import type { RequestHandler } from "express";

const OPEN_PATHS = new Set(["/health"]);

export const authMiddleware: RequestHandler = (req, res, next) => {
  if (OPEN_PATHS.has(req.path)) {
    next();
    return;
  }

  const configuredApiKey = process.env.API_KEY;
  if (!configuredApiKey) {
    res.status(500).json({ error: "Server auth misconfigured: API_KEY is missing." });
    return;
  }

  const providedApiKey = req.header("x-api-key");
  if (!providedApiKey || providedApiKey !== configuredApiKey) {
    res.status(401).json({ error: "Unauthorized: invalid API key." });
    return;
  }

  const tenantHeader = req.header("x-tenant-id");
  if (tenantHeader) {
    const bodyTenantId = typeof req.body?.tenantId === "string" ? req.body.tenantId : undefined;
    const queryTenantId =
      typeof req.query?.tenantId === "string" ? req.query.tenantId : undefined;

    const mismatchedBody = bodyTenantId && bodyTenantId !== tenantHeader;
    const mismatchedQuery = queryTenantId && queryTenantId !== tenantHeader;
    if (mismatchedBody || mismatchedQuery) {
      res.status(403).json({ error: "Forbidden: tenant scope mismatch." });
      return;
    }
  }

  next();
};

