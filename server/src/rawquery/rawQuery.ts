import { prisma } from "../../db/prismaConnection";

const DISALLOWED_SQL = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy)\b/i;
const MULTI_STATEMENT = /;[\s\S]*\S/;
const SQL_COMMENT = /(--|\/\*)/;

export const assertSafeReadOnlyQuery = (query: string): string => {
  const trimmed = query.trim().replace(/;+\s*$/, "");
  if (!trimmed) {
    throw new Error("Query is required.");
  }
  if (!/^select\b/i.test(trimmed) || DISALLOWED_SQL.test(trimmed)) {
    throw new Error("Only read-only SELECT queries are allowed.");
  }
  if (MULTI_STATEMENT.test(trimmed)) {
    throw new Error("Only single-statement queries are allowed.");
  }
  if (SQL_COMMENT.test(trimmed)) {
    throw new Error("SQL comments are not allowed.");
  }
  return trimmed;
};

type ExplainNode = {
  "Node Type"?: string;
  "Startup Cost"?: number;
  "Total Cost"?: number;
  "Plan Rows"?: number;
  "Actual Rows"?: number;
  Plans?: ExplainNode[];
};

type ExplainEnvelope = {
  Plan?: ExplainNode;
  "Planning Time"?: number;
  "Execution Time"?: number;
};

export type ParsedExplainPlan = {
  planJson: ExplainEnvelope;
  estimatedCost: number;
  actualDurationMs: number;
  planningTimeMs: number;
  hasSeqScan: boolean;
  hasHashJoin: boolean;
  hasNestedLoop: boolean;
  rowsEstimate: number;
  rowsActual: number;
  rowsEstimateErr: number;
};

export const rawQuery = async (query: string) => {
  const trimmed = assertSafeReadOnlyQuery(query);

  const explainSql = `EXPLAIN (ANALYZE, FORMAT JSON) ${trimmed}`;
  return prisma.$queryRawUnsafe(explainSql);
};

const walkPlan = (
  node: ExplainNode | undefined,
  visitor: (current: ExplainNode) => void,
): void => {
  if (!node) return;
  visitor(node);
  for (const child of node.Plans ?? []) {
    walkPlan(child, visitor);
  }
};

export const parseExplainResult = (rawResult: unknown): ParsedExplainPlan => {
  const rows = Array.isArray(rawResult) ? rawResult : [];
  const firstRow = rows[0] as Record<string, unknown> | undefined;
  const queryPlan = firstRow?.["QUERY PLAN"];

  if (!Array.isArray(queryPlan) || queryPlan.length === 0) {
    throw new Error("Unexpected EXPLAIN result format.");
  }

  const envelope = queryPlan[0] as ExplainEnvelope;
  const root = envelope.Plan;
  if (!root) {
    throw new Error("EXPLAIN output missing root plan node.");
  }

  let hasSeqScan = false;
  let hasHashJoin = false;
  let hasNestedLoop = false;

  walkPlan(root, (node) => {
    const nodeType = node["Node Type"] ?? "";
    if (nodeType === "Seq Scan") hasSeqScan = true;
    if (nodeType === "Hash Join") hasHashJoin = true;
    if (nodeType === "Nested Loop") hasNestedLoop = true;
  });

  const rowsEstimate = root["Plan Rows"] ?? 0;
  const rowsActual = root["Actual Rows"] ?? 0;
  const rowsEstimateErr =
    rowsEstimate > 0 ? Math.abs(rowsActual - rowsEstimate) / rowsEstimate : 0;

  return {
    planJson: envelope,
    estimatedCost: root["Total Cost"] ?? root["Startup Cost"] ?? 0,
    actualDurationMs: envelope["Execution Time"] ?? 0,
    planningTimeMs: envelope["Planning Time"] ?? 0,
    hasSeqScan,
    hasHashJoin,
    hasNestedLoop,
    rowsEstimate,
    rowsActual,
    rowsEstimateErr,
  };
};