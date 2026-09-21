# MazyOS — Sistema operacional do negócio

Sua empresa roda em cima desse arquivo. Aqui ficam as regras de operação
do MazyOS — como o Claude lê o contexto, aprende com correções, mantém
tudo atualizado e cria skills novas conforme a operação evolui.

Esse arquivo é editável. As regras específicas do negócio estão na
seção **"Kroma Projetos — operação"** no final dessa página.

---

## Contexto do negócio

No início de toda conversa, ler os seguintes arquivos (quando existirem
e estiverem preenchidos):

1. `_memoria/empresa.md` — quem é o usuário, o que faz, como funciona o negócio
2. `_memoria/preferencias.md` — tom de voz, estilo de escrita, o que evitar
3. `_memoria/estrategia.md` — foco atual, prioridades, prazos

Usar essas informações como base pra qualquer resposta ou decisão. Ao
sugerir prioridades, formatos ou abordagens, considerar o foco atual
descrito em `estrategia.md`.

Pra qualquer tarefa visual (carrossel, post, landing page), consultar
`identidade/design-guide.md` como referência de estilo.

Não é necessário listar o que foi lido nem confirmar a leitura. Apenas
usar o contexto naturalmente.

---

## Fluxo de trabalho

Antes de executar qualquer tarefa, verificar se existe skill relevante
em `.claude/skills/`. Se encontrar, seguir as instruções da skill. Se
não encontrar, executar a tarefa normalmente.

Ao concluir uma tarefa que não tinha skill mas parece repetível (o
usuário provavelmente vai pedir de novo no futuro), perguntar:

> "Isso pode virar uma skill pra próxima vez. Quer que eu crie?"

Não perguntar pra tarefas pontuais ou perguntas simples. Só quando o
padrão de repetição for claro.

---

## Aprender com correções

