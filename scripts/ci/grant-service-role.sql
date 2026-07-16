-- CI-only, runs after migrations. On a real Supabase project `service_role`
-- already has full access to every table in `public` as part of the
-- platform bootstrap; `bootstrap-rls-roles.sql` only creates the role
-- itself (with BYPASSRLS) before migrations run, so table grants have to
-- be applied here, once the tables actually exist.

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
