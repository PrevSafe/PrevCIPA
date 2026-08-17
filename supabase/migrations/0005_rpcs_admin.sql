-- =====================================================================
-- 0005 — RPCs do painel da consultoria (papel `authenticated`)
-- Todas checam autorização explicitamente: SECURITY DEFINER ignora RLS.
-- =====================================================================

create or replace function app.assert_acesso(p_eleicao_id uuid)
returns public.eleicoes
language plpgsql
stable
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
declare v_eleicao public.eleicoes;
begin
  select * into v_eleicao from public.eleicoes where id = p_eleicao_id;
  if not found then
    raise exception 'ELEICAO_NAO_ENCONTRADA' using errcode = 'no_data_found';
  end if;
  if not app.tem_acesso_empresa(v_eleicao.empresa_id) then
    raise exception 'ACESSO_NEGADO' using errcode = 'insufficient_privilege';
  end if;
  return v_eleicao;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Importação da lista do RH (CSV -> JSONB no frontend)
-- Payload: [{"nome":"...","cpf":"...","cargo_funcao":"...","setor":"...",
--            "contato_email":"...","contato_telefone":"...","matricula":"..."}]
-- ---------------------------------------------------------------------
create or replace function public.importar_eleitores(
  p_eleicao_id uuid,
  p_eleitores  jsonb
)
returns json
language plpgsql
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
declare
  v_eleicao    public.eleicoes;
  v_item       jsonb;
  v_cpf        text;
  v_inseridos  int := 0;
  v_atualizados int := 0;
  v_ignorados  jsonb := '[]'::jsonb;
