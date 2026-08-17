-- =====================================================================
-- 0001 — Extensões, tipos (ENUMs) e funções utilitárias
-- Projeto: SaaS CIPA/CIPATR Digital
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Schema privado para helpers. Nada aqui é exposto via PostgREST.
create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1. Tipos enumerados
-- ---------------------------------------------------------------------
do $$ begin
  create type public.papel_usuario as enum (
    'SUPER_ADMIN',            -- equipe da plataforma
    'CONSULTORIA_ADMIN',      -- dono da consultoria SST
    'CONSULTORIA_OPERADOR',   -- técnico/analista da consultoria
    'SESMT_CLIENTE'           -- usuário da empresa cliente (escopo 1 empresa)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.eleicao_tipo as enum ('NR-05', 'NR-31');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.eleicao_status as enum (
    'RASCUNHO', 'AGENDADA', 'ABERTA', 'ENCERRADA', 'APURADA', 'CANCELADA'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.origem_voto as enum ('LINK_MAGICO', 'QR_CODE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_voto as enum ('NOMINAL', 'BRANCO', 'NULO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.status_analise as enum ('PENDENTE', 'APROVADO', 'REJEITADO');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Helpers genéricos
-- ---------------------------------------------------------------------

-- Remove qualquer caractere não numérico (CPF/CNPJ/telefone).
create or replace function app.somente_digitos(p_texto text)
returns text
language sql
immutable strict
set search_path = pg_catalog, pg_temp
as $$
  select regexp_replace(p_texto, '\D', '', 'g');
$$;

-- Validação real de CPF (dígitos verificadores). Usada em CHECK constraints.
create or replace function app.cpf_valido(p_cpf text)
returns boolean
language plpgsql
immutable
set search_path = app, pg_catalog, pg_temp
as $$
declare
  v_cpf  text;
  v_soma int;
  v_dig  int;
  i      int;
begin
  if p_cpf is null then
    return false;
  end if;

  v_cpf := app.somente_digitos(p_cpf);

  if length(v_cpf) <> 11 then
    return false;
  end if;

  -- Rejeita sequências repetidas (000..., 111..., 999...)
  if v_cpf ~ '^(\d)\1{10}$' then
    return false;
  end if;

  -- 1º dígito verificador
  v_soma := 0;
  for i in 1..9 loop
    v_soma := v_soma + substr(v_cpf, i, 1)::int * (11 - i);
  end loop;
  v_dig := 11 - (v_soma % 11);
  if v_dig >= 10 then v_dig := 0; end if;
  if v_dig <> substr(v_cpf, 10, 1)::int then
    return false;
  end if;

  -- 2º dígito verificador
  v_soma := 0;
  for i in 1..10 loop
    v_soma := v_soma + substr(v_cpf, i, 1)::int * (12 - i);
  end loop;
  v_dig := 11 - (v_soma % 11);
  if v_dig >= 10 then v_dig := 0; end if;

  return v_dig = substr(v_cpf, 11, 1)::int;
end;
$$;

-- Máscara para exibição em painel/ata: 123.***.**9-00 -> ***.456.789-**
create or replace function app.mascara_cpf(p_cpf text)
returns text
language sql
immutable
set search_path = app, pg_catalog, pg_temp
as $$
  select case
    when p_cpf is null or length(app.somente_digitos(p_cpf)) <> 11 then null
    else '***.' || substr(app.somente_digitos(p_cpf), 4, 3)
         || '.' || substr(app.somente_digitos(p_cpf), 7, 3) || '-**'
  end;
$$;

-- Hash SHA-256 do token mágico. O token em claro NUNCA é persistido.
create or replace function app.hash_token(p_token text)
returns text
language sql
immutable strict
set search_path = extensions, public, pg_catalog, pg_temp
as $$
  select encode(digest(p_token, 'sha256'), 'hex');
$$;

-- Gera token opaco de 48 caracteres, URL-safe (hex).
create or replace function app.novo_token()
returns text
language sql
volatile
set search_path = extensions, public, pg_catalog, pg_temp
as $$
  select encode(gen_random_bytes(24), 'hex');
$$;

-- Triggers de normalização (rodam ANTES do CHECK constraint).
create or replace function app.tg_normaliza_cpf_eleitor()
returns trigger
language plpgsql
set search_path = app, public, pg_catalog, pg_temp
as $$
begin
  new.cpf := app.somente_digitos(new.cpf);
  new.nome := btrim(regexp_replace(new.nome, '\s+', ' ', 'g'));
  return new;
end;
$$;

create or replace function app.tg_normaliza_cpf_quarentena()
returns trigger
language plpgsql
set search_path = app, public, pg_catalog, pg_temp
as $$
begin
  new.cpf_declarado := app.somente_digitos(new.cpf_declarado);
  new.nome_declarado := btrim(regexp_replace(new.nome_declarado, '\s+', ' ', 'g'));
  return new;
end;
$$;

create or replace function app.tg_normaliza_cpf_assinatura()
returns trigger
language plpgsql
set search_path = app, public, pg_catalog, pg_temp
as $$
begin
  new.cpf := app.somente_digitos(new.cpf);
  return new;
end;
$$;

-- Nenhuma função de app é exposta ao PostgREST (schema fora do exposed_schemas).
revoke execute on all functions in schema app from public;
grant execute on all functions in schema app to anon, authenticated, service_role;
