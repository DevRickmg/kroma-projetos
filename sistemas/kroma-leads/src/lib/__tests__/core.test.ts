import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, phoneVariants, jidToE164 } from "../phone";
import { isOptOut } from "../text";
import { render, spin, validateTemplate, cleanCompanyName } from "../template";
import { brazilHolidays, localParts, zonedToUtc, localDateKey } from "../time";
import { planSchedule, dailyLimit, type NumberPlanState } from "../sender/schedule";
import { DEFAULT_SEND, DEFAULT_WARMUP } from "../types";

test("telefone: celular BR nacional", () => {
  const p = normalizePhone("(11) 99876-5432", "55")!;
  assert.equal(p.e164, "+5511998765432");
  assert.equal(p.type, "mobile");
});
test("telefone: fixo BR", () => {
  const p = normalizePhone("(34) 3255-0371", "55")!;
  assert.equal(p.e164, "+553432550371");
  assert.equal(p.type, "fixed");
});
test("telefone: já com DDI é mantido", () => {
  assert.equal(normalizePhone("+351 912 345 678", "55")!.e164, "+351912345678");
  assert.equal(normalizePhone("5511998765432", "55")!.e164, "+5511998765432");
});
test("telefone: lixo vira null", () => {
  assert.equal(normalizePhone("619835617793964062", "55"), null);
  assert.equal(normalizePhone("—", "55"), null);
});
test("telefone: variantes do 9 e jid", () => {
  assert.deepEqual(phoneVariants("+5511998765432").sort(), ["+551198765432", "+5511998765432"].sort());
  assert.equal(jidToE164("5511998765432@s.whatsapp.net"), "+5511998765432");
  assert.equal(jidToE164("123@g.us"), null);
});

test("opt-out", () => {
  assert.ok(isOptOut("Pode me REMOVER da lista"));
  assert.ok(isOptOut("não tenho interesse, obrigado"));
  assert.ok(isOptOut("PARE"));
  assert.ok(!isOptOut("parece interessante, me conta mais"));
  assert.ok(!isOptOut("quero saber o preço"));
});

test("spintax aninhado", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) seen.add(spin("{Oi|Olá|{Opa|E aí}}!"));
  assert.deepEqual([...seen].sort(), ["E aí!", "Oi!", "Olá!", "Opa!"]);
});
test("variáveis + fallback", () => {
  const out = render("{Oi|Olá}, {{empresa}} de {{cidade|sua cidade}}!", { empresa: "Sorriso", cidade: "" }, () => 0);
  assert.equal(out, "Oi, Sorriso de sua cidade!");
  assert.equal(render("Nota {{nota}}", {}, () => 0), "Nota boa");
});
test("nome da empresa limpo", () => {
  assert.equal(cleanCompanyName("CLÍNICA SORRISO LTDA - Unidade Centro"), "Clínica Sorriso");
});
test("validação da primeira mensagem", () => {
  const me = { my_name: "Rick", my_company: "Kroma Projetos" };
  const bad = validateTemplate("Veja https://x.com", me).map((i) => i.code).sort();
  assert.deepEqual(bad, ["exit", "identity", "link", "question"]);
  const good = validateTemplate("Oi, {{empresa}}! Aqui é {{meu_nome}}, da {{minha_empresa}}. Vocês têm site? Se não fizer sentido, é só me avisar que não chamo mais.", me);
  assert.equal(good.length, 0, JSON.stringify(good));
});

test("feriados 2026", () => {
  const h = brazilHolidays(2026);
  assert.ok(h.has("2026-04-03")); // Sexta Santa
  assert.ok(h.has("2026-02-16")); // Carnaval
  assert.ok(h.has("2026-06-04")); // Corpus Christi
  assert.ok(h.has("2026-11-20"));
});
test("fuso São Paulo", () => {
  const d = zonedToUtc(2026, 9, 23, 9, 0, 0, "America/Sao_Paulo");
  assert.equal(d.toISOString(), "2026-09-23T12:00:00.000Z");
  assert.equal(localParts(d, "America/Sao_Paulo").hour, 9);
});

test("agenda respeita janela, dias úteis, pausas e limite diário", () => {
  const cfg = DEFAULT_SEND;
  const now = zonedToUtc(2026, 9, 25, 17, 50, 0, cfg.timezone); // sexta 17:50
  const st: NumberPlanState = {
    id: "n1", warmupStart: "2026-09-25", replyRate: null, perDay: new Map(),
    cursor: now, sinceLongPause: 0, longPauseEvery: 9,
  };
  const ids = Array.from({ length: 60 }, (_, i) => `m${i}`);
  const plan = planSchedule(ids, [st], cfg, DEFAULT_WARMUP);
  const perDay = new Map<string, number>();
  let prev = 0;
  for (const p of plan) {
    const lp = localParts(p.scheduled_at, cfg.timezone);
    const key = localDateKey(p.scheduled_at, cfg.timezone);
    assert.ok([1, 2, 3, 4, 5].includes(lp.weekday), `dia não útil: ${key}`);
    assert.ok(lp.hour >= 9 && lp.hour < 18, `fora da janela: ${p.scheduled_at.toISOString()}`);
    if (prev) assert.ok(p.scheduled_at.getTime() - prev >= 40_000, "intervalo < 40s");
    prev = p.scheduled_at.getTime();
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  for (const [key, n] of perDay) {
    assert.ok(n <= dailyLimit("n1", "2026-09-25", key, null, DEFAULT_WARMUP), `limite estourado em ${key}: ${n}`);
    assert.ok(n <= 20, "semana 1 passou de 20");
  }
});

test("rodízio entre dois números", () => {
  const cfg = DEFAULT_SEND;
  const now = zonedToUtc(2026, 9, 23, 10, 0, 0, cfg.timezone);
  const mk = (id: string): NumberPlanState => ({ id, warmupStart: "2026-08-01", replyRate: 12, perDay: new Map(), cursor: now, sinceLongPause: 0, longPauseEvery: 9 });
  const plan = planSchedule(Array.from({ length: 20 }, (_, i) => `m${i}`), [mk("a"), mk("b")], cfg, DEFAULT_WARMUP);
  const a = plan.filter((p) => p.number_id === "a").length;
  assert.ok(a >= 6 && a <= 14, `rodízio desequilibrado: ${a}/20`);
});
