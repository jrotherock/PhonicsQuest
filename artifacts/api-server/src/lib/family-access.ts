import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const familyAccessCookie = "phonics_quest_family_access";
const cookieMaxAgeSeconds = 60 * 60 * 24 * 30;
const maxFailedAttempts = 5;
const lockoutMilliseconds = 15 * 60 * 1000;

type FailedAttempt = {
  count: number;
  blockedUntil: number;
};

const failedAttempts = new Map<string, FailedAttempt>();

function configuration() {
  const code = process.env.FAMILY_ACCESS_CODE;
  const sessionSecret = process.env.SESSION_SECRET;
  return code && sessionSecret ? { code, sessionSecret } : null;
}

function digest(value: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(value).digest();
}

function matches(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function cookieValue(request: Request): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  const entry = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${familyAccessCookie}=`));
  return entry ? entry.slice(familyAccessCookie.length + 1) : null;
}

function clientKey(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}

export function familyAccessIsConfigured(): boolean {
  return configuration() !== null;
}

export function hasFamilyAccess(request: Request): boolean {
  const config = configuration();
  const token = cookieValue(request);
  if (!config || !token) return false;
  let presented: Buffer;
  try {
    presented = Buffer.from(token, "base64url");
  } catch {
    return false;
  }
  return matches(
    presented,
    digest(config.code, config.sessionSecret),
  );
}

export function attemptFamilyAccess(
  request: Request,
  code: string,
): { ok: true } | { ok: false; status: 401 | 429 | 503 } {
  const config = configuration();
  if (!config) return { ok: false, status: 503 };

  const key = clientKey(request);
  const now = Date.now();
  const previous = failedAttempts.get(key);
  if (matches(digest(code, config.sessionSecret), digest(config.code, config.sessionSecret))) {
    failedAttempts.delete(key);
    return { ok: true };
  }
  if (previous && previous.blockedUntil > now) {
    return { ok: false, status: 429 };
  }
  if (previous && previous.blockedUntil <= now) {
    failedAttempts.delete(key);
  }

  const count = (previous?.count ?? 0) + 1;
  failedAttempts.set(key, {
    count,
    blockedUntil: count >= maxFailedAttempts ? now + lockoutMilliseconds : 0,
  });
  return { ok: false, status: count >= maxFailedAttempts ? 429 : 401 };
}

export function setFamilyAccessCookie(response: Response): void {
  const config = configuration();
  if (!config) return;
  const token = digest(config.code, config.sessionSecret).toString("base64url");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${familyAccessCookie}=${token}; Path=/; Max-Age=${cookieMaxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`,
  );
}

export function requireFamilyAccess(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (!familyAccessIsConfigured()) {
    response.status(503).json({ error: "Family access is not configured" });
    return;
  }
  if (!hasFamilyAccess(request)) {
    response.status(401).json({ error: "Family access is required" });
    return;
  }
  next();
}