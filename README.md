# CIPA Digital

Eleição de CIPA (NR-05) e CIPATR (NR-31) 100% digital, multi-tenant, com sigilo do
voto garantido no nível do banco de dados.

Next.js 15 (App Router) · Tailwind · Supabase (PostgreSQL + RLS + RPC) · Google Gemini

---

## Rodando em 10 minutos

```bash
npm install
cp .env.local.example .env.local     # preencha as chaves
npm run dev
```

### 1. Banco

Aplique as migrações na ordem, pelo SQL Editor do Supabase ou pela CLI:

```bash
supabase link --project-ref SEU_REF
supabase db push
```

Ordem: `0001` extensões e helpers → `0002` tabelas → `0003` RLS e permissões →
`0004` RPCs do eleitor → `0005` RPCs do painel.
Detalhes e decisões estão em [`supabase/BANCO.md`](./supabase/BANCO.md).

> `supabase/tests/00_stub_supabase.sql` **não** vai para o Supabase. Ele só recria
> `auth.users` e os papéis `anon`/`authenticated` para rodar os testes num Postgres local.

### 2. Primeiro usuário

O `perfis` é escrito só por `service_role` — deixar o usuário escolher o próprio papel
seria escalada de privilégio. Crie o usuário em **Authentication → Add user**, troque
o e-mail em `supabase/seed_exemplo.sql` e rode o arquivo.

### 3. Variáveis

| Variável | Onde usar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente e servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | **só servidor** — ignora RLS |
| `NEXT_PUBLIC_APP_URL` | monta os links mágicos e o QR do cartaz |
| `GOOGLE_AI_API_KEY`, `GEMINI_MODEL` | redação das atas |

---

## Como o sigilo é mantido

O voto e a identidade nunca coexistem numa consulta possível.

**Porta A — link mágico.** A RPC recebe o token (não o `eleitor_id`), confere o
SHA-256, incrementa o contador do candidato e insere o nome na lista de presença
na mesma transação. Não existe tabela ligando os dois.

**Porta B — QR Code no mural.** O envelope cai em `urna_quarentena` com identidade
declarada + escolha. A comissão confere o CPF contra a lista do RH e aprova; nesse
instante o voto é computado, a assinatura entra na lista e `candidato_escolhido_id`
vira `NULL`. Enquanto está pendente, a coluna da escolha **não tem GRANT de leitura**
para `authenticated` — nem `select *` a devolve.

Não existe tabela de cédulas individuais, de propósito: com timestamps, a ordem dos
votos cruzada com a ordem das assinaturas reconstruiria quem votou em quem. O preço é
não haver recontagem cédula a cédula (ADR-002 em `supabase/BANCO.md`).

---

## Mapa do projeto

```
src/
  app/
    (eleitor)/v/[token]      Porta A — link mágico
    (eleitor)/q/[eleicaoId]  Porta B — QR Code do mural
    (painel)/login
    (painel)/painel/eleicoes/[id]/
        page.tsx             quórum e situação (sem resultado parcial)
        eleitores/           import CSV + geração de links
        candidatos/          inscrições
        quarentena/          fila de conferência com alertas
        cartaz/              cartaz A4 para imprimir e afixar
        apuracao/            encerramento + atas por IA
        actions.ts           server actions do painel
    api/votar                única porta do PWA (captura o IP real)
    api/ata                  encerrar_eleicao → Gemini → Markdown
  components/eleitor         urna, cédula, bottom sheet, comprovante
  components/painel          fila, importador, gerador de links, ata
  lib/supabase               anon (eleitor) · server (sessão) · admin (service_role)
  lib/erros.ts               códigos secos do banco → frases legíveis
supabase/migrations          5 migrações, validadas em PostgreSQL 16
supabase/tests               18 cenários end-to-end
```

O PWA nunca chama o Supabase direto. Tudo passa por `/api/votar`, porque só o servidor
enxerga o `x-forwarded-for` real — o PostgREST veria o IP do proxy.

---

## Notas de design

A paleta vem da sinalização de segurança do trabalho (ABNT NBR 7195): verde para
segurança, âmbar para atenção, vermelho para impedimento, sobre fundo concreto — a
tela é lida no chão de fábrica, muitas vezes no sol. O número da urna é o elemento
dominante do card porque é o que o trabalhador reconhece do voto em papel. A faixa
listrada aparece uma única vez, no topo do bottom sheet de confirmação: é a marcação
de piso que delimita zona de risco, e a confirmação do voto é irreversível.

---

## O que ainda falta

- **Disparo dos links** (e-mail/WhatsApp). Hoje o painel gera e baixa um CSV; falta
  plugar Resend/Twilio numa Edge Function.
- **Upload de foto do candidato** para o Supabase Storage, com compressão WebP no
  cliente antes do upload.
- **Rate limit por IP** no edge (Vercel Middleware ou Cloudflare), não no Postgres.
- **Expurgo LGPD** de `ip_dispositivo` e `user_agent` depois da posse.
- **Tipos gerados**: `npm run db:types` depois de linkar o projeto, para trocar os
  `as Tipo` por tipos reais do banco.
- **Convite de operadores** via Edge Function com `service_role`.

---

## Comandos

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção (validado)
npm run typecheck  # tsc --noEmit (limpo)
npm run db:push    # aplica as migrações
npm run db:types   # gera src/lib/types/database.ts
```