begin
  v_eleicao := app.assert_acesso(p_eleicao_id);

  if v_eleicao.status not in ('RASCUNHO', 'AGENDADA', 'ABERTA') then
    raise exception 'ELEICAO_NAO_EDITAVEL' using errcode = 'raise_exception';
  end if;
  if jsonb_typeof(p_eleitores) <> 'array' then
    raise exception 'PAYLOAD_INVALIDO' using errcode = 'raise_exception';
  end if;

  for v_item in select * from jsonb_array_elements(p_eleitores) loop
    v_cpf := app.somente_digitos(coalesce(v_item->>'cpf', ''));

    if not app.cpf_valido(v_cpf) or coalesce(btrim(v_item->>'nome'), '') = '' then
      v_ignorados := v_ignorados || jsonb_build_object(
        'linha', v_item, 'motivo', 'CPF ou nome inválido');
      continue;
    end if;

    insert into public.eleitores (
      eleicao_id, nome, cpf, matricula, cargo_funcao, setor,
      contato_email, contato_telefone
    ) values (
      p_eleicao_id, v_item->>'nome', v_cpf, v_item->>'matricula',
      v_item->>'cargo_funcao', v_item->>'setor',
      nullif(v_item->>'contato_email', ''), nullif(v_item->>'contato_telefone', '')
    )
    on conflict (eleicao_id, cpf) do update set
      nome             = excluded.nome,
      matricula        = coalesce(excluded.matricula, public.eleitores.matricula),
      cargo_funcao     = coalesce(excluded.cargo_funcao, public.eleitores.cargo_funcao),
      setor            = coalesce(excluded.setor, public.eleitores.setor),
      contato_email    = coalesce(excluded.contato_email, public.eleitores.contato_email),
      contato_telefone = coalesce(excluded.contato_telefone, public.eleitores.contato_telefone)
    where public.eleitores.status_voto = false;

    if found then
      v_inseridos := v_inseridos + 1;
    else
      v_atualizados := v_atualizados + 1;
    end if;
  end loop;

  update public.eleicoes
     set total_eleitores_aptos = (select count(*) from public.eleitores where eleicao_id = p_eleicao_id)
   where id = p_eleicao_id;

  insert into public.logs_auditoria (eleicao_id, empresa_id, ator_id, acao, detalhes)
  values (p_eleicao_id, v_eleicao.empresa_id, auth.uid(), 'IMPORTACAO_ELEITORES',
          jsonb_build_object('processados', v_inseridos, 'ignorados', jsonb_array_length(v_ignorados)));

  return json_build_object(
    'status', 'sucesso',
    'processados', v_inseridos,
    'nao_alterados', v_atualizados,
    'ignorados', v_ignorados,
    'total_aptos', (select count(*) from public.eleitores where eleicao_id = p_eleicao_id)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Geração de Links Mágicos
-- Retorna o token EM CLARO uma única vez (para o disparo E-mail/WhatsApp).
-- O banco guarda apenas o SHA-256.
-- ---------------------------------------------------------------------
create or replace function public.gerar_tokens_eleicao(
  p_eleicao_id     uuid,
  p_validade_horas int default 168,      -- 7 dias
  p_apenas_sem_token boolean default true
)
returns table (eleitor_id uuid, nome text, contato_email text, contato_telefone text, token text)
language plpgsql
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
declare
  v_eleicao public.eleicoes;
  r         record;
  v_token   text;
begin
  v_eleicao := app.assert_acesso(p_eleicao_id);
  if not app.pode_administrar(p_eleicao_id) then
    raise exception 'ACESSO_NEGADO' using errcode = 'insufficient_privilege';
  end if;

  for r in
    select e.* from public.eleitores e
    where e.eleicao_id = p_eleicao_id
      and e.status_voto = false
      and (not p_apenas_sem_token or e.token_hash is null)
    order by e.nome
  loop
    v_token := app.novo_token();

    update public.eleitores
       set token_hash      = app.hash_token(v_token),
           token_expira_em = now() + make_interval(hours => p_validade_horas)
     where id = r.id;

    eleitor_id := r.id;
    nome := r.nome;
    contato_email := r.contato_email;
    contato_telefone := r.contato_telefone;
    token := v_token;
    return next;
  end loop;

  insert into public.logs_auditoria (eleicao_id, empresa_id, ator_id, acao)
  values (p_eleicao_id, v_eleicao.empresa_id, auth.uid(), 'TOKENS_GERADOS');
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Abertura da eleição
-- ---------------------------------------------------------------------
create or replace function public.abrir_eleicao(p_eleicao_id uuid)
returns json
language plpgsql
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
declare
  v_eleicao     public.eleicoes;
  v_candidatos  int;
  v_eleitores   int;
begin
  v_eleicao := app.assert_acesso(p_eleicao_id);
  if not app.pode_administrar(p_eleicao_id) then
    raise exception 'ACESSO_NEGADO' using errcode = 'insufficient_privilege';
  end if;
  if v_eleicao.status not in ('RASCUNHO', 'AGENDADA') then
    raise exception 'STATUS_INVALIDO' using errcode = 'raise_exception';
  end if;

  select count(*) into v_candidatos from public.candidatos
   where eleicao_id = p_eleicao_id and inscricao_status = 'DEFERIDA';
  select count(*) into v_eleitores from public.eleitores where eleicao_id = p_eleicao_id;

  if v_candidatos < 1 then
    raise exception 'SEM_CANDIDATOS_DEFERIDOS' using errcode = 'raise_exception';
  end if;
  if v_eleitores < 1 then
    raise exception 'SEM_ELEITORES_IMPORTADOS' using errcode = 'raise_exception';
  end if;

  update public.eleicoes
     set status = 'ABERTA',
         aberta_em = now(),
         total_eleitores_aptos = v_eleitores
   where id = p_eleicao_id;

  insert into public.logs_auditoria (eleicao_id, empresa_id, ator_id, acao, detalhes)
  values (p_eleicao_id, v_eleicao.empresa_id, auth.uid(), 'ELEICAO_ABERTA',
          jsonb_build_object('aptos', v_eleitores, 'candidatos', v_candidatos));

  return json_build_object('status', 'sucesso', 'aptos', v_eleitores, 'candidatos', v_candidatos);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Fila de quarentena com cruzamento automático (RH x autodeclarado)
-- ⚠️ Não expõe candidato_escolhido_id.
-- ---------------------------------------------------------------------
create or replace function public.fila_quarentena(
  p_eleicao_id uuid,
  p_status     public.status_analise default 'PENDENTE'
)
returns table (
  id uuid, nome_declarado text, cpf_mascara text, cargo_declarado text,
  data_hora timestamptz, ip_dispositivo inet, status_analise public.status_analise,
  alerta text, nome_rh text, cargo_rh text, votos_mesmo_ip int
)
language plpgsql
stable
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
begin
  perform app.assert_acesso(p_eleicao_id);

  return query
  with base as (
    select q.*,
           e.nome  as rh_nome,
           e.cargo_funcao as rh_cargo,
           e.status_voto  as rh_ja_votou,
           exists (select 1 from public.lista_assinaturas la
                    where la.eleicao_id = q.eleicao_id and la.cpf = q.cpf_declarado) as ja_assinou,
           (select count(*) from public.urna_quarentena q2
             where q2.eleicao_id = q.eleicao_id
               and q2.ip_dispositivo is not distinct from q.ip_dispositivo
               and q2.ip_dispositivo is not null)::int as mesmo_ip
    from public.urna_quarentena q
    left join public.eleitores e
           on e.eleicao_id = q.eleicao_id and e.cpf = q.cpf_declarado
    where q.eleicao_id = p_eleicao_id
      and q.status_analise = p_status
  )
  select
    b.id,
    b.nome_declarado,
    app.mascara_cpf(b.cpf_declarado),
    b.cargo_declarado,
    b.data_hora,
    b.ip_dispositivo,
    b.status_analise,
    case
      when b.ja_assinou or b.rh_ja_votou then 'TENTATIVA_DUPLICADA'
      when b.rh_nome is null             then 'CPF_NAO_ENCONTRADO_RH'
      when upper(btrim(split_part(b.rh_nome, ' ', 1)))
           <> upper(btrim(split_part(b.nome_declarado, ' ', 1)))
                                         then 'DIVERGENCIA_NOME'
      when b.mesmo_ip >= 5               then 'MULTIPLOS_VOTOS_MESMO_IP'
      else 'OK'
    end as alerta,
    b.rh_nome,
    b.rh_cargo,
    b.mesmo_ip
  from base b
  order by b.data_hora;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Aprovação — o milissegundo em que voto e identidade se separam
-- ---------------------------------------------------------------------
create or replace function public.aprovar_voto_quarentena(p_quarentena_id uuid)
returns json
language plpgsql
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
declare
  v_q       public.urna_quarentena;
  v_eleicao public.eleicoes;
begin
  select * into v_q from public.urna_quarentena where id = p_quarentena_id for update;
  if not found then
    raise exception 'ENVELOPE_NAO_ENCONTRADO' using errcode = 'no_data_found';
  end if;

  v_eleicao := app.assert_acesso(v_q.eleicao_id);

  if v_q.status_analise <> 'PENDENTE' then
    raise exception 'VOTO_JA_PROCESSADO' using errcode = 'raise_exception';
  end if;
  if v_eleicao.status not in ('ABERTA', 'ENCERRADA') then
    raise exception 'STATUS_INVALIDO' using errcode = 'raise_exception';
  end if;
  -- Corrida contra um voto por Link Mágico do mesmo CPF
  if exists (
    select 1 from public.lista_assinaturas
    where eleicao_id = v_q.eleicao_id and cpf = v_q.cpf_declarado
  ) then
    raise exception 'CPF_JA_ASSINOU' using errcode = 'raise_exception';
  end if;

  -- 1) Computa o voto
  if v_q.tipo_voto = 'NOMINAL' then
    update public.candidatos
       set total_votos = total_votos + 1
     where id = v_q.candidato_escolhido_id and eleicao_id = v_q.eleicao_id;
    if not found then
      raise exception 'CANDIDATO_INVALIDO' using errcode = 'raise_exception';
    end if;
  elsif v_q.tipo_voto = 'BRANCO' then
    update public.eleicoes set votos_branco = votos_branco + 1 where id = v_q.eleicao_id;
  else
    update public.eleicoes set votos_nulo = votos_nulo + 1 where id = v_q.eleicao_id;
  end if;

  -- 2) Assina a lista de presença
  insert into public.lista_assinaturas
    (eleicao_id, eleitor_id, nome, cpf, cargo, data_hora_voto, ip_dispositivo, origem_voto)
  values
    (v_q.eleicao_id,
     (select id from public.eleitores
       where eleicao_id = v_q.eleicao_id and cpf = v_q.cpf_declarado),
     v_q.nome_declarado, v_q.cpf_declarado, v_q.cargo_declarado,
     v_q.data_hora, v_q.ip_dispositivo, 'QR_CODE');

  -- 3) 🔥 QUEIMA O VÍNCULO (NR-05 / LGPD): a escolha deixa de existir no banco
  update public.urna_quarentena
     set status_analise         = 'APROVADO',
         candidato_escolhido_id = null,
         analisado_por          = auth.uid(),
         analisado_em           = now()
   where id = p_quarentena_id;

  -- 4) Marca o eleitor da lista do RH (se existir)
  update public.eleitores
     set status_voto = true, votou_em = coalesce(votou_em, v_q.data_hora)
   where eleicao_id = v_q.eleicao_id and cpf = v_q.cpf_declarado;

  insert into public.logs_auditoria (eleicao_id, empresa_id, ator_id, acao, detalhes)
  values (v_q.eleicao_id, v_eleicao.empresa_id, auth.uid(), 'QUARENTENA_APROVADA',
          jsonb_build_object('cpf_mascara', app.mascara_cpf(v_q.cpf_declarado)));

  return json_build_object('status', 'sucesso');
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Rejeição
-- ---------------------------------------------------------------------
create or replace function public.rejeitar_voto_quarentena(
  p_quarentena_id uuid,
  p_motivo        text
)
returns json
language plpgsql
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
declare
  v_q       public.urna_quarentena;
  v_eleicao public.eleicoes;
