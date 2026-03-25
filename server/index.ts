import express from "express";
import { prisma } from "./db/prismaConnection";
import healthRoutes from "./src/routes/health.routes";
import tenantsRoutes from "./src/routes/tenants.routes";
import queryExplainRoutes from "./src/routes/queryExplain.routes";
import queryExplainStoreRoutes from "./src/routes/queryExplainStore.routes";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

//Routes
app.use(healthRoutes);
app.use(tenantsRoutes);
app.use(queryExplainRoutes);
app.use(queryExplainStoreRoutes);

const server = app.listen(port, () => {
  console.log(`QuerySense API listening on port ${port}`);
});
