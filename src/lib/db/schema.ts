import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(), // sempre em minúsculas
    fullName: text("full_name"),
    firstName: text("first_name"),
    country: text("country"),
    region: text("region"),
    phone: text("phone"),
    timezone: text("timezone"),
    isTest: boolean("is_test").notNull().default(false),
    suppressed: boolean("suppressed").notNull().default(false),
    suppressedReason: text("suppressed_reason"),
    suppressedAt: ts("suppressed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("customers_email_uq").on(t.email),
    index("customers_created_idx").on(t.createdAt),
  ],
);

export const productMappings = pgTable(
  "product_mappings",
  {
    id: serial("id").primaryKey(),
    productKey: text("product_key").notNull(), // main | nathan | knots | reclaim
    matchType: text("match_type").notNull(), // code | product_code | plan_code | offer_code | name_pattern
    value: text("value").notNull(),
    label: text("label"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("product_mappings_match_uq").on(t.matchType, t.value)],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(), // perfectpay | simulator
    dedupeKey: text("dedupe_key").notNull(),
    isDuplicate: boolean("is_duplicate").notNull().default(false),
    receivedAt: ts("received_at").notNull().defaultNow(),
    rawPayload: jsonb("raw_payload").notNull(),
    normalized: jsonb("normalized"),
    eventType: text("event_type"),
    productKey: text("product_key"),
    customerId: integer("customer_id").references(() => customers.id),
    // received | processed | duplicate | ignored | error | unmapped | unrecognized
    status: text("status").notNull().default("received"),
    statusReason: text("status_reason"),
    error: text("error"),
    processedAt: ts("processed_at"),
    isTest: boolean("is_test").notNull().default(false),
  },
  (t) => [
    uniqueIndex("webhook_events_dedupe_uq")
      .on(t.provider, t.dedupeKey)
      .where(sql`${t.isDuplicate} = false`),
    index("webhook_events_status_idx").on(t.status, t.receivedAt),
    index("webhook_events_customer_idx").on(t.customerId),
  ],
);

export const flows = pgTable(
  "flows",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    type: text("type").notNull(), // upsell | recovery_a | recovery_b
    status: text("status").notNull().default("active"), // active | completed | cancelled
    statusReason: text("status_reason"),
    anchorAt: ts("anchor_at").notNull(),
    includesF3: boolean("includes_f3").notNull().default(false),
    f3Sent: boolean("f3_sent").notNull().default(false),
    isControl: boolean("is_control").notNull().default(false),
    declineReason: text("decline_reason"),
    recoveryUrl: text("recovery_url"),
    startedByEventId: integer("started_by_event_id").references(() => webhookEvents.id),
    isTest: boolean("is_test").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    endedAt: ts("ended_at"),
  },
  (t) => [
    index("flows_customer_idx").on(t.customerId),
    index("flows_status_idx").on(t.type, t.status),
    // No máximo um fluxo de upsell por cliente, para sempre.
    uniqueIndex("flows_one_upsell_uq").on(t.customerId).where(sql`${t.type} = 'upsell'`),
    // No máximo um fluxo de recuperação ativo por cliente.
    uniqueIndex("flows_one_active_recovery_uq")
      .on(t.customerId)
      .where(sql`${t.type} <> 'upsell' and ${t.status} = 'active'`),
  ],
);

export const scheduledEmails = pgTable(
  "scheduled_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flowId: integer("flow_id")
      .notNull()
      .references(() => flows.id),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    templateKey: text("template_key").notNull(),
    offerKey: text("offer_key"),
    stepOrder: integer("step_order").notNull(),
    scheduledFor: ts("scheduled_for").notNull(),
    originalScheduledFor: ts("original_scheduled_for").notNull(),
    // scheduled | sending | sent | dry_run | skipped | cancelled | failed | expired
    status: text("status").notNull().default("scheduled"),
    statusReason: text("status_reason"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    lockedAt: ts("locked_at"),
    resendId: text("resend_id"),
    sentAt: ts("sent_at"),
    deadlineAt: ts("deadline_at"),
    renderedSubject: text("rendered_subject"),
    renderedHtml: text("rendered_html"),
    renderedText: text("rendered_text"),
    isTest: boolean("is_test").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("scheduled_emails_due_idx").on(t.status, t.scheduledFor),
    index("scheduled_emails_customer_idx").on(t.customerId),
    index("scheduled_emails_flow_idx").on(t.flowId),
    index("scheduled_emails_resend_idx").on(t.resendId),
  ],
);

export const purchases = pgTable(
  "purchases",
  {
    id: serial("id").primaryKey(),
    transactionId: text("transaction_id").notNull(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    productKey: text("product_key").notNull(),
    amountCents: integer("amount_cents"),
    currency: text("currency"),
    status: text("status").notNull().default("approved"), // approved | refunded | chargeback
    purchasedAt: ts("purchased_at").notNull(),
    refundedAt: ts("refunded_at"),
    attribution: text("attribution").notNull().default("direct"), // email | direct
    attributedEmailId: uuid("attributed_email_id").references(() => scheduledEmails.id),
    webhookEventId: integer("webhook_event_id").references(() => webhookEvents.id),
    isTest: boolean("is_test").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("purchases_transaction_uq").on(t.transactionId),
    index("purchases_customer_idx").on(t.customerId),
    index("purchases_date_idx").on(t.purchasedAt),
  ],
);

export const emailEvents = pgTable(
  "email_events",
  {
    id: serial("id").primaryKey(),
    providerEventId: text("provider_event_id"), // svix-id / webhook-id
    scheduledEmailId: uuid("scheduled_email_id").references(() => scheduledEmails.id),
    resendEmailId: text("resend_email_id"),
    customerId: integer("customer_id").references(() => customers.id),
    type: text("type").notNull(), // sent | delivered | delivery_delayed | bounced | complained | opened | clicked | failed | suppressed
    detail: text("detail"),
    url: text("url"),
    occurredAt: ts("occurred_at").notNull(),
    raw: jsonb("raw"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("email_events_provider_uq").on(t.providerEventId),
    index("email_events_email_idx").on(t.scheduledEmailId, t.type),
    index("email_events_customer_idx").on(t.customerId),
  ],
);

export const customerEvents = pgTable(
  "customer_events",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    type: text("type").notNull(),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata"),
    occurredAt: ts("occurred_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("customer_events_customer_idx").on(t.customerId, t.occurredAt)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: ts("window_start").notNull(),
  count: integer("count").notNull().default(0),
});

export type Customer = typeof customers.$inferSelect;
export type Flow = typeof flows.$inferSelect;
export type ScheduledEmail = typeof scheduledEmails.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type ProductMapping = typeof productMappings.$inferSelect;
