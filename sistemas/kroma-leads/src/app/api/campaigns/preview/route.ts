import { ApiError, handler, ok, readJson, requireUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/settings";
import { leadVars, render } from "@/lib/template";
import { generateOpener } from "@/lib/ai";
import type { Lead } from "@/lib/types";

export const maxDuration = 60;

/** 5 exemplos gerados com leads reais */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const b = await readJson<{ templates?: string[]; lead_ids?: string[]; use_ai?: boolean; ai_instructions?: string }>(req);
  const templates = (b.templates ?? []).filter((t) => t.trim());
  if (!templates.length) throw new ApiError(400, "Escreva pelo menos um modelo.");
  const settings = await loadSettings(user.id);
  const sb = await supabaseServer();
  let q = sb.from("leads").select("*").eq("archived", false).limit(5);
  if (b.lead_ids?.length) q = q.in("id", b.lead_ids.slice(0, 50));
  const { data } = await q;
  const leads = (data ?? []) as Lead[];
  const fallback: Lead[] = leads.length ? leads : [{ name: "Clínica Exemplo", city: "São Paulo", category: "Clínica odontológica", rating: 4.7, reviews_count: 132 } as Lead];
  const out = await Promise.all(fallback.slice(0, 5).map(async (l, i) => {
    const vars = leadVars(l, settings);
    const tpl = templates[i % templates.length];
    const ai = b.use_ai ? await generateOpener(vars, b.ai_instructions ?? "", tpl) : null;
    return { lead: l.name, text: ai ?? render(tpl, vars), ai: !!ai };
  }));
  return ok({ examples: out });
});
