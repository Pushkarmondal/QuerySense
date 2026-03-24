# QuerySense — AI-Powered Database Query Optimizer

## The Problem

Every production database accumulates slow queries over time. Tools like `pg_stat_statements` or DataDog tell you *which* queries are slow — but not *why*, and certainly not *how to fix them*. Engineers spend hours manually reading `EXPLAIN` plans, guessing at indexes, and hoping rewrites don't break things in production.

## What QuerySense Does

QuerySense watches your database's slow query log continuously, identifies the queries with the highest real-world cost (`total_time × frequency`), analyzes their execution plans to pinpoint the bottleneck, and uses an LLM to propose a concrete fix — a new index or a rewritten query. Every suggestion is replica-tested before you ever see it, so what you get isn't a guess. It's a validated recommendation with a before/after execution time and the exact SQL to run.

You go from "the app is slow" to "run this index, it cuts that query from 800ms to 12ms" — automatically.

## What It Is Not

QuerySense is not a monitoring dashboard, not a chatbot, and not another APM tool that shows you the same slow query list you already have. It is an action engine: its only output is vetted, ready-to-apply fixes — prioritized by the ones that will save you the most time first.

## How It Works

A lightweight collector agent taps `pg_stat_statements` and enqueues query data into a processing pipeline. Each query is normalized (stripping literal values so structural duplicates collapse into one pattern), then scored by impact (`total_time × call_count`) so the system always works on what matters most. The top patterns are run through `EXPLAIN ANALYZE` on a read-only replica to understand the bottleneck. An LLM receives the query, the execution plan, and your schema, and returns a proposed fix — index DDL or a rewritten query. That fix is executed on the replica, timed, and only surfaced if it demonstrably improves performance. Accepted and rejected recommendations feed back into the system over time.

## Architecture

```
  Your Database (pg_stat_statements)
          │
          │ poll every 60s
          ▼
  ┌───────────────────┐
  │  Collector Agent  │  Node.js daemon · node-cron · pg
  └─────────┬─────────┘
            │ enqueue raw queries
            ▼
  ┌───────────────────┐
  │      BullMQ       │  Job queue · Redis
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │    Normalizer     │  pgsql-parser · SHA-256 fingerprint
  │                   │  strips literals → canonical form
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │   Impact Scorer   │  total_time × call_count
  │                   │  ranks by highest real-world cost
  └─────────┬─────────┘
            │ top-N patterns only
            ▼
  ┌───────────────────┐
  │  EXPLAIN Analyzer │  EXPLAIN ANALYZE on read replica
  │                   │  extracts: cost · seq scans · joins
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │   LLM Rewrite     │  OpenAI / Anthropic compatible
  │   Engine          │  input:  SQL + plan + schema
  │                   │  output: index DDL + rewritten query
  └─────────┬─────────┘
            │ candidate fix
            ▼
  ┌───────────────────┐
  │   Validation      │  runs fix on read replica
  │   Engine          │  measures actual before/after time
  │   (replica-tested)│  rejects if no real improvement
  └─────────┬─────────┘
            │ validated fix + confidence score
            ▼
  ┌───────────────────┐
  │   Fastify API     │  REST + webhooks
  │                   │  delivers: SQL to run · time saved · confidence
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │   Feedback Loop   │  accepted / rejected → re-ranks future fixes
  │                   │  system improves with every decision
  └───────────────────┘
```

## Tech Stack

Node.js · TypeScript · Fastify · BullMQ · Redis · PostgreSQL · Prisma ORM · LLM-agnostic (OpenAI / Anthropic compatible) · Zod · Docker