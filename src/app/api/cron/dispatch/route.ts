import { getDb } from "@/lib/db";
import { runDispatch } from "@/lib/dispatch/dispatcher";
import { resendSender } from "@/lib/email/sender";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/util/crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Processa os e-mails vencidos. Aceita:
 *  - Vercel Cron: cabeçalho "Authorization: Bearer <CRON_SECRET>"
 *  - serviço externo (cron-job.org): o mesmo cabeçalho ou ?key=<CRON_SECRET>
 */
async function handle(req: Request) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!secret || !(safeEqual(bearer, secret) || safeEqual(key, secret))) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }
  const summary = await runDispatch(getDb(), { getSender: resendSender });
  return Response.json(summary);
}

export const GET = handle;
export const POST = handle;
