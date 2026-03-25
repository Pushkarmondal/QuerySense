import express from "express";
import { prisma } from "../../db/prismaConnection";

const router = express.Router();

router.post("/tenants", async (req, res) => {
  const { name, dbHost, dbName, replicaUrl, active } = req.body ?? {};

  if (typeof name !== "string" || typeof dbHost !== "string" || typeof dbName !== "string") {
    return res.status(400).json({
      error: "Body must include `name`, `dbHost`, and `dbName` as strings.",
    });
  }

  try {
    const tenant = await prisma.tenant.create({
      data: {
        name,
        dbHost,
        dbName,
        replicaUrl: typeof replicaUrl === "string" ? replicaUrl : null,
        active: typeof active === "boolean" ? active : true,
      },
    });
    return res.status(201).json(tenant);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});

export default router;

