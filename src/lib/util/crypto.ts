import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Comparação em tempo constante (também quando os tamanhos diferem). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/** Número entre 0 e 99 derivado de forma estável de uma string. */
export function stableBucket(s: string): number {
  return parseInt(sha256(s).slice(0, 8), 16) % 100;
}
