import type { RequestHandler } from "express";
import { log } from "../utils/logger";

export const requestLoggerMiddleware: RequestHandler = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    log("info", "http_request", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
};

