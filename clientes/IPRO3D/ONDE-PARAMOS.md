# Onde paramos — IPRO3D

Última sessão: **03/09/2026**
Site: [`site/index.html`](site/index.html) · Landing do e-book: [`site/ebook.html`](site/ebook.html)

---

## Decisões já fechadas (não reabrir)

| Assunto | Decisão |
|---|---|
| Formato | Site **completo**, não demo |
| Preço no site | **Não** — clínica não divulga valor, paciente entra em contato |
| Blog | **Cortado** — o atual está parado desde 2021 |
| Base de estrutura | **ruul.io** (só a organização, não o conteúdo) |
| Identidade | Marca da IPRO3D modernizada (roxo `#2a2472` + laranja `#f5851f`), **não** a da Kroma |
| Referências de nicho | Redimagem, LA Imaging, SMRAD (estrutura) · Atlanta Perio, Grand Street (acabamento) |

---

## O que está pronto

**Estrutura**: topbar → header sticky → hero → prova (4 números) → IDOC (diagrama +
acessos) → dois públicos → exames (com filtro) → zigzag → **e-book** → a clínica +
Dr. Ronald → depoimentos (carrossel) → FAQ → localização + mapa → faixa de CTA → rodapé.

**Dente do hero** — **embed do Sketchfab**: modelo "Tooth", do Skazok
(`d2b3c8f5b4194f59b04b5e7542ccbe58`). Flutua sobre o painel roxo escuro, gira
sozinho e dá pra girar arrastando. Fundo transparente (`transparent=1`), então
o painel aparece atrás.

**Dente dos logos** (header, rodapé, header da `ebook.html`) — esse continua
sendo o nosso: silhueta chapada gerada por `_ferramentas/gerar-dente-3d.py`
(coroa com 4 cúspides + 4 raízes), gradiente da marca no fundo claro e branco
no escuro. **Não mexer** — o pedido foi trocar só o do hero.

**Seção do e-book** — livro 3D em CSS com **as 6 faces**: capa, contracapa,
lombada, corte da frente, cabeça e pé. Fica girado mostrando o **bloco de
páginas branco** (é ele que denuncia a espessura; mostrando a lombada o livro
sumia, roxo sobre roxo). Flutua, balança sozinho e **dá pra girar arrastando**
(mouse e dedo), igual ao dente. O dente da capa é o sólido, gerado
pelo `injetar-dente.py` (classe `book-mark`). Formulário inline e a capa clica
pra landing dedicada.

**Landing `ebook.html`** — página separada pra rodar anúncio direto pro material.
Reaproveita os tokens e o livro 3D do site. Formulário com nome, e-mail, WhatsApp e
CRO opcional, mais um bloco "como funciona" em 3 passos.

**Animação**: barra de progresso, header que ganha peso, reveal em cascata, contadores
animados, tracejado correndo no diagrama, filtro com indicador deslizante, sanfona com
altura animada, carrossel com scroll-snap. Tudo respeita `prefers-reduced-motion`.

**Técnico**: Schema `MedicalClinic`, meta description, Open Graph, responsivo validado
em 390px, zero foto de banco (só SVG autoral).

---

## Resolvido nesta sessão

- [x] **Livro do e-book refeito.** Antes tinha só capa + lombada + um corte, e
      lia como um cartão inclinado. Agora são as 6 faces de um livro de verdade
      (capa, contracapa, lombada, corte, cabeça e pé), com o miolo listrado quase
      rente à capa e vinco na dobra da lombada. Gira arrastando, e o dente da
      capa virou o sólido no lugar do wireframe.

### O motivo real do livro parecer uma placa (a armadilha principal)

**`opacity` animada no mesmo elemento que tem `transform-style:preserve-3d`
achata o 3D.** A animação de entrada (`bookIn`) vivia no `.book`, e como ela
mexe em `opacity`, o elemento vira grupo de composição — o navegador ignora o
`preserve-3d` e projeta tudo num plano só. Resultado: as faces do miolo
simplesmente não eram pintadas (forcei elas em vermelho puro pra confirmar:
não apareciam), e o livro ficava uma placa fina flutuando, por mais que eu
mexesse em ângulo, espessura e cor.

Como ficou: `.book-wrap` segura a entrada, a flutuação **e a perspectiva**
(perspectiva não atravessa elemento achatado), e o `.book` fica só com o giro.

Sintoma pra reconhecer da próxima vez: `getComputedStyle` diz
`transform-style: preserve-3d`, o `getBoundingClientRect` das faces mostra que
elas estão na posição certa, e mesmo assim nada aparece na tela.

### Outras três de CSS 3D que custaram tempo (anotar)

