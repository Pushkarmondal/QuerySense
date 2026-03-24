-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'VALIDATED', 'DELIVERED', 'ACCEPTED', 'REJECTED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'ERROR');

-- CreateEnum
CREATE TYPE "FeedbackOutcome" AS ENUM ('ACCEPTED', 'REJECTED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "CollectorStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "db_host" VARCHAR(255) NOT NULL,
    "db_name" VARCHAR(255) NOT NULL,
    "replica_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "fingerprint_hash" VARCHAR(64) NOT NULL,
    "normalized_sql" TEXT NOT NULL,
    "raw_sql_sample" TEXT NOT NULL,
    "tables" JSONB,
    "columns" JSONB,
    "total_calls" BIGINT NOT NULL DEFAULT 0,
    "total_time_ms" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mean_time_ms" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "min_time_ms" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_time_ms" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rows" BIGINT NOT NULL DEFAULT 0,
    "shared_blks_hit" BIGINT NOT NULL DEFAULT 0,
    "shared_blks_read" BIGINT NOT NULL DEFAULT 0,
    "impact_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "query_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "explain_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "plan_json" JSONB NOT NULL,
    "estimated_cost" DOUBLE PRECISION NOT NULL,
    "actual_duration_ms" DOUBLE PRECISION NOT NULL,
    "planning_time_ms" DOUBLE PRECISION NOT NULL,
    "has_seq_scan" BOOLEAN NOT NULL DEFAULT false,
    "has_hash_join" BOOLEAN NOT NULL DEFAULT false,
    "has_nested_loop" BOOLEAN NOT NULL DEFAULT false,
    "rows_estimate" BIGINT NOT NULL,
    "rows_actual" BIGINT NOT NULL,
    "rows_estimate_err" DOUBLE PRECISION NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "explain_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "llm_model" VARCHAR(100) NOT NULL,
    "rewrite_sql" TEXT,
    "index_ddl" TEXT,
    "llm_explanation" TEXT NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recommendation_id" UUID NOT NULL,
    "status" "ValidationStatus" NOT NULL DEFAULT 'PENDING',
    "baseline_duration_ms" DOUBLE PRECISION,
    "proposed_duration_ms" DOUBLE PRECISION,
    "savings_pct" DOUBLE PRECISION,
    "confidence_score" DOUBLE PRECISION,
    "error_message" TEXT,
    "replica_used" VARCHAR(255),
    "ran_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recommendation_id" UUID NOT NULL,
    "outcome" "FeedbackOutcome" NOT NULL,
    "actual_savings_pct" DOUBLE PRECISION,
    "notes" TEXT,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collector_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "status" "CollectorStatus" NOT NULL,
    "queries_seen" INTEGER NOT NULL DEFAULT 0,
    "queries_enqueued" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "ran_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collector_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "query_templates_tenant_id_impact_score_idx" ON "query_templates"("tenant_id", "impact_score" DESC);

-- CreateIndex
CREATE INDEX "query_templates_tenant_id_last_seen_at_idx" ON "query_templates"("tenant_id", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "query_templates_tenant_id_fingerprint_hash_key" ON "query_templates"("tenant_id", "fingerprint_hash");

-- CreateIndex
CREATE INDEX "explain_plans_template_id_captured_at_idx" ON "explain_plans"("template_id", "captured_at");

-- CreateIndex
CREATE INDEX "recommendations_tenant_id_status_idx" ON "recommendations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "recommendations_template_id_version_idx" ON "recommendations"("template_id", "version");

-- CreateIndex
CREATE INDEX "validation_runs_recommendation_id_ran_at_idx" ON "validation_runs"("recommendation_id", "ran_at");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_recommendation_id_key" ON "feedback"("recommendation_id");

-- CreateIndex
CREATE INDEX "collector_runs_tenant_id_ran_at_idx" ON "collector_runs"("tenant_id", "ran_at");

-- AddForeignKey
ALTER TABLE "query_templates" ADD CONSTRAINT "query_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "explain_plans" ADD CONSTRAINT "explain_plans_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "query_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "query_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collector_runs" ADD CONSTRAINT "collector_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