Quando o usuário corrigir algo, melhorar uma resposta ou dar uma
instrução que parece permanente (frases como "na verdade é assim", "não
faça mais isso", "prefiro assim", "sempre que...", "evita...", "da
próxima vez..."), perguntar:

> "Quer que eu salve isso pra não precisar repetir?"

Se sim, identificar onde faz mais sentido salvar:

- **Sobre o negócio** (clientes, serviços, mercado) → `_memoria/empresa.md`
- **Sobre preferências e estilo** (tom de voz, formato, o que evitar) → `_memoria/preferencias.md`
- **Sobre prioridades e foco** (projetos, metas, prazos) → `_memoria/estrategia.md`
- **Regra de comportamento nessa pasta** → próprio `CLAUDE.md`

Salvar com uma linha nova clara, sem reformatar o arquivo inteiro.
Confirmar mostrando a linha adicionada.

Não perguntar se a correção for óbvia de contexto imediato (ex: "na
verdade o arquivo se chama X"). Só perguntar quando a informação tiver
valor duradouro.

---

## Manter contexto atualizado

Ao terminar uma tarefa que mudou algo relevante (cliente novo, skill
nova, mudança de foco, processo novo, ferramenta instalada, estrutura
alterada), perguntar:

> "Isso mudou algo no teu contexto. Quer que eu atualize a memória?"

Se sim, identificar o que atualizar:

- **Cliente, serviço, ferramenta, equipe** → `_memoria/empresa.md`
- **Mudança de prioridade ou foco** → `_memoria/estrategia.md`
- **Tom ou estilo** → `_memoria/preferencias.md`
- **Pasta, regra de organização, skill criada** → `CLAUDE.md`
- **Visual (cores, fontes, logo)** → `identidade/design-guide.md`

Mostrar o que vai mudar antes de salvar. Não reformatar o arquivo
inteiro, só adicionar ou editar a linha relevante.

**Quando NÃO perguntar:**
- Tarefas pontuais sem impacto no contexto (escrever um email avulso, criar um post)
- Perguntas simples ou conversas sem ação
- Mudanças já salvas pelo bloco "Aprender com correções"

**Dica:** rode `/atualizar` pra uma varredura completa quando houver dúvida.

---

## Criação de skills

Quando o usuário pedir skill nova:

1. Verificar se existe template relevante em `templates/skills/`. Se
   existir, usar como base e adaptar pro contexto
2. Perguntar se é específica desse projeto ou útil em qualquer:
   - Específica → `.claude/skills/nome-da-skill/SKILL.md` (local)
   - Universal → `~/.claude/skills/nome-da-skill/SKILL.md` (global)
3. Ler `_memoria/empresa.md` e `_memoria/preferencias.md` pra calibrar
   o conteúdo da skill ao contexto do negócio
4. Se a skill precisar de arquivos de apoio (templates, exemplos),
   criar dentro da pasta da skill
5. Seguir o fluxo da skill-creator nativa do Claude Code

---

# Kroma Projetos — operação

> Perfil **freelancer**: uma pessoa vendendo projetos de tecnologia
> fechados. O sistema gira em torno de captar, entregar e cobrar —
> um projeto de cada vez, sem enrolar na produção.

## O que é esse workspace

Operação solo da Kroma Projetos. Aqui ficam todos os clientes,
briefings, entregas, propostas e o conteúdo da própria marca.

**Estrutura de pastas:**
- `_memoria/` — quem é a Kroma, como fala, foco atual
- `identidade/` — marca da Kroma aplicada em site, proposta e conteúdo
- `clientes/` — uma subpasta por cliente, autossuficiente (criar quando entrar o primeiro)
- `propostas/` — propostas em rascunho ou enviadas (antes de fechar)
- `marketing/` — conteúdo da própria Kroma (Insta, portfolio, etc.)
- `saidas/` — emails e documentos pontuais
- `dados/` — arquivos a analisar
- `scripts/` — utilitários Node/Python que as skills chamam (gerar imagem, postar em rede, render PNG). Vem vazia; cada skill diz como criar o seu
- `templates/` — modelos de `CLAUDE.md`, design-guide e catálogos que o `/instalar` usa como base
- `tarefas.md` — pipeline, prazos, próximos passos, lembretes da semana
- `netlify.toml` — config de publicação do site da IPRO3D no Netlify (ver "Publicação")

## Quem sou

Sozinho na Kroma Projetos (marca pessoal). Monto a estrutura de
tecnologia completa de um negócio — site, automação de WhatsApp, sistemas — e
entrego pronto de uma vez.

## Meu serviço

- Sites institucionais / landing pages
- Robô de atendimento no WhatsApp (automação)
- Estrutura digital pro negócio rodar no automático (sistemas, CRM, integrações)

Cobrança: **valor único fechado, sem recorrência**. Nunca propor modelo
de mensalidade — é o oposto do posicionamento da marca.

## Clientes e prospecção

Distinguir os dois estágios. **Prospecção** = ainda não fechou, o trabalho
é pra conquistar. **Ativo** = contratado. Nunca tratar prospecção como
trabalho já contratado (não falar de cobrança, prazo de entrega ou próximos
passos como se estivesse fechado).

### Em prospecção

- **IPRO3D** (Dr. Ronald Lima) — radiologia odontológica, Pindamonhangaba/SP.
  Site atual desatualizado (parado em 2021). Pasta: `clientes/IPRO3D/`.
  Site novo pronto pra apresentar. Estado e pendências em
  `clientes/IPRO3D/ONDE-PARAMOS.md`.
- **Alessandro Soares** (psicanalista clínico, @alessandro_psicanalista) —
  primo do pai do Rick. Não tinha site. Site institucional criado do zero e
  publicado no Netlify (`monumental-manatee-03bcdb.netlify.app`) pra
  apresentar. Pasta: `clientes/Alessandro-Soares/`.

### Clientes ativos

Nenhum ainda. Quando um prospect fechar, mover pra cá e avisar o usuário.
O `/atualizar` mantém essa lista sincronizada com as pastas em `clientes/`.

## Como trabalho

Um projeto de tecnologia por vez, do briefing à entrega final. O gargalo
hoje é a criação de site (demora, erro, retrabalho) — ao trabalhar em
site, priorizar padronização: base reutilizável, componentes prontos e
checklist de QA antes de mandar pro cliente. Ver `_memoria/estrategia.md`.

## Tom de voz

Direto, curto, sem marketês. Ver `_memoria/preferencias.md` para a lista
completa do que evitar.

## Regras do sistema

- Cliente novo → criar pasta `clientes/<Nome>/` com `briefing.md`
- Proposta antes de fechar → `propostas/<Nome>.html`
- Proposta de cliente fechado → `clientes/<Nome>/proposta.html`
- Qualquer peça visual (site, proposta, carrossel) → ler `identidade/design-guide.md` antes
- Nunca sugerir cobrança recorrente / mensalidade pro cliente final
- Lembretes e tarefas da semana → `tarefas.md` (candidato a virar skill via `/mapear-rotinas`)

## Repositório (GitHub)

- Repo oficial da Kroma: `https://github.com/DevRickmg/kroma-projetos` (private)
- O git dessa máquina autentica como **DevRickmg**, mesmo que os commits apareçam assinados como `RickMS16` — as duas contas são do mesmo dono; usar sempre DevRickmg pra push
- O `mazzeoia/MazyOS` era só o template de origem, não é o repo de trabalho
- `git push` já está liberado no modo automático (regra `Bash(git push:*)` em `.claude/settings.json`), mas o classificador de segurança do Auto Mode pode travar pushes com conteúdo pessoal de cliente (nome, contato) mesmo assim — nesse caso pedir pro usuário rodar `git push` direto no terminal dele. O `git commit` ainda pede confirmação — liberar com `Bash(git commit:*)` se quiser o `/salvar` 100% automático
- A conta do Netlify conectada ao GitHub é a **RickMS16**, não a DevRickmg — ao criar um site novo no Netlify (Import an existing project), se ele não achar o `kroma-projetos`, trocar a conta no seletor de repositório pra DevRickmg

## Publicação (Netlify)

- O site da IPRO3D está publicado no **Netlify**, conectado direto ao repo do GitHub.
  Todo `git push` na `main` dispara o deploy sozinho — não precisa de CLI nem de
  credencial do Netlify na máquina.
- O `netlify.toml` na raiz trava o `publish` em `clientes/IPRO3D/site/` — **sem
  isso o Netlify serviria a raiz inteira do repo** (briefings, `dados-negocio.md`
  com preços, `_memoria/`) como URL pública. Não mexer nesse `publish`.
- O `netlify.toml` também manda `X-Robots-Tag: noindex` — o site é cópia do
  `ipro3d.com.br`, que está no ar; indexar criaria conteúdo duplicado. Apagar esse
  bloco só quando for pro domínio do Ronald.
- É preview de prospecção, ainda em subdomínio `*.netlify.app`. Domínio próprio só
  depois que o Ronald aprovar.
- O site do **Alessandro Soares** é um **segundo projeto Netlify**, separado do da
  IPRO3D mas puxando do mesmo repo: `clientes/Alessandro-Soares/site/` tem seu
  próprio `netlify.toml` (também com `noindex`, mesma lógica de prospecção), e
  no painel do Netlify esse projeto foi criado com **Base directory** =
  `clientes/Alessandro-Soares/site`. Publicado em
  `monumental-manatee-03bcdb.netlify.app`. Esse é o padrão pra qualquer cliente
  novo que precisar de preview: pasta com `netlify.toml` próprio + novo projeto
  no painel apontando o Base directory pra ela — nunca mexer no `netlify.toml`
  da raiz (esse é só da IPRO3D).

## Ferramentas conectadas

- [x] **Netlify** — hospedagem/deploy dos sites da IPRO3D e do Alessandro Soares
  (2 projetos separados na mesma conta, via integração GitHub, sem MCP)
- [ ] Notion
- [ ] Gmail
- [ ] Google Calendar
- [ ] Stripe / cobrança

*(Marcar conforme for instalando os MCPs)*
