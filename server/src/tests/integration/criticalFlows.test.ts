import { describe, expect, it } from "bun:test";

const RUN_LIVE = process.env.RUN_LIVE_INTEGRATION === "true";
const BASE_URL = process.env.INTEGRATION_BASE_URL ?? "http://localhost:3000";
const API_KEY = process.env.API_KEY ?? "";

const headers = {
  "Content-Type": "application/json",
  "x-api-key": API_KEY,
};

const maybeIt = RUN_LIVE ? it : it.skip;

describe("critical integration flows", () => {
  maybeIt("collect -> enqueue -> worker -> store", async () => {
    const tenantRes = await fetch(`${BASE_URL}/tenants`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: `integration-${Date.now()}`,
        dbHost: "localhost",
        dbName: "querysense",
        replicaUrl: process.env.DATABASE_URL,
        active: true,
      }),
    });
    expect(tenantRes.ok).toBeTrue();
    const tenant = (await tenantRes.json()) as { id: string };

    const enqueueRes = await fetch(`${BASE_URL}/collector/enqueue`, {
      method: "POST",
      headers: {
        ...headers,
        "x-tenant-id": tenant.id,
      },
      body: JSON.stringify({
        tenantId: tenant.id,
        query: "SELECT 1",
      }),
    });
    expect(enqueueRes.status).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const topRes = await fetch(
      `${BASE_URL}/query/templates/top?tenantId=${tenant.id}&limit=5`,
      {
        method: "GET",
        headers: {
          ...headers,
          "x-tenant-id": tenant.id,
        },
      },
    );
    expect(topRes.ok).toBeTrue();
    const payload = (await topRes.json()) as { templates: unknown[] };
    expect(payload.templates.length).toBeGreaterThan(0);
  });

  maybeIt("generate -> validate -> feedback", async () => {
    const tenantRes = await fetch(`${BASE_URL}/tenants`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: `integration-rec-${Date.now()}`,
        dbHost: "localhost",
        dbName: "querysense",
        replicaUrl: process.env.DATABASE_URL,
        active: true,
      }),
    });
    expect(tenantRes.ok).toBeTrue();
    const tenant = (await tenantRes.json()) as { id: string };

    const storeRes = await fetch(`${BASE_URL}/query/explain/store`, {
      method: "POST",
      headers: {
        ...headers,
        "x-tenant-id": tenant.id,
      },
      body: JSON.stringify({
        tenantId: tenant.id,
        query: "SELECT 1",
      }),
    });
    expect(storeRes.ok).toBeTrue();
    const stored = (await storeRes.json()) as { templateId: string };

    const genRes = await fetch(`${BASE_URL}/recommendations/generate`, {
      method: "POST",
      headers: {
        ...headers,
        "x-tenant-id": tenant.id,
      },
      body: JSON.stringify({
        tenantId: tenant.id,
        templateId: stored.templateId,
      }),
    });
    expect(genRes.ok).toBeTrue();
    const generated = (await genRes.json()) as {
      recommendation?: { id?: string };
    };
    const recommendationId = generated.recommendation?.id;
    expect(!!recommendationId).toBeTrue();

    const feedbackRes = await fetch(
      `${BASE_URL}/recommendations/${recommendationId}/feedback`,
      {
        method: "POST",
        headers: {
          ...headers,
          "x-tenant-id": tenant.id,
        },
        body: JSON.stringify({
          outcome: "ACCEPTED",
          actualSavingsPct: 10,
          notes: "integration test",
        }),
      },
    );
    expect(feedbackRes.ok).toBeTrue();
  });
});

