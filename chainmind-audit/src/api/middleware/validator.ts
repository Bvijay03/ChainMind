import { Request, Response, NextFunction } from "express";

export function validateTxHashQuery(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const txHash = req.query.tx_hash as string;

  if (!txHash) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Missing required query parameter: 'tx_hash'",
      },
    });
    return;
  }

  // Check 0x-prefixed hex string
  const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
  if (!txHashRegex.test(txHash)) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid tx_hash format. Must be a 0x-prefixed 64-character hexadecimal string.",
      },
    });
    return;
  }

  next();
}
