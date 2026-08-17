-- =====================================================================
-- 0002 — Schema principal (multi-tenant + urna)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Hierarquia multi-tenant
-- ---------------------------------------------------------------------
create table if not exists public.consultorias (
  id              uuid primary key default gen_random_uuid(),
  nome_fantasia   text not null,
  razao_social    text,
  cnpj            text unique,
  plano           text not null default 'TRIAL',
  limite_empresas int  not null default 5,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.empresas_clientes (
  id                 uuid primary key default gen_random_uuid(),
  consultoria_id     uuid not null references public.consultorias(id) on delete cascade,
  razao_social       text not null,
  nome_fantasia      text,
  cnpj               text not null,
  cnae               text,
  grau_risco         smallint check (grau_risco between 1 and 4),
  total_funcionarios integer not null default 0 check (total_funcionarios >= 0),
  endereco           jsonb not null default '{}'::jsonb,
  ativo              boolean not null default true,
  created_at         timestamptz not null default now(),
  unique (consultoria_id, cnpj)
);

create index if not exists idx_empresas_consultoria
  on public.empresas_clientes (consultoria_id);

-- Perfis: espelho de auth.users com o vínculo de tenant.
create table if not exists public.perfis (
  id             uuid primary key references auth.users(id) on delete cascade,
  consultoria_id uuid references public.consultorias(id) on delete cascade,
  empresa_id     uuid references public.empresas_clientes(id) on delete set null,
  nome           text not null,
  email          text,
  papel          public.papel_usuario not null default 'CONSULTORIA_OPERADOR',
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  -- SESMT_CLIENTE precisa estar amarrado a uma empresa específica
  constraint perfis_escopo_ck check (
    papel = 'SUPER_ADMIN'
    or (consultoria_id is not null and (papel <> 'SESMT_CLIENTE' or empresa_id is not null))
  )
);

create index if not exists idx_perfis_consultoria on public.perfis (consultoria_id);

-- ---------------------------------------------------------------------
-- 2. O evento eleitoral
-- ---------------------------------------------------------------------
create table if not exists public.eleicoes (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references public.empresas_clientes(id) on delete cascade,
  titulo                text not null,
  tipo                  public.eleicao_tipo not null default 'NR-05',
  gestao                text,                       -- ex.: "2026/2027"
  data_inicio           timestamptz not null,
  data_fim              timestamptz not null,
  status                public.eleicao_status not null default 'RASCUNHO',

  -- Configuração da cédula
  permite_voto_branco   boolean not null default true,
  permite_voto_nulo     boolean not null default true,
  permite_qr_code       boolean not null default true,
  vagas_efetivos        smallint not null default 1 check (vagas_efetivos > 0),
  vagas_suplentes       smallint not null default 1 check (vagas_suplentes >= 0),

  -- Snapshot de apuração (preenchido pelas RPCs)
  total_eleitores_aptos integer not null default 0 check (total_eleitores_aptos >= 0),
  votos_branco          integer not null default 0 check (votos_branco >= 0),
  votos_nulo            integer not null default 0 check (votos_nulo >= 0),

  aberta_em             timestamptz,
  encerrada_em          timestamptz,
  ata_eleicao_md        text,
  ata_eleicao_pdf_url   text,
  ata_posse_md          text,
  ata_posse_pdf_url     text,

  created_by            uuid references public.perfis(id) on delete set null,
  created_at            timestamptz not null default now(),

  constraint eleicoes_periodo_ck check (data_fim > data_inicio)
);

create index if not exists idx_eleicoes_empresa on public.eleicoes (empresa_id);
create index if not exists idx_eleicoes_status  on public.eleicoes (status);

-- ---------------------------------------------------------------------
-- 3. Participantes
-- ---------------------------------------------------------------------

-- Lista nominal do RH (importada por CSV). É a fonte da verdade de quem é apto.
create table if not exists public.eleitores (
  id               uuid primary key default gen_random_uuid(),
  eleicao_id       uuid not null references public.eleicoes(id) on delete cascade,
  nome             text not null,
  cpf              text not null,
  matricula        text,
  cargo_funcao     text,
  setor            text,
  contato_email    text,
  contato_telefone text,

  -- Credencial do Link Mágico: guardamos SOMENTE o hash.
  token_hash       text unique,
  token_expira_em  timestamptz,
  token_enviado_em timestamptz,

  status_voto      boolean not null default false,
  votou_em         timestamptz,
  created_at       timestamptz not null default now(),

  constraint eleitores_cpf_valido_ck check (app.cpf_valido(cpf)),
  constraint eleitores_cpf_uk unique (eleicao_id, cpf)
);

create index if not exists idx_eleitores_eleicao on public.eleitores (eleicao_id);
create index if not exists idx_eleitores_cpf     on public.eleitores (eleicao_id, cpf);

drop trigger if exists trg_eleitores_normaliza on public.eleitores;
create trigger trg_eleitores_normaliza
  before insert or update on public.eleitores
  for each row execute function app.tg_normaliza_cpf_eleitor();

create table if not exists public.candidatos (
  id                uuid primary key default gen_random_uuid(),
  eleicao_id        uuid not null references public.eleicoes(id) on delete cascade,
  numero_urna       smallint,
  nome_completo     text not null,
  nome_urna         text not null,
  cpf               text,
  cargo_funcao      text,
  setor             text,
  foto_url          text,
  inscricao_status  text not null default 'DEFERIDA'
                    check (inscricao_status in ('PENDENTE', 'DEFERIDA', 'INDEFERIDA')),
  motivo_indeferimento text,

  -- Contador agregado. Ver ADR-002: não há tabela de cédulas individuais.
  total_votos       integer not null default 0 check (total_votos >= 0),

  ordem             smallint,
  created_at        timestamptz not null default now(),
  unique (eleicao_id, numero_urna)
);

create index if not exists idx_candidatos_eleicao on public.candidatos (eleicao_id);

-- ---------------------------------------------------------------------
-- 4. Transacional — a urna
-- ---------------------------------------------------------------------

-- Envelope digital do fluxo QR Code: identidade + escolha, temporariamente juntos.
create table if not exists public.urna_quarentena (
  id                     uuid primary key default gen_random_uuid(),
  eleicao_id             uuid not null references public.eleicoes(id) on delete cascade,
  nome_declarado         text not null,
  cpf_declarado          text not null,
  cargo_declarado        text,
  setor_declarado        text,
  ip_dispositivo         inet,
  user_agent             text,
  data_hora              timestamptz not null default now(),

  -- ⚠️ Campo sensível: é anulado (NULL) no instante da aprovação/rejeição.
  candidato_escolhido_id uuid references public.candidatos(id) on delete restrict,
  tipo_voto              public.tipo_voto not null default 'NOMINAL',

  status_analise         public.status_analise not null default 'PENDENTE',
  analisado_por          uuid references public.perfis(id) on delete set null,
  analisado_em           timestamptz,
  motivo_rejeicao        text,

  constraint quarentena_cpf_valido_ck check (app.cpf_valido(cpf_declarado)),
  -- Voto nominal pendente obriga candidato; branco/nulo nunca tem candidato;
  -- após análise o vínculo deve estar queimado.
  constraint quarentena_vinculo_ck check (
    case
      when tipo_voto <> 'NOMINAL' then candidato_escolhido_id is null
      when status_analise = 'PENDENTE' then candidato_escolhido_id is not null
      else candidato_escolhido_id is null
    end
  )
);

-- Barreira de banco contra múltiplos envelopes pendentes do mesmo CPF.
create unique index if not exists urna_quarentena_pendente_uk
  on public.urna_quarentena (eleicao_id, cpf_declarado)
  where status_analise = 'PENDENTE';

create index if not exists idx_quarentena_fila
  on public.urna_quarentena (eleicao_id, status_analise, data_hora);

drop trigger if exists trg_quarentena_normaliza on public.urna_quarentena;
create trigger trg_quarentena_normaliza
  before insert or update on public.urna_quarentena
  for each row execute function app.tg_normaliza_cpf_quarentena();

-- Lista de presença (NR-01 / NR-05). Prova de QUEM votou, jamais EM QUEM.
create table if not exists public.lista_assinaturas (
  id             uuid primary key default gen_random_uuid(),
  eleicao_id     uuid not null references public.eleicoes(id) on delete cascade,
  eleitor_id     uuid references public.eleitores(id) on delete set null,
  nome           text not null,
  cpf            text not null,
  cargo          text,
  data_hora_voto timestamptz not null default now(),
  ip_dispositivo inet,
  origem_voto    public.origem_voto not null,
  constraint lista_assinaturas_uk unique (eleicao_id, cpf)
);

create index if not exists idx_assinaturas_eleicao on public.lista_assinaturas (eleicao_id);

drop trigger if exists trg_assinaturas_normaliza on public.lista_assinaturas;
create trigger trg_assinaturas_normaliza
  before insert or update on public.lista_assinaturas
  for each row execute function app.tg_normaliza_cpf_assinatura();

-- ---------------------------------------------------------------------
-- 5. Auditoria
-- ---------------------------------------------------------------------
-- REGRA: nunca gravar aqui a dupla (CPF, candidato). Só metadados de processo.
create table if not exists public.logs_auditoria (
  id         bigint generated always as identity primary key,
  eleicao_id uuid references public.eleicoes(id) on delete set null,
  empresa_id uuid references public.empresas_clientes(id) on delete set null,
  ator_id    uuid,
  acao       text not null,
  detalhes   jsonb not null default '{}'::jsonb,
  ip         inet,
  created_at timestamptz not null default now()
);

create index if not exists idx_logs_eleicao on public.logs_auditoria (eleicao_id, created_at desc);
