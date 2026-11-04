"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { advanceTestCustomer, runDispatch } from "@/lib/dispatch/dispatcher";
import { resendSender } from "@/lib/email/sender";
import { deleteTestData, simulate, SIM_ACTIONS, type SimAction } from "@/lib/simulator";

export type SimState = { error?: string; ok?: string };

const form = z.object({
  action: z.enum(Object.keys(SIM_ACTIONS) as [SimAction, ...SimAction[]]),
  email: z.string().trim().toLowerCase().email(),
  name: z.string().max(200).default(""),
  country: z.string().max(60).default(""),
  region: z.string().max(60).default(""),
});

export async function simulateAction(_: SimState, fd: FormData): Promise<SimState> {
  await requireAdminPage();
  const p = form.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Preencha um e-mail válido e escolha o evento." };
  try {
    const r = await simulate(getDb(), p.data);
    revalidatePath("/simulador");
    return { ok: `Evento #${r.id}: ${r.status}${r.reason ? ` — ${r.reason}` : ""}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Avança o relógio do cliente de teste até o próximo e-mail e processa (simulado). */
export async function advanceAction(fd: FormData) {
  await requireAdminPage();
  const id = z.coerce.number().int().positive().parse(fd.get("customerId"));
  const all = fd.get("all") === "1";
  const db = getDb();
  for (let i = 0; i < (all ? 20 : 1); i++) {
    const now = new Date();
    const due = await advanceTestCustomer(db, id, now);
    if (!due.length) break;
    await runDispatch(db, { now, getSender: resendSender, onlyIds: due });
  }
  revalidatePath("/simulador");
  revalidatePath(`/clientes/${id}`);
}

export async function deleteTestDataAction() {
  await requireAdminPage();
  await deleteTestData(getDb());
  revalidatePath("/", "layout");
}
