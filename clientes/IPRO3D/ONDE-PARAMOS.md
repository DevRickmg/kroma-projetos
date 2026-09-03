# Onde paramos — IPRO3D

Última sessão: **03/09/2026**
Arquivo do site: [`site/index.html`](site/index.html) — 1.320 linhas, arquivo único, abre com dois cliques.

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

## O que já está pronto

**Estrutura completa**, na ordem: topbar → header sticky → hero → prova (4 números) →
IDOC (diagrama) → dois públicos → exames (com filtro) → zigzag (celular / escaneamento) →
**e-book** → a clínica + Dr. Ronald → depoimentos (carrossel) → FAQ → localização + mapa →
faixa de CTA → rodapé.

**Dente 3D wireframe da logo** — gerado por script paramétrico (coroa lofted + 4 raízes
tubulares, profundidade por opacidade, gradiente roxo→laranja). Usado em 3 lugares:
hero (flutuando + balanço 3D + sombra pulsante), logo do header e logo do rodapé.

**Seção do e-book** — fundo escuro com spotlight, livro 3D em CSS (capa + lombo + miolo
de páginas + sombra), flutuando e girando. Formulário inline: nome, e-mail, WhatsApp.

**Animação**: barra de progresso, header que ganha peso, reveal em cascata, contadores
animados, linhas tracejadas correndo no diagrama, filtro com indicador deslizante,
sanfona com altura animada, carrossel com scroll-snap. Tudo respeita `prefers-reduced-motion`.

**Técnico**: Schema `MedicalClinic`, meta description, Open Graph, 100% responsivo,
zero foto de banco (só SVG autoral, nada quebra offline).

---

## O QUE FALTA FAZER

### 1. Ajustes que eu já sei que preciso mexer

- [ ] **Lombo do livro está do lado errado** (aparece à direita, o padrão é à esquerda).
      Correção: `index.html` **linha 351** — inverter o sinal em `@keyframes bookSpin`:
      `rotateY(31deg)` → `rotateY(-31deg)` e `rotateY(17deg)` → `rotateY(-17deg)`.
      Depois conferir se o `.book-spine` (linha 364) continua visível; se sumir,
      trocar `rotateY(90deg)` por `rotateY(-90deg)`.

- [ ] **Faltam os acessos do IDOC.** A seção `#idoc` hoje só explica o sistema —
      não tem os botões de login. O site atual tem "Acesse Dentista" e
      "Acesse Paciente" e isso é função central da clínica.
      Adicionar dois botões na seção `#idoc` e apontar pras URLs reais.
      Hoje o botão "Área do dentista" do header (linha 476) só rola pra `#publicos`.

- [ ] **Página `ebook.html` separada** — landing dedicada pra rodar anúncio direto
      pro e-book. Combinado, ainda não feita. Hoje o formulário é inline na seção.

- [ ] **Testar no celular de verdade.** Só validei desktop (1440px) e 1000px.
      Conferir: menu lateral com scrim, livro 3D, dente do hero, grade de exames,
      carrossel de depoimentos e o mapa.

- [ ] **Rodapé: Facebook e YouTube estão com `href="#"`** (linhas 1190 e 1191).
      Colar as URLs reais.

### 2. Preciso que o Ronald confirme antes de publicar

- [ ] **Nota do Google: está "4,9" chutado** (linha 502). Trocar pela real ou tirar.
- [ ] **Depoimentos são inventados** — Marina C., José S., Ana P., Rodrigo F.
      (linhas 982, 987, 992, 997). Substituir por reais ou puxar do Google.
- [ ] **Números** (linhas 529-531 e 956-959): 23 anos, +180 mil exames,
      +300 dentistas, 10 na equipe. Vieram do site atual (que dizia 18 anos / 311
      dentistas em 2021). Confirmar os atuais.
- [ ] **CEP**: o site atual mostra 12410-030 e 12410-732 em telas diferentes.
      Está usando 12410-030 em dois lugares (linha 25 no Schema e linha 1070).
- [ ] **FAQ**: escrevi as 8 respostas com base no padrão do setor. Validar
      principalmente preparo do exame, prazo de entrega e convênio.
- [ ] **Bio do Dr. Ronald** — hoje só tem nome, "radiologista" e CRO-SP 66226.
      Formação e tempo de atuação deixariam a seção mais forte.
- [ ] Fotos boas da clínica/equipe em alta, se ele tiver (opcional — hoje é tudo ilustração).

### 3. Formulários (não têm backend)

- **Contato** (`id="frm"`, linha 1090) — monta a mensagem e abre o WhatsApp.
  Funciona como está, não precisa de nada.
- **E-book** (`id="ebForm"`, linha 915) — tem `data-netlify="true"`, então
  funciona sozinho **se publicar na Netlify**. Fora dela, precisa ligar num
  serviço de formulário ou no e-mail da clínica.

### 4. Depois de aprovado pelo Ronald

- [ ] Descobrir quem controla domínio e hospedagem hoje (o rodapé do site atual
      diz "Consultoria Digital Marketing" — provavelmente uma agência)
- [ ] Publicar (Netlify ou Vercel) e apontar o domínio
- [ ] Ligar o Google Meu Negócio e o Search Console
- [ ] Redirecionar as URLs antigas do WordPress pras novas âncoras

---

## Ferramentas guardadas

Em [`_ferramentas/`](_ferramentas/) — copiei do temp porque ia sumir:

- `gerar-dente-3d.py` — gera a malha wireframe do dente.
  Uso: `build(size, rings_coroa, merid_coroa, rings_raiz, merid_raiz, seg, steps, phi, pitch, op_fundo, eps, precisao, escala)`
  Densidades usadas: hero `(260,15,26,9,10,76,36,22,10,.22,.34,1,.92)`,
  logo `(40,8,12,5,7,40,20,21,10,.32,.075,2,.94)`, mini `(40,6,9,4,6,32,16,21,10,.38,.12,2,.94)`
- `screenshot-secao.py` — isola uma seção no topo e fotografa com Chrome headless.
  Uso: `python screenshot-secao.py ebook exames:1440x1250`.
  Ajustar o caminho `SRC` no topo do arquivo se rodar de outra pasta.

---

## Arquivos do projeto

| Arquivo | O que é |
|---|---|
| `briefing.md` | Briefing e decisões |
| `analise-site-atual.md` | Análise do site velho, página por página (usar na conversa de venda) |
| `dados-negocio.md` | Dados da clínica + tabela de preços (não vai pro site, mas serve de referência) |
| `site/index.html` | O site |
| `site/README.md` | Mapa Ruul→IPRO3D, lista de animações e de placeholders |
| `_ferramentas/` | Scripts do dente 3D e de screenshot |

---

## Pendência de organização

`clientes/IPRO3D/` ainda **não foi commitado** no git. Rodar `/salvar`.
E a IPRO3D ainda não está registrada como cliente ativo em
`_memoria/empresa.md` nem no `CLAUDE.md` da raiz.
