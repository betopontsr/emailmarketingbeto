import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db/types";
import { rows, type Filters } from "./common";

export type TemplateStats = {
  template_key: string;
  scheduled: string;
  sent: string;
  skipped: string;
  cancelled: string;
  expired: string;
  failed: string;
  pending: string;
  delivered: string;
  opened: string;
  clicked: string;
  bounced: string;
  complained: string;
  purchases: string;
  revenue_cents: string;
  unsubscribes: string;
};

export async function performance(db: DbOrTx, f: Filters) {
  const test = f.includeTest ? sql`true` : sql`e.is_test = false`;
  const perTemplate = await rows<TemplateStats>(
    db,
    sql`
    with em as (
      select e.* from scheduled_emails e
      where e.original_scheduled_for between ${f.from} and ${f.to} and ${test}
    ),
    ev as (
      select ee.scheduled_email_id id,
        bool_or(ee.type = 'delivered') delivered, bool_or(ee.type = 'opened') opened, bool_or(ee.type = 'clicked') clicked,
        bool_or(ee.type = 'bounced') bounced, bool_or(ee.type = 'complained') complained
      from email_events ee where ee.scheduled_email_id in (select id from em) group by 1
    ),
    unsub as (
      select (select e2.id from scheduled_emails e2 where e2.customer_id = c.id and e2.status in ('sent','dry_run') and e2.sent_at <= c.suppressed_at
              order by e2.sent_at desc limit 1) email_id
      from customers c where c.suppressed and c.suppressed_reason = 'descadastro pelo link'
    )
    select em.template_key,
      count(*) scheduled,
      count(*) filter (where em.status in ('sent','dry_run')) sent,
      count(*) filter (where em.status = 'skipped') skipped,
      count(*) filter (where em.status = 'cancelled') cancelled,
      count(*) filter (where em.status = 'expired') expired,
      count(*) filter (where em.status = 'failed') failed,
      count(*) filter (where em.status in ('scheduled','sending')) pending,
      count(*) filter (where ev.delivered) delivered,
      count(*) filter (where ev.opened) opened,
      count(*) filter (where ev.clicked) clicked,
      count(*) filter (where ev.bounced) bounced,
      count(*) filter (where ev.complained) complained,
      (select count(*) from purchases p where p.attributed_email_id in (select id from em em2 where em2.template_key = em.template_key) and p.status = 'approved') purchases,
      (select coalesce(sum(p.amount_cents),0) from purchases p where p.attributed_email_id in (select id from em em2 where em2.template_key = em.template_key) and p.status = 'approved') revenue_cents,
      (select count(*) from unsub u where u.email_id in (select id from em em2 where em2.template_key = em.template_key)) unsubscribes
    from em left join ev on ev.id = em.id
    group by em.template_key`,
  );

  const skipReasons = await rows<{ template_key: string; status: string; reason: string | null; count: string }>(
    db,
    sql`select e.template_key, e.status, e.status_reason reason, count(*) count from scheduled_emails e
        where e.status in ('skipped','cancelled','expired','failed') and e.original_scheduled_for between ${f.from} and ${f.to} and ${test}
        group by 1, 2, 3 order by 1, 4 desc`,
  );

  const ftest = f.includeTest ? sql`true` : sql`fl.is_test = false`;
  // Recuperação: compra do principal em até 7 dias depois do evento que abriu o fluxo
  const recovery = await rows<{ type: string; is_control: boolean; flows: string; recovered: string; revenue_cents: string; upsell_cents: string }>(
    db,
    sql`
    with r as (
      select fl.id, fl.type, fl.is_control, fl.customer_id, fl.anchor_at,
        (select p.id from purchases p where p.customer_id = fl.customer_id and p.product_key = 'main' and p.status = 'approved'
           and p.purchased_at between fl.anchor_at and fl.anchor_at + interval '7 days' order by p.purchased_at limit 1) purchase_id
      from flows fl where fl.type in ('recovery_a','recovery_b') and fl.anchor_at between ${f.from} and ${f.to} and ${ftest}
    )
    select r.type, r.is_control, count(*) flows, count(r.purchase_id) recovered,
      coalesce(sum((select p.amount_cents from purchases p where p.id = r.purchase_id)),0) revenue_cents,
      coalesce(sum(case when r.purchase_id is null then 0 else
        (select coalesce(sum(p2.amount_cents),0) from purchases p2 where p2.customer_id = r.customer_id and p2.product_key <> 'main' and p2.status = 'approved') end),0) upsell_cents
    from r group by 1, 2 order by 1, 2`,
  );

  const offers = await rows<{ offer: string; flows: string; buyers: string; via_email: string; revenue_cents: string }>(
    db,
    sql`
    with u as (select fl.customer_id from flows fl where fl.type = 'upsell' and fl.anchor_at between ${f.from} and ${f.to} and ${ftest})
    select o.offer,
      (select count(*) from u) flows,
      count(distinct p.customer_id) buyers,
      count(distinct p.customer_id) filter (where p.attributed_email_id is not null) via_email,
      coalesce(sum(p.amount_cents),0) revenue_cents
    from (values ('nathan'),('knots'),('reclaim')) o(offer)
    left join purchases p on p.product_key = o.offer and p.status = 'approved' and p.customer_id in (select customer_id from u)
    group by o.offer order by o.offer`,
  );

  return { perTemplate, skipReasons, recovery, offers };
}
