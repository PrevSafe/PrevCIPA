-- =====================================================================
-- 0004 — RPCs públicas (PWA do eleitor, papel `anon`)
-- Toda a superfície de ataque do eleitor está nestas 4 funções.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guard: eleição precisa estar ABERTA e dentro da janela
-- ---------------------------------------------------------------------
create or replace function app.assert_eleicao_aberta(p_eleicao_id uuid)
returns public.eleicoes
language plpgsql
stable
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_eleicao public.eleicoes;
begin
  select * into v_eleicao from public.eleicoes where id = p_eleicao_id;

  if not found then
    raise exception 'ELEICAO_NAO_ENCONTRADA' using errcode = 'no_data_found';
  end if;
  if v_eleicao.status <> 'ABERTA' then
    raise exception 'ELEICAO_NAO_ABERTA' using errcode = 'raise_exception';
  end if;
  if now() < v_eleicao.data_inicio then
    raise exception 'ELEICAO_NAO_INICIADA' using errcode = 'raise_exception';
  end if;
  if now() > v_eleicao.data_fim then
    raise exception 'ELEICAO_ENCERRADA' using errcode = 'raise_exception';
  end if;

  return v_eleicao;
end;
$$;

-- Valida que o candidato pertence à eleição e teve inscrição deferida.
create or replace function app.assert_candidato_valido(p_eleicao_id uuid, p_candidato_id uuid)
returns void
language plpgsql
stable
set search_path = public, pg_catalog, pg_temp
as $$
begin
  if not exists (
    select 1 from public.candidatos
    where id = p_candidato_id
      and eleicao_id = p_eleicao_id
      and inscricao_status = 'DEFERIDA'
  ) then
    raise exception 'CANDIDATO_INVALIDO' using errcode = 'raise_exception';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC 1 — Cédula pública (o que o PWA renderiza)
