---
name: apresentacao-venda
description: >
  Cria PDFs de apoio pra call de venda ou apresentação pro cliente — proposta de
  investimento/preço, comparativo de serviço (ex: bot x agente de IA), argumento
  de fechamento. Gera HTML em slides no padrão visual da Kroma e renderiza em PDF
  via Playwright. Use quando o usuário pedir "PDF pra call", "apresentação de
  valores", "material pra reunião", "proposta em PDF", "quanto vou cobrar",
  "PDF pra explicar [serviço]", ou /apresentacao-venda.
---

# /apresentacao-venda — PDF de apoio pra call

Gera um ou mais PDFs em formato de slide (paisagem), no padrão visual da Kroma,
pra usar como apoio numa call ou reunião com prospect/cliente — proposta de
investimento, comparativo de serviço, argumento de venda.

## Dependências

- **Identidade visual:** `identidade/design-guide.md` — ler antes de montar qualquer slide
- **Contexto do negócio:** `_memoria/empresa.md`
- **Tom de voz:** `_memoria/preferencias.md`
- **Contexto do cliente:** `clientes/<Nome>/` — ler `briefing.md`, `ONDE-PARAMOS.md` e
  `dados-negocio.md` (se existirem) pra puxar informação real do que já foi
  entregue/decidido
- **Playwright:** pra renderizar HTML em PDF

---

## Passo 1 — Entender o pedido

Identificar:
1. **Quantos PDFs** o usuário quer e qual o tema de cada um (preço/investimento,
   comparativo de serviço, outro argumento de venda)
2. **Pra qual cliente/prospect** — puxar a pasta `clientes/<Nome>/`
3. **Se envolve preço:** checar se o usuário já deu um valor. Se não deu,
   perguntar "me dá um valor que você acha justo" primeiro; só sugerir um
   valor se ele pedir explicitamente pra eu sugerir.

### Regras de preço (fixas da Kroma — ver `CLAUDE.md`)

- **Nunca** propor mensalidade/recorrência pro cliente final
- Valor sempre **fechado, único**, mesmo quando o projeto tem várias entregas
  (site + bio + agente de IA, etc.) — nunca fatiar em orçamentos separados
- Formato padrão de pagamento (a menos que o usuário diga outro):
  - **Opção 1 — à vista:** Pix, ou cartão em até 3x **sem juros** (mesmo valor total)
  - **Opção 2 — parcelado à parte:** mesmo número de parcelas (ou mais, se o
    usuário especificar), parcela individual menor que pagar tudo de uma vez,
    mas **total 20-30% maior** que o valor à vista
- Se for sugerir o valor: calibrar pelo porte do cliente, pela fase da Kroma
  (primeiro cliente pode justificar preço de entrada mais baixo — ver
  `_memoria/estrategia.md`) e pelo escopo real entregue. Deixar claro que é
  uma sugestão, não decisão fechada.
- Se o pacote incluir **agente de IA no WhatsApp**, adicionar nota de rodapé:
  custo de terceiro (número WhatsApp Business, API de mensagens) não entra no
  valor da Kroma — é repassado sem markup.

**CHECKPOINT:** confirmar com o usuário o valor e a forma de pagamento antes
de gerar o PDF, se ainda não estiver claro.

---

## Passo 2 — Estrutura de conteúdo

Cada PDF é um mini-deck de slides (5 a 8), landscape. Estrutura recorrente:

1. **Capa** — logo Kroma + eyebrow (contexto) + título de impacto + subtítulo
2. **Slides de conteúdo** — 1 ideia por slide, cards ou comparativo (tabela),
   nunca parede de texto
3. **Slide de preço** (se aplicável) — dois cards lado a lado (à vista vs parcelado)
4. **Slide de fecho** — reforço da mensagem principal + CTA final

Escrever o texto seguindo `_memoria/preferencias.md`: direto, frase curta, sem
marketês, sem "vamos juntos"/"alavancar"/clichê de agência. Explicar tecnologia
do jeito que o dono do negócio entende.

**CHECKPOINT:** mostrar o roteiro/texto de cada slide antes de montar o visual,
igual no `/carrossel` — só segue pro HTML depois de aprovado (pular esse
checkpoint só se o usuário já tiver dado o conteúdo pronto, como valor e
serviços inclusos).

---

## Passo 3 — Visual (HTML)

Um arquivo `.html` por PDF, com todos os slides como `<section class="page">`
dentro do mesmo arquivo (ver exemplo em
`clientes/IPRO3D/apresentacao-call/investimento.html`, que serve de referência
de estrutura e CSS pra reaproveitar).

Padrão técnico:
- Cada slide: `width:1600px; height:900px`, `page-break-after: always`
- Fundo: `#0D0F12` (grafite), cards `#1A1D23` com borda `#262B33`
- Título: Orbitron 700/900 (Google Fonts) — corpo: Inter
- Cor de apoio/estrutura: `#00E5FF` (ciano) — eyebrow, réguas, ícones
- Cor de CTA: `#FF007F` (magenta) — só no botão/CTA final, nunca decorativo
- Logo Kroma (SVG inline, ver `identidade/logo.svg`) no canto superior esquerdo da capa
- Rodapé com "Kroma Projetos — Tecnologia definitiva. Projetos fechados." + nome do cliente

Se o design-guide do projeto mudar essas cores/fontes no futuro, seguir o que
estiver em `identidade/design-guide.md` — ele sempre tem prioridade sobre esse
padrão.

---

## Passo 4 — Renderizar em PDF

1. Checar se o Chromium do Playwright já está instalado:
   `ls "$HOME/AppData/Local/ms-playwright"` (Windows). Se não estiver, rodar
   `npx --yes playwright install chromium` (baixa ~200MB, só na primeira vez —
   fica em cache pro resto da máquina).
2. Criar `render.js` na mesma pasta dos HTMLs — script Node com Playwright que:
   - Abre cada HTML (`waitUntil: 'networkidle'`, pra esperar a Google Font carregar)
   - Chama `page.pdf({ width:'1600px', height:'900px', printBackground:true, margin:0 })`
3. Instalar o pacote localmente pra rodar o script (o Chromium baixado no passo 1
   já cobre o binário, só falta o módulo Node):
   ```
   npm install playwright --no-save --silent
   node render.js
   ```
4. **Depois de gerar os PDFs**, limpar o que não deve ficar versionado:
   ```
   rm -rf node_modules package.json package-lock.json
   ```
   Ficam só os `.html` fonte, o `render.js` e os `.pdf` finais na pasta.

### Onde salvar

- Cliente já tem pasta própria → `clientes/<Nome>/apresentacao-call/`
- Ainda em prospecção sem pasta de cliente → `propostas/<Nome>/`
- Nome de arquivo: `kroma-<cliente>-<tema>.pdf` (ex: `kroma-ipro3d-preco-servico.pdf`)

---

## Passo 5 — Conferir antes de entregar

Tirar um screenshot de 1-2 slides-chave (Playwright `.screenshot()` num script
temporário) e olhar antes de dar como pronto — principalmente o slide de
preço, pra garantir que o valor e a formatação bateram com o que foi
combinado. Apagar esse screenshot/script de checagem depois.

Avisar onde o arquivo ficou salvo (caminho relativo dentro do repo) — o
usuário abre direto pelo VSCode (preview nativo de PDF) ou copia pro celular
pra usar na call.
