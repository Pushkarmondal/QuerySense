import express from "express";
import { prisma } from "./db/prismaConnection";
import healthRoutes from "./src/routes/health.routes";
import tenantsRoutes from "./src/routes/tenants.routes";
import queryExplainRoutes from "./src/routes/queryExplain.routes";
import queryExplainStoreRoutes from "./src/routes/queryExplainStore.routes";
import queryTemplatesTopRoutes from "./src/routes/queryTemplatesTop.routes";
import collectorEnqueueRoutes from "./src/routes/collectorEnqueue.routes";
import collectorRoutes from "./src/routes/collector.routes";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

//Routes
app.use(healthRoutes);
app.use(tenantsRoutes);
app.use(queryExplainRoutes);
app.use(queryExplainStoreRoutes);
app.use(queryTemplatesTopRoutes);
app.use(collectorEnqueueRoutes);
app.use(collectorRoutes);

const server = app.listen(port, () => {
  console.log(`QuerySense API listening on port ${port}`);
});
