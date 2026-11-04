"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { productMappings } from "@/lib/db/schema";
import { PRODUCT_KEYS } from "@/lib/events/types";
import { MATCH_TYPES } from "@/lib/products/resolve";

const schema = z.object({
  productKey: z.enum(PRODUCT_KEYS),
  matchType: z.enum(MATCH_TYPES),
  value: z.string().trim().min(2).max(200),
  label: z.string().trim().max(200).optional(),
});

export type MappingState = { error?: string; ok?: boolean };

export async function addMappingAction(_: MappingState, fd: FormData): Promise<MappingState> {
  await requireAdminPage();
  const p = schema.safeParse({ productKey: fd.get("productKey"), matchType: fd.get("matchType"), value: fd.get("value"), label: fd.get("label") || undefined });
  if (!p.success) return { error: "Preencha produto, tipo e valor (mínimo 2 caracteres)." };
  const r = await getDb().insert(productMappings).values(p.data).onConflictDoNothing().returning();
  if (!r.length) return { error: "Já existe um mapeamento com esse tipo e valor." };
  revalidatePath("/produtos");
  return { ok: true };
}

export async function deleteMappingAction(fd: FormData) {
  await requireAdminPage();
  const id = z.coerce.number().int().positive().parse(fd.get("id"));
  await getDb().delete(productMappings).where(eq(productMappings.id, id));
  revalidatePath("/produtos");
}
