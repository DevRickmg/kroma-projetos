"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Globe, Info, Save, UserRound, Sparkles } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAppConfig, useSettings } from "@/lib/hooks";
import { countryNameFromDdi } from "@/lib/phone";
import { Button, Callout, Card, Input, Label, PageHeader, Spinner } from "@/components/ui";
import { GoogleCard } from "@/components/settings/google-card";
import { SendCard } from "@/components/settings/send-card";
import { BlocklistCard, DataCard, SegmentsCard } from "@/components/settings/lists-cards";
import type { Settings } from "@/lib/types";

export default function ConfiguracoesPage() {
  const { settings, reload } = useSettings();
  const { config, reload: reloadConfig } = useAppConfig();
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (settings) setDraft(settings); }, [settings]);
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    }
  }, [draft === null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!draft) return <div className="flex justify-center py-20"><Spinner /></div>;
  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  async function save() {
    if (!draft) return;
    const ddi = draft.ddi.replace(/\D/g, "");
    if (!ddi || ddi.length > 4) return toast.error("Código do país inválido.");
    const sc = draft.send_config;
    if (sc.window_start >= sc.window_end) return toast.error("O fim da janela de horário tem que ser depois do início.");
    if (!sc.weekdays.length) return toast.error("Escolha pelo menos um dia de envio.");
    setSaving(true);
    const { error } = await supabaseBrowser().from("settings").update({
      ddi,
      my_name: draft.my_name.trim(),
      my_company: draft.my_company.trim(),
      google_monthly_limit: draft.google_monthly_limit,
      send_config: draft.send_config,
      warmup_config: draft.warmup_config,
      autopause_config: draft.autopause_config,
      optout_keywords: draft.optout_keywords,
    }).eq("user_id", draft.user_id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas.");
    reload();
    reloadConfig();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Configurações" />
      <div className="space-y-5">
        <Card title="País dos contatos (código do telefone)" icon={<Globe className="size-4" />}>
          <p className="mb-4 text-sm text-muted">
            Código do país adicionado automaticamente aos números nos <b className="text-ink">links de WhatsApp</b>. Use <b className="text-ink">55</b> para
            o Brasil, <b className="text-ink">351</b> para Portugal.
          </p>
          <Label>Código do país (DDI)</Label>
          <div className="flex items-center gap-3">
            <span className="text-muted">+</span>
            <Input className="w-24 text-center" inputMode="numeric" value={draft.ddi} onChange={(e) => set({ ddi: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
            <span className="text-sm text-ink">{countryNameFromDdi(draft.ddi)}</span>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-faint">
            <Info className="size-3.5" /> Números que já vêm com o código do país são mantidos como estão.
          </p>
        </Card>

        <GoogleCard config={config} reload={reloadConfig} limit={draft.google_monthly_limit} onLimit={(n) => set({ google_monthly_limit: n })} />

        <Card title="Meus dados" icon={<UserRound className="size-4" />}>
          <p className="mb-4 text-sm text-muted">Usados nas variáveis <code className="text-cyan">{"{{meu_nome}}"}</code> e <code className="text-cyan">{"{{minha_empresa}}"}</code> das mensagens.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Meu nome</Label><Input value={draft.my_name} onChange={(e) => set({ my_name: e.target.value })} placeholder="Rick" /></div>
            <div><Label>Nome da empresa</Label><Input value={draft.my_company} onChange={(e) => set({ my_company: e.target.value })} /></div>
          </div>
          {config && (
            <Callout tone="neutral" className="mt-4" icon={<Sparkles className="size-4 text-violet" />} title="Mensagem com IA">
              {config.aiEnabled
                ? "Ativa. Nas campanhas dá pra gerar uma primeira mensagem única por lead."
                : "Desligada. Pra ligar, cadastre ANTHROPIC_API_KEY nas variáveis de ambiente da Vercel (opcional)."}
            </Callout>
          )}
        </Card>

        <SendCard
          send={draft.send_config} warmup={draft.warmup_config} autopause={draft.autopause_config}
          onSend={(v) => set({ send_config: v })} onWarmup={(v) => set({ warmup_config: v })} onAutopause={(v) => set({ autopause_config: v })}
        />

        <BlocklistCard ddi={draft.ddi} keywords={draft.optout_keywords} onKeywords={(k) => set({ optout_keywords: k })} />
        <SegmentsCard />
        <DataCard />
      </div>

      <div className="sticky bottom-4 z-10 mt-6 flex justify-end">
        <Button variant="cta" size="lg" icon={<Save className="size-4" />} onClick={save} loading={saving} disabled={!dirty}
          className={dirty ? "" : "opacity-60"}>
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
