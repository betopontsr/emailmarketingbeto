"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { flows, scheduledEmails } from "@/lib/db/schema";
import { addTimeline } from "@/lib/pipeline/ingest";

/** Reenviar: volta para a fila agora. Passa pela guarda de novo (nada é enviado sem as checagens). */
export async function resendAction(fd: FormData) {
  await requireAdminPage();
  const emailId = z.string().uuid().parse(fd.get("emailId"));
  const db = getDb();
  const now = new Date();
  await db.transaction(async (tx) => {
    const [e] = await tx.select().from(scheduledEmails).where(eq(scheduledEmails.id, emailId));
    if (!e || !["failed", "expired"].includes(e.status)) return;
    const [f] = await tx.select().from(flows).where(eq(flows.id, e.flowId));
    // O fluxo pode ter sido concluído quando este e-mail falhou: reabre se ainda faz sentido
    if (f && f.status === "completed" && f.statusReason === "fim da sequência") {
      await tx.update(flows).set({ status: "active", statusReason: null, endedAt: null }).where(eq(flows.id, f.id));
    }
    await tx
      .update(scheduledEmails)
      .set({ status: "scheduled", scheduledFor: now, attempts: 0, statusReason: "reenviado manualmente", lastError: null, updatedAt: now })
      .where(eq(scheduledEmails.id, emailId));
    await addTimeline(tx, e.customerId, "email_requeued", `${e.templateKey}: recolocado na fila manualmente`, now, { emailId });
  });
  revalidatePath("/fila");
}

export async function cancelEmailAction(fd: FormData) {
  await requireAdminPage();
  const emailId = z.string().uuid().parse(fd.get("emailId"));
  const db = getDb();
  const now = new Date();
  const r = await db
    .update(scheduledEmails)
    .set({ status: "cancelled", statusReason: "cancelado manualmente no painel", updatedAt: now })
    .where(and(eq(scheduledEmails.id, emailId), inArray(scheduledEmails.status, ["scheduled", "failed", "expired"])))
    .returning();
  if (r[0]) await addTimeline(db, r[0].customerId, "email_cancelled", `${r[0].templateKey}: cancelado manualmente`, now, { emailId });
  revalidatePath("/fila");
}
