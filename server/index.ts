import express from "express";
import { prisma } from "./db/prismaConnection";

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

const server = app.listen(port, () => {
  console.log(`QuerySense API listening on port ${port}`);
});