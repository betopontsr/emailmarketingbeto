import { Resend } from "resend";
import { getDb } from "@/lib/db";
import { recordResendEvent } from "@/lib/email/events";
import { env } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/util/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const db = getDb();
  const secret = env().RESEND_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "RESEND_WEBHOOK_SECRET não configurada" }, { status: 500 });
  if (!(await rateLimit(db, `rs:${clientIp(req)}`, 1200, 60))) return Response.json({ error: "muitas requisições" }, { status: 429 });

  const payload = await req.text();
  const h = req.headers;
  const id = h.get("svix-id") ?? h.get("webhook-id") ?? "";
  const timestamp = h.get("svix-timestamp") ?? h.get("webhook-timestamp") ?? "";
  const signature = h.get("svix-signature") ?? h.get("webhook-signature") ?? "";

  let event;
  try {
    event = new Resend(env().RESEND_API_KEY ?? "re_verify_only").webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    });
  } catch {
    return Response.json({ error: "assinatura inválida" }, { status: 401 });
  }
  const r = await recordResendEvent(db, id || null, event as unknown as Parameters<typeof recordResendEvent>[2]);
  return Response.json({ ok: true, ...r });
}