begin
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'MOTIVO_OBRIGATORIO' using errcode = 'raise_exception';
  end if;

  select * into v_q from public.urna_quarentena where id = p_quarentena_id for update;
  if not found then
    raise exception 'ENVELOPE_NAO_ENCONTRADO' using errcode = 'no_data_found';
  end if;

  v_eleicao := app.assert_acesso(v_q.eleicao_id);

  if v_q.status_analise <> 'PENDENTE' then
    raise exception 'VOTO_JA_PROCESSADO' using errcode = 'raise_exception';
  end if;

  -- O vínculo também é queimado na rejeição: o voto não é computado e a
  -- escolha de quem foi barrado não pode ficar registrada.
  update public.urna_quarentena
     set status_analise         = 'REJEITADO',
         candidato_escolhido_id = null,
         motivo_rejeicao        = p_motivo,
         analisado_por          = auth.uid(),
         analisado_em           = now()
   where id = p_quarentena_id;

  insert into public.logs_auditoria (eleicao_id, empresa_id, ator_id, acao, detalhes)
  values (v_q.eleicao_id, v_eleicao.empresa_id, auth.uid(), 'QUARENTENA_REJEITADA',
          jsonb_build_object('cpf_mascara', app.mascara_cpf(v_q.cpf_declarado), 'motivo', p_motivo));

  return json_build_object('status', 'sucesso');
