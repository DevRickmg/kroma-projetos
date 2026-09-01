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
- `tarefas.md` — pipeline, prazos, próximos passos, lembretes da semana

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

## Clientes ativos

Nenhum registrado ainda. Quando entrar o primeiro, criar
`clientes/<Nome>/` com `briefing.md`. O `/atualizar` mantém essa lista
sincronizada com as pastas em `clientes/`.

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
- `git push` já está liberado no modo automático (regra `Bash(git push:*)` em `.claude/settings.json`). O `git commit` ainda pede confirmação — liberar com `Bash(git commit:*)` se quiser o `/salvar` 100% automático

## Ferramentas conectadas

- [ ] Notion
- [ ] Gmail
- [ ] Google Calendar
- [ ] Stripe / cobrança

*(Marcar conforme for instalando os MCPs)*
