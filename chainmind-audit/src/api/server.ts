import express, { Express } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { EventRepository } from "../storage/event-repository.js";
import { ReconRepository } from "../storage/recon-repository.js";
import { createReconciliationRouter } from "./routes/reconciliation.js";
import { errorHandler } from "./middleware/error-handler.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export function createServer(
  eventRepo: EventRepository,
  reconRepo: ReconRepository
): Express {
  const app = express();

  // Standard middleware
  app.use(cors());
  app.use(express.json());

  // Rate limiter
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: config.apiRateLimitPerMin,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please try again later.",
      },
    },
  });
  app.use(limiter);

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "ChainMind Audit",
    });
  });

  // Mount API v1 router
  app.use(
    "/api/v1/reconciliation",
    createReconciliationRouter(eventRepo, reconRepo)
  );

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
