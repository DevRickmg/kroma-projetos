# Análise do site atual — IPRO3D

Site analisado: https://ipro3d.com.br/ · Data: 01/09/2026
Base: acesso ao site + prints enviados pelo Ronald.

---

## Veredito rápido

O site foi feito em WordPress por uma agência ("Consultoria Digital
Marketing") e **parou no tempo em 2021** — rodapé "Copyright 2021",
blog sem post novo desde nov/2021, contador de "18 anos" (a clínica
tem 23 hoje). Passa a impressão de empresa que abandonou o site, o que
é ruim justamente pra quem vende **tecnologia e futuro** ("Radiografando
o futuro pra você").

A identidade (roxo + laranja, dente 3D wireframe) tem um bom conceito,
mas a execução está datada: degradês, sombras, clipart de dentista,
fotos de banco sem relação com o serviço. Dá pra reaproveitar a ideia
da marca e modernizar.

Tem também uma série de **erros bobos ao vivo** que pegam mal com
cliente e com dentista parceiro (e-mail escrito errado, telefone sem
espaço, contador quebrado, banner de cookie em inglês).

---

## Erros que estão no ar agora (corrigir de cara)

| Onde | Problema |
|---|---|
| Página Contato | E-mail aparece como `contato @ ipro3d-com-br` — com espaços e traços no lugar de ponto. Ninguém consegue copiar certo. |
| Rodapé | `diretoria@ipro3d.com.br + 55 12 981470501` — e-mail e telefone grudados, sem formatação. |
| Home / Contato | Horário "Segunda-Sexta: 8h00 19h00" — falta o traço entre os horários. |
| Home ("história em números") | Contador quebrado: mostra `10C`, `311D`, `180Mil`, `18Anos`. O efeito de animação travou e nunca chega no número final. |
| Endereço | Aparece com dois CEPs diferentes: `12410-030` e `12410-732`. |
| Banner de cookies | Texto em **inglês** ("We use cookies to ensure that we give you the best experience…") num site 100% português, e fica fixo cobrindo o conteúdo do rodapé. |
| Blog | Posts marcados como "SEM CATEGORIA", datas travadas em ago/2021, conteúdo copiado de fontes (Healthline, Harvard). Nada novo há ~4 anos. |
| Seção "Segue a gente" | Vídeos do YouTube incorporados sem thumbnail — aparecem como quadrados cinza vazios. |

---

## Análise por página

### Home
- **Menu gigante e confuso:** HOME · SOBRE · EXAMES · CONTATO · BLOG · ACESSE · SOU DENTISTA — mais os submenus "Requisição de exames", "Agendamento", "Acesse Dentista", "Acesse Paciente". São dois públicos diferentes (paciente e dentista) empilhados no mesmo menu sem separação.
- **"SOU DENTISTA"** joga direto no WhatsApp, sem avisar. O clique não diz o que vai acontecer.
- **Hero:** dente 3D wireframe sobre degradê roxo→laranja. Texto branco sobre o degradê tem contraste baixo e fica difícil de ler. Estilo remete a 2015.
- **Prova social fraca:** os "números" estão quebrados e, mesmo funcionando, são genéricos. Não tem depoimento real de dentista nem avaliação do Google.
- **Galeria de fotos aleatória:** máscara N95, sala de aula, medidor de glicose, alicate com dente extraído. Fotos de banco de imagem sem ligação com radiologia — e a do dente extraído é agressiva pra um paciente.
- **"Deixe sua avaliação"** é só um formulário (com campos "First"/"Last" em inglês). Não mostra nenhuma avaliação — pede sem entregar prova nenhuma.
- **Sem CTA claro.** Não fica óbvio o que o paciente deve fazer (agendar? ligar? WhatsApp?).

### Sobre
- Texto corrido, um parágrafo só, sem respiro. Mistura história, lista de exames e discurso de venda.
- Não apresenta o **Dr. Ronald Lima** como pessoa — só aparece "radiologista responsável, CRO-SP 66226" no rodapé. Pra clínica de diagnóstico, a autoridade do responsável técnico é argumento de venda forte e está escondida.
- Não usa o nome por extenso: **Instituto Pindense de Radiologia Odontológica**.
- Carrossel de fotos da clínica/equipe está lá, mas pequeno e sem legenda.

### Exames
- Conteúdo bom (5 blocos: Escaneamento Digital, Modelos 3D, Radiologia Digital, IDOC, Documentações), mas **texto denso e centralizado**, difícil de escanear.
- Todo card tem só o link "Agendar" — que provavelmente cai no mesmo lugar.
- **Não tem preço.** Você tem tabela de valores organizada (tomografia, documentação, periapical, etc.) — isso podia estar no site, filtra cliente e reduz ligação pra perguntar preço.
- Não explica **pra quem** é cada exame (paciente encaminhado pelo dentista? dentista pedindo documentação?).

### Requisição de exames
- É só uma imagem do formulário PDF em baixa resolução + botão "Baixar". Funciona, mas parece improviso.

### Contato
- Ilustração cartoon de um "dentista" segurando uma chapa — estilo clipart infantil, destoa totalmente de "tecnologia de ponta".
- Formulário com "Nome / First / Last" em inglês.
- Dados de contato com os erros de digitação já citados.

### Blog
- Abandonado desde 2021. Pior do que não ter: mostra descontinuidade.
- Conteúdo copiado de terceiros, sem valor de SEO próprio.

### Acesse Dentista / Acesse Paciente
- Telas de login cruas (campos "E-mail/senha" e "Número/senha"), sem explicar o que é o IDOC, o que a pessoa vai encontrar lá dentro, nem como conseguir acesso na primeira vez.

---

## Problemas técnicos e de SEO

- **Sem meta description** — o Google monta o snippet sozinho, CTR sofre.
- **Sem dados estruturados (Schema LocalBusiness / MedicalClinic)** — clínica local sem marcação perde rich results e presença no mapa/busca local.
- **H1 duplicado** ("Radiografando o futuro pra você" aparece 2x) e hierarquia de headings bagunçada.
- **Links âncora vazios** (`href="#"`) espalhados.
- WordPress com vários plugins, carrosséis e vídeos embedados → provável **lentidão**, principalmente no celular.
- Não há indício de otimização de imagem (fotos de banco em tamanho cheio).
- Google Meu Negócio não está integrado ao site (nem avaliações, nem botão de rota destacado).

---

## O que dá pra aproveitar

- **Conceito da marca:** dente 3D + roxo/laranja + "radiografando o futuro". A ideia é boa, só precisa de execução moderna (menos degradê, mais respiro, tipografia melhor).
- **Conteúdo dos exames:** os textos técnicos servem de base, é só reorganizar.
- **Tabela de preços** (você já tem, organizada) → vira seção do site.
- **Botão flutuante de WhatsApp** — manter.
- **IDOC / acesso digital** — é um diferencial real, só está mal comunicado.
- **Fotos reais da clínica, equipamento e equipe** — existem, dá pra usar melhor (com boa luz/recorte).
- **Dr. Ronald como autoridade** — trazer pra frente.

---

## Proposta de estrutura pro site novo

Separar os dois públicos logo no topo: **Paciente** e **Dentista**.

1. **Home** — hero limpo com proposta clara ("Radiologia odontológica digital em Pindamonhangaba desde 2003"), CTA duplo (Agendar exame / Área do dentista), destaques (digital, IDOC, 23 anos, responsável técnico), depoimentos reais, avaliações do Google, endereço + mapa.
2. **Exames** — cada exame com: o que é, pra quem, como receber (impresso/PDF/IDOC) e **preço**. Filtro paciente × dentista.
3. **Para dentistas** — parceria, requisição de exames, documentações, IDOC, login.
4. **Sobre** — história da clínica + Dr. Ronald Lima (foto, formação, CRO), equipe, estrutura.
5. **Contato** — dados corretos, formulário enxuto em português, WhatsApp, mapa, horário.
6. **IDOC / Área digital** — explicação + logins de paciente e dentista.
7. **Blog** — opcional. Só entra se houver compromisso de manter. Melhor não ter do que ter abandonado.

Melhorias transversais: design responsivo de verdade, HTTPS + performance, meta tags + Schema LocalBusiness, banner de cookie em português, Google Meu Negócio integrado, identidade visual atualizada.
