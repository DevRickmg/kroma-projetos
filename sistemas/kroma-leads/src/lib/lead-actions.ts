"use client";
import { toast } from "sonner";
import { supabaseBrowser } from "./supabase/client";
import { waLink } from "./phone";
import type { Lead } from "./types";

export async function updateLeads(ids: string[], patch: Partial<Lead>): Promise<Lead[] | null> {
  const { data, error } = await supabaseBrowser().from("leads").update(patch).in("id", ids).select("*");
  if (error) {
    toast.error(error.message);
    return null;
  }
  return data as Lead[];
}

/** Limpar = apagar de vez (volta se aparecer numa busca nova) */
export async function deleteLeads(ids: string[]): Promise<boolean> {
  const { error } = await supabaseBrowser().from("leads").delete().in("id", ids);
  if (error) {
    toast.error(error.message);
    return false;
  }
  return true;
}

export function mapsUrl(l: Lead): string {
  if (l.google_maps_url) return l.google_maps_url;
  const q = [l.name, l.address ?? l.city].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function whatsappUrl(l: Lead): string | null {
  return l.phone_e164 ? waLink(l.phone_e164) : null;
}

export const CAMPAIGN_SELECTION_KEY = "kroma:campaign-leads";

export function stashCampaignSelection(ids: string[]) {
  try {
    sessionStorage.setItem(CAMPAIGN_SELECTION_KEY, JSON.stringify(ids));
  } catch {
    /* sem storage: a tela de campanha deixa escolher de novo */
  }
}

export function readCampaignSelection(): string[] {
  try {
    const v = sessionStorage.getItem(CAMPAIGN_SELECTION_KEY);
    return v ? (JSON.parse(v) as string[]) : [];
  } catch {
    return [];
  }
}
