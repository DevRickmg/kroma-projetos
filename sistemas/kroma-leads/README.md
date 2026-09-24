# Kroma Leads

Sistema interno da Kroma Projetos: capta leads no Google Maps, organiza num CRM simples e
prospecta pelo WhatsApp (Uazapi) com proteção anti-bloqueio.

- **App:** Next.js 16 (App Router) + TypeScript + Tailwind 4, na Vercel
- **Banco / login / tempo real:** Supabase (Postgres + Auth + RLS + Realtime + pg_cron + pg_net)
- **WhatsApp:** Uazapi, isolada em `src/lib/whatsapp/uazapi.ts`
- **Google:** Places API (New), só pelo servidor
- **Mapa:** Leaflet + OpenStreetMap (grátis)

---

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Nome | De onde vem | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → `anon` / publishable | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role` / secret | sim |
| `CRON_SECRET` | Invente: string longa aleatória (ex.: gere em 1password.com/password-generator) | sim |
| `WEBHOOK_SECRET` | Invente outra string longa aleatória | sim |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | não (liga a mensagem com IA) |
| `ANTHROPIC_MODEL` | padrão `claude-opus-5` | não |

As chaves novas do Supabase funcionam: `sb_publishable_…` vai em `NEXT_PUBLIC_SUPABASE_ANON_KEY` e
`sb_secret_…` vai em `SUPABASE_SERVICE_ROLE_KEY` (as legadas `anon`/`service_role` também servem).

A chave do Google e os tokens da Uazapi **não** vão aqui: são cadastrados pela própria tela
do sistema e ficam guardados no Supabase, lidos só pelo servidor.

---

## Instalação (tudo pelo navegador, sem terminal)

### 1. Supabase
1. supabase.com → **New project** (região São Paulo). Guarde a senha do banco.
2. **SQL Editor → New query** → cole o conteúdo inteiro de `supabase/setup.sql` → **Run**.
   Deve terminar com "Success". Pode rodar de novo sem problema.
3. **Authentication → Users → Add user → Create new user**: seu e-mail e senha,
   marque **Auto Confirm User**.
4. **Authentication → Sign In / Providers**: desligue **Allow new users to sign up**
   (ninguém mais consegue criar conta).
5. **Project Settings → API**: copie a Project URL, a chave `anon` e a `service_role`.

### 2. Vercel
1. vercel.com → **Add New → Project** → importe o repositório `kroma-projetos`
   (se não aparecer, troque a conta do GitHub no seletor pra **DevRickmg**).
2. Em **Root Directory**, escolha `sistemas/kroma-leads`. Framework: Next.js (automático).
3. Abra **Environment Variables** e cadastre as 5 obrigatórias da tabela acima.
4. **Deploy**. Todo `git push` na `main` publica sozinho depois disso.
5. Abra o endereço do projeto (`https://….vercel.app`) e entre com o usuário do passo 1.3.
   **Esse primeiro acesso já registra a URL do app no banco** e o disparo automático
   (pg_cron a cada minuto) passa a funcionar.

### 3. Google Maps
Configurações → card **Google Maps API** → **Ver tutorial**. Resumo: criar projeto no Google
Cloud, vincular faturamento, ativar **Places API (New)**, criar a chave, colar, **Salvar chave**,
**Testar conexão**. Limite a Text Search a ~30/dia em Cotas e crie alerta de orçamento de R$ 1.

### 4. WhatsApp (Uazapi)
1. No painel da Uazapi, crie uma instância e copie a **Server URL** e o **token da instância**.
2. No sistema: **WhatsApp → Adicionar número** → cole os dois → **Validar e salvar**.
3. Leia o QR code com o celular do chip de prospecção.
   O webhook é registrado sozinho nessa hora (não precisa configurar nada na Uazapi).
4. Preencha **Meu nome** em Configurações (vai nas mensagens).

---

## Checklist de testes (com 2 números seus)

1. **Buscar leads**: marque sua cidade, 1 nicho, 20 resultados → Iniciar. Confira os leads em
   Leads e a cota subindo (≈1 requisição por página de 20).
2. **Importar CSV**: suba um CSV com 3 linhas, incluindo **o seu celular pessoal** e um duplicado.
   Relatório deve mostrar importados/duplicados.
3. **Campanha de teste**: conecte o chip de prospecção (número A). Selecione só o lead com o
   seu celular (número B) → Adicionar a uma campanha → 5 modelos → Iniciar. Dentro da janela
   comercial, a mensagem chega em 1–3 min com "digitando…" antes.
4. **Resposta**: responda do número B. Em segundos aparece em Conversas, o lead vira
   "Respondeu" e sai da fila.
5. **Pedido de saída**: responda "pode me remover". O lead vira "Não perturbe" e o número
   aparece em Configurações → Lista de bloqueio.
6. **Pausa automática**: em Configurações, ponha "Falhas seguidas" = 1, crie uma campanha pra
   um número inválido que tenha passado como celular, e veja o número pausar com o motivo.
   Volte o valor pra 3 depois.
7. **Desconexão**: desconecte o aparelho pelo celular. Em até 10 min o número aparece pausado
   ("A instância desconectou").

## Como funciona por dentro

- **Buscas longas**: viram um job no banco (`search_jobs`). A página aberta processa em lotes;
  se você fechar, o cron continua de onde parou. Cada requisição ao Google é contada **antes**
  de ser feita; bateu o limite do mês, para e salva o que achou.
- **Disparo**: ao iniciar a campanha, cada mensagem ganha um `scheduled_at` respeitando
  intervalo aleatório, pausa longa, janela comercial, dias úteis, feriados e o limite diário do
  aquecimento. A cada minuto o pg_cron chama `/api/cron/tick`, que pega no máximo 1 mensagem
  vencida por número (trava no banco: nunca duplica, nunca 2 envios simultâneos no mesmo
  número), revalida tudo e envia com "digitando…".
- **Webhook** (`/api/webhooks/whatsapp`): resposta tira o lead da fila e marca "Respondeu";
  pedido de saída manda pra "Não perturbe" + lista de bloqueio; recibos atualizam
  entregue/lida; desconexão pausa o número.
- **Pausa automática**: falhas seguidas, restrição do WhatsApp, desconexão, taxa de resposta
  baixa ou sequência de pedidos de saída. Retomar é sempre manual e reagenda a fila.

**Diferença em relação ao pedido original:** o motor de envio e o webhook rodam como rotas da
Vercel (chamadas pelo pg_cron via pg_net) em vez de Supabase Edge Functions. Motivo: Edge
Function exige CLI ou colar código no painel a cada mudança; assim, todo `git push` atualiza
tudo sozinho.

## Desenvolvimento

```
npm install
npm test          # agenda, spintax, telefone, feriados, opt-out
npm run typecheck
npm run build
```
