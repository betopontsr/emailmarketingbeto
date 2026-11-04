import type { Db } from "@/lib/db/types";
import { handleEvent } from "./handle";
import { ingestWebhook, processWebhookEvent, type Provider } from "./ingest";

/** Grava e processa um evento (usado pelo webhook, pelo simulador e pelo reprocessamento). */
export async function receiveAndProcess(
  db: Db,
  input: { provider: Provider; raw: unknown; isTest?: boolean; receivedAt?: Date },
  opts: { now?: Date } = {},
) {
  const r = await ingestWebhook(db, input);
  if (r.duplicate) return { id: r.id, status: "duplicate" as const, reason: null };
  const p = await processWebhookEvent(db, r.id, handleEvent, opts);
  return { id: r.id, ...p };
}

export async function reprocess(db: Db, eventId: number, now?: Date) {
  return processWebhookEvent(db, eventId, handleEvent, { now, force: true });
}

export async function processOnly(db: Db, eventId: number, now?: Date) {
  return processWebhookEvent(db, eventId, handleEvent, { now });
}
