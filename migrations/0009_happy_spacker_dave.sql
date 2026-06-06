CREATE INDEX "audit_logs_organization_created_idx" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "domain_events_organization_occurred_idx" ON "domain_events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "system_events_level_created_idx" ON "system_events" USING btree ("level","created_at");--> statement-breakpoint
CREATE INDEX "appointments_organization_branch_start_idx" ON "appointments" USING btree ("organization_id","branch_id","start_at");--> statement-breakpoint
CREATE INDEX "appointments_organization_barber_start_idx" ON "appointments" USING btree ("organization_id","barber_id","start_at");--> statement-breakpoint
CREATE INDEX "commissions_organization_period_status_idx" ON "commissions" USING btree ("organization_id","period","status");