export type LeadStatus =
  | "new" | "qualified" | "contacted" | "replied" | "negotiating" | "client" | "not_interested" | "do_not_disturb";

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Novo",
  qualified: "Qualificado",
  contacted: "Em contato",
  replied: "Respondeu",
  negotiating: "Negociando",
  client: "Cliente",
  not_interested: "Sem interesse",
  do_not_disturb: "Não perturbe",
};

export type Presence = "none" | "instagram" | "site";
export type SiteQuality = "unknown" | "bad" | "good";

export interface Lead {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone_raw: string | null;
  phone_e164: string | null;
  phone_type: "mobile" | "fixed" | "unknown";
  email: string | null;
  website: string | null;
  instagram: string | null;
  rating: number | null;
  reviews_count: number | null;
  google_place_id: string | null;
  google_maps_url: string | null;
  lat: number | null;
  lng: number | null;
  presence: Presence;
  site_quality: SiteQuality;
  score: number;
  status: LeadStatus;
  qualified: boolean;
  contact_mode: "campaign" | "manual" | null;
  archived: boolean;
  archived_at: string | null;
  notes: string;
  tags: string[];
  source: "google_maps" | "import" | "manual";
  source_detail: string | null;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
}

export interface SendConfig {
  min_interval_s: number;
  max_interval_s: number;
  long_pause_every_min: number;
  long_pause_every_max: number;
  long_pause_min_min: number;
  long_pause_max_min: number;
  window_start: string;
  window_end: string;
  weekdays: number[]; // 0 = domingo … 6 = sábado
  skip_holidays: boolean;
  typing_min_s: number;
  typing_max_s: number;
  timezone: string;
}

export interface WarmupConfig {
  weeks: { week: number; min: number; max: number }[];
  mature: { after_weeks: number; min_reply_rate: number; min: number; max: number };
  daily_cap: number;
}

export interface AutopauseConfig {
  max_consecutive_failures: number;
  min_reply_rate: number;
  min_reply_rate_after: number;
  optout_streak: number;
  optout_window: number;
}

export interface Settings {
  user_id: string;
  ddi: string;
  my_name: string;
  my_company: string;
  google_monthly_limit: number;
  send_config: SendConfig;
  warmup_config: WarmupConfig;
  autopause_config: AutopauseConfig;
  optout_keywords: string[];
}

export const DEFAULT_SEND: SendConfig = {
  min_interval_s: 40,
  max_interval_s: 150,
  long_pause_every_min: 8,
  long_pause_every_max: 10,
  long_pause_min_min: 5,
  long_pause_max_min: 15,
  window_start: "09:00",
  window_end: "18:00",
  weekdays: [1, 2, 3, 4, 5],
  skip_holidays: true,
  typing_min_s: 3,
  typing_max_s: 8,
  timezone: "America/Sao_Paulo",
};

export const DEFAULT_WARMUP: WarmupConfig = {
  weeks: [
    { week: 1, min: 10, max: 20 },
    { week: 2, min: 20, max: 30 },
    { week: 3, min: 30, max: 50 },
  ],
  mature: { after_weeks: 5, min_reply_rate: 10, min: 80, max: 100 },
  daily_cap: 100,
};

export const DEFAULT_AUTOPAUSE: AutopauseConfig = {
  max_consecutive_failures: 3,
  min_reply_rate: 5,
  min_reply_rate_after: 30,
  optout_streak: 3,
  optout_window: 5,
};

export interface Segment {
  id: string;
  section: string;
  icon: string;
  name: string;
  is_custom: boolean;
  sort: number;
}

export interface SearchJob {
  id: string;
  status: "queued" | "running" | "done" | "cancelled" | "error" | "quota";
  params: SearchParams;
  current_category: string | null;
  found: number;
  inserted: number;
  duplicates: number;
  discarded: number;
  requests: number;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface SearchParams {
  lat: number;
  lng: number;
  radius_m: number;
  place_label?: string;
  categories: string[];
  max_per_category: number;
  filter: "phone" | "phone_site" | "all";
  source: "google_maps";
}

export interface WhatsappNumber {
  id: string;
  label: string;
  server_url: string;
  token_last4: string;
  phone: string | null;
  profile_name: string | null;
  status: "disconnected" | "connecting" | "connected";
  qr_code: string | null;
  paused: boolean;
  pause_reason: string | null;
  paused_at: string | null;
  warmup_start_date: string;
  consecutive_failures: number;
  last_error: string | null;
  webhook_ok: boolean;
  last_status_at: string | null;
  created_at: string;
}

export interface NumberStats {
  number_id: string;
  sent_today: number;
  sent_total: number;
  leads_contacted: number;
  leads_replied: number;
  failures_7d: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: "draft" | "running" | "paused" | "completed" | "cancelled";
  number_ids: string[];
  use_ai: boolean;
  ai_instructions: string;
  pause_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CampaignStats {
  campaign_id: string;
  scheduled: number;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  next_send_at: string | null;
  delivered: number;
  read: number;
  replies: number;
  optouts: number;
}

export interface Message {
  id: string;
  lead_id: string | null;
  number_id: string | null;
  campaign_id: string | null;
  direction: "in" | "out";
  body: string;
  status: "sent" | "delivered" | "read" | "failed" | "received";
  is_optout: boolean;
  created_at: string;
}
