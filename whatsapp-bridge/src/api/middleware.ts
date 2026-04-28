import { Request, Response, NextFunction } from "express";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET || "change-me-whatsapp-secret";

export function requireBridgeSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = req.headers["x-bridge-secret"];
  if (secret !== BRIDGE_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