end;
$$;

-- Aprovação em lote (para as filas com alerta 'OK').
create or replace function public.aprovar_quarentena_lote(p_ids uuid[])
returns json
language plpgsql
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
declare
  v_id      uuid;
  v_ok      int := 0;
  v_erros   jsonb := '[]'::jsonb;
begin
  foreach v_id in array p_ids loop
    begin
      perform public.aprovar_voto_quarentena(v_id);
      v_ok := v_ok + 1;
    exception when others then
      v_erros := v_erros || jsonb_build_object('id', v_id, 'erro', sqlerrm);
    end;
  end loop;
  return json_build_object('aprovados', v_ok, 'erros', v_erros);
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Painel em tempo real — quórum SEM resultado parcial
-- ---------------------------------------------------------------------
create or replace function public.painel_eleicao(p_eleicao_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
declare
  v_eleicao   public.eleicoes;
  v_votantes  int;
  v_pendentes int;
begin
  v_eleicao := app.assert_acesso(p_eleicao_id);

  select count(*) into v_votantes from public.lista_assinaturas where eleicao_id = p_eleicao_id;
  select count(*) into v_pendentes from public.urna_quarentena
   where eleicao_id = p_eleicao_id and status_analise = 'PENDENTE';

  return json_build_object(
    'status',          v_eleicao.status,
    'aptos',           v_eleicao.total_eleitores_aptos,
    'votantes',        v_votantes,
    'quorum_percent',  case when v_eleicao.total_eleitores_aptos > 0
                            then round(100.0 * v_votantes / v_eleicao.total_eleitores_aptos, 2)
                            else 0 end,
    'quorum_atingido', v_votantes * 2 > v_eleicao.total_eleitores_aptos,  -- >50% (NR-05 item 5.4.5)
    'quarentena_pendente', v_pendentes,
    'por_origem', (
      select coalesce(json_object_agg(origem_voto, qtd), '{}'::json)
      from (select origem_voto, count(*) as qtd
              from public.lista_assinaturas where eleicao_id = p_eleicao_id
             group by origem_voto) t
    ),
    -- Resultado parcial é deliberadamente omitido enquanto a urna está aberta.
    'resultado_disponivel', v_eleicao.status in ('ENCERRADA', 'APURADA')
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Encerramento + payload consolidado para a IA (ata de apuração)
-- ---------------------------------------------------------------------
create or replace function public.encerrar_eleicao(p_eleicao_id uuid)
returns json
language plpgsql
security definer
set search_path = public, app, pg_catalog, pg_temp
as $$
declare
  v_eleicao   public.eleicoes;
  v_empresa   public.empresas_clientes;
  v_pendentes int;
  v_votantes  int;
  v_payload   json;
begin
  v_eleicao := app.assert_acesso(p_eleicao_id);
  if not app.pode_administrar(p_eleicao_id) then
    raise exception 'ACESSO_NEGADO' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_pendentes from public.urna_quarentena
   where eleicao_id = p_eleicao_id and status_analise = 'PENDENTE';
  if v_pendentes > 0 then
    raise exception 'QUARENTENA_PENDENTE: % envelope(s) aguardando análise', v_pendentes
      using errcode = 'raise_exception';
  end if;

  if v_eleicao.status = 'ABERTA' then
    update public.eleicoes set status = 'ENCERRADA', encerrada_em = now() where id = p_eleicao_id;
    select * into v_eleicao from public.eleicoes where id = p_eleicao_id;
  elsif v_eleicao.status not in ('ENCERRADA', 'APURADA') then
    raise exception 'STATUS_INVALIDO' using errcode = 'raise_exception';
  end if;

  select * into v_empresa from public.empresas_clientes where id = v_eleicao.empresa_id;
  select count(*) into v_votantes from public.lista_assinaturas where eleicao_id = p_eleicao_id;

  select json_build_object(
    'empresa', json_build_object(
      'razao_social', v_empresa.razao_social,
      'cnpj', v_empresa.cnpj,
      'total_funcionarios', v_empresa.total_funcionarios,
      'grau_risco', v_empresa.grau_risco,
      'cnae', v_empresa.cnae
    ),
    'eleicao', json_build_object(
      'titulo', v_eleicao.titulo,
      'norma', v_eleicao.tipo,
      'gestao', v_eleicao.gestao,
      'data_inicio', v_eleicao.data_inicio,
      'data_fim', v_eleicao.data_fim,
      'encerrada_em', v_eleicao.encerrada_em,
      'vagas_efetivos', v_eleicao.vagas_efetivos,
      'vagas_suplentes', v_eleicao.vagas_suplentes
    ),
    'quorum', json_build_object(
      'aptos', v_eleicao.total_eleitores_aptos,
      'votantes', v_votantes,
      'percentual', case when v_eleicao.total_eleitores_aptos > 0
                         then round(100.0 * v_votantes / v_eleicao.total_eleitores_aptos, 2) else 0 end,
      'atingido', v_votantes * 2 > v_eleicao.total_eleitores_aptos
    ),
    'apuracao', json_build_object(
      'votos_brancos', v_eleicao.votos_branco,
      'votos_nulos', v_eleicao.votos_nulo,
      'votos_nominais', coalesce((select sum(total_votos) from public.candidatos
                                   where eleicao_id = p_eleicao_id), 0),
      'classificacao', coalesce((
        select json_agg(x order by x.posicao)
        from (
          select
            rank() over (order by c.total_votos desc) as posicao,
            c.nome_completo, c.nome_urna, c.cargo_funcao, c.numero_urna,
            c.total_votos,
            case
              when rank() over (order by c.total_votos desc) <= v_eleicao.vagas_efetivos then 'EFETIVO'
              when rank() over (order by c.total_votos desc)
                   <= v_eleicao.vagas_efetivos + v_eleicao.vagas_suplentes then 'SUPLENTE'
              else 'NAO_ELEITO'
            end as situacao,
            count(*) over (partition by c.total_votos) > 1 as empate
          from public.candidatos c
          where c.eleicao_id = p_eleicao_id and c.inscricao_status = 'DEFERIDA'
        ) x
      ), '[]'::json)
    ),
    'quarentena', (
      select coalesce(json_object_agg(status_analise, qtd), '{}'::json)
      from (select status_analise, count(*) qtd from public.urna_quarentena
             where eleicao_id = p_eleicao_id group by status_analise) q
    )
  ) into v_payload;

  insert into public.logs_auditoria (eleicao_id, empresa_id, ator_id, acao)
  values (p_eleicao_id, v_eleicao.empresa_id, auth.uid(), 'ELEICAO_ENCERRADA');

  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('importar_eleitores','gerar_tokens_eleicao','abrir_eleicao',
                        'fila_quarentena','aprovar_voto_quarentena','rejeitar_voto_quarentena',
                        'aprovar_quarentena_lote','painel_eleicao','encerrar_eleicao')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;
