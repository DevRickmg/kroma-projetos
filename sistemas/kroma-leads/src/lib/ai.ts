import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { EXIT_SNIPPET, render, type VarValues } from "./template";

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic();
  return client;
}

const SYSTEM = `Você escreve a PRIMEIRA mensagem de WhatsApp de prospecção para um pequeno negócio brasileiro.
Regras obrigatórias:
- Português do Brasil, tom de conversa real, direto, sem marketês, sem emoji em excesso (no máximo 1).
- Até 280 caracteres. Sem links. Sem travessão (—).
- Diga quem está falando (nome e empresa informados).
- Mencione algo concreto do negócio (nome, cidade, categoria ou avaliações) para não parecer disparo em massa.
- Termine com UMA pergunta simples.
- Inclua uma frase de saída curta, no sentido de "se não fizer sentido, é só me avisar que não chamo mais".
- Nunca prometa mensalidade, nunca invente dados que não foram informados.
Responda só com o texto da mensagem, sem aspas e sem explicação.`;

/**
 * Gera uma mensagem única para o lead. Devolve null se a IA não estiver
 * configurada ou falhar — quem chama cai pro modelo normal.
 */
export async function generateOpener(
  vars: VarValues, instructions: string, exampleTemplate: string,
): Promise<string | null> {
  if (!aiEnabled()) return null;
  const facts = [
    `Negócio: ${vars.empresa}`,
    vars.categoria && `Categoria: ${vars.categoria}`,
    vars.cidade && `Cidade: ${vars.cidade}`,
    vars.nota && `Nota no Google: ${vars.nota}`,
    vars.avaliacoes && `Avaliações no Google: ${vars.avaliacoes}`,
    `Quem escreve: ${vars.meu_nome || "(sem nome)"}, da ${vars.minha_empresa}`,
  ].filter(Boolean).join("\n");
  try {
    const resp = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      output_config: { effort: "low" },
      messages: [{
        role: "user",
        content: `${facts}\n\nO que eu ofereço / orientação: ${instructions || "sites, sistemas e automação de WhatsApp, entregues prontos com valor fechado"}\n\nModelo de referência (só o estilo, não copie):\n${render(exampleTemplate, vars)}`,
      }],
    });
    if (resp.stop_reason === "refusal") return null;
    const text = resp.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim().replace(/^"|"$/g, "");
    if (!text || text.length > 450 || /https?:\/\//i.test(text)) return null;
    // garante a frase de saída mesmo se o modelo esquecer
    if (!/n[aã]o (te )?(chamo|incomodo) mais|me avis/i.test(text)) return `${text} ${render(EXIT_SNIPPET, vars)}`;
    return text;
  } catch (e) {
    console.error("IA falhou, usando modelo:", e);
    return null;
  }
}