1. **`backface-visibility:hidden` nas faces do miolo faz elas sumirem.** Lombada,
   corte, cabeça e pé são painéis girados 90° a partir da borda — a normal deles
   acaba apontando pra **dentro** do livro. Com backface escondida, some tudo e
   o livro vira um cartão chapado. Só as duas capas podem ter backface escondida.
2. **`rotateX` positivo olha o livro de cima** (mostra a cabeça), não de baixo.
   É o contrário do que parece. Descobri renderizando as faces com cores de
   debug — vale repetir o truque se mexer nisso de novo.
3. **A lombada sumia por contraste, não por geometria.** Ela era `#3b34a0` sobre
   uma seção `#1d1856`: escuro sobre escuro. Clareei pra `#544bd4` / `#ff9433` e
   pus um vinco escuro entre lombada e capa. Antes de mexer em transform,
   conferir se o problema não é só cor.

- [x] **Bug de escopo**: o JS do livro usava a variável `reduce`, que só existe
      no `index.html`. Na `ebook.html` estourava `ReferenceError` e o livro
      ficava parado. O bloco agora lê `prefers-reduced-motion` por conta própria.

- [x] **Dente do hero trocado pelo modelo do Sketchfab.** Saiu o dente que eu
      modelei em WebGL, entrou o embed do "Tooth" do Skazok. O bloco WebGL foi
      removido (virou código morto) e o `index.html` caiu de 225 KB pra 124 KB.
      O dente dos logos ficou como estava.

### O que veio junto com o embed (ler antes de mostrar pro Ronald)

- **Licença OK**: Sketchfab **Standard** — uso comercial liberado, sem exigência
  de crédito. Por isso não coloquei o `<p>` de atribuição que vem no snippet;
  o próprio player já mostra "Tooth by Skazok".
- **Os ícones do Sketchfab não somem por parâmetro.** `ui_controls=0` e
  `ui_watermark=0` são ignorados em conta grátis. Resolvido no CSS: a moldura
  do iframe estoura **96px em cima e embaixo** e o excedente é cortado
  (`overflow:hidden` no `.tooth-embed`). Funciona porque os ícones ficam todos
  em duas faixas — compartilhar em cima, marca + barra de controles embaixo.
  **Só na vertical**: cortar de lado exigiria esticar tanto que cortaria o
  próprio dente (o logo do Sketchfab chega a ~85px da borda esquerda).
  Medida em px fixos de propósito — os ícones têm tamanho fixo, não
  acompanham o tamanho do painel.
- **Isso esconde a marca do Sketchfab, que o embed grátis exige mostrar.**
  Não é ilegal e a licença do modelo (Standard) permite uso comercial, mas
  contraria os termos de embed deles. O caminho limpo é plano pago **ou**
  baixar o `.glb` (o modelo é downloadable e a licença permite) e hospedar no
  nosso servidor — aí não tem UI de terceiro nenhuma, nem dependência externa.
- **Modelo pesado**: 220 mil faces. O painel mostra "Loading 3D model" nos
  primeiros segundos, e em 3G isso demora.
- **Depende de internet e do Sketchfab estar no ar.** Se cair, o painel fica
  vazio — não tem fallback, o SVG do hero saiu junto.
- **Não consegui conferir o render aqui.** O Chrome headless usa WebGL por
  software (swiftshader) e o modelo não termina de carregar nem com 90 s de
  orçamento. Confirmei a forma pela thumbnail da API (molar branco, 2 raízes).
  **Abrir no navegador de verdade pra validar.**
- No celular pus uma capa transparente por cima do iframe: sem ela, arrastar o
  dedo em cima do dente gira o modelo em vez de rolar a página.
- **Armadilha que o recorte destapou**: pôr o iframe em `position:absolute`
  colapsou o hero pra 0x0 abaixo de 1000px. O `.hero-vis` tem
  `margin-inline:auto`, que impede o `stretch` da coluna do grid — então a
  largura vinha do conteúdo, e tirando o iframe do fluxo não sobrava conteúdo
  nenhum (painel e tarjas já eram `absolute`). Resolvido com `width:100%`
  explícito no `.hero-vis` do mobile.

- [x] **Dente refeito: branco e sólido, sem wireframe.** As versões de linha
      (SVG e depois canvas) não eram o que o Ronald/eu queríamos — o pedido era
      dente branco maciço, formato tradicional, com 4 pontinhas embaixo.
      Geometria refeita (4 raízes em vez de 3, coroa mais alta, cintura no colo)
      e o hero agora é **WebGL cru**, com sombreamento suave, luz alta pela
      esquerda, sombra puxada pro violeta do painel e uma borda quente que separa
      o dente do fundo.
      - Flutua, gira no sentido **anti-horário** e responde a arrastar (mouse e
        toque). `touch-action:pan-y` no canvas pra não travar o scroll do celular.
      - Sem WebGL → o `<svg>` de silhueta que já está no HTML fica no lugar.
      - Os logos também viraram silhueta chapada: no tamanho de 34px o wireframe
        virava um cestinho ilegível.
