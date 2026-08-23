import express, { Express } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { EventRepository } from "../storage/event-repository.js";
import { ReconRepository } from "../storage/recon-repository.js";
import { createReconciliationRouter } from "./routes/reconciliation.js";
import { errorHandler } from "./middleware/error-handler.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer(
  eventRepo: EventRepository,
  reconRepo: ReconRepository
): Express {
  const app = express();

  // Standard middleware
  app.use(cors());
  app.use(express.json());

  // Serve static UI dashboard files
  const publicDir = path.resolve(__dirname, "../../public");
  app.use(express.static(publicDir));

  // Rate limiter (exempt static files and health check)
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
  app.use("/api", limiter);

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
