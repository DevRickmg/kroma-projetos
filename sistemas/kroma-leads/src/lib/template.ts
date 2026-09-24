/**
 * Mensagens de campanha: variáveis {{empresa}} + spintax {Oi|Olá|{Opa|E aí}}.
 *
 * Ordem: variáveis viram marcadores → spintax é sorteado → marcadores viram
 * os valores. Assim "{{empresa}}" nunca é confundido com spintax, e um valor
 * com chaves (nome de empresa estranho) não é sorteado.
 */

export const VARIABLES = [
  { key: "empresa", label: "Nome da empresa", fallback: "sua empresa" },
  { key: "cidade", label: "Cidade", fallback: "sua região" },
  { key: "categoria", label: "Categoria", fallback: "seu segmento" },
  { key: "nota", label: "Nota no Google", fallback: "boa" },
  { key: "avaliacoes", label: "Nº de avaliações", fallback: "várias" },
  { key: "meu_nome", label: "Meu nome", fallback: "" },
  { key: "minha_empresa", label: "Minha empresa", fallback: "" },
] as const;

export type VarKey = (typeof VARIABLES)[number]["key"];
export type VarValues = Partial<Record<VarKey, string | number | null | undefined>>;

export interface LeadForTemplate {
  name: string;
  city?: string | null;
  category?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
}

export function leadVars(lead: LeadForTemplate, me: { my_name: string; my_company: string }): VarValues {
  return {
    empresa: cleanCompanyName(lead.name),
    cidade: lead.city ?? "",
    categoria: lead.category ? lead.category.toLowerCase() : "",
    nota: lead.rating ? String(lead.rating).replace(".", ",") : "",
    avaliacoes: lead.reviews_count ? String(lead.reviews_count) : "",
    meu_nome: me.my_name,
    minha_empresa: me.my_company,
  };
}

/** "CLÍNICA SORRISO LTDA - Unidade Centro" → "Clínica Sorriso" */
export function cleanCompanyName(name: string): string {
  let n = name.split(/\s[-|–]\s/)[0];
  n = n.replace(/\b(ltda|me|eireli|s\/?a|epp)\.?$/i, "").trim();
  if (n === n.toUpperCase() && /[A-Z]/.test(n)) {
    n = n.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, sp, c) => sp + c.toUpperCase());
  }
  return n || name;
}

type Rng = () => number;

/** Sorteia spintax com aninhamento: {a|b|{c|d}} */
export function spin(text: string, rng: Rng = Math.random): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "{") {
      const end = findClose(text, i);
      if (end === -1) {
        out += ch;
        i++;
        continue;
      }
      const inner = text.slice(i + 1, end);
      const options = splitTop(inner);
      const pick = options[Math.floor(rng() * options.length)] ?? "";
      out += spin(pick, rng);
      i = end + 1;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

function findClose(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTop(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (ch === "|" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

const VAR_RE = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/g;

/**
 * Renderiza: {{var}} ou {{var|texto se vazio}}. Variável vazia usa o texto
 * alternativo informado, senão o padrão da variável. Espaços/pontuação
 * duplicados que sobrarem são limpos para não quebrar a frase.
 */
export function render(template: string, values: VarValues, rng: Rng = Math.random): string {
  const slots: string[] = [];
  const marked = template.replace(VAR_RE, (_, key: string, alt?: string) => {
    const v = values[key as VarKey];
    const def = VARIABLES.find((x) => x.key === key)?.fallback ?? "";
    const val = v !== undefined && v !== null && String(v).trim() !== "" ? String(v).trim() : (alt ?? def);
    slots.push(val);
    return `\u0000${slots.length - 1}\u0000`;
  });
  const spun = spin(marked, rng);
  const filled = spun.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[Number(i)] ?? "");
  return tidy(filled);
}

function tidy(s: string): string {
  return s
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?;:])/g, "$1")
    .replace(/([,;:])\1+/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/^[ \t]+|[ \t]+$/gm, "")
    .trim();
}

// ------------------------------------------------------------------
// Validação da primeira mensagem
// ------------------------------------------------------------------
export interface TemplateIssue {
  level: "error" | "warning";
  code: "link" | "length" | "question" | "identity" | "exit" | "empty" | "braces";
  message: string;
}

export const EXIT_SNIPPET = "{Se não fizer sentido|Se não for o momento}, é só me avisar que não chamo mais.";
export const IDENTITY_SNIPPET = "{Aqui é|Sou} {{meu_nome}}, da {{minha_empresa}}.";

const EXIT_RE = /(n[aã]o (te )?cham(o|arei) mais|n[aã]o (te )?incomodo mais|[eé] s[oó] (me )?(avisar|falar|dizer)|me avis[ae]|n[aã]o fizer sentido|n[aã]o for (o )?momento|sem problema)/i;
const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|com\.br|net|br|io|app|site|online)\b)/i;

export function validateTemplate(body: string, me: { my_name: string; my_company: string }): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  if (!body.trim()) return [{ level: "error", code: "empty", message: "Mensagem vazia." }];

  const opens = (body.match(/\{/g) ?? []).length;
  const closes = (body.match(/\}/g) ?? []).length;
  if (opens !== closes) {
    issues.push({ level: "error", code: "braces", message: "Chaves { } desbalanceadas no spintax." });
  }

  const sample = render(body, {
    empresa: "Empresa Exemplo", cidade: "Cidade", categoria: "segmento", nota: "4,8", avaliacoes: "120",
    meu_nome: me.my_name || "Rick", minha_empresa: me.my_company || "Kroma Projetos",
  });
  // pior caso de tamanho: a opção mais longa de cada spintax
  const longest = render(body.replace(/\{([^{}|]*\|[^{}]*)\}/g, (m, inner: string) => {
    const opts = inner.split("|");
    return opts.reduce((a, b) => (b.length > a.length ? b : a), "");
  }), { empresa: "Empresa Exemplo Nome Longo", cidade: "Cidade", categoria: "segmento", nota: "4,8", avaliacoes: "120", meu_nome: me.my_name || "Rick", minha_empresa: me.my_company || "Kroma Projetos" });

  if (LINK_RE.test(body.replace(VAR_RE, ""))) {
    issues.push({ level: "warning", code: "link", message: "Tem link. Na primeira mensagem, link aumenta muito a chance de denúncia e bloqueio." });
  }
  if (Math.max(sample.length, longest.length) > 300) {
    issues.push({ level: "warning", code: "length", message: `Mensagem longa (~${Math.max(sample.length, longest.length)} caracteres). Primeira mensagem boa tem até ~300.` });
  }
  if (!sample.includes("?")) {
    issues.push({ level: "warning", code: "question", message: "Sem pergunta. Terminar com uma pergunta simples aumenta a taxa de resposta." });
  }
  const hasIdentity = /\{\{\s*(meu_nome|minha_empresa)/.test(body)
    || (me.my_name && body.toLowerCase().includes(me.my_name.toLowerCase()))
    || (me.my_company && body.toLowerCase().includes(me.my_company.toLowerCase()));
  if (!hasIdentity) {
    issues.push({ level: "error", code: "identity", message: "Falta dizer quem está falando ({{meu_nome}} / {{minha_empresa}})." });
  }
  if (!EXIT_RE.test(sample)) {
    issues.push({ level: "error", code: "exit", message: "Falta a frase de saída (ex.: \"se não fizer sentido, é só me avisar que não chamo mais\")." });
  }
  return issues;
}
