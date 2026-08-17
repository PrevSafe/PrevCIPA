-- =====================================================================
-- Teste end-to-end do fluxo eleitoral (rodar em banco descartável)
-- =====================================================================
\set ON_ERROR_STOP on
\timing off

-- Seed -----------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@consultoria.com.br');

insert into public.consultorias (id, nome_fantasia, cnpj)
values ('c0000000-0000-0000-0000-000000000001', 'SST Consultoria', '11222333000181');

insert into public.empresas_clientes (id, consultoria_id, razao_social, cnpj, total_funcionarios, grau_risco)
values ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
        'Metalúrgica Exemplo LTDA', '99888777000166', 120, 3);

insert into public.perfis (id, consultoria_id, nome, email, papel)
values ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000001',
        'Ana Técnica', 'admin@consultoria.com.br', 'CONSULTORIA_ADMIN');

insert into public.eleicoes (id, empresa_id, titulo, tipo, gestao, data_inicio, data_fim,
                             vagas_efetivos, vagas_suplentes, created_by)
values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
        'Eleição CIPA 2026/2027', 'NR-05', '2026/2027',
        now() - interval '1 hour', now() + interval '2 days', 2, 1,
        '11111111-1111-1111-1111-111111111111');

insert into public.candidatos (id, eleicao_id, numero_urna, nome_completo, nome_urna, cargo_funcao)
values
 ('d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',10,'Carlos Silva Souza','Carlinhos','Soldador'),
 ('d0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001',20,'Maria Oliveira Lima','Maria','Operadora'),
 ('d0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001',30,'João Pedro Alves','João P.','Almoxarife');

-- Sessão do admin -------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

\echo '--- 1) Importação de eleitores (1 CPF inválido deve ser ignorado)'
select jsonb_pretty(importar_eleitores(
  'a0000000-0000-0000-0000-000000000001',
  '[{"nome":"Carlos Silva Souza","cpf":"529.982.247-25","cargo_funcao":"Soldador","contato_email":"carlos@x.com"},
    {"nome":"Maria Oliveira Lima","cpf":"11144477735","cargo_funcao":"Operadora"},
    {"nome":"Jose Roberto Dias","cpf":"87748248800","cargo_funcao":"Motorista"},
    {"nome":"Fulano Lixo","cpf":"11111111111","cargo_funcao":"Teste"}]'::jsonb
)::jsonb);

\echo '--- 2) Abertura da eleição'
select abrir_eleicao('a0000000-0000-0000-0000-000000000001');

\echo '--- 3) Geração de links mágicos'
create temp table tokens as
  select * from gerar_tokens_eleicao('a0000000-0000-0000-0000-000000000001');
select count(*) as tokens_gerados from tokens;

-- Sessão do eleitor (anon) ---------------------------------------------
reset role;
set role anon;
reset request.jwt.claim.sub;

\echo '--- 4) anon NÃO pode ler tabelas diretamente (esperado: erro)'
do $$
begin
  perform 1 from public.eleitores limit 1;
  raise exception 'FALHA DE SEGURANÇA: anon leu eleitores';
exception
  when insufficient_privilege then raise notice 'OK: anon bloqueado em eleitores';
end $$;

