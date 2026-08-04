CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth_key" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_organization_user_idx" ON "push_subscriptions" USING btree ("organization_id","user_id");--> statement-breakpoint

-- RLS: backstop, no defensa primaria (ver docs/DECISIONS.md — "RLS es
-- backstop"). El backend (postgres role) bypasea RLS; esto solo cierra el
-- acceso si algún día algo se conecta con un rol más restringido. No hay
-- acceso directo de cliente/anon a suscripciones push, todo pasa por
-- /api/notifications/subscribe, igual que barber_profiles en 0000_daily_marrow.sql.
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "push_subscriptions" FROM anon;--> statement-breakpoint
CREATE POLICY "service_role_push_subscriptions" ON "push_subscriptions" TO service_role USING (true);