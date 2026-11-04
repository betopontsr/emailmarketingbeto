import { hmac, safeEqual } from "@/lib/util/crypto";

export const SESSION_COOKIE = "funil_sess";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas

type Payload = { e: string; exp: number };

export function createSessionToken(email: string, secret: string, now = Date.now()): string {
  const payload: Payload = { e: email, exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(secret, `session:${body}`)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): Payload | null {
  if (!token || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sig, hmac(secret, `session:${body}`))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (typeof p.exp !== "number" || p.exp * 1000 < now) return null;
    return p;
  } catch {
    return null;
  }
}
