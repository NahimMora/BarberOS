-- CI-only bootstrap. The real Supabase project provisions the `anon`,
-- `authenticated` and `service_role` roles, the `auth.uid()`/`auth.role()`
-- functions, and the `storage.buckets` table automatically as part of its
-- platform — none of that exists in the plain `postgres:16` container CI
-- uses to test RLS policies. This file recreates just enough of it for the
-- migrations and policies (which assume it's already there, same as on a
-- real Supabase project) to apply cleanly. Never run against production.

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;

create schema if not exists auth;

create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.role() returns text
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.role', true), '')::text $$;

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
