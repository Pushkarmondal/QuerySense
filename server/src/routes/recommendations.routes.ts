import express from "express";
import { FeedbackOutcome, RecommendationStatus } from "../../generated/prisma/client";
import { prisma } from "../../db/prismaConnection";
import {
  generateAndValidateRecommendation,
  validateRecommendationById,
} from "../services/recommendationEngine.ts";

const router = express.Router();

router.post("/recommendations/generate", async (req, res) => {
  const { tenantId, templateId } = req.body ?? {};
  if (typeof tenantId !== "string") {
    return res.status(400).json({ error: "Body must include `tenantId` as string." });
  }

  try {
    const result = await generateAndValidateRecommendation({
      tenantId,
      templateId: typeof templateId === "string" ? templateId : undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});

router.post("/recommendations/:id/validate", async (req, res) => {
  try {
    const validationRun = await validateRecommendationById(req.params.id);
    return res.status(200).json({ validationRun });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});

router.post("/recommendations/:id/feedback", async (req, res) => {
  const { outcome, actualSavingsPct, notes, appliedAt } = req.body ?? {};
  if (
    outcome !== FeedbackOutcome.ACCEPTED &&
    outcome !== FeedbackOutcome.REJECTED &&
    outcome !== FeedbackOutcome.DEFERRED
  ) {
    return res.status(400).json({
      error: "Body must include `outcome` as ACCEPTED | REJECTED | DEFERRED.",
    });
  }

  try {
    const recommendation = await prisma.recommendation.findUnique({
      where: { id: req.params.id },
    });
    if (!recommendation) {
      return res.status(404).json({ error: "Recommendation not found." });
    }

    const feedback = await prisma.feedback.upsert({
      where: { recommendationId: req.params.id },
      create: {
        recommendationId: req.params.id,
        outcome,
        actualSavingsPct:
          typeof actualSavingsPct === "number" ? actualSavingsPct : null,
        notes: typeof notes === "string" ? notes : null,
        appliedAt:
          typeof appliedAt === "string" ? new Date(appliedAt) : new Date(),
      },
      update: {
        outcome,
        actualSavingsPct:
          typeof actualSavingsPct === "number" ? actualSavingsPct : null,
        notes: typeof notes === "string" ? notes : null,
        appliedAt:
          typeof appliedAt === "string" ? new Date(appliedAt) : new Date(),
      },
    });

    const mappedStatus =
      outcome === FeedbackOutcome.ACCEPTED
        ? RecommendationStatus.ACCEPTED
        : outcome === FeedbackOutcome.REJECTED
          ? RecommendationStatus.REJECTED
          : RecommendationStatus.DEFERRED;

    const updatedRecommendation = await prisma.recommendation.update({
      where: { id: req.params.id },
      data: { status: mappedStatus },
    });

    return res.status(200).json({ feedback, recommendation: updatedRecommendation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});

router.get("/recommendations", async (req, res) => {
  const tenantId = req.query.tenantId;
  if (typeof tenantId !== "string" || tenantId.trim() === "") {
    return res.status(400).json({ error: "Query param `tenantId` is required." });
  }

  try {
    const recommendations = await prisma.recommendation.findMany({
      where: { tenantId },
      include: {
        validationRuns: { orderBy: { ranAt: "desc" }, take: 1 },
        feedback: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return res.status(200).json({ recommendations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});

export default router;

