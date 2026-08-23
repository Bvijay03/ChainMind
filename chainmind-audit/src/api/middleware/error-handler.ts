import { Request, Response, NextFunction } from "express";
import { logger } from "../../utils/logger.js";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error({ err: err.message, stack: err.stack, path: req.path }, "Unhandled API Error");

  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_ERROR",
      message: err.message || "An unexpected internal server error occurred.",
    },
  });
}
