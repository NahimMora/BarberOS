CREATE TYPE "public"."file_storage_provider" AS ENUM('supabase', 'r2');--> statement-breakpoint
ALTER TYPE "public"."file_visibility" ADD VALUE 'client_visible';--> statement-breakpoint
CREATE TABLE "client_visit_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"appointment_id" uuid,
	"file_id" uuid NOT NULL,
	"caption" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "created_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "client_booking_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "actor_client_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "nickname" varchar(100);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "birthday_day" smallint;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "birthday_month" smallint;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "profession" varchar(150);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "auth_user_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointment_history" ADD COLUMN "actor_client_id" uuid;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "created_by_client_id" uuid;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "storage_provider" "file_storage_provider" DEFAULT 'supabase' NOT NULL;--> statement-breakpoint
ALTER TABLE "client_visit_photos" ADD CONSTRAINT "client_visit_photos_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_visit_photos" ADD CONSTRAINT "client_visit_photos_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_visit_photos" ADD CONSTRAINT "client_visit_photos_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_visit_photos" ADD CONSTRAINT "client_visit_photos_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_visit_photos" ADD CONSTRAINT "client_visit_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_visit_photos" ADD CONSTRAINT "client_visit_photos_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_visit_photos_org_client_idx" ON "client_visit_photos" USING btree ("organization_id","client_id","created_at");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_client_id_clients_id_fk" FOREIGN KEY ("actor_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_history" ADD CONSTRAINT "appointment_history_actor_client_id_clients_id_fk" FOREIGN KEY ("actor_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_client_id_clients_id_fk" FOREIGN KEY ("created_by_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_auth_user_id_idx" ON "clients" USING btree ("auth_user_id") WHERE "clients"."auth_user_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_birthday_day_range" CHECK ("clients"."birthday_day" IS NULL OR ("clients"."birthday_day" BETWEEN 1 AND 31));--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_birthday_month_range" CHECK ("clients"."birthday_month" IS NULL OR ("clients"."birthday_month" BETWEEN 1 AND 12));--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_exactly_one" CHECK (("appointments"."created_by_user_id" IS NOT NULL) <> ("appointments"."created_by_client_id" IS NOT NULL));