import express from "express";
import { prisma } from "./db/prismaConnection";
import { authMiddleware } from "./src/middleware/auth";
import { requestLoggerMiddleware } from "./src/middleware/requestLogger";
import healthRoutes from "./src/routes/health.routes";
import tenantsRoutes from "./src/routes/tenants.routes";
import queryExplainRoutes from "./src/routes/queryExplain.routes";
import queryExplainStoreRoutes from "./src/routes/queryExplainStore.routes";
import queryTemplatesTopRoutes from "./src/routes/queryTemplatesTop.routes";
import collectorEnqueueRoutes from "./src/routes/collectorEnqueue.routes";
import collectorRoutes from "./src/routes/collector.routes";
import recommendationsRoutes from "./src/routes/recommendations.routes";
import opsRoutes from "./src/routes/ops.routes";

export const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());
app.use(requestLoggerMiddleware);
app.use(authMiddleware);

//Routes
app.use(healthRoutes);
app.use(tenantsRoutes);
app.use(queryExplainRoutes);
app.use(queryExplainStoreRoutes);
app.use(queryTemplatesTopRoutes);
app.use(collectorEnqueueRoutes);
app.use(collectorRoutes);
app.use(recommendationsRoutes);
app.use(opsRoutes);

if (import.meta.main) {
  const server = app.listen(port, () => {
    console.log(`QuerySense API listening on port ${port}`);
  });

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      try {
        await prisma.$disconnect();
        process.exit(0);
      } catch {
        process.exit(1);
      }
    });
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
