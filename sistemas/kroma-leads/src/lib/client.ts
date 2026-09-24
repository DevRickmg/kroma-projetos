"use client";
import Papa from "papaparse";
import { toast } from "sonner";
import { STATUS_LABEL, type Lead } from "./types";

/** POST/GET pras rotas /api com erro virando exceção com mensagem amigável */
export async function api<T = Record<string, unknown>>(path: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erro ${res.status}`);
  return data as T;
}

export async function apiToast<T>(p: Promise<T>, success?: string): Promise<T | null> {
  try {
    const r = await p;
    if (success) toast.success(success);
    return r;
  } catch (e) {
    toast.error((e as Error).message);
    return null;
  }
}

const PRESENCE_LABEL = { none: "Sem presença", instagram: "Só Instagram", site: "Tem site" } as const;
const QUALITY_LABEL = { unknown: "", bad: "Site ruim", good: "Site bom" } as const;

/** CSV em UTF-8 com BOM e ponto e vírgula: abre certo no Excel em português */
export function downloadLeadsCsv(leads: Lead[], filename: string) {
  const rows = leads.map((l) => ({
    Empresa: l.name,
    Categoria: l.category ?? "",
    Telefone: l.phone_e164 ?? l.phone_raw ?? "",
    "Tipo de telefone": l.phone_type === "mobile" ? "Celular" : l.phone_type === "fixed" ? "Fixo" : "",
    "E-mail": l.email ?? "",
    Site: l.website ?? "",
    Instagram: l.instagram ?? "",
    Cidade: l.city ?? "",
    UF: l.state ?? "",
    Endereço: l.address ?? "",
    Presença: l.site_quality !== "unknown" && l.presence === "site" ? QUALITY_LABEL[l.site_quality] : PRESENCE_LABEL[l.presence],
    Status: STATUS_LABEL[l.status],
    Score: l.score,
    Qualificado: l.qualified ? "Sim" : "Não",
    Arquivado: l.archived ? "Sim" : "Não",
    "Nota Google": l.rating ?? "",
    Avaliações: l.reviews_count ?? "",
    Tags: (l.tags ?? []).join(", "),
    Notas: l.notes ?? "",
    "Google Maps": l.google_maps_url ?? "",
    Origem: l.source_detail ?? l.source,
    "Capturado em": new Date(l.created_at).toLocaleString("pt-BR"),
  }));
  const csv = Papa.unparse(rows, { delimiter: ";" });
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