\echo '--- 5) Cédula pública não expõe total_votos'
select (obter_cedula('a0000000-0000-0000-0000-000000000001')::jsonb #>> '{candidatos,0}') as primeiro_candidato;

\echo '--- 6) Voto pela Porta A (Link Mágico)'
reset role;
select token as t_carlos from tokens where nome = 'Carlos Silva Souza' \gset
set role anon;
set teste.token_carlos = :'t_carlos';
select registrar_voto_link(:'t_carlos', 'NOMINAL', 'd0000000-0000-0000-0000-000000000002',
                           '10.0.0.5', 'PWA/test');

\echo '--- 7) Mesmo token votando de novo (esperado: JA_VOTOU)'
do $$
begin
  perform registrar_voto_link(current_setting('teste.token_carlos'), 'NOMINAL',
          'd0000000-0000-0000-0000-000000000001', '10.0.0.5', 'PWA');
  raise exception 'FALHA: voto duplicado aceito';
exception when raise_exception then
  raise notice 'OK: bloqueado -> %', sqlerrm;
end $$;

\echo '--- 8) Voto pela Porta B (QR Code) — CPF presente no RH'
select registrar_voto_qr('a0000000-0000-0000-0000-000000000001', '877.482.488-00',
       'Jose Roberto Dias', 'Motorista', 'NOMINAL',
       'd0000000-0000-0000-0000-000000000001', '10.0.0.9', 'PWA/test');

\echo '--- 9) QR Code de CPF fora do RH (vai para quarentena com alerta)'
select registrar_voto_qr('a0000000-0000-0000-0000-000000000001', '390.533.447-05',
       'Pedro Novato Santos', 'Ajudante', 'BRANCO', null, '10.0.0.9', 'PWA/test');

\echo '--- 10) Segundo envelope do mesmo CPF (esperado: VOTO_EM_ANALISE)'
do $$
begin
  perform registrar_voto_qr('a0000000-0000-0000-0000-000000000001', '87748248800',
          'Jose Roberto Dias', 'Motorista', 'NOMINAL',
          'd0000000-0000-0000-0000-000000000003', '10.0.0.9', 'PWA');
  raise exception 'FALHA: envelope duplicado aceito';
exception when raise_exception then
  raise notice 'OK: bloqueado -> %', sqlerrm;
end $$;

\echo '--- 11) QR Code de quem já votou pelo link (esperado: JA_VOTOU)'
do $$
begin
  perform registrar_voto_qr('a0000000-0000-0000-0000-000000000001', '52998224725',
          'Carlos Silva Souza', 'Soldador', 'NOMINAL',
          'd0000000-0000-0000-0000-000000000003', '10.0.0.9', 'PWA');
  raise exception 'FALHA: CPF que já assinou conseguiu votar';
exception when raise_exception then
  raise notice 'OK: bloqueado -> %', sqlerrm;
end $$;

-- Volta para o admin ----------------------------------------------------
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

\echo '--- 12) Fila de quarentena com cruzamento automático'
select nome_declarado, cpf_mascara, alerta, nome_rh, votos_mesmo_ip from fila_quarentena('a0000000-0000-0000-0000-000000000001');

\echo '--- 13) Painel NÃO revela resultado parcial'
select jsonb_pretty(painel_eleicao('a0000000-0000-0000-0000-000000000001')::jsonb);

\echo '--- 14) A comissão NÃO consegue ler candidato_escolhido_id (esperado: erro)'
do $$
begin
  perform candidato_escolhido_id from public.urna_quarentena limit 1;
  raise exception 'FALHA DE SIGILO: comissão leu a escolha do eleitor';
exception when insufficient_privilege then
  raise notice 'OK: coluna candidato_escolhido_id inacessível';
end $$;

\echo '--- 15) Aprovação dos envelopes'
do $$
declare r record;
begin
  for r in select id from public.urna_quarentena where status_analise = 'PENDENTE' loop
    perform public.aprovar_voto_quarentena(r.id);
  end loop;
end $$;

\echo '--- 16) Vínculo queimado? (todas as linhas devem ter candidato NULL)'
reset role;
select status_analise, count(*) filter (where candidato_escolhido_id is not null) as com_vinculo,
       count(*) as total
from public.urna_quarentena group by status_analise;

\echo '--- 17) Encerramento + payload para a IA'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select jsonb_pretty(encerrar_eleicao('a0000000-0000-0000-0000-000000000001')::jsonb);

\echo '--- 18) Lista de presença é imutável (esperado: erro)'
reset role;
do $$
begin
  update public.lista_assinaturas set nome = 'hack';
  raise exception 'FALHA: lista de presença alterada';
exception when insufficient_privilege then
  raise notice 'OK: lista de presença imutável';
end $$;

\echo '=== TODOS OS CENÁRIOS EXECUTADOS ==='
