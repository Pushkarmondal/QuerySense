import express from "express";
import { parseExplainResult, rawQuery } from "../rawquery/rawQuery";

const router = express.Router();

router.post("/query/explain", async (req, res) => {
  const sql = req.body?.query;
  if (typeof sql !== "string") {
    return res.status(400).json({
      error: "Body must include `query` as a string.",
    });
  }

  try {
    const rawPlan = await rawQuery(sql);
    const parsedPlan = parseExplainResult(rawPlan);
    return res.status(200).json(parsedPlan);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});

export default router;

