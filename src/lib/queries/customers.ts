import { sql, type SQL } from "drizzle-orm";
import { DateTime } from "luxon";
import type { DbOrTx } from "@/lib/db/types";
import { PANEL_TZ, one, rows, type SP } from "./common";

export const JOURNEY_LABELS: Record<string, string> = {
  upsell: "em upsell",
  recovery_a: "em recuperação A",
  recovery_b: "em recuperação B",
  completed: "completo",
  suppressed: "suprimido",
  none: "sem fluxo ativo",
};

export type CustomerRow = {
  id: number;
  email: string;
  full_name: string | null;
  first_name: string | null;
  country: string | null;
  is_test: boolean;
  created_at: Date;
  journey: string;
  products: string | null;
  revenue_cents: string;
  emails_sent: string;
  emails_opened: string;
  last_event: string | null;
  last_event_at: Date | null;
};

export type CustomerFilters = {
  q: string;
  journey: string;
  product: string;
  flow: string;
  since: string;
  until: string;
  includeTest: boolean;
};

export function parseCustomerFilters(sp: SP): CustomerFilters {
  return {
    q: one(sp.q).trim(),
    journey: one(sp.journey),
    product: one(sp.product),
    flow: one(sp.flow),
    since: one(sp.since),
    until: one(sp.until),
    includeTest: one(sp.test) === "1",
  };
}

const BASE = sql`
  with base as (
    select c.id, c.email, c.full_name, c.first_name, c.country, c.is_test, c.created_at,
      case when c.suppressed then 'suppressed'
           when exists (select 1 from flows f where f.customer_id = c.id and f.status = 'active' and f.type = 'upsell') then 'upsell'
           when exists (select 1 from flows f where f.customer_id = c.id and f.status = 'active' and f.type = 'recovery_a') then 'recovery_a'
           when exists (select 1 from flows f where f.customer_id = c.id and f.status = 'active' and f.type = 'recovery_b') then 'recovery_b'
           when exists (select 1 from flows f where f.customer_id = c.id and f.type = 'upsell' and f.status = 'completed') then 'completed'
           else 'none' end as journey,
      (select string_agg(distinct p.product_key, ',') from purchases p where p.customer_id = c.id and p.status = 'approved') as products,
      (select coalesce(sum(p.amount_cents), 0) from purchases p where p.customer_id = c.id and p.status = 'approved') as revenue_cents,
      (select count(*) from scheduled_emails e where e.customer_id = c.id and e.status in ('sent', 'dry_run')) as emails_sent,
      (select count(distinct ee.scheduled_email_id) from email_events ee where ee.customer_id = c.id and ee.type = 'opened') as emails_opened,
      (select ce.summary from customer_events ce where ce.customer_id = c.id order by ce.occurred_at desc, ce.id desc limit 1) as last_event,
      (select max(ce.occurred_at) from customer_events ce where ce.customer_id = c.id) as last_event_at
    from customers c
  )`;

function where(f: CustomerFilters): SQL {
  const parts: SQL[] = [sql`true`];
  if (!f.includeTest) parts.push(sql`is_test = false`);
  if (f.q) parts.push(sql`(email ilike ${"%" + f.q + "%"} or full_name ilike ${"%" + f.q + "%"})`);
  if (f.journey && f.journey in JOURNEY_LABELS) parts.push(sql`journey = ${f.journey}`);
  if (f.product === "none") parts.push(sql`products is null`);
  else if (["main", "nathan", "knots", "reclaim"].includes(f.product)) parts.push(sql`(',' || coalesce(products, '') || ',') like ${"%," + f.product + ",%"}`);
  if (["upsell", "recovery_a", "recovery_b"].includes(f.flow)) parts.push(sql`exists (select 1 from flows f where f.customer_id = base.id and f.type = ${f.flow})`);
  const s = DateTime.fromISO(f.since, { zone: PANEL_TZ });
  const u = DateTime.fromISO(f.until, { zone: PANEL_TZ });
  if (s.isValid) parts.push(sql`created_at >= ${s.startOf("day").toJSDate()}`);
  if (u.isValid) parts.push(sql`created_at <= ${u.endOf("day").toJSDate()}`);
  return sql.join(parts, sql` and `);
}

export async function listCustomers(db: DbOrTx, f: CustomerFilters, page: number, pageSize = 50) {
  const list = await rows<CustomerRow>(
    db,
    sql`${BASE} select * from base where ${where(f)} order by created_at desc limit ${pageSize + 1} offset ${(page - 1) * pageSize}`,
  );
  return { list: list.slice(0, pageSize), hasNext: list.length > pageSize };
}

export async function allCustomers(db: DbOrTx, f: CustomerFilters) {
  return rows<CustomerRow>(db, sql`${BASE} select * from base where ${where(f)} order by created_at desc limit 50000`);
}
