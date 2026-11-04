import Link from "next/link";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmailStatusBadge, PageHeader, Pager } from "@/components/painel/common";
import { getDb } from "@/lib/db";
import { customers, scheduledEmails } from "@/lib/db/schema";
import { TEMPLATE_INFO } from "@/lib/engine/steps";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/engine/types";
import { one } from "@/lib/queries/common";
import { formatBr } from "@/lib/util/time";
import { cancelEmailAction, resendAction } from "./actions";

const STATUSES = [
  ["queue", "agendados + enviando"],
  ["scheduled", "agendados"],
  ["sending", "enviando"],
  ["failed", "falhos"],
  ["expired", "expirados"],
  ["skipped", "pulados"],
  ["cancelled", "cancelados"],
  ["sent", "enviados"],
  ["dry_run", "simulados"],
] as const;

export default async function Fila(props: PageProps<"/fila">) {
  const sp = await props.searchParams;
  const status = one(sp.status) || "queue";
  const template = one(sp.template);
  const includeTest = one(sp.test) === "1";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const statuses = status === "queue" ? ["scheduled", "sending"] : [status];
  const db = getDb();
  const list = await db
    .select({ e: scheduledEmails, email: customers.email, name: customers.fullName })
    .from(scheduledEmails)
    .innerJoin(customers, eq(customers.id, scheduledEmails.customerId))
    .where(
      and(
        inArray(scheduledEmails.status, statuses),
        template && (TEMPLATE_KEYS as readonly string[]).includes(template) ? eq(scheduledEmails.templateKey, template) : undefined,
        includeTest ? undefined : eq(scheduledEmails.isTest, false),
      ),
    )
    .orderBy(status === "queue" || status === "scheduled" ? asc(scheduledEmails.scheduledFor) : desc(scheduledEmails.updatedAt))
    .limit(51)
    .offset((page - 1) * 50);
  const counts = await db
    .select({ status: scheduledEmails.status, c: sql<number>`count(*)::int` })
    .from(scheduledEmails)
    .where(includeTest ? undefined : eq(scheduledEmails.isTest, false))
    .groupBy(scheduledEmails.status);
  const count = Object.fromEntries(counts.map((c) => [c.status, c.c]));

  return (
    <div>
      <PageHeader title="Fila de envios" description="O dispatcher pega os vencidos a cada minuto e roda a guarda de envio antes de cada e-mail." />
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {["scheduled", "sending", "failed", "expired"].map((s) => (
          <Badge key={s} variant="outline">
            {STATUSES.find((x) => x[0] === s)?.[1]}: {count[s] ?? 0}
          </Badge>
        ))}
      </div>
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={status}>
            {STATUSES.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="template">E-mail</Label>
          <Select id="template" name="template" defaultValue={template}>
            <option value="">todos</option>
            {TEMPLATE_KEYS.map((k) => (
              <option key={k} value={k}>
                {TEMPLATE_INFO[k].label}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" name="test" value="1" defaultChecked={includeTest} /> incluir dados de teste
        </label>
        <Button size="sm" variant="secondary">
          Filtrar
        </Button>
      </form>
      <Table>
        <THead>
          <TR>
            <TH>Agendado para</TH>
            <TH>Cliente</TH>
            <TH>E-mail</TH>
            <TH>Status</TH>
            <TH>Tentativas</TH>
            <TH>Motivo / erro</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {list.length === 0 && (
            <TR>
              <TD colSpan={7} className="text-center text-muted-foreground">
                Nada aqui.
              </TD>
            </TR>
          )}
          {list.slice(0, 50).map(({ e, email, name }) => (
            <TR key={e.id}>
              <TD className="whitespace-nowrap text-xs">{formatBr(e.scheduledFor)}</TD>
              <TD>
                <Link href={`/clientes/${e.customerId}`} className="underline-offset-2 hover:underline">
                  {name || email}
                </Link>
                {e.isTest && (
                  <Badge variant="outline" className="ml-1">
                    teste
                  </Badge>
                )}
              </TD>
              <TD className="text-xs">
                <Link href={`/clientes/${e.customerId}/email/${e.id}`} className="underline-offset-2 hover:underline">
                  {TEMPLATE_INFO[e.templateKey as TemplateKey]?.label ?? e.templateKey}
                </Link>
              </TD>
              <TD>
                <EmailStatusBadge status={e.status} />
              </TD>
              <TD className="tabular-nums">{e.attempts}</TD>
              <TD className="max-w-72 text-xs text-muted-foreground">{e.lastError ?? e.statusReason ?? "—"}</TD>
              <TD>
                <div className="flex gap-2">
                  {["failed", "expired"].includes(e.status) && (
                    <form action={resendAction}>
                      <input type="hidden" name="emailId" value={e.id} />
                      <button className="text-xs underline">reenviar</button>
                    </form>
                  )}
                  {["scheduled", "failed", "expired"].includes(e.status) && (
                    <form action={cancelEmailAction}>
                      <input type="hidden" name="emailId" value={e.id} />
                      <button className="text-xs text-red-600 underline">cancelar</button>
                    </form>
                  )}
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Pager sp={sp} page={page} hasNext={list.length > 50} base="/fila" />
    </div>
  );
}
