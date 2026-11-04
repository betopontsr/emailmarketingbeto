import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db/types";
import { getSettings, isDryRun, missingRequiredConfig } from "@/lib/settings";
import { n, rows, type Filters } from "./common";

export async function overview(db: DbOrTx, f: Filters) {
  const t = (alias: string) => (f.includeTest ? sql.raw("true") : sql.raw(`${alias}.is_test = false`));
  const [events] = await rows<{ total: string; processed: string; error: string; unmapped: string; dup: string }>(
    db,
    sql`select count(*) total,
          count(*) filter (where status='processed') processed,
          count(*) filter (where status='error') error,
          count(*) filter (where status='unmapped') unmapped,
          count(*) filter (where status='duplicate') dup
        from webhook_events w where w.received_at between ${f.from} and ${f.to} and ${t("w")}`,
  );
  const [cust] = await rows<{ total: string; created: string; suppressed: string }>(
    db,
    sql`select count(*) total,
          count(*) filter (where c.created_at between ${f.from} and ${f.to}) created,
          count(*) filter (where c.suppressed) suppressed
        from customers c where ${t("c")}`,
  );
  const activeFlows = await rows<{ type: string; count: string }>(
    db,
    sql`select f.type, count(*) count from flows f where f.status='active' and ${t("f")} group by f.type`,
  );
  const [emails] = await rows<{ sent: string; dry: string; scheduled: string; failed: string }>(
    db,
    sql`select count(*) filter (where status='sent') sent,
          count(*) filter (where status='dry_run') dry,
          count(*) filter (where status='scheduled') scheduled,
          count(*) filter (where status='failed' or status='expired') failed
        from scheduled_emails e where coalesce(e.sent_at, e.updated_at) between ${f.from} and ${f.to} and ${t("e")}`,
  );
  const [ev] = await rows<Record<string, string>>(
    db,
    sql`select count(distinct ee.scheduled_email_id) filter (where ee.type='delivered') delivered,
          count(distinct ee.scheduled_email_id) filter (where ee.type='opened') opened,
          count(distinct ee.scheduled_email_id) filter (where ee.type='clicked') clicked,
          count(distinct ee.scheduled_email_id) filter (where ee.type='bounced') bounced,
          count(distinct ee.scheduled_email_id) filter (where ee.type='complained') complained
        from email_events ee left join scheduled_emails e on e.id = ee.scheduled_email_id
        where ee.occurred_at between ${f.from} and ${f.to} and (e.id is null or ${t("e")})`,
  );
  const [unsub] = await rows<{ count: string }>(
    db,
    sql`select count(*) count from customers c where c.suppressed and c.suppressed_reason = 'descadastro pelo link'
        and c.suppressed_at between ${f.from} and ${f.to} and ${t("c")}`,
  );
  const revenue = await rows<{ product_key: string; origin: string; count: string; cents: string; currency: string | null }>(
    db,
    sql`select p.product_key,
          case when p.attributed_email_id is null then 'direct'
               when f.type = 'upsell' then 'upsell_email' else 'recovery_email' end origin,
          count(*) count, coalesce(sum(p.amount_cents),0) cents, max(p.currency) currency
        from purchases p
        left join scheduled_emails e on e.id = p.attributed_email_id
        left join flows f on f.id = e.flow_id
        where p.status='approved' and p.purchased_at between ${f.from} and ${f.to} and ${t("p")}
        group by 1, 2 order by 1, 2`,
  );
  const s = await getSettings(db);
  const [unmappedAll] = await rows<{ count: string }>(db, sql`select count(*) count from webhook_events where status='unmapped'`);
  const [errorsAll] = await rows<{ count: string }>(db, sql`select count(*) count from webhook_events where status='error'`);
  const [failedAll] = await rows<{ count: string }>(db, sql`select count(*) count from scheduled_emails where status='failed'`);

  const alerts: { level: "warning" | "danger" | "info"; text: string; href?: string }[] = [];
  if (n(unmappedAll.count)) alerts.push({ level: "warning", text: `${n(unmappedAll.count)} eventos de produtos não mapeados`, href: "/eventos?status=unmapped" });
  if (n(errorsAll.count)) alerts.push({ level: "danger", text: `${n(errorsAll.count)} eventos com erro`, href: "/eventos?status=error" });
  if (n(failedAll.count)) alerts.push({ level: "danger", text: `${n(failedAll.count)} e-mails falharam`, href: "/fila?status=failed" });
  const missing = missingRequiredConfig(s);
  if (missing.length) alerts.push({ level: "warning", text: `Configuração incompleta: ${missing.join(", ")}`, href: "/configuracoes" });
  if (isDryRun(s)) alerts.push({ level: "info", text: "DRY_RUN ligado: nenhum e-mail é enviado de verdade", href: "/configuracoes" });
  if (s.globalPause) alerts.push({ level: "danger", text: "Pausa global ligada: o dispatcher não envia nada", href: "/configuracoes" });

  return {
    events,
    cust,
    activeFlows: Object.fromEntries(activeFlows.map((r) => [r.type, n(r.count)])),
    emails,
    ev,
    unsub: n(unsub.count),
    revenue,
    alerts,
  };
}
