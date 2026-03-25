import crypto from "crypto";
import { prisma } from "../../db/prismaConnection";
import { parseExplainResult, rawQuery, type ParsedExplainPlan } from "../rawquery/rawQuery";

export type StoreQueryExplainInput = {
  tenantId: string;
  query: string;
};

export type StoreQueryExplainResult = {
  templateId: string;
  explainPlanId: string;
  parsed: ParsedExplainPlan;
};

export const storeQueryExplain = async (
  input: StoreQueryExplainInput,
): Promise<StoreQueryExplainResult> => {
  const tenantId = input.tenantId;
  const query = input.query;

  const normalizedSql = query.trim(); // TODO: replace with literal-normalization (strip literals -> canonical form)
  const rawSqlSample = query.trim();

  const fingerprintHash = crypto
    .createHash("sha256")
    .update(normalizedSql)
    .digest("hex")
    .slice(0, 64); // matches schema length

  const rawPlan = await rawQuery(rawSqlSample);
  const parsed = parseExplainResult(rawPlan);

  const templateWhere = {
    tenantId_fingerprintHash: {
      tenantId,
      fingerprintHash,
    },
  };

  const existing = await prisma.queryTemplate.findUnique({
    where: templateWhere,
  });

  const explainPlan = await prisma.$transaction(async (tx) => {
    let templateId: string;

    if (!existing) {
      const rowsActual = BigInt(Math.trunc(parsed.rowsActual));
      const totalCalls = 1n;

      const created = await tx.queryTemplate.create({
        data: {
          tenantId,
          fingerprintHash,
          normalizedSql,
          rawSqlSample,
          totalCalls,
          totalTimeMs: parsed.actualDurationMs,
          meanTimeMs: parsed.actualDurationMs,
          minTimeMs: parsed.actualDurationMs,
          maxTimeMs: parsed.actualDurationMs,
          rows: rowsActual,
          impactScore: parsed.actualDurationMs, // TODO: update formula once we track frequency better
        },
      });

      templateId = created.id;
    } else {
      const newTotalCalls = existing.totalCalls + 1n;
      const newTotalTimeMs = existing.totalTimeMs + parsed.actualDurationMs;
      const newMeanTimeMs = newTotalTimeMs / Number(newTotalCalls);
      const newMinTimeMs = Math.min(existing.minTimeMs, parsed.actualDurationMs);
      const newMaxTimeMs = Math.max(existing.maxTimeMs, parsed.actualDurationMs);
      const newRows = existing.rows + BigInt(Math.trunc(parsed.rowsActual));
      const newImpactScore = newMeanTimeMs * Number(newTotalCalls);

      const updated = await tx.queryTemplate.update({
        where: { id: existing.id },
        data: {
          normalizedSql,
          rawSqlSample,
          totalCalls: newTotalCalls,
          totalTimeMs: newTotalTimeMs,
          meanTimeMs: newMeanTimeMs,
          minTimeMs: newMinTimeMs,
          maxTimeMs: newMaxTimeMs,
          rows: newRows,
          impactScore: newImpactScore,
        },
      });

      templateId = updated.id;
    }

    const createdExplainPlan = await tx.explainPlan.create({
      data: {
        templateId,
        planJson: parsed.planJson,
        estimatedCost: parsed.estimatedCost,
        actualDurationMs: parsed.actualDurationMs,
        planningTimeMs: parsed.planningTimeMs,
        hasSeqScan: parsed.hasSeqScan,
        hasHashJoin: parsed.hasHashJoin,
        hasNestedLoop: parsed.hasNestedLoop,
        rowsEstimate: BigInt(Math.trunc(parsed.rowsEstimate)),
        rowsActual: BigInt(Math.trunc(parsed.rowsActual)),
        rowsEstimateErr: parsed.rowsEstimateErr,
      },
    });

    return createdExplainPlan;
  });

  return {
    templateId: explainPlan.templateId,
    explainPlanId: explainPlan.id,
    parsed,
  };
};

