ALTER TABLE "sales" ADD CONSTRAINT "sales_paid_at_matches_status" CHECK (
    ("sales"."status" = 'paid' AND "sales"."paid_at" IS NOT NULL)
    OR ("sales"."status" <> 'paid' AND "sales"."paid_at" IS NULL)
  );--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_state_valid" CHECK (
    (
      "cash_sessions"."status" = 'open'
      AND "cash_sessions"."closed_by" IS NULL
      AND "cash_sessions"."closed_at" IS NULL
      AND "cash_sessions"."expected_cash" IS NULL
      AND "cash_sessions"."expected_transfer" IS NULL
      AND "cash_sessions"."expected_card" IS NULL
      AND "cash_sessions"."expected_mercadopago_manual" IS NULL
      AND "cash_sessions"."expected_other" IS NULL
      AND "cash_sessions"."expected_total" IS NULL
      AND "cash_sessions"."counted_cash" IS NULL
      AND "cash_sessions"."cash_difference" IS NULL
    )
    OR (
      "cash_sessions"."status" IN ('closed', 'reconciled')
      AND "cash_sessions"."closed_by" IS NOT NULL
      AND "cash_sessions"."closed_at" IS NOT NULL
      AND "cash_sessions"."expected_cash" IS NOT NULL
      AND "cash_sessions"."expected_transfer" IS NOT NULL
      AND "cash_sessions"."expected_card" IS NOT NULL
      AND "cash_sessions"."expected_mercadopago_manual" IS NOT NULL
      AND "cash_sessions"."expected_other" IS NOT NULL
      AND "cash_sessions"."expected_total" IS NOT NULL
      AND "cash_sessions"."counted_cash" IS NOT NULL
      AND "cash_sessions"."cash_difference" = "cash_sessions"."counted_cash" - "cash_sessions"."expected_cash"
    )
  );
--> statement-breakpoint
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sale_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cash_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cash_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "sales_select_scoped"
ON "sales"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "users" actor
    WHERE actor."auth_id" = (SELECT auth.uid())
      AND actor."organization_id" = "sales"."organization_id"
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
      AND (
        actor."role" = 'admin'
        OR (
          actor."role" = 'receptionist'
          AND EXISTS (
            SELECT 1
            FROM "user_branches" membership
            WHERE membership."user_id" = actor."id"
              AND membership."branch_id" = "sales"."branch_id"
          )
        )
        OR (
          actor."role" = 'barber'
          AND actor."id" = "sales"."barber_id"
        )
      )
  )
);
--> statement-breakpoint
CREATE POLICY "sale_items_select_scoped"
ON "sale_items"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "sales" sale
    JOIN "users" actor
      ON actor."organization_id" = sale."organization_id"
    WHERE sale."id" = "sale_items"."sale_id"
      AND sale."organization_id" = "sale_items"."organization_id"
      AND actor."auth_id" = (SELECT auth.uid())
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
      AND (
        actor."role" = 'admin'
        OR (
          actor."role" = 'receptionist'
          AND EXISTS (
            SELECT 1
            FROM "user_branches" membership
            WHERE membership."user_id" = actor."id"
              AND membership."branch_id" = sale."branch_id"
          )
        )
        OR (
          actor."role" = 'barber'
          AND actor."id" = sale."barber_id"
        )
      )
  )
);
--> statement-breakpoint
CREATE POLICY "payments_select_scoped"
ON "payments"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "sales" sale
    JOIN "users" actor
      ON actor."organization_id" = sale."organization_id"
    WHERE sale."id" = "payments"."sale_id"
      AND sale."organization_id" = "payments"."organization_id"
      AND actor."auth_id" = (SELECT auth.uid())
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
      AND (
        actor."role" = 'admin'
        OR (
          actor."role" = 'receptionist'
          AND EXISTS (
            SELECT 1
            FROM "user_branches" membership
            WHERE membership."user_id" = actor."id"
              AND membership."branch_id" = sale."branch_id"
          )
        )
        OR (
          actor."role" = 'barber'
          AND actor."id" = sale."barber_id"
        )
      )
  )
);
--> statement-breakpoint
CREATE POLICY "cash_sessions_select_scoped"
ON "cash_sessions"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "users" actor
    WHERE actor."auth_id" = (SELECT auth.uid())
      AND actor."organization_id" = "cash_sessions"."organization_id"
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
      AND (
        actor."role" = 'admin'
        OR (
          actor."role" = 'receptionist'
          AND EXISTS (
            SELECT 1
            FROM "user_branches" membership
            WHERE membership."user_id" = actor."id"
              AND membership."branch_id" = "cash_sessions"."branch_id"
          )
        )
      )
  )
);
--> statement-breakpoint
CREATE POLICY "cash_movements_select_scoped"
ON "cash_movements"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "cash_sessions" session
    JOIN "users" actor
      ON actor."organization_id" = session."organization_id"
    WHERE session."id" = "cash_movements"."cash_session_id"
      AND session."organization_id" = "cash_movements"."organization_id"
      AND actor."auth_id" = (SELECT auth.uid())
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
      AND (
        actor."role" = 'admin'
        OR (
          actor."role" = 'receptionist'
          AND EXISTS (
            SELECT 1
            FROM "user_branches" membership
            WHERE membership."user_id" = actor."id"
              AND membership."branch_id" = session."branch_id"
          )
        )
      )
  )
);
--> statement-breakpoint
CREATE POLICY "commissions_select_scoped"
ON "commissions"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "users" actor
    WHERE actor."auth_id" = (SELECT auth.uid())
      AND actor."organization_id" = "commissions"."organization_id"
      AND actor."status" = 'active'
      AND actor."deleted_at" IS NULL
      AND (
        actor."role" = 'admin'
        OR (
          actor."role" = 'barber'
          AND actor."id" = "commissions"."barber_id"
        )
      )
  )
);
--> statement-breakpoint
REVOKE ALL ON TABLE
  "sales",
  "sale_items",
  "payments",
  "cash_sessions",
  "cash_movements",
  "commissions"
FROM anon, authenticated;

GRANT SELECT ON TABLE
  "sales",
  "sale_items",
  "payments",
  "cash_sessions",
  "cash_movements",
  "commissions"
TO authenticated;

GRANT ALL ON TABLE
  "sales",
  "sale_items",
  "payments",
  "cash_sessions",
  "cash_movements",
  "commissions"
TO service_role;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_financial_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Physical deletes are forbidden for financial table %', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "sales_prevent_delete"
BEFORE DELETE ON "sales"
FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();

CREATE TRIGGER "sale_items_prevent_delete"
BEFORE DELETE ON "sale_items"
FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();

CREATE TRIGGER "payments_prevent_delete"
BEFORE DELETE ON "payments"
FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();

CREATE TRIGGER "cash_sessions_prevent_delete"
BEFORE DELETE ON "cash_sessions"
FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();

CREATE TRIGGER "cash_movements_prevent_delete"
BEFORE DELETE ON "cash_movements"
FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();

CREATE TRIGGER "commissions_prevent_delete"
BEFORE DELETE ON "commissions"
FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_financial_entry_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Updates are forbidden for immutable financial table %', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "payments_prevent_update"
BEFORE UPDATE ON "payments"
FOR EACH ROW EXECUTE FUNCTION prevent_financial_entry_update();

CREATE TRIGGER "cash_movements_prevent_update"
BEFORE UPDATE ON "cash_movements"
FOR EACH ROW EXECUTE FUNCTION prevent_financial_entry_update();
