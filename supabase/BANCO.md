# CIPA/CIPATR Digital — Camada de Dados (Supabase)

Migrações validadas em PostgreSQL 16 real. O arquivo `tests/01_fluxo_completo.sql`
executa 18 cenários (voto duplo, quarentena, sigilo, imutabilidade) e todos passam.

## Ordem de aplicação

```bash
supabase db push          # ou, manualmente, na ordem:
0001_setup_extensions_tipos_helpers.sql
0002_schema_core.sql
0003_rls_e_permissoes.sql
0004_rpcs_votacao.sql
0005_rpcs_admin.sql
```

`tests/00_stub_supabase.sql` **não** deve ser aplicado no Supabase — ele só recria
`auth.users`, `auth.uid()` e os papéis `anon/authenticated/service_role` para rodar
os testes num Postgres local.

---

## Decisões de arquitetura (ADRs)

### ADR-001 — O token mágico é a credencial, não o `eleitor_id`
A RPC do PRD recebia `p_eleitor_id` e era `SECURITY DEFINER`. Isso significa que
qualquer pessoa com um UUID (que vaza em log, em URL, em erro de API) votaria no
lugar de outra. Aqui a RPC recebe **o token**, compara o SHA-256 com `token_hash`
e o banco nunca guarda o token em claro. `gerar_tokens_eleicao` devolve o token
uma única vez, para o disparo por e-mail/WhatsApp.

### ADR-002 — Não existe tabela de cédulas individuais
A tentação natural é criar `votos(id, eleicao_id, candidato_id, created_at)` para
permitir recontagem. **Isso quebra o sigilo**: bastaria ordenar `votos.created_at`
e `lista_assinaturas.data_hora_voto` lado a lado para reconstruir em quem cada
pessoa votou. Mantivemos o contador agregado (`candidatos.total_votos`,
`eleicoes.votos_branco/nulo`), que é incrementado na mesma transação da assinatura.

Trade-off assumido: **não há recontagem cédula a cédula**. A prova jurídica é a
lista de presença + o log de auditoria + a ata. Se o cliente exigir recontagem,
a saída correta é criptografia homomórfica ou mixnet — outro projeto, outro custo.

### ADR-003 — A comissão não pode ver em quem alguém votou, nem na quarentena
O PRD deixava `candidato_escolhido_id` legível no painel enquanto o voto estava
pendente. Bloqueamos por `GRANT` de coluna: `authenticated` não tem privilégio de
SELECT nessa coluna, então nem `select *` via PostgREST a retorna. A fila é lida
pela RPC `fila_quarentena`, que devolve só identidade + alertas. Na aprovação **e
na rejeição** o campo vira `NULL`.

### ADR-004 — Bloqueios de CPF em quatro camadas
1. `lista_assinaturas (eleicao_id, cpf)` UNIQUE — quem assinou não vota de novo.
2. Índice único parcial em `urna_quarentena` — um só envelope pendente por CPF
   (o PRD só checava a lista de presença, o que permitia N votos por QR Code
   antes de qualquer aprovação).
3. `eleitores.status_voto` + `FOR UPDATE` — trava a linha contra duplo clique.
4. Revalidação dentro de `aprovar_voto_quarentena`, contra corrida entre um voto
   por QR Code e um por link mágico do mesmo CPF.

### ADR-005 — Resultado parcial é segredo até o encerramento
`painel_eleicao` devolve quórum, origem dos votos e fila pendente, mas nunca a
contagem. `encerrar_eleicao` exige quarentena zerada, muda o status e só então
devolve o payload de apuração — que é exatamente o JSON a mandar para o Gemini.

### ADR-006 — Lista de presença é append-only
Trigger bloqueia UPDATE/DELETE. Efeito colateral desejado: eleição que já recebeu
voto não pode ser apagada em cascata, só `CANCELADA`.

---

## Contrato das RPCs

### Públicas (papel `anon`, usadas pelo PWA)
| Função | Uso |
|---|---|
| `obter_cedula(eleicao_id)` | monta a tela de votação (sem `total_votos`) |
| `validar_token_magico(token)` | tela de boas-vindas; devolve `ja_votou` |
| `registrar_voto_link(token, tipo_voto, candidato_id, ip, user_agent)` | Porta A |
| `registrar_voto_qr(eleicao_id, cpf, nome, cargo, tipo_voto, candidato_id, ip, ua)` | Porta B |

### Painel (papel `authenticated`)
`importar_eleitores`, `gerar_tokens_eleicao`, `abrir_eleicao`, `fila_quarentena`,
`aprovar_voto_quarentena`, `rejeitar_voto_quarentena`, `aprovar_quarentena_lote`,
`painel_eleicao`, `encerrar_eleicao`.

### Códigos de erro (mapear para mensagens no PWA)
`TOKEN_INVALIDO`, `TOKEN_EXPIRADO`, `JA_VOTOU`, `VOTO_EM_ANALISE`,
`ELEICAO_NAO_ABERTA`, `ELEICAO_ENCERRADA`, `ELEICAO_NAO_INICIADA`,
`CPF_INVALIDO`, `NOME_INVALIDO`, `CANDIDATO_INVALIDO`, `CANDIDATO_OBRIGATORIO`,
`QR_CODE_DESABILITADO`, `ACESSO_NEGADO`, `QUARENTENA_PENDENTE`.

Sugestão: um `mapErro()` no frontend traduzindo esses códigos, em vez de mostrar
`sqlerrm` cru ao operário no chão de fábrica.

---

## Pendências conscientes (não implementadas nesta camada)

- **IP real:** `request.headers` do PostgREST traz o IP do proxy. Capture
  `x-forwarded-for` em uma Route Handler do Next.js e passe como parâmetro
  (é o que as RPCs esperam). Não confie no cliente para isso.
- **Rate limit:** bloquear N tentativas por IP/minuto no edge (Vercel Middleware
  ou Cloudflare), não no Postgres.
- **Onboarding de usuários:** `perfis` só é escrito por `service_role`. Criar uma
  Edge Function de convite; deixar o usuário definir o próprio `papel` seria
  escalada de privilégio.
- **Retenção LGPD:** `ip_dispositivo` e `user_agent` são dado pessoal. Definir
  job de expurgo (ex.: 6 meses após a posse) e registrar na política de privacidade.
- **Backup pré-encerramento:** snapshot antes de `encerrar_eleicao`.

---

## Próximo passo sugerido — estrutura do PWA (Next.js 15 / App Router)

```
app/
  (eleitor)/
    v/[token]/page.tsx          # Porta A: link mágico
    q/[eleicaoId]/page.tsx      # Porta B: QR Code (autodeclaração)
    _components/
      CedulaCandidato.tsx       # card grande com foto
      BottomSheetConfirmacao.tsx
      TecladoCpf.tsx            # inputmode="numeric"
      ComprovanteVoto.tsx
  (painel)/
    login/page.tsx
    eleicoes/[id]/
      page.tsx                  # quórum, indicadores
      quarentena/page.tsx       # fila com alertas
      eleitores/page.tsx        # import CSV
      candidatos/page.tsx
      apuracao/page.tsx         # resultado + ata gerada por IA
  api/
    votar/route.ts              # captura x-forwarded-for e chama a RPC
    ata/route.ts                # payload -> Gemini -> Markdown
lib/
  supabase/{client,server,admin}.ts
  erros.ts                      # mapErro()
  types/database.ts             # gerado via supabase gen types
```

Regra de ouro do PWA: a `anon key` só chama as 4 RPCs públicas. A `service_role
key` nunca sai do servidor.
