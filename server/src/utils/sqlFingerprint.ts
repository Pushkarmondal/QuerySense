import crypto from "crypto";

const stripComments = (sql: string): string =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ");

export const normalizeSql = (sql: string): string => {
  const noComments = stripComments(sql);

  return noComments
    .replace(/'(?:''|[^'])*'/g, "?")
    .replace(/\b\d+(?:\.\d+)?\b/g, "?")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

export const fingerprintSql = (normalizedSql: string): string =>
  crypto.createHash("sha256").update(normalizedSql).digest("hex").slice(0, 64);

