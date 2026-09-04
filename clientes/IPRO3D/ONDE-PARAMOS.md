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

**Dente 3D wireframe da logo** — script paramétrico (coroa lofted + 4 raízes tubulares,
profundidade por opacidade, gradiente roxo→laranja). No hero (flutuando + balanço 3D +
sombra), no logo do header e no do rodapé.

**Seção do e-book** — livro 3D em CSS (capa + lombo + miolo + sombra), flutuando e
girando. Formulário inline e a capa clica pra landing dedicada.

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
| `screenshot-secao.py` | Isola uma seção no topo e fotografa (desktop) |
| `screenshot-mobile.py` | Fotografa com viewport mobile real, via iframe |

Densidades do dente em uso:
hero `(260,15,26,9,10,76,36,22,10,.22,.34,1,.92)` ·
logo `(40,8,12,5,7,40,20,21,10,.32,.075,2,.94)` ·
mini `(40,6,9,4,6,32,16,21,10,.38,.12,2,.94)`

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
