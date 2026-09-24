"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Star, HelpCircle, AlertTriangle, ExternalLink, KeyRound, Eye, EyeOff, Plug, ShieldCheck, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { Badge, Button, Callout, Card, Input, Label, Modal, Progress } from "@/components/ui";
import { api } from "@/lib/client";
import type { AppConfig } from "@/lib/hooks";

export function GoogleCard({ config, reload, limit, onLimit }: {
  config: AppConfig | null; reload: () => void; limit: number; onLimit: (n: number) => void;
}) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [tutorial, setTutorial] = useState(false);
  const configured = config?.googleConfigured;

  async function save() {
    setSaving(true);
    try {
      await api("/api/google-key", { key });
      toast.success("API Key salva. Ela fica guardada no servidor e não volta pro navegador.");
      setKey("");
      setShow(false);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const r = await api<{ ok: boolean; message: string }>("/api/google-key/test", { key: key || undefined });
      setResult(r);
      reload();
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  async function remove() {
    if (!confirm("Remover a API Key do Google? As buscas ficam bloqueadas até cadastrar outra.")) return;
    await api("/api/google-key", undefined, "DELETE");
    toast.success("Chave removida.");
    reload();
  }

  const usage = config?.googleUsage ?? 0;

  return (
    <Card
      id="google"
      className="border-cyan/20"
      title={<span className="flex items-center gap-2"><Badge tone="cyan"><Star className="size-3" /> Recomendado</Badge> Google Maps API</span>}
      actions={<Button size="sm" variant="secondary" icon={<HelpCircle className="size-3.5" />} onClick={() => setTutorial(true)}>Ver tutorial</Button>}
    >
      <p className="mb-4 text-sm text-muted">
        A fonte <b className="text-ink">mais completa</b>: retorna telefone, site e endereço com alta cobertura.{" "}
        <b className="text-ink">1.000 requisições gratuitas por mês</b> (≈ até 20.000 leads). O sistema trava as buscas sozinho quando a cota do mês acaba.
      </p>

      <Callout tone="neutral" icon={<AlertTriangle className="size-4 text-violet" />} title="API específica que precisa estar ativa" className="mb-4">
        <p className="mb-2">
          Você precisa ativar a <b>Places API (New)</b>, não a &quot;Places API&quot; antiga. São APIs diferentes no Console do Google.
        </p>
        <ol className="mb-3 list-decimal space-y-0.5 pl-5 text-ink/90">
          <li>Acesse console.cloud.google.com</li>
          <li>Selecione seu projeto → <b>APIs e Serviços</b> → <b>Biblioteca</b></li>
          <li>Pesquise <b>&quot;Places API (New)&quot;</b> (não &quot;Places API&quot;)</li>
          <li>Clique em <b>Ativar</b></li>
          <li>Aguarde 1–2 minutos e tente novamente</li>
        </ol>
        <div className="flex flex-col gap-1.5">
          <a className="inline-flex items-center gap-1.5 text-cyan hover:underline" target="_blank" rel="noreferrer"
            href="https://console.cloud.google.com/apis/library/places.googleapis.com">
            <ExternalLink className="size-3.5" /> Abrir e ativar a &quot;Places API (New)&quot; no Google
          </a>
          <a className="inline-flex items-center gap-1.5 text-cyan hover:underline" target="_blank" rel="noreferrer"
            href="https://console.cloud.google.com/apis/credentials">
            <KeyRound className="size-3.5" /> Criar / copiar a API Key (Credenciais)
          </a>
        </div>
      </Callout>

      <Label>API Key</Label>
      {configured && !key && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="cyan"><CheckCircle2 className="size-3" /> Salva</Badge>
          <span className="font-mono text-muted">••••••••••••••••{config?.googleLast4}</span>
          <button onClick={remove} className="ml-auto inline-flex items-center gap-1 text-xs text-faint hover:text-danger"><Trash2 className="size-3.5" /> Remover</button>
        </div>
      )}
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={configured ? "Colar uma chave nova pra trocar" : "AIza..."}
          autoComplete="off"
          spellCheck={false}
          className="pr-10 font-mono"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-ink" aria-label="Mostrar/ocultar">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      <Callout tone="neutral" icon={<KeyRound className="size-4 text-cyan" />} title="Restrições da chave: verifique isso" className="mt-4">
        No Console do Google, vá em <b>APIs e Serviços → Credenciais → edite sua chave</b>. Em <b>&quot;Restrições de API&quot;</b>, confirme que está
        em <i>&quot;Não restringir chave&quot;</i> ou que <i>&quot;Places API (New)&quot;</i> está na lista permitida. Em &quot;Restrições de aplicativo&quot;, deixe
        <i> &quot;Nenhuma&quot;</i>: a busca sai do servidor, não do navegador.
      </Callout>

      <Callout tone="violet" icon={<ShieldCheck className="size-4 text-violet" />} title="Proteção contra cobrança" className="mt-3">
        Além da trava deste sistema, trave no próprio Google: em <b>APIs e Serviços → Places API (New) → Cotas</b>, limite a
        <b> Text Search</b> a uns <b>30 pedidos por dia</b>. E em <b>Faturamento → Orçamentos e alertas</b>, crie um alerta de orçamento de <b>R$ 1</b>.
        Assim, se algo sair do controle, você fica sabendo antes de pagar.
      </Callout>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {key && <Button variant="primary" onClick={save} loading={saving}>Salvar chave</Button>}
        <Button variant="secondary" icon={<Plug className="size-4" />} onClick={test} loading={testing} disabled={!key && !configured}>
          Testar conexão
        </Button>
      </div>
      {result && (
        <div className={`mt-3 flex items-start gap-2 rounded-lg border p-3 text-sm ${result.ok ? "border-cyan/30 bg-cyan/5 text-ink" : "border-danger/30 bg-danger/5 text-ink"}`}>
          {result.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-cyan" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
          <span>{result.message}</span>
        </div>
      )}

      <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
        <div>
          <Label>Limite mensal de requisições</Label>
          <Input type="number" min={1} max={100000} value={limit} onChange={(e) => onLimit(Math.max(1, Number(e.target.value) || 1))} />
          <p className="mt-1 text-xs text-faint">Padrão 1.000 (a faixa gratuita do Google). Salve no botão lá embaixo.</p>
        </div>
        <div>
          <Label>Uso deste mês</Label>
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-strong">{usage.toLocaleString("pt-BR")}</span>
            <span className="text-muted">/ {limit.toLocaleString("pt-BR")} requisições</span>
          </div>
          <Progress value={usage} max={limit} tone={usage >= limit ? "danger" : usage / limit > 0.8 ? "violet" : "cyan"} />
          <p className="mt-1 text-xs text-faint">Zera sozinho todo dia 1º.</p>
        </div>
      </div>

      <Modal open={tutorial} onClose={() => setTutorial(false)} title="Como pegar a API Key do Google (5 minutos)">
        <ol className="list-decimal space-y-3 pl-5 text-sm text-ink">
          <li>Entre em <a className="text-cyan hover:underline" href="https://console.cloud.google.com" target="_blank" rel="noreferrer">console.cloud.google.com</a> com sua conta Google.</li>
          <li>No topo, clique no seletor de projeto → <b>Novo projeto</b> → nome &quot;Kroma Leads&quot; → Criar.</li>
          <li>Menu → <b>Faturamento</b> → vincule uma conta de faturamento (cartão). Sem isso o Google não libera a cota gratuita, mas você não paga nada dentro dela.</li>
          <li>Abra o link <a className="text-cyan hover:underline" href="https://console.cloud.google.com/apis/library/places.googleapis.com" target="_blank" rel="noreferrer">Places API (New)</a> e clique em <b>Ativar</b>.</li>
          <li>Vá em <a className="text-cyan hover:underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Credenciais</a> → <b>Criar credenciais → Chave de API</b>. Copie a chave.</li>
          <li>Opcional mas recomendado: edite a chave → Restrições de API → <b>Restringir chave</b> → marque só <b>Places API (New)</b>.</li>
          <li>Em <b>Cotas</b> da Places API (New), limite <b>Text Search</b> a ~30 por dia, e crie um alerta de orçamento de R$ 1.</li>
          <li>Cole a chave aqui, clique em <b>Salvar chave</b> e depois em <b>Testar conexão</b>.</li>
        </ol>
      </Modal>
    </Card>
  );
}
