"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { customers, scheduledEmails } from "@/lib/db/schema";
import { runDispatch } from "@/lib/dispatch/dispatcher";
import { resendSender } from "@/lib/email/sender";
import { applyActions } from "@/lib/pipeline/handle";
import { reactivateCustomer, suppressCustomer } from "@/lib/pipeline/suppress";
import { getSettings, isDryRun } from "@/lib/settings";

const id = z.coerce.number().int().positive();

export async function cancelPendingAction(fd: FormData) {
  await requireAdminPage();
  const customerId = id.parse(fd.get("customerId"));
  const db = getDb();
  const pending = await db
    .select({ id: scheduledEmails.id })
    .from(scheduledEmails)
    .where(and(eq(scheduledEmails.customerId, customerId), eq(scheduledEmails.status, "scheduled")));
  await db.transaction((tx) =>
    applyActions(tx, { customerId, eventId: null, isTest: false, now: new Date(), timezone: "UTC" }, [
      { type: "cancel_emails", emailIds: pending.map((p) => p.id), reason: "cancelado manualmente no painel" },
    ]),
  );
  revalidatePath(`/clientes/${customerId}`);
}

export async function suppressAction(fd: FormData) {
  await requireAdminPage();
  const customerId = id.parse(fd.get("customerId"));
  await getDb().transaction((tx) => suppressCustomer(tx, customerId, "suprimido manualmente no painel"));
  revalidatePath(`/clientes/${customerId}`);
}

export async function reactivateAction(fd: FormData) {
  await requireAdminPage();
  const customerId = id.parse(fd.get("customerId"));
  await getDb().transaction((tx) => reactivateCustomer(tx, customerId));
  revalidatePath(`/clientes/${customerId}`);
}

/** "Enviar agora": só em simulação (ou para cliente de teste), e passa pela guarda normal. */
export async function sendNowAction(fd: FormData) {
  await requireAdminPage();
  const customerId = id.parse(fd.get("customerId"));
  const emailId = z.string().uuid().parse(fd.get("emailId"));
  const db = getDb();
  const s = await getSettings(db);
  const [c] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (!isDryRun(s) && !c?.isTest) throw new Error("“Enviar agora” só funciona com DRY_RUN ligado.");
  const now = new Date();
  await db
    .update(scheduledEmails)
    .set({ scheduledFor: now, updatedAt: now })
    .where(and(eq(scheduledEmails.id, emailId), eq(scheduledEmails.customerId, customerId), eq(scheduledEmails.status, "scheduled")));
  await runDispatch(db, { now, getSender: resendSender, onlyIds: [emailId] });
  revalidatePath(`/clientes/${customerId}`);
}
