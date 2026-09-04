# Site novo — IPRO3D

`index.html` — site completo, arquivo único, sem dependência de build.
`ebook.html` — landing dedicada do e-book (pra rodar anúncio direto pro material).
Abre com dois cliques no navegador. Só usa CDN de fonte (Google Fonts) e o iframe do Google Maps.

## Base de estrutura

Estrutura inspirada no **ruul.io** (escolhido pelo Rick pela organização, não pelo conteúdo):

| Ruul | Aqui |
|---|---|
| Hero em bloco de cor + "I'm a Talent / I'm a Business" | Hero lilás + **Sou paciente / Sou dentista** |
| Trustpilot + logos de cliente | Nota do Google + 4 cards de números |
| Seção AOR: diagrama à esquerda, texto + grade 2×2 à direita | **Sistema IDOC**: diagrama animado do fluxo + 4 features |
| "Tailored for the new economy": 2 cards grandes de público | **Para pacientes** (branco) / **Para dentistas** (pêssego) |
| "Remedies": pílula de alternância + cards | **Exames** com filtro Todos / Pacientes / Dentistas |
| Zigzag card ↔ ilustração | 2 blocos zigzag: resultado no celular · escaneamento sem gesso |
| "Why they love Ruul" carrossel escuro | Depoimentos em carrossel escuro com setas |
| "Common questions" 2 colunas | FAQ 2 colunas com sanfona |
| Seção de blog + newsletter | **Cortada** → virou Localização + mapa + formulário |
| Rodapé multi-coluna + barra inferior | Igual |

Seção adicionada que o Ruul não tem: **A clínica / Dr. Ronald Lima** — o nicho exige
autoridade do responsável técnico visível.

## Animação e movimento

- Barra de progresso de scroll no topo
- Header sticky que ganha fundo e sombra ao rolar
- Reveal em cascata (IntersectionObserver, delay escalonado por irmão)
- Dente 3D com traço desenhando (`stroke-dashoffset`) + flutuação
- 3 chips flutuantes no hero com boias em tempos diferentes
- Grifo pêssego animado no título
- Blobs de fundo em movimento lento
- Contadores animados (easing cúbico) ao entrar na tela — resolve o bug de contador do site atual
- Diagrama do IDOC com linhas tracejadas correndo
- Pílula de filtro com indicador deslizante
- Sanfona do FAQ com `grid-template-rows` (altura animada de verdade)
- Carrossel com scroll-snap, setas que desabilitam nas pontas
- Hover: elevação de card, seta que anda no botão, zoom na ilustração
- **`prefers-reduced-motion` respeitado** — tudo desliga para quem pediu

## Técnico

- Schema.org `MedicalClinic` (endereço, telefone, horário) — o site atual não tem nenhum
- Meta description e Open Graph preenchidos
- 100% responsivo (menu lateral com scrim no mobile)
- Sem foto de banco: tudo ilustração SVG autoral, então nada quebra offline
- Formulário monta a mensagem e abre o WhatsApp (não precisa de backend)

## Ligado ao site atual

- Acessos do IDOC: `ipro3d.com.br/acesse-dentista/` e `/acesse-paciente/`
  (botões na seção IDOC, no header e no rodapé)
- Facebook `facebook.com/ipro3d` · YouTube canal `UCjJIRo56W7X0Qk_RhVU5f0A`
  · Instagram `@ipro3dpinda`

## Antes de publicar — confirmar com o Ronald

- [ ] **Nota do Google (4,9)** — está estimada, trocar pela real ou remover
- [ ] **Depoimentos** — os 4 são de exemplo, substituir por reais
- [ ] **Números**: 23 anos (2003), +180 mil exames, +300 dentistas, 10 na equipe — vieram do site atual, confirmar
- [ ] **CEP** — 12410-030 ou 12410-732
- [ ] **FAQ** — respostas escritas com base no padrão do setor; validar preparo, prazo e convênio
- [ ] Se tiver foto boa da clínica/equipe, dá pra trocar uma das ilustrações

## Identidade

Marca da IPRO3D modernizada — **não** a identidade da Kroma.
Roxo `#2a2472` / `#14103c`, laranja `#f5851f` só em CTA e acento, pêssego `#ffe1c4`,
creme `#fdf5ec`. Fontes: Plus Jakarta Sans (títulos) + Inter (corpo).

## Landing do e-book (`ebook.html`)

Reaproveita todo o CSS e o livro 3D do `index.html` — é gerada por
`_ferramentas/` a partir do site, então **se mudar os tokens no index, regerar**.

Os dois formulários de e-book têm `name` diferente (`ebook` na seção do site,
`ebook-lp` na landing) pra dar pra separar de onde veio o lead.

O e-book em si (PDF) ainda não existe. Confirmar com o Ronald antes de publicar.

## Como testar

- Desktop: `python _ferramentas/screenshot-secao.py ebook exames:1440x1250`
- Mobile: `python _ferramentas/screenshot-mobile.py top:390x1500`

⚠️ O Chrome não aceita janela abaixo de ~500px. Screenshot direto com
`--window-size=390` renderiza a 500 e corta o lado direito — dá falso positivo de
overflow. Use o `screenshot-mobile.py`, que roda a página dentro de um iframe da
largura pedida.
