"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/client";
import { api } from "./client";
import { DEFAULT_AUTOPAUSE, DEFAULT_SEND, DEFAULT_WARMUP, type Settings } from "./types";

export interface AppConfig {
  googleConfigured: boolean;
  googleLast4: string | null;
  googleUsage: number;
  aiEnabled: boolean;
  webhookConfigured: boolean;
  cronConfigured: boolean;
}

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const reload = useCallback(async () => {
    try {
      setConfig(await api<AppConfig>("/api/config"));
    } catch {
      /* mantém o último */
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { config, reload };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const reload = useCallback(async () => {
    const { data } = await supabaseBrowser().from("settings").select("*").maybeSingle();
    if (data) {
      setSettings({
        ...data,
        send_config: { ...DEFAULT_SEND, ...data.send_config },
        warmup_config: { ...DEFAULT_WARMUP, ...data.warmup_config },
        autopause_config: { ...DEFAULT_AUTOPAUSE, ...data.autopause_config },
      } as Settings);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { settings, setSettings, reload };
}
