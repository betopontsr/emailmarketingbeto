CREATE TABLE "customer_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"type" text NOT NULL,
	"summary" text NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"first_name" text,
	"country" text,
	"region" text,
	"phone" text,
	"timezone" text,
	"is_test" boolean DEFAULT false NOT NULL,
	"suppressed" boolean DEFAULT false NOT NULL,
	"suppressed_reason" text,
	"suppressed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_event_id" text,
	"scheduled_email_id" uuid,
	"resend_email_id" text,
	"customer_id" integer,
	"type" text NOT NULL,
	"detail" text,
	"url" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flows" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"status_reason" text,
	"anchor_at" timestamp with time zone NOT NULL,
	"includes_f3" boolean DEFAULT false NOT NULL,
	"f3_sent" boolean DEFAULT false NOT NULL,
	"is_control" boolean DEFAULT false NOT NULL,
	"decline_reason" text,
	"recovery_url" text,
	"started_by_event_id" integer,
	"is_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_key" text NOT NULL,
	"match_type" text NOT NULL,
	"value" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"customer_id" integer NOT NULL,
	"product_key" text NOT NULL,
	"amount_cents" integer,
	"currency" text,
	"status" text DEFAULT 'approved' NOT NULL,
	"purchased_at" timestamp with time zone NOT NULL,
	"refunded_at" timestamp with time zone,
	"attribution" text DEFAULT 'direct' NOT NULL,
	"attributed_email_id" uuid,
	"webhook_event_id" integer,
	"is_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flow_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"template_key" text NOT NULL,
	"offer_key" text,
	"step_order" integer NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"original_scheduled_for" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"status_reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"locked_at" timestamp with time zone,
	"resend_id" text,
	"sent_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"rendered_subject" text,
	"rendered_html" text,
	"rendered_text" text,
	"is_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"normalized" jsonb,
	"event_type" text,
	"product_key" text,
	"customer_id" integer,
	"status" text DEFAULT 'received' NOT NULL,
	"status_reason" text,
	"error" text,
	"processed_at" timestamp with time zone,
	"is_test" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_events" ADD CONSTRAINT "customer_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_scheduled_email_id_scheduled_emails_id_fk" FOREIGN KEY ("scheduled_email_id") REFERENCES "public"."scheduled_emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_started_by_event_id_webhook_events_id_fk" FOREIGN KEY ("started_by_event_id") REFERENCES "public"."webhook_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_attributed_email_id_scheduled_emails_id_fk" FOREIGN KEY ("attributed_email_id") REFERENCES "public"."scheduled_emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_webhook_event_id_webhook_events_id_fk" FOREIGN KEY ("webhook_event_id") REFERENCES "public"."webhook_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD CONSTRAINT "scheduled_emails_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD CONSTRAINT "scheduled_emails_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_events_customer_idx" ON "customer_events" USING btree ("customer_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_uq" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customers_created_idx" ON "customers" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_events_provider_uq" ON "email_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "email_events_email_idx" ON "email_events" USING btree ("scheduled_email_id","type");--> statement-breakpoint
CREATE INDEX "email_events_customer_idx" ON "email_events" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "flows_customer_idx" ON "flows" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "flows_status_idx" ON "flows" USING btree ("type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "flows_one_upsell_uq" ON "flows" USING btree ("customer_id") WHERE "flows"."type" = 'upsell';--> statement-breakpoint
CREATE UNIQUE INDEX "flows_one_active_recovery_uq" ON "flows" USING btree ("customer_id") WHERE "flows"."type" <> 'upsell' and "flows"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "product_mappings_match_uq" ON "product_mappings" USING btree ("match_type","value");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_transaction_uq" ON "purchases" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "purchases_customer_idx" ON "purchases" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "purchases_date_idx" ON "purchases" USING btree ("purchased_at");--> statement-breakpoint
CREATE INDEX "scheduled_emails_due_idx" ON "scheduled_emails" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "scheduled_emails_customer_idx" ON "scheduled_emails" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "scheduled_emails_flow_idx" ON "scheduled_emails" USING btree ("flow_id");--> statement-breakpoint
CREATE INDEX "scheduled_emails_resend_idx" ON "scheduled_emails" USING btree ("resend_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_dedupe_uq" ON "webhook_events" USING btree ("provider","dedupe_key") WHERE "webhook_events"."is_duplicate" = false;--> statement-breakpoint
CREATE INDEX "webhook_events_status_idx" ON "webhook_events" USING btree ("status","received_at");--> statement-breakpoint
CREATE INDEX "webhook_events_customer_idx" ON "webhook_events" USING btree ("customer_id");