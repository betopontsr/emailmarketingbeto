import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmailStatusBadge, EventStatusBadge, PageHeader } from "@/components/painel/common";
import { getDb } from "@/lib/db";
import { TEMPLATE_INFO } from "@/lib/engine/steps";
import { FLOW_LABELS, type FlowType, type TemplateKey } from "@/lib/engine/types";
import { EVENT_TYPE_LABELS, PRODUCT_LABELS, PRODUCT_SHORT, type EventType, type ProductKey } from "@/lib/events/types";
import { money } from "@/lib/queries/common";
import { customerDetail } from "@/lib/queries/customer-detail";
import { getSettings, isDryRun } from "@/lib/settings";
import { formatBr, resolveZone } from "@/lib/util/time";
import { cancelPendingAction, reactivateAction, sendNowAction, suppressAction } from "./actions";

const FLOW_STATUS: Record<string, string> = { active: "ativo", completed: "concluído", cancelled: "cancelado" };

export default async function ClienteDetalhe(props: PageProps<"/clientes/[id]">) {
  const { id } = await props.params;
  const db = getDb();
  const d = await customerDetail(db, Number(id));
  if (!d) notFound();
  const s = await getSettings(db);
  const { customer: c } = d;
  const zone = resolveZone(c.timezone, s.defaultTimezone);
  const canSendNow = isDryRun(s) || c.isTest;
  const approved = d.purchases.filter((p) => p.status === "approved");
  const total = approved.reduce((sum, p) => sum + (p.amountCents ?? 0), 0);
  const pendingCount = d.emails.filter((e) => e.status === "scheduled").length;

  return (
    <div className="space-y-6">
      <PageHeader title={c.fullName || c.firstName || c.email} description={`${c.email} · ${c.country ?? "país ?"}${c.region ? ` / ${c.region}` : ""} · fuso ${zone}${c.timezone ? "" : " (padrão)"}`}>
        <div className="flex flex-wrap gap-2">
          {c.isTest && <Badge variant="outline">cliente de teste</Badge>}
          {c.suppressed ? <Badge variant="danger">suprimido: {c.suppressedReason}</Badge> : <Badge variant="success">ativo</Badge>}
        </div>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <form action={cancelPendingAction}>
          <input type="hidden" name="customerId" value={c.id} />
          <Button size="sm" variant="outline" disabled={!pendingCount}>
            Cancelar pendentes ({pendingCount})
          </Button>
        </form>
        {c.suppressed ? (
          <form action={reactivateAction}>
            <input type="hidden" name="customerId" value={c.id} />
            <Button size="sm" variant="outline">
              Reativar
            </Button>
          </form>
        ) : (
          <form action={suppressAction}>
            <input type="hidden" name="customerId" value={c.id} />
            <Button size="sm" variant="destructive">
              Suprimir
            </Button>
          </form>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Produtos comprados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {d.purchases.length === 0 && <p className="text-muted-foreground">Nenhuma compra.</p>}
            {d.purchases.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <div>
                  <Badge variant={p.status === "approved" ? "secondary" : "danger"}>{PRODUCT_SHORT[p.productKey as ProductKey]}</Badge>{" "}
                  <span className="text-xs text-muted-foreground">{formatBr(p.purchasedAt)}</span>
                  {p.status !== "approved" && <span className="ml-1 text-xs text-red-600">({p.status === "refunded" ? "reembolsado" : "chargeback"})</span>}
                </div>
                <span className="tabular-nums">{p.amountCents !== null ? money(p.amountCents, p.currency ?? "USD") : "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Receita: {money(total)}</div>
            <div>Entrou em: {formatBr(c.createdAt)}</div>
            <div>E-mails entregues/simulados: {d.emails.filter((e) => e.status === "sent" || e.status === "dry_run").length}</div>
            <div>Abertos (aprox.): {[...d.flags.values()].filter((f) => f.opened).length} · Clicados: {[...d.flags.values()].filter((f) => f.clicked).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Webhooks recebidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {d.webhooks.slice(0, 8).map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-2">
                <Link href={`/eventos/${w.id}`} className="text-xs underline">
                  #{w.id} {w.eventType ? EVENT_TYPE_LABELS[w.eventType as EventType] : ""}
                </Link>
                <EventStatusBadge status={w.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Jornada</h2>
        {d.flows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum fluxo.</p>}
        <div className="space-y-4">
          {d.flows.map((f) => {
            const emails = d.emails.filter((e) => e.flowId === f.id);
            const buys = d.purchases.filter((p) => emails.some((e) => e.id === p.attributedEmailId));
            const story: string[] = [];
            emails.forEach((e, i) => {
              const fl = d.flags.get(e.id);
              const nth = `e-mail ${i + 1}`;
              if (e.status === "sent" || e.status === "dry_run") story.push(fl?.opened ? `viu o ${nth}` : `recebeu o ${nth}`);
              for (const p of buys.filter((b) => b.attributedEmailId === e.id)) story.push(`comprou ${PRODUCT_SHORT[p.productKey as ProductKey]} após o ${nth}`);
            });
            return (
              <Card key={f.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {FLOW_LABELS[f.type as FlowType]}
                    <Badge variant={f.status === "active" ? "info" : f.status === "completed" ? "success" : "outline"}>{FLOW_STATUS[f.status]}</Badge>
                    {f.isControl && <Badge variant="warning">grupo de controle</Badge>}
                    {f.type !== "upsell" && !f.includesF3 && !f.isControl && <Badge variant="outline">sem F3 (já recebeu)</Badge>}
                    <span className="text-xs font-normal text-muted-foreground">
                      início {formatBr(f.anchorAt)}
                      {f.statusReason ? ` · ${f.statusReason}` : ""}
                    </span>
                  </CardTitle>
                  {story.length > 0 && <p className="text-xs text-muted-foreground">{story.join(", ")}</p>}
                </CardHeader>
                <CardContent>
                  <ol className="relative space-y-2 border-l pl-4">
                    {emails.map((e) => {
                      const fl = d.flags.get(e.id);
                      const bought = buys.filter((b) => b.attributedEmailId === e.id);
                      return (
                        <li key={e.id} className="text-sm">
                          <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border bg-background" />
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/clientes/${c.id}/email/${e.id}`} className="font-medium underline-offset-2 hover:underline">
                              {TEMPLATE_INFO[e.templateKey as TemplateKey]?.label ?? e.templateKey}
                            </Link>
                            <EmailStatusBadge status={e.status} />
                            <span className="text-xs text-muted-foreground">
                              {e.sentAt ? `enviado ${formatBr(e.sentAt)}` : `agendado ${formatBr(e.scheduledFor)}`} (cliente: {formatBr(e.sentAt ?? e.scheduledFor, zone)})
                            </span>
                            {fl?.delivered && <Badge variant="outline">entregue</Badge>}
                            {fl?.opened && <Badge variant="outline">aberto (aprox.)</Badge>}
                            {fl?.clicked && <Badge variant="info">clicado</Badge>}
                            {fl?.bounced && <Badge variant="danger">bounce</Badge>}
                            {fl?.complained && <Badge variant="danger">spam</Badge>}
                            {e.status === "scheduled" && canSendNow && (
                              <form action={sendNowAction}>
                                <input type="hidden" name="customerId" value={c.id} />
                                <input type="hidden" name="emailId" value={e.id} />
                                <button className="text-xs underline">enviar agora (simulação)</button>
                              </form>
                            )}
                          </div>
                          {e.statusReason && <div className="text-xs text-muted-foreground">motivo: {e.statusReason}</div>}
                          {bought.map((b) => (
                            <div key={b.id} className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                              ★ comprou {PRODUCT_LABELS[b.productKey as ProductKey]} em {formatBr(b.purchasedAt)}
                            </div>
                          ))}
                        </li>
                      );
                    })}
                    {emails.length === 0 && <li className="text-sm text-muted-foreground">Sem e-mails.</li>}
                  </ol>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Linha do tempo</h2>
        <Table>
          <THead>
            <TR>
              <TH>Quando</TH>
              <TH>Tipo</TH>
              <TH>O que aconteceu</TH>
            </TR>
          </THead>
          <TBody>
            {d.timeline.map((t) => (
              <TR key={t.id}>
                <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatBr(t.occurredAt)}</TD>
                <TD className="text-xs">{t.type}</TD>
                <TD className="text-sm">{t.summary}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
