import { createHash, randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "./db.js";
import { env } from "./env.js";

const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Issue a short-lived access JWT and a rotating refresh token, both as httpOnly cookies. */
export async function startSession(res: Response, userId: string): Promise<void> {
  const refresh = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { userId, tokenHash: sha256(refresh), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  setAccess(res, userId);
  res.cookie(REFRESH_COOKIE, refresh, {
    ...cookieBase,
    path: "/api/auth",
    maxAge: REFRESH_TTL_MS,
  });
}

function setAccess(res: Response, userId: string): void {
  const token = jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: ACCESS_TTL_S });
  res.cookie(ACCESS_COOKIE, token, { ...cookieBase, path: "/", maxAge: ACCESS_TTL_S * 1000 });
}

/** Swap a valid refresh token for a new pair; the old one is single-use. */
export async function rotateSession(res: Response, refresh: string | undefined): Promise<boolean> {
  if (!refresh) return false;
  const session = await db.session.findUnique({ where: { tokenHash: sha256(refresh) } });
  if (!session) return false;
  await db.session.delete({ where: { id: session.id } });
  if (session.expiresAt < new Date()) return false;
  await startSession(res, session.userId);
  return true;
}

export async function endSession(res: Response, refresh: string | undefined): Promise<void> {
  if (refresh) await db.session.deleteMany({ where: { tokenHash: sha256(refresh) } });
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase, path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase, path: "/api/auth" });
}

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.[ACCESS_COOKIE];
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Not authenticated" });
  }
}
