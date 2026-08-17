-- =====================================================================
-- Seed de demonstração. Rode DEPOIS das migrações 0001..0005.
-- Pré-requisito: criar o usuário no Supabase (Authentication -> Add user)
-- e trocar o e-mail abaixo.
-- =====================================================================
do $$
declare
  v_usuario     uuid;
  v_consultoria uuid := gen_random_uuid();
  v_empresa     uuid := gen_random_uuid();
  v_eleicao     uuid := gen_random_uuid();
begin
  select id into v_usuario from auth.users where email = 'voce@suaconsultoria.com.br';
  if v_usuario is null then
    raise exception 'Crie o usuário no painel do Supabase antes de rodar o seed.';
  end if;

  insert into public.consultorias (id, nome_fantasia, cnpj)
  values (v_consultoria, 'Sua Consultoria SST', '11222333000181');

  insert into public.perfis (id, consultoria_id, nome, email, papel)
  values (v_usuario, v_consultoria, 'Administrador', 'voce@suaconsultoria.com.br', 'CONSULTORIA_ADMIN')
  on conflict (id) do update
     set consultoria_id = excluded.consultoria_id, papel = excluded.papel;

  insert into public.empresas_clientes (id, consultoria_id, razao_social, cnpj, total_funcionarios, grau_risco)
  values (v_empresa, v_consultoria, 'Metalúrgica Exemplo LTDA', '99888777000166', 120, 3);

  insert into public.eleicoes (id, empresa_id, titulo, tipo, gestao, data_inicio, data_fim,
                               vagas_efetivos, vagas_suplentes, created_by)
  values (v_eleicao, v_empresa, 'Eleição CIPA 2026/2027', 'NR-05', '2026/2027',
          now(), now() + interval '7 days', 2, 1, v_usuario);

  insert into public.candidatos (eleicao_id, numero_urna, nome_completo, nome_urna, cargo_funcao, setor)
  values
    (v_eleicao, 10, 'Carlos Silva Souza',  'Carlinhos', 'Soldador',   'Caldeiraria'),
    (v_eleicao, 20, 'Maria Oliveira Lima', 'Maria',     'Operadora',  'Produção'),
    (v_eleicao, 30, 'João Pedro Alves',    'João P.',   'Almoxarife', 'Logística');

  raise notice 'Eleição criada: %', v_eleicao;
  raise notice 'QR Code do mural: /q/%', v_eleicao;
end $$;