- [x] **Duas armadilhas que custaram caro no sombreado** (anotadas porque não são
      óbvias):
      1. O perfil interpolava com **smoothstep entre pontos de controle**, que
         chega com derivada zero em cada ponto — ou seja, um anel achatado em
         cada um. Em wireframe não aparece; no sólido virou onda. Trocado por
         Catmull-Rom + uma média móvel leve pra tirar a quina de curvatura.
      2. Os tubos das raízes começavam rente à saia da coroa, e como a borda da
         coroa cai exatamente em cima da superfície dos tubos, abria fresta pro
         fundo. Agora os tubos sobem bem pra dentro da coroa (`S_JOIN` pequeno) e
         a última volta da coroa encolhe 22% pra ficar enterrada.
- [x] **Sombreamento plano não serve** — a primeira tentativa foi Canvas 2D com
      uma cor por face; num objeto branco liso vira bola de discoteca. Só com
      normal por vértice (WebGL) fica liso.

- [x] **Dente do hero virou 3D de verdade.** Duas rodadas de SVG não convenceram:
      linha fina e clara num painel branco lê como gaiola de arame, não como
      escaneamento. Agora é `<canvas>` com a malha rotacionada e projetada a cada
      frame — gira sozinho, dá pra arrastar, e o painel do hero virou roxo escuro
      (`#3d2b78 → #1c1442`) com gradiente laranja no topo e violeta nas raízes,
      que é o que faz o dente saltar.
      - Sem dependência externa **de propósito**: o Ronald/eu abrimos o
        `index.html` do disco, e `<script type="module">` puxando CDN não carrega
        em `file://` (CORS). Canvas 2D também garante o screenshot em headless.
      - Fallback: sem JS ou sem canvas, o SVG estático continua lá (regradeado
        pro fundo escuro).
      - Pausa fora da tela (`IntersectionObserver`) e com a aba escondida;
        `prefers-reduced-motion` deixa pose fixa, mas ainda arrastável.
      - Malha menor abaixo de 720px.
- [x] **Tarjas flutuantes no celular** — as 3 cobriam o dente no painel pequeno.
      Menores, nos cantos, e a do meio some abaixo de 720px.

- [x] **Dente refeito** — a versão anterior era um barril com 4 pernas soltas
      penduradas embaixo (coroa cilíndrica + raízes tubulares separadas, com uma
      emenda horizontal dura no colo). Reescrevi o gerador: agora é uma superfície
      contínua, a seção da coroa se deforma de circular pra lobada (união dos 3
      cilindros radiculares) entre `T_MIX` e `T_FULL`, e as raízes só passam a ser
      desenhadas a partir de `S_ROOT`. As 3 raízes giram junto com a câmera
      (`root_base`) pra projetarem simétricas — sem isso um lado ficava mais estreito
      que a coroa e a emenda voltava a aparecer. Cor mantida (roxo→laranja do site).
- [x] **Estrela no ápice** — a modulação de cúspide mexia no `y` mesmo com raio 0,
      o que virava uma estrela de 4 pontas no polo. Agora o deslocamento é
      multiplicado pelo raio normalizado.
- [x] **Logo do header da `ebook.html`** — o header daquela página é `--indigo-900`
      fixo, e o dente saía com o gradiente roxo (sumia no fundo). Trocado pro traço
      branco, igual ao do rodapé.

- [x] **Lombo do livro** — a configuração original já estava certa; ele só era
      invisível porque era azul-marinho sobre fundo azul-marinho. Testei as 4
      variantes de rotação num grid lado a lado e fiquei com a A
      (`rotateY(+29deg)` + lombo à esquerda em `rotateY(90deg)`), agora com o
      lombo em duas faixas (roxo/laranja) pra destacar do fundo.
- [x] **Acessos do IDOC** — busquei as URLs reais no site atual e liguei:
      `ipro3d.com.br/acesse-dentista/` e `/acesse-paciente/`. Dois botões no fim
      da seção `#idoc`, mais o botão "Área do dentista" do header e dois links
      no rodapé.
- [x] **Facebook e YouTube** — URLs reais coladas no rodapé
      (`facebook.com/ipro3d` e o canal `UCjJIRo56W7X0Qk_RhVU5f0A`).
