import { env, baseUrl } from "@/lib/env";
import { hmac, safeEqual } from "@/lib/util/crypto";

function secret(): string {
  const s = env().SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET não configurada");
  return s;
}

/** Token assinado: "<id do cliente>.<assinatura>" */
export function unsubscribeToken(customerId: number): string {
  return `${customerId}.${hmac(secret(), `unsub:${customerId}`)}`;
}

export function verifyUnsubscribeToken(token: string): number | null {
  const [idStr, sig] = token.split(".");
  if (!idStr || !sig || !/^\d+$/.test(idStr)) return null;
  return safeEqual(sig, hmac(secret(), `unsub:${idStr}`)) ? Number(idStr) : null;
}

export function unsubscribePageUrl(customerId: number): string {
  return `${baseUrl()}/u/${unsubscribeToken(customerId)}`;
}

export function unsubscribeOneClickUrl(customerId: number): string {
  return `${baseUrl()}/api/unsubscribe/${unsubscribeToken(customerId)}`;
}
