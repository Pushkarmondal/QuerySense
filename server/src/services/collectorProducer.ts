import { CollectorStatus } from "../../generated/prisma/client";
import { Client } from "pg";
import { prisma } from "../../db/prismaConnection";
import { collectorQueue } from "../queue/collectorQueue";

type SlowQueryRow = {
  query: string;
  calls: string | number;
  total_exec_time?: string | number;
  total_time?: string | number;
};

const getCollectorTopN = (): number => {
  const parsed = Number.parseInt(process.env.COLLECTOR_TOP_N ?? "10", 10);
  if (Number.isNaN(parsed)) return 10;
  return Math.max(1, Math.min(parsed, 100));
};

const getCollectorMinCalls = (): number => {
  const parsed = Number.parseInt(process.env.COLLECTOR_MIN_CALLS ?? "1", 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.max(1, parsed);
};

const fetchTopQueriesFromStatStatements = async (
  connectionString: string,
  dbName: string,
  topN: number,
  minCalls: number,
): Promise<string[]> => {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    const extensionCheck = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') AS exists",
    );
    if (!extensionCheck.rows[0]?.exists) {
      throw new Error("pg_stat_statements extension is not enabled.");
    }

    const columnCheck = await client.query<{ has_total_exec_time: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pg_stat_statements'
          AND column_name = 'total_exec_time'
      ) AS has_total_exec_time
      `,
    );
    const hasTotalExecTime = columnCheck.rows[0]?.has_total_exec_time ?? false;
    const totalTimeColumn = hasTotalExecTime ? "total_exec_time" : "total_time";

    const result = await client.query<SlowQueryRow>(
      `
      SELECT
        query,
        calls,
        ${totalTimeColumn}
      FROM pg_stat_statements
      WHERE dbid = (SELECT oid FROM pg_database WHERE datname = $1)
        AND calls >= $2
        AND query ILIKE 'select %'
      ORDER BY (${totalTimeColumn} * calls) DESC
      LIMIT $3
      `,
      [dbName, minCalls, topN],
    );

    return result.rows
      .map((row) => row.query.trim())
      .filter(Boolean);
  } finally {
    await client.end();
  }
};

const minuteBucket = () => new Date().toISOString().slice(0, 16);

export const runCollectorCycle = async (): Promise<{
  tenantsProcessed: number;
  jobsEnqueued: number;
}> => {
  const tenants = await prisma.tenant.findMany({
    where: { active: true },
    select: { id: true, replicaUrl: true, dbName: true },
  });

  const topN = getCollectorTopN();
  const minCalls = getCollectorMinCalls();
  let jobsEnqueued = 0;

  for (const tenant of tenants) {
    const started = Date.now();
    let status: CollectorStatus = CollectorStatus.SUCCESS;
    let errorMessage: string | null = null;
    let queriesSeen = 0;
    let queriesEnqueued = 0;

    try {
      if (!tenant.replicaUrl) {
        throw new Error("Tenant replicaUrl is missing.");
      }

      const queries = await fetchTopQueriesFromStatStatements(
        tenant.replicaUrl,
        tenant.dbName,
        topN,
        minCalls,
      );
      queriesSeen = queries.length;

      for (let i = 0; i < queries.length; i += 1) {
        const query = queries[i];
        const jobId = `${tenant.id}:${i}:${minuteBucket()}`;
        await collectorQueue.add(
          "collectAndStore",
          { tenantId: tenant.id, query },
          {
            jobId,
            removeOnComplete: true,
            attempts: 3,
            backoff: { type: "exponential", delay: 1000 },
          },
        );
        queriesEnqueued += 1;
        jobsEnqueued += 1;
      }
    } catch (error) {
      status =
        queriesEnqueued > 0 ? CollectorStatus.PARTIAL : CollectorStatus.FAILED;
      errorMessage = error instanceof Error ? error.message : "Unknown error";
    } finally {
      await prisma.collectorRun.create({
        data: {
          tenantId: tenant.id,
          status,
          queriesSeen,
          queriesEnqueued,
          errorMessage,
          durationMs: Date.now() - started,
        },
      });
    }
  }

  return {
    tenantsProcessed: tenants.length,
    jobsEnqueued,
  };
};

