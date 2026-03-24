import express from "express";
import { prisma } from "./db/prismaConnection";
import { rawQuery } from "./src/rawquery/rawQuery";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: "ok",
      service: "querysense-server",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(503).json({
      status: "degraded",
      service: "querysense-server",
      database: "disconnected",
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.post("/query/explain", async (req, res) => {
  const sql = req.body?.query;
  if (typeof sql !== "string") {
    return res.status(400).json({
      error: "Body must include `query` as a string.",
    });
  }

  try {
    const plan = await rawQuery(sql);
    return res.status(200).json({ plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});

const server = app.listen(port, () => {
  console.log(`QuerySense API listening on port ${port}`);
});