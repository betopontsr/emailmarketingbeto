import { after } from "next/server";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { extractToken } from "@/lib/perfectpay/adapter";
import { ingestWebhook } from "@/lib/pipeline/ingest";
import { processOnly } from "@/lib/pipeline/run";
import { safeEqual } from "@/lib/util/crypto";
import { clientIp, rateLimit } from "@/lib/util/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BODY = 512 * 1024;

async function readBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new Error("payload grande demais");
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(text);
    const obj: Record<string, unknown> = {};
    for (const [k, v] of params) obj[k] = v;
    // Alguns provedores mandam o JSON inteiro num campo só.
    for (const k of ["data", "payload", "json"]) {
      if (typeof obj[k] === "string") {
        try {
          return JSON.parse(obj[k] as string);
        } catch {}
      }
    }
    return obj;
  }
  return JSON.parse(text);
}

export async function POST(req: Request) {
  const db = getDb();
  const e = env();
  const ip = clientIp(req);
  const key = new URL(req.url).searchParams.get("key") ?? "";

  if (!e.PERFECTPAY_WEBHOOK_SECRET || !safeEqual(key, e.PERFECTPAY_WEBHOOK_SECRET)) {
    await rateLimit(db, `ppfail:${ip}`, 20, 600);
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!(await rateLimit(db, `pp:${ip}`, 600, 60))) {
    return Response.json({ error: "muitas requisições" }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await readBody(req);
  } catch {
    return Response.json({ error: "corpo inválido" }, { status: 400 });
  }

  if (e.PERFECTPAY_TOKEN) {
    const token = extractToken(raw, req.headers);
    if (!token || !safeEqual(token, e.PERFECTPAY_TOKEN)) {
      return Response.json({ error: "token inválido" }, { status: 401 });
    }
  }

  const { id, duplicate } = await ingestWebhook(db, { provider: "perfectpay", raw });
  if (!duplicate) {
    // Responde 200 rápido; o processamento roda logo depois.
    // Se falhar aqui, o dispatcher pega eventos "received" parados e o painel permite reprocessar.
    after(async () => {
      await processOnly(db, id);
    });
  }
  return Response.json({ ok: true, id, duplicate });
}