-- Nunca devolve `total_votos`.
-- ---------------------------------------------------------------------
create or replace function public.obter_cedula(p_eleicao_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
declare
  v_eleicao public.eleicoes;
  v_empresa public.empresas_clientes;
begin
  select * into v_eleicao from public.eleicoes where id = p_eleicao_id;
  if not found then
    raise exception 'ELEICAO_NAO_ENCONTRADA' using errcode = 'no_data_found';
  end if;

  select * into v_empresa from public.empresas_clientes where id = v_eleicao.empresa_id;

  return json_build_object(
    'eleicao', json_build_object(
      'id',                  v_eleicao.id,
      'titulo',              v_eleicao.titulo,
      'tipo',                v_eleicao.tipo,
      'gestao',              v_eleicao.gestao,
      'status',              v_eleicao.status,
      'data_inicio',         v_eleicao.data_inicio,
      'data_fim',            v_eleicao.data_fim,
      'permite_voto_branco', v_eleicao.permite_voto_branco,
      'permite_voto_nulo',   v_eleicao.permite_voto_nulo,
      'permite_qr_code',     v_eleicao.permite_qr_code,
      'aceitando_votos',     (v_eleicao.status = 'ABERTA'
                              and now() between v_eleicao.data_inicio and v_eleicao.data_fim)
    ),
    'empresa', json_build_object(
      'razao_social',  v_empresa.razao_social,
      'nome_fantasia', v_empresa.nome_fantasia
    ),
    'candidatos', coalesce((
      select json_agg(c order by c.ordem nulls last, c.numero_urna nulls last, c.nome_urna)
      from (
        select id, numero_urna, nome_urna, cargo_funcao, setor, foto_url, ordem
        from public.candidatos
        where eleicao_id = p_eleicao_id and inscricao_status = 'DEFERIDA'
      ) c
    ), '[]'::json)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- RPC 2 — Validação do Link Mágico
-- O token é a credencial; NUNCA aceitar `eleitor_id` vindo do cliente.
-- ---------------------------------------------------------------------
create or replace function public.validar_token_magico(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
declare
  v_eleitor public.eleitores;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'TOKEN_INVALIDO' using errcode = 'raise_exception';
  end if;

  select * into v_eleitor
  from public.eleitores
  where token_hash = app.hash_token(p_token);

  if not found then
    raise exception 'TOKEN_INVALIDO' using errcode = 'raise_exception';
  end if;
  if v_eleitor.token_expira_em is not null and now() > v_eleitor.token_expira_em then
    raise exception 'TOKEN_EXPIRADO' using errcode = 'raise_exception';
  end if;

  return json_build_object(
    'eleicao_id',  v_eleitor.eleicao_id,
    'nome',        split_part(v_eleitor.nome, ' ', 1),
    'cpf_mascara', app.mascara_cpf(v_eleitor.cpf),
    'ja_votou',    v_eleitor.status_voto
  );
end;
$$;

-- ---------------------------------------------------------------------
-- RPC 3 — Voto pela Porta A (Link Mágico)
-- Computa o voto e assina a presença na MESMA transação.
-- ---------------------------------------------------------------------
create or replace function public.registrar_voto_link(
  p_token       text,
  p_tipo_voto   public.tipo_voto default 'NOMINAL',
  p_candidato_id uuid            default null,
  p_ip          text             default null,
  p_user_agent  text             default null
)
returns json
language plpgsql
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
declare
  v_eleitor public.eleitores;
  v_eleicao public.eleicoes;
begin
  -- 1) Autenticação pelo token + lock pessimista da linha do eleitor
  select * into v_eleitor
  from public.eleitores
  where token_hash = app.hash_token(coalesce(p_token, ''))
  for update;

  if not found then
    raise exception 'TOKEN_INVALIDO' using errcode = 'raise_exception';
  end if;
  if v_eleitor.token_expira_em is not null and now() > v_eleitor.token_expira_em then
    raise exception 'TOKEN_EXPIRADO' using errcode = 'raise_exception';
  end if;

  -- 2) Estado da eleição
  v_eleicao := app.assert_eleicao_aberta(v_eleitor.eleicao_id);

  -- 3) Unicidade do voto
  if v_eleitor.status_voto then
    raise exception 'JA_VOTOU' using errcode = 'raise_exception';
  end if;
  if exists (
    select 1 from public.lista_assinaturas
    where eleicao_id = v_eleitor.eleicao_id and cpf = v_eleitor.cpf
  ) then
    raise exception 'JA_VOTOU' using errcode = 'raise_exception';
  end if;
  if exists (
    select 1 from public.urna_quarentena
    where eleicao_id = v_eleitor.eleicao_id
      and cpf_declarado = v_eleitor.cpf
      and status_analise = 'PENDENTE'
  ) then
    raise exception 'VOTO_EM_ANALISE' using errcode = 'raise_exception';
  end if;

  -- 4) Regras da cédula
  if p_tipo_voto = 'NOMINAL' then
    if p_candidato_id is null then
      raise exception 'CANDIDATO_OBRIGATORIO' using errcode = 'raise_exception';
    end if;
    perform app.assert_candidato_valido(v_eleitor.eleicao_id, p_candidato_id);
    update public.candidatos
       set total_votos = total_votos + 1
     where id = p_candidato_id;

  elsif p_tipo_voto = 'BRANCO' then
    if not v_eleicao.permite_voto_branco then
      raise exception 'BRANCO_NAO_PERMITIDO' using errcode = 'raise_exception';
    end if;
    update public.eleicoes set votos_branco = votos_branco + 1 where id = v_eleicao.id;

  else -- NULO
    if not v_eleicao.permite_voto_nulo then
      raise exception 'NULO_NAO_PERMITIDO' using errcode = 'raise_exception';
    end if;
    update public.eleicoes set votos_nulo = votos_nulo + 1 where id = v_eleicao.id;
  end if;

  -- 5) Assinatura da lista de presença (identidade, sem escolha)
  insert into public.lista_assinaturas
    (eleicao_id, eleitor_id, nome, cpf, cargo, data_hora_voto, ip_dispositivo, origem_voto)
  values
    (v_eleitor.eleicao_id, v_eleitor.id, v_eleitor.nome, v_eleitor.cpf,
     v_eleitor.cargo_funcao, now(), p_ip::inet, 'LINK_MAGICO');

  -- 6) Marca o eleitor. O token continua válido de propósito: se a pessoa
  -- reabrir o link, `validar_token_magico` devolve ja_votou = true e o PWA
  -- mostra o comprovante em vez de "link inválido".
  update public.eleitores
     set status_voto = true,
         votou_em    = now()
   where id = v_eleitor.id;

  insert into public.logs_auditoria (eleicao_id, empresa_id, acao, detalhes, ip)
  values (v_eleicao.id, v_eleicao.empresa_id, 'VOTO_REGISTRADO',
          jsonb_build_object('origem', 'LINK_MAGICO'), p_ip::inet);

  return json_build_object('status', 'sucesso', 'origem', 'LINK_MAGICO');
end;
$$;

