-- =====================================================================
-- 0003 — Row Level Security, helpers de tenant e GRANTs
-- Princípio: o papel `anon` (eleitor no PWA) NÃO enxerga tabela nenhuma.
--            Ele interage exclusivamente via RPCs SECURITY DEFINER (0004).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helpers de tenant (SECURITY DEFINER para evitar recursão de RLS)
-- ---------------------------------------------------------------------
create or replace function app.perfil_atual()
returns public.perfis
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select p.* from public.perfis p where p.id = auth.uid() and p.ativo;
$$;

create or replace function app.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo and p.papel = 'SUPER_ADMIN'
  );
$$;

create or replace function app.consultoria_atual()
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select p.consultoria_id from public.perfis p where p.id = auth.uid() and p.ativo;
$$;

-- O usuário logado pode operar esta empresa cliente?
create or replace function app.tem_acesso_empresa(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select exists (
    select 1
    from public.perfis p
    join public.empresas_clientes e on e.id = p_empresa_id
    where p.id = auth.uid()
      and p.ativo
      and (
        p.papel = 'SUPER_ADMIN'
        or (
          p.consultoria_id = e.consultoria_id
          and (p.empresa_id is null or p.empresa_id = e.id)
        )
      )
  );
$$;

-- Atalho para as tabelas filhas da eleição.
create or replace function app.tem_acesso_eleicao(p_eleicao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
  select exists (
    select 1 from public.eleicoes el
    where el.id = p_eleicao_id and app.tem_acesso_empresa(el.empresa_id)
  );
$$;

-- Ações estruturais (abrir/encerrar eleição, apagar dados) exigem papel de gestão.
create or replace function app.pode_administrar(p_eleicao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
  select app.tem_acesso_eleicao(p_eleicao_id)
     and exists (
       select 1 from public.perfis p
       where p.id = auth.uid() and p.ativo
         and p.papel in ('SUPER_ADMIN', 'CONSULTORIA_ADMIN', 'CONSULTORIA_OPERADOR')
     );
$$;

grant execute on all functions in schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Reset de privilégios (Supabase concede acesso amplo por padrão)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

alter table public.consultorias       enable row level security;
alter table public.empresas_clientes  enable row level security;
alter table public.perfis             enable row level security;
alter table public.eleicoes           enable row level security;
alter table public.eleitores          enable row level security;
alter table public.candidatos         enable row level security;
alter table public.urna_quarentena    enable row level security;
alter table public.lista_assinaturas  enable row level security;
alter table public.logs_auditoria     enable row level security;

-- ⚠️ Não usar FORCE ROW LEVEL SECURITY nestas tabelas: as RPCs SECURITY DEFINER
-- rodam como owner e precisam gravar na urna/lista de presença sem policy de INSERT.

-- ---------------------------------------------------------------------
-- 3. GRANTs por coluna
-- ---------------------------------------------------------------------
grant select on public.consultorias, public.empresas_clientes, public.perfis,
                public.eleicoes, public.eleitores, public.candidatos,
                public.lista_assinaturas, public.logs_auditoria
  to authenticated;

grant insert, update, delete on public.empresas_clientes, public.eleicoes,
                                public.eleitores, public.candidatos
  to authenticated;

grant update on public.perfis to authenticated;

-- 🔒 urna_quarentena: a comissão NUNCA pode ler `candidato_escolhido_id`.
-- Sem GRANT na coluna, mesmo um SELECT * via PostgREST falha.
grant select (
  id, eleicao_id, nome_declarado, cpf_declarado, cargo_declarado,
  setor_declarado, ip_dispositivo, user_agent, data_hora, tipo_voto,
  status_analise, analisado_por, analisado_em, motivo_rejeicao
) on public.urna_quarentena to authenticated;

-- Nada para o eleitor anônimo.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- 4. Policies
-- ---------------------------------------------------------------------

-- consultorias
drop policy if exists consultorias_select on public.consultorias;
create policy consultorias_select on public.consultorias
  for select to authenticated
  using (id = app.consultoria_atual() or app.is_super_admin());

-- perfis: vê a si mesmo e os colegas do mesmo tenant
drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis
  for select to authenticated
  using (id = auth.uid() or consultoria_id = app.consultoria_atual() or app.is_super_admin());

drop policy if exists perfis_update_self on public.perfis;
create policy perfis_update_self on public.perfis
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
-- NOTA: criação de perfis e troca de `papel`/`consultoria_id` só via service_role
-- (Edge Function de convite). Ver README §Onboarding.

-- empresas_clientes
drop policy if exists empresas_all on public.empresas_clientes;
create policy empresas_all on public.empresas_clientes
  for all to authenticated
  using (app.tem_acesso_empresa(id))
  with check (
    consultoria_id = app.consultoria_atual() or app.is_super_admin()
  );

-- eleicoes
drop policy if exists eleicoes_all on public.eleicoes;
create policy eleicoes_all on public.eleicoes
  for all to authenticated
  using (app.tem_acesso_empresa(empresa_id))
  with check (app.tem_acesso_empresa(empresa_id));

-- eleitores / candidatos
drop policy if exists eleitores_all on public.eleitores;
create policy eleitores_all on public.eleitores
  for all to authenticated
  using (app.tem_acesso_eleicao(eleicao_id))
  with check (app.tem_acesso_eleicao(eleicao_id));

drop policy if exists candidatos_all on public.candidatos;
create policy candidatos_all on public.candidatos
  for all to authenticated
  using (app.tem_acesso_eleicao(eleicao_id))
  with check (app.tem_acesso_eleicao(eleicao_id));

-- urna_quarentena: somente leitura (colunas permitidas). Escrita só via RPC.
drop policy if exists quarentena_select on public.urna_quarentena;
create policy quarentena_select on public.urna_quarentena
  for select to authenticated
  using (app.tem_acesso_eleicao(eleicao_id));

-- lista_assinaturas: imutável pela aplicação. Somente leitura.
drop policy if exists assinaturas_select on public.lista_assinaturas;
create policy assinaturas_select on public.lista_assinaturas
  for select to authenticated
  using (app.tem_acesso_eleicao(eleicao_id));

-- logs
drop policy if exists logs_select on public.logs_auditoria;
create policy logs_select on public.logs_auditoria
  for select to authenticated
  using (
    (eleicao_id is null and app.is_super_admin())
    or app.tem_acesso_eleicao(eleicao_id)
  );

-- ---------------------------------------------------------------------
-- 5. Trava de integridade da lista de presença
-- ---------------------------------------------------------------------
-- Nem admin autenticado pode editar/apagar assinatura ou contador de votos.
create or replace function app.tg_bloqueia_alteracao()
returns trigger
language plpgsql
set search_path = public, pg_catalog, pg_temp
as $$
begin
  raise exception 'Registro imutável: alterações só são permitidas via RPC de apuração.'
    using errcode = 'insufficient_privilege';
end;
$$;

-- A lista de presença é append-only. Nenhuma RPC deste projeto faz UPDATE/DELETE
-- nela; se um dia precisar (correção judicial), desabilite a trigger explicitamente
-- em uma migração dedicada, deixando rastro no histórico.
-- Efeito colateral desejado: como a trigger dispara também em DELETE em cascata,
-- uma eleição que já recebeu votos não pode ser apagada (só CANCELADA).
drop trigger if exists trg_assinaturas_imutavel on public.lista_assinaturas;
create trigger trg_assinaturas_imutavel
  before update or delete on public.lista_assinaturas
  for each row execute function app.tg_bloqueia_alteracao();
