import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth";
import { allCustomers, JOURNEY_LABELS, parseCustomerFilters } from "@/lib/queries/customers";
import { n } from "@/lib/queries/common";

export const dynamic = "force-dynamic";

const csv = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Evita fórmulas ao abrir no Excel/Sheets
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const list = await allCustomers(getDb(), parseCustomerFilters(sp));
  const header = ["id", "nome", "email", "pais", "status", "produtos", "ultimo_evento", "emails_enviados", "emails_abertos_aprox", "receita", "entrada", "teste"];
  const lines = list.map((c) =>
    [
      c.id,
      c.full_name ?? c.first_name ?? "",
      c.email,
      c.country ?? "",
      JOURNEY_LABELS[c.journey],
      c.products ?? "",
      c.last_event ?? "",
      n(c.emails_sent),
      n(c.emails_opened),
      (n(c.revenue_cents) / 100).toFixed(2),
      new Date(c.created_at).toISOString(),
      c.is_test ? "sim" : "não",
    ]
      .map(csv)
      .join(","),
  );
  return new Response("﻿" + [header.join(","), ...lines].join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="clientes.csv"` },
  });
}
