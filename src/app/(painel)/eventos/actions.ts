"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { reprocess } from "@/lib/pipeline/run";

/** Reprocessa: roda o adaptador de novo sobre o payload bruto. As regras de idempotência do motor continuam valendo. */
export async function reprocessAction(fd: FormData) {
  await requireAdminPage();
  const id = z.coerce.number().int().positive().parse(fd.get("eventId"));
  await reprocess(getDb(), id);
  revalidatePath("/eventos");
  revalidatePath(`/eventos/${id}`);
}