- [x] **Página `ebook.html`** criada.
- [x] **Teste de celular** feito a 390px.
- [x] Corrigi `.btn-outline`, que eu tinha usado sem existir no CSS (botão saía
      sem borda), e dois nós do diagrama do IDOC que encostavam na borda.

### Cuidado com o método de screenshot

O Chrome **não aceita janela abaixo de ~500px**. Rodar `--window-size=390` renderiza
a página a 500px e corta o lado direito — isso me deu um falso positivo de "overflow
no mobile" que quase virou correção desnecessária. Pra medir mobile de verdade use
`_ferramentas/screenshot-mobile.py`, que coloca a página num iframe da largura
pedida (aí a viewport é real). O `screenshot-secao.py` continua valendo pra desktop.

---

## O QUE FALTA

### Depende do Ronald (não dá pra resolver sozinho)

- [ ] **Nota do Google: "4,9" está chutado** (`index.html` linha ~504). Trocar pela real ou tirar.
- [ ] **Depoimentos são inventados** — Marina C., José S., Ana P., Rodrigo F.
      Substituir por reais ou puxar do Google.
- [ ] **Números**: 23 anos, +180 mil exames, +300 dentistas, 10 na equipe.
      Vieram do site atual (que dizia 18 anos / 311 dentistas em 2021). Confirmar.
- [ ] **CEP**: o site atual mostra 12410-030 e 12410-732 em telas diferentes.
      Está usando 12410-030 no Schema e no bloco de contato.
- [ ] **FAQ**: as 8 respostas foram escritas com base no padrão do setor.
      Validar preparo do exame, prazo de entrega e convênio.
- [ ] **Bio do Dr. Ronald** — hoje só nome, "radiologista" e CRO-SP 66226.
- [ ] **O e-book existe em PDF?** A landing promete envio por e-mail. Se o arquivo
      não existir, ou a gente produz ou tira a seção.
- [ ] Fotos boas da clínica/equipe em alta (opcional — hoje é tudo ilustração).

### Formulários (sem backend)

- **Contato** (`id="frm"`) — monta a mensagem e abre o WhatsApp. Funciona como está.
- **E-book** (`id="ebForm"`, nos dois arquivos) — tem `data-netlify="true"`, então
  funciona sozinho **se publicar na Netlify**. Fora dela, ligar num serviço de
  formulário ou no e-mail da clínica. Os dois formulários têm `name` diferente
  (`ebook` e `ebook-lp`) pra separar a origem do lead.

### Depois de aprovado

- [ ] Descobrir quem controla domínio e hospedagem (o rodapé do site atual diz
      "Consultoria Digital Marketing" — provavelmente uma agência)
- [ ] Publicar (Netlify ou Vercel) e apontar o domínio
- [ ] Ligar Google Meu Negócio e Search Console
- [ ] Redirecionar as URLs antigas do WordPress pras novas âncoras

---

## Ferramentas ([`_ferramentas/`](_ferramentas/))

| Arquivo | Pra que serve |
|---|---|
| `gerar-dente-3d.py` | Gera a malha wireframe do dente |
| `injetar-dente.py` | Regera a malha e injeta nos SVGs do site (hero + logos) |
| `preview-dente.py` | Renderiza a silhueta SVG em 4 poses, pra conferir a forma |
| `screenshot-secao.py` | Isola uma seção no topo e fotografa (desktop) |
| `screenshot-mobile.py` | Fotografa com viewport mobile real, via iframe |

`gerar-dente-3d.py` + `injetar-dente.py` agora servem **só aos logos** (o hero é
o iframe do Sketchfab). Mexeu no perfil, roda
`python _ferramentas/injetar-dente.py` pra refazer as 3 marcas. A versão branca é
escolhida sozinha quando o `<svg>` já estava em branco (rodapé e header da
landing).

Screenshot com WebGL precisa de `--enable-unsafe-swiftshader` no Chrome headless
(já está nos scripts). Com `--disable-gpu` puro o canvas sai vazio.

---

## Arquivos

| Arquivo | O que é |
|---|---|
| `briefing.md` | Briefing e decisões |
| `analise-site-atual.md` | Análise do site velho, página por página (usar na venda) |
| `dados-negocio.md` | Dados da clínica + tabela de preços (não vai pro site) |
| `site/index.html` | O site |
| `site/ebook.html` | Landing do e-book |
| `site/README.md` | Mapa Ruul→IPRO3D, animações e placeholders |

---

## Pendência de organização

A IPRO3D já está registrada como **prospecção** em `_memoria/empresa.md`
e no `CLAUDE.md` da raiz. Quando fechar, mover pra "Clientes ativos".