-- ---------------------------------------------------------------------
-- RPC 4 — Voto pela Porta B (QR Code / autodeclaração)
-- Vai para quarentena. Nada é computado aqui.
-- ---------------------------------------------------------------------
create or replace function public.registrar_voto_qr(
  p_eleicao_id  uuid,
  p_cpf         text,
  p_nome        text,
  p_cargo       text default null,
  p_tipo_voto   public.tipo_voto default 'NOMINAL',
  p_candidato_id uuid default null,
  p_ip          text default null,
  p_user_agent  text default null
)
returns json
language plpgsql
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
declare
  v_eleicao public.eleicoes;
  v_cpf     text;
begin
  v_eleicao := app.assert_eleicao_aberta(p_eleicao_id);

  if not v_eleicao.permite_qr_code then
    raise exception 'QR_CODE_DESABILITADO' using errcode = 'raise_exception';
  end if;

  v_cpf := app.somente_digitos(coalesce(p_cpf, ''));
  if not app.cpf_valido(v_cpf) then
    raise exception 'CPF_INVALIDO' using errcode = 'raise_exception';
  end if;
  if p_nome is null or length(btrim(p_nome)) < 5 or position(' ' in btrim(p_nome)) = 0 then
    raise exception 'NOME_INVALIDO' using errcode = 'raise_exception';
  end if;

  -- Bloqueio de CPF: já assinou, já tem envelope pendente, ou já votou pelo link
  if exists (
    select 1 from public.lista_assinaturas
    where eleicao_id = p_eleicao_id and cpf = v_cpf
  ) then
    raise exception 'JA_VOTOU' using errcode = 'raise_exception';
  end if;
  if exists (
    select 1 from public.urna_quarentena
    where eleicao_id = p_eleicao_id and cpf_declarado = v_cpf and status_analise = 'PENDENTE'
  ) then
    raise exception 'VOTO_EM_ANALISE' using errcode = 'raise_exception';
  end if;
  if exists (
    select 1 from public.eleitores
    where eleicao_id = p_eleicao_id and cpf = v_cpf and status_voto
  ) then
    raise exception 'JA_VOTOU' using errcode = 'raise_exception';
  end if;

  if p_tipo_voto = 'NOMINAL' then
    if p_candidato_id is null then
      raise exception 'CANDIDATO_OBRIGATORIO' using errcode = 'raise_exception';
    end if;
    perform app.assert_candidato_valido(p_eleicao_id, p_candidato_id);
  elsif p_tipo_voto = 'BRANCO' and not v_eleicao.permite_voto_branco then
    raise exception 'BRANCO_NAO_PERMITIDO' using errcode = 'raise_exception';
  elsif p_tipo_voto = 'NULO' and not v_eleicao.permite_voto_nulo then
    raise exception 'NULO_NAO_PERMITIDO' using errcode = 'raise_exception';
  end if;

  begin
    insert into public.urna_quarentena (
      eleicao_id, nome_declarado, cpf_declarado, cargo_declarado,
      ip_dispositivo, user_agent, data_hora,
      candidato_escolhido_id, tipo_voto, status_analise
    ) values (
      p_eleicao_id, p_nome, v_cpf, p_cargo,
      p_ip::inet, left(coalesce(p_user_agent, ''), 400), now(),
      case when p_tipo_voto = 'NOMINAL' then p_candidato_id else null end,
      p_tipo_voto, 'PENDENTE'
    );
  exception when unique_violation then
    -- corrida entre dois envios simultâneos do mesmo CPF
    raise exception 'VOTO_EM_ANALISE' using errcode = 'raise_exception';
  end;

  insert into public.logs_auditoria (eleicao_id, empresa_id, acao, detalhes, ip)
  values (p_eleicao_id, v_eleicao.empresa_id, 'VOTO_QUARENTENA',
          jsonb_build_object('cpf_mascara', app.mascara_cpf(v_cpf)), p_ip::inet);

  return json_build_object('status', 'quarentena', 'origem', 'QR_CODE');
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões: só estas 4 funções ficam expostas ao papel anônimo
-- ---------------------------------------------------------------------
revoke execute on function public.obter_cedula(uuid) from public;
revoke execute on function public.validar_token_magico(text) from public;
revoke execute on function public.registrar_voto_link(text, public.tipo_voto, uuid, text, text) from public;
revoke execute on function public.registrar_voto_qr(uuid, text, text, text, public.tipo_voto, uuid, text, text) from public;

grant execute on function public.obter_cedula(uuid) to anon, authenticated;
grant execute on function public.validar_token_magico(text) to anon, authenticated;
grant execute on function public.registrar_voto_link(text, public.tipo_voto, uuid, text, text) to anon, authenticated;
grant execute on function public.registrar_voto_qr(uuid, text, text, text, public.tipo_voto, uuid, text, text) to anon, authenticated;
