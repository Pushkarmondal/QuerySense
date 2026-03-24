import { prisma } from "../../db/prismaConnection";

const DISALLOWED_SQL = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy)\b/i;

export const rawQuery = async (query: string) => {
  const trimmed = query.trim().replace(/;+\s*$/, "");

  if (!trimmed) {
    throw new Error("Query is required.");
  }

  // Guardrail for MVP: only allow read-only SELECT statements.
  if (!/^select\b/i.test(trimmed) || DISALLOWED_SQL.test(trimmed)) {
    throw new Error("Only read-only SELECT queries are allowed.");
  }

  const explainSql = `EXPLAIN (ANALYZE, FORMAT JSON) ${trimmed}`;
  return prisma.$queryRawUnsafe(explainSql);
};