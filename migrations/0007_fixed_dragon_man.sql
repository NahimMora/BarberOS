CREATE TYPE "public"."payment_method" AS ENUM('cash', 'transfer', 'card', 'mercadopago_manual', 'other');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('draft', 'pending', 'partially_paid', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."cash_movement_type" AS ENUM('sale', 'income', 'expense', 'withdrawal', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."cash_session_status" AS ENUM('open', 'closed', 'reconciled');--> statement-breakpoint
CREATE TYPE "public"."commission_status" AS ENUM('pending', 'paid', 'cancelled');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"description" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	CONSTRAINT "sale_items_quantity_positive" CHECK ("sale_items"."quantity" > 0),
	CONSTRAINT "sale_items_amounts_nonnegative" CHECK ("sale_items"."unit_price" >= 0 AND "sale_items"."line_total" >= 0),
	CONSTRAINT "sale_items_total_matches" CHECK ("sale_items"."line_total" = "sale_items"."unit_price" * "sale_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"appointment_id" uuid,
	"barber_id" uuid NOT NULL,
	"client_id" uuid,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"status" "sale_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_amounts_nonnegative" CHECK (
    "sales"."subtotal" >= 0
    AND "sales"."discount" >= 0
    AND "sales"."total" >= 0
  ),
	CONSTRAINT "sales_total_matches" CHECK ("sales"."total" = "sales"."subtotal" - "sales"."discount")
);
--> statement-breakpoint
CREATE TABLE "cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cash_session_id" uuid NOT NULL,
	"type" "cash_movement_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"reference_sale_id" uuid,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_movements_amount_valid" CHECK (
    ("cash_movements"."type" = 'adjustment' AND "cash_movements"."amount" <> 0)
    OR ("cash_movements"."type" <> 'adjustment' AND "cash_movements"."amount" > 0)
  ),
	CONSTRAINT "cash_movements_sale_reference" CHECK (
    ("cash_movements"."type" = 'sale' AND "cash_movements"."reference_sale_id" IS NOT NULL)
    OR ("cash_movements"."type" <> 'sale' AND "cash_movements"."reference_sale_id" IS NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "cash_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opening_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"closed_by" uuid,
	"closed_at" timestamp with time zone,
	"expected_cash" numeric(12, 2),
	"expected_transfer" numeric(12, 2),
	"expected_card" numeric(12, 2),
	"expected_mercadopago_manual" numeric(12, 2),
	"expected_other" numeric(12, 2),
	"expected_total" numeric(12, 2),
	"counted_cash" numeric(12, 2),
	"cash_difference" numeric(12, 2),
	"status" "cash_session_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_sessions_opening_nonnegative" CHECK ("cash_sessions"."opening_amount" >= 0),
	CONSTRAINT "cash_sessions_counted_nonnegative" CHECK ("cash_sessions"."counted_cash" IS NULL OR "cash_sessions"."counted_cash" >= 0)
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"barber_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"base_amount" numeric(12, 2) NOT NULL,
	"rate_snapshot" numeric(5, 2) NOT NULL,
	"commission_amount" numeric(12, 2) NOT NULL,
	"period" varchar(7) NOT NULL,
	"status" "commission_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commissions_amounts_nonnegative" CHECK (
    "commissions"."base_amount" >= 0
    AND "commissions"."commission_amount" >= 0
  ),
	CONSTRAINT "commissions_rate_valid" CHECK ("commissions"."rate_snapshot" >= 0 AND "commissions"."rate_snapshot" <= 100),
	CONSTRAINT "commissions_period_format" CHECK ("commissions"."period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_barber_id_users_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_reference_sale_id_sales_id_fk" FOREIGN KEY ("reference_sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_barber_id_users_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_organization_sale_idx" ON "payments" USING btree ("organization_id","sale_id");--> statement-breakpoint
CREATE INDEX "payments_organization_method_created_idx" ON "payments" USING btree ("organization_id","method","created_at");--> statement-breakpoint
CREATE INDEX "sale_items_organization_sale_idx" ON "sale_items" USING btree ("organization_id","sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_appointment_id_idx" ON "sales" USING btree ("appointment_id") WHERE "sales"."appointment_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sales_organization_branch_created_idx" ON "sales" USING btree ("organization_id","branch_id","created_at");--> statement-breakpoint
CREATE INDEX "sales_organization_status_paid_idx" ON "sales" USING btree ("organization_id","status","paid_at");--> statement-breakpoint
CREATE INDEX "cash_movements_organization_session_created_idx" ON "cash_movements" USING btree ("organization_id","cash_session_id","created_at");--> statement-breakpoint
CREATE INDEX "cash_movements_reference_sale_idx" ON "cash_movements" USING btree ("reference_sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_movements_sale_method_idx" ON "cash_movements" USING btree ("reference_sale_id","payment_method") WHERE "cash_movements"."type" = 'sale' AND "cash_movements"."reference_sale_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_sessions_one_open_per_branch_idx" ON "cash_sessions" USING btree ("branch_id") WHERE "cash_sessions"."status" = 'open';--> statement-breakpoint
CREATE INDEX "cash_sessions_organization_branch_opened_idx" ON "cash_sessions" USING btree ("organization_id","branch_id","opened_at");--> statement-breakpoint
CREATE UNIQUE INDEX "commissions_sale_id_idx" ON "commissions" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "commissions_organization_barber_period_idx" ON "commissions" USING btree ("organization_id","barber_id","period");