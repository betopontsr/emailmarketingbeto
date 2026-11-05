import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EVENT_STATUS_LABELS, EventStatusBadge, PageHeader, Pager } from "@/components/painel/common";
import { getDb } from "@/lib/db";
import { customers, webhookEvents } from "@/lib/db/schema";
import { EVENT_TYPE_LABELS, PRODUCT_SHORT, type EventType, type ProductKey } from "@/lib/events/types";
import { one } from "@/lib/queries/common";
import { formatBr } from "@/lib/util/time";
import { reprocessAction, reprocessUnmappedAction } from "./actions";

export default async function Eventos(props: PageProps<"/eventos">) {
  const sp = await props.searchParams;
  const status = one(sp.status);
  const provider = one(sp.provider);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const db = getDb();
  const list = await db
    .select({ w: webhookEvents, email: customers.email })
    .from(webhookEvents)
    .leftJoin(customers, eq(customers.id, webhookEvents.customerId))
    .where(and(status ? eq(webhookEvents.status, status) : undefined, provider ? eq(webhookEvents.provider, provider) : undefined))
    .orderBy(desc(webhookEvents.receivedAt), desc(webhookEvents.id))
    .limit(51)
    .offset((page - 1) * 50);
  const counts = await db.select({ s: webhookEvents.status, c: sql<number>`count(*)::int` }).from(webhookEvents).groupBy(webhookEvents.status);
  return (
    <div>
      <PageHeader title="Eventos (webhooks)" description="Todo payload recebido fica gravado antes de ser processado.">
        {(counts.find((c) => c.s === "unmapped")?.c ?? 0) > 0 && (
          <form action={reprocessUnmappedAction}>
            <Button size="sm" variant="outline">
              Reprocessar todos os não mapeados ({counts.find((c) => c.s === "unmapped")?.c})
            </Button>
          </form>
        )}
      </PageHeader>
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={status}>
            <option value="">todos</option>
            {Object.entries(EVENT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v} ({counts.find((c) => c.s === k)?.c ?? 0})
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="provider">Origem</Label>
          <Select id="provider" name="provider" defaultValue={provider}>
            <option value="">todas</option>
            <option value="perfectpay">Perfect Pay</option>
            <option value="simulator">Simulador</option>
          </Select>
        </div>
        <Button size="sm" variant="secondary">
          Filtrar
        </Button>
      </form>
      <Table>
        <THead>
          <TR>
            <TH>#</TH>
            <TH>Recebido</TH>
            <TH>Origem</TH>
            <TH>Tipo</TH>
            <TH>Produto</TH>
            <TH>Cliente</TH>
            <TH>Status</TH>
            <TH>Motivo</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {list.slice(0, 50).map(({ w, email }) => (
            <TR key={w.id}>
              <TD>
                <Link href={`/eventos/${w.id}`} className="underline">
                  {w.id}
                </Link>
              </TD>
              <TD className="whitespace-nowrap text-xs">{formatBr(w.receivedAt)}</TD>
              <TD className="text-xs">{w.provider === "simulator" ? "simulador" : "Perfect Pay"}</TD>
              <TD className="text-xs">{w.eventType ? EVENT_TYPE_LABELS[w.eventType as EventType] : "—"}</TD>
              <TD className="text-xs">{w.productKey ? PRODUCT_SHORT[w.productKey as ProductKey] : "—"}</TD>
              <TD className="text-xs">{w.customerId ? <Link href={`/clientes/${w.customerId}`} className="underline">{email}</Link> : "—"}</TD>
              <TD>
                <EventStatusBadge status={w.status} />
              </TD>
              <TD className="max-w-72 text-xs text-muted-foreground">{w.error ?? w.statusReason ?? "—"}</TD>
              <TD>
                {!w.isDuplicate && (
                  <form action={reprocessAction}>
                    <input type="hidden" name="eventId" value={w.id} />
                    <button className="text-xs underline">reprocessar</button>
                  </form>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Pager sp={sp} page={page} hasNext={list.length > 50} base="/eventos" />
    </div>
  );
}
