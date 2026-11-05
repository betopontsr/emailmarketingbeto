"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { reprocess } from "@/lib/pipeline/run";
import { asc, eq } from "drizzle-orm";
import { webhookEvents } from "@/lib/db/schema";

/** Reprocessa: roda o adaptador de novo sobre o payload bruto. As regras de idempotência do motor continuam valendo. */
export async function reprocessAction(fd: FormData) {
  await requireAdminPage();
  const id = z.coerce.number().int().positive().parse(fd.get("eventId"));
  await reprocess(getDb(), id);
  revalidatePath("/eventos");
  revalidatePath(`/eventos/${id}`);
}

/** Reprocessa, do mais antigo para o mais novo, todos os eventos "não mapeados" (até 500 por clique). */
export async function reprocessUnmappedAction() {
  await requireAdminPage();
  const db = getDb();
  const list = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(eq(webhookEvents.status, "unmapped"))
    .orderBy(asc(webhookEvents.receivedAt), asc(webhookEvents.id))
    .limit(500);
  for (const e of list) await reprocess(db, e.id);
  revalidatePath("/eventos");
  revalidatePath("/produtos");
}
