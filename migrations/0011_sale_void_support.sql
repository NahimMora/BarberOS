ALTER TABLE "sales" DROP CONSTRAINT "sales_paid_at_matches_status";--> statement-breakpoint
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_amount_valid";--> statement-breakpoint
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_sale_reference";--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "voided_by" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_movements_void_method_idx" ON "cash_movements" USING btree ("reference_sale_id","payment_method") WHERE "cash_movements"."type" = 'void' AND "cash_movements"."reference_sale_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_void_fields_consistent" CHECK (
    ("sales"."voided_at" IS NULL AND "sales"."voided_by" IS NULL AND "sales"."void_reason" IS NULL)
    OR ("sales"."voided_at" IS NOT NULL AND "sales"."voided_by" IS NOT NULL AND "sales"."void_reason" IS NOT NULL)
  );--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_paid_at_matches_status" CHECK (
    ("sales"."status" = 'paid' AND "sales"."paid_at" IS NOT NULL AND "sales"."voided_at" IS NULL)
    OR ("sales"."status" = 'cancelled' AND "sales"."voided_at" IS NOT NULL AND "sales"."paid_at" IS NOT NULL)
    OR ("sales"."status" = 'cancelled' AND "sales"."voided_at" IS NULL AND "sales"."paid_at" IS NULL)
    OR ("sales"."status" NOT IN ('paid', 'cancelled') AND "sales"."paid_at" IS NULL AND "sales"."voided_at" IS NULL)
  );--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_amount_valid" CHECK (
    ("cash_movements"."type" = 'adjustment' AND "cash_movements"."amount" <> 0)
    OR ("cash_movements"."type" = 'void' AND "cash_movements"."amount" < 0)
    OR ("cash_movements"."type" NOT IN ('adjustment', 'void') AND "cash_movements"."amount" > 0)
  );--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_sale_reference" CHECK (
    ("cash_movements"."type" IN ('sale', 'void') AND "cash_movements"."reference_sale_id" IS NOT NULL)
    OR ("cash_movements"."type" NOT IN ('sale', 'void') AND "cash_movements"."reference_sale_id" IS NULL)
  );
