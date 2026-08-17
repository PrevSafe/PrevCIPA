-- Stub local do ambiente Supabase, apenas para validar as migrações offline.
-- NÃO aplicar em produção — no Supabase esses objetos já existem.
create schema if not exists extensions;
create schema if not exists auth;

do $$ begin create role anon nologin;          exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema extensions to public;
grant usage on schema auth to anon, authenticated, service_role;
