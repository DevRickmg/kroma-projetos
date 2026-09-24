-- =====================================================================
-- Kroma Leads — setup completo do banco (Supabase / Postgres)
--
-- Como usar: Supabase → SQL Editor → New query → colar este arquivo
-- inteiro → Run. Pode rodar de novo sem quebrar nada (idempotente).
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- settings: uma linha por usuário
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ddi text not null default '55',
  my_name text not null default '',
  my_company text not null default 'Kroma Projetos',
  google_monthly_limit int not null default 1000,
  send_config jsonb not null default '{
    "min_interval_s": 40,
    "max_interval_s": 150,
    "long_pause_every_min": 8,
    "long_pause_every_max": 10,
    "long_pause_min_min": 5,
    "long_pause_max_min": 15,
    "window_start": "09:00",
    "window_end": "18:00",
    "weekdays": [1,2,3,4,5],
    "skip_holidays": true,
    "typing_min_s": 3,
    "typing_max_s": 8,
    "timezone": "America/Sao_Paulo"
  }'::jsonb,
  warmup_config jsonb not null default '{
    "weeks": [
      {"week": 1, "min": 10, "max": 20},
      {"week": 2, "min": 20, "max": 30},
      {"week": 3, "min": 30, "max": 50}
    ],
    "mature": {"after_weeks": 5, "min_reply_rate": 10, "min": 80, "max": 100},
    "daily_cap": 100
  }'::jsonb,
  autopause_config jsonb not null default '{
    "max_consecutive_failures": 3,
    "min_reply_rate": 5,
    "min_reply_rate_after": 30,
    "optout_streak": 3,
    "optout_window": 5
  }'::jsonb,
  optout_keywords text[] not null default array[
    'sair','parar','pare','para de','remover','remova','me remove','me tira',
    'nao quero','nao tenho interesse','sem interesse','nao me chame',
    'nao me mande','nao mande mais','nao chame mais','cancelar','descadastrar',
    'stop','bloquear','spam'
  ],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_settings_touch on public.settings;
create trigger trg_settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- api_credentials: chaves (Google, tokens Uazapi, IA). SÓ o servidor lê.
-- RLS ligado e nenhuma policy → anon/authenticated não enxergam nada.
-- ---------------------------------------------------------------------
create table if not exists public.api_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('google_places','uazapi_token','ai')),
  ref_id uuid,
  secret text not null,
  last4 text not null default '',
  lookup_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists api_credentials_lookup on public.api_credentials (lookup_hash) where lookup_hash is not null;
create unique index if not exists api_credentials_uniq
  on public.api_credentials (user_id, kind, coalesce(ref_id, '00000000-0000-0000-0000-000000000000'::uuid));
revoke all on public.api_credentials from anon, authenticated;

-- ---------------------------------------------------------------------
-- app_config: URL do app + segredo do cron (preenchido pelo próprio app)
-- ---------------------------------------------------------------------
create table if not exists public.app_config (
  id int primary key default 1 check (id = 1),
  app_url text,
  cron_secret text,
  updated_at timestamptz not null default now()
);
revoke all on public.app_config from anon, authenticated;

-- ---------------------------------------------------------------------
-- google_usage: requisições por mês (a linha do mês novo zera sozinha)
-- ---------------------------------------------------------------------
create table if not exists public.google_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period date not null,
  requests int not null default 0,
  primary key (user_id, period)
);

-- ---------------------------------------------------------------------
-- segments: categorias padrão + personalizadas
-- ---------------------------------------------------------------------
create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null,
  icon text not null default 'tag',
  name text not null,
  is_custom boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists segments_uniq on public.segments (user_id, lower(name));

-- ---------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  address text,
  city text,
  state text,
  phone_raw text,
  phone_e164 text,
  phone_type text not null default 'unknown' check (phone_type in ('mobile','fixed','unknown')),
  email text,
  website text,
  instagram text,
  rating numeric(2,1),
  reviews_count int,
  google_place_id text,
  google_maps_url text,
  lat double precision,
  lng double precision,
  presence text not null default 'none' check (presence in ('none','instagram','site')),
  site_quality text not null default 'unknown' check (site_quality in ('unknown','bad','good')),
  score int not null default 0,
  status text not null default 'new' check (status in
    ('new','qualified','contacted','replied','negotiating','client','not_interested','do_not_disturb')),
  qualified boolean not null default false,
  contact_mode text check (contact_mode in ('campaign','manual')),
  archived boolean not null default false,
  archived_at timestamptz,
  notes text not null default '',
  tags text[] not null default '{}',
  source text not null default 'manual' check (source in ('google_maps','import','manual')),
  source_detail text,
  unread_count int not null default 0,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists leads_place_uniq on public.leads (user_id, google_place_id) where google_place_id is not null;
create unique index if not exists leads_phone_uniq on public.leads (user_id, phone_e164) where phone_e164 is not null;
create index if not exists leads_user_status on public.leads (user_id, status);
create index if not exists leads_user_score on public.leads (user_id, score desc);
create index if not exists leads_user_archived on public.leads (user_id, archived);
create index if not exists leads_last_msg on public.leads (user_id, last_message_at desc nulls last);

-- Presença + score recalculados sempre que o lead muda
create or replace function public.compute_lead_fields()
returns trigger language plpgsql as $$
declare s int;
begin
  if new.website is not null and btrim(new.website) = '' then new.website := null; end if;
  if new.instagram is not null and btrim(new.instagram) = '' then new.instagram := null; end if;

  new.presence := case
    when new.website is not null then 'site'
    when new.instagram is not null then 'instagram'
    else 'none' end;

  if new.presence = 'none' then
    s := 92;
  elsif new.presence = 'instagram' then
    s := 75;
  elsif new.site_quality = 'bad' then
    s := 88;
  elsif new.site_quality = 'good' then
    s := 25;
  else
    s := 40;
  end if;

  -- empresa ativa, com cliente e com dinheiro
  if coalesce(new.reviews_count, 0) >= 50 and coalesce(new.rating, 0) >= 4.3 then
    s := s + 4;
  elsif coalesce(new.reviews_count, 0) >= 20 and coalesce(new.rating, 0) >= 4.0 then
    s := s + 2;
  end if;

  if new.phone_e164 is null then
    s := s - 10;
  elsif new.phone_type = 'fixed' then
    s := s - 5;
  end if;

  new.score := greatest(0, least(100, s));

  if new.qualified and new.status = 'new' then new.status := 'qualified'; end if;
  if not new.qualified and new.status = 'qualified' then new.status := 'new'; end if;
  if new.archived and new.archived_at is null then new.archived_at := now(); end if;
  if not new.archived then new.archived_at := null; end if;
  return new;
end $$;

drop trigger if exists trg_leads_compute on public.leads;
create trigger trg_leads_compute before insert or update on public.leads
  for each row execute function public.compute_lead_fields();
drop trigger if exists trg_leads_touch on public.leads;
create trigger trg_leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- lead_events: linha do tempo
-- ---------------------------------------------------------------------
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null,
  from_status text,
  to_status text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists lead_events_lead on public.lead_events (lead_id, created_at desc);

create or replace function public.log_lead_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into lead_events (user_id, lead_id, type, to_status, detail)
    values (new.user_id, new.id, 'created', new.status,
            coalesce(new.source_detail, new.source));
  elsif new.status is distinct from old.status then
    insert into lead_events (user_id, lead_id, type, from_status, to_status)
    values (new.user_id, new.id, 'status', old.status, new.status);
  elsif new.archived is distinct from old.archived then
    insert into lead_events (user_id, lead_id, type, detail)
    values (new.user_id, new.id, case when new.archived then 'archived' else 'unarchived' end, null);
  end if;
  return new;
end $$;
drop trigger if exists trg_leads_events on public.leads;
create trigger trg_leads_events after insert or update on public.leads
  for each row execute function public.log_lead_events();

-- ---------------------------------------------------------------------
-- search_jobs: buscas no Google Maps em segundo plano
-- ---------------------------------------------------------------------
create table if not exists public.search_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','done','cancelled','error','quota')),
  params jsonb not null,
  cursor jsonb not null default '{}'::jsonb,
  current_category text,
  found int not null default 0,
  inserted int not null default 0,
  duplicates int not null default 0,
  discarded int not null default 0,
  requests int not null default 0,
  error text,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists search_jobs_active on public.search_jobs (status) where status in ('queued','running');
drop trigger if exists trg_search_jobs_touch on public.search_jobs;
create trigger trg_search_jobs_touch before update on public.search_jobs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- whatsapp_numbers: instâncias da Uazapi
-- ---------------------------------------------------------------------
create table if not exists public.whatsapp_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  server_url text not null,
  token_last4 text not null default '',
  phone text,
  profile_name text,
  status text not null default 'disconnected' check (status in ('disconnected','connecting','connected')),
  qr_code text,
  paused boolean not null default false,
  pause_reason text,
  paused_at timestamptz,
  resumed_at timestamptz,
  warmup_start_date date not null default (now() at time zone 'America/Sao_Paulo')::date,
  consecutive_failures int not null default 0,
  last_error text,
  webhook_ok boolean not null default false,
  last_status_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_wn_touch on public.whatsapp_numbers;
create trigger trg_wn_touch before update on public.whatsapp_numbers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- campaigns + templates
-- ---------------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft','running','paused','completed','cancelled')),
  number_ids uuid[] not null default '{}',
  use_ai boolean not null default false,
  ai_instructions text not null default '',
  pause_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_campaigns_touch on public.campaigns;
create trigger trg_campaigns_touch before update on public.campaigns
  for each row execute function public.touch_updated_at();

create table if not exists public.campaign_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  body text not null,
  position int not null default 0
);
create index if not exists campaign_templates_campaign on public.campaign_templates (campaign_id, position);

-- ---------------------------------------------------------------------
-- message_queue: fila agendada do disparo
-- ---------------------------------------------------------------------
create table if not exists public.message_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  number_id uuid references public.whatsapp_numbers(id) on delete set null,
  template_id uuid references public.campaign_templates(id) on delete set null,
  scheduled_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','sending','sent','failed','skipped','cancelled')),
  rendered_text text,
  error text,
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists message_queue_uniq on public.message_queue (campaign_id, lead_id);
create index if not exists message_queue_due on public.message_queue (status, scheduled_at) where status in ('scheduled','sending');
create index if not exists message_queue_number on public.message_queue (number_id, status, scheduled_at);
create index if not exists message_queue_lead on public.message_queue (lead_id, status);

-- ---------------------------------------------------------------------
-- messages: histórico (entrada e saída)
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  number_id uuid references public.whatsapp_numbers(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  queue_id uuid references public.message_queue(id) on delete set null,
  direction text not null check (direction in ('in','out')),
  body text not null default '',
  provider_message_id text,
  status text not null default 'sent' check (status in ('sent','delivered','read','failed','received')),
  is_optout boolean not null default false,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz
);
create unique index if not exists messages_provider_uniq on public.messages (number_id, provider_message_id) where provider_message_id is not null;
create index if not exists messages_lead on public.messages (lead_id, created_at);
create index if not exists messages_campaign on public.messages (campaign_id, direction);
create index if not exists messages_number_day on public.messages (number_id, direction, created_at);

-- ---------------------------------------------------------------------
-- blocklist
-- ---------------------------------------------------------------------
create table if not exists public.blocklist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text not null,
  reason text not null default 'manual',
  created_at timestamptz not null default now()
);
create unique index if not exists blocklist_uniq on public.blocklist (user_id, phone_e164);

-- ---------------------------------------------------------------------
-- RLS: cada usuário só enxerga o que é dele
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['settings','google_usage','segments','leads','lead_events','search_jobs',
                           'whatsapp_numbers','campaigns','campaign_templates','message_queue',
                           'messages','blocklist']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
alter table public.api_credentials enable row level security;
alter table public.app_config enable row level security;

-- ---------------------------------------------------------------------
-- Views de métricas (security_invoker → respeitam o RLS)
-- ---------------------------------------------------------------------
create or replace view public.campaign_stats with (security_invoker = true) as
select
  c.id as campaign_id,
  count(q.*) filter (where q.status = 'scheduled') as scheduled,
  count(q.*) filter (where q.status = 'sent') as sent,
  count(q.*) filter (where q.status = 'failed') as failed,
  count(q.*) filter (where q.status in ('skipped','cancelled')) as skipped,
  count(q.*) as total,
  min(q.scheduled_at) filter (where q.status = 'scheduled') as next_send_at,
  (select count(*) from public.messages m where m.campaign_id = c.id and m.direction = 'out' and m.status in ('delivered','read')) as delivered,
  (select count(*) from public.messages m where m.campaign_id = c.id and m.direction = 'out' and m.status = 'read') as read,
  (select count(distinct m.lead_id) from public.messages m where m.campaign_id = c.id and m.direction = 'in') as replies,
  (select count(distinct m.lead_id) from public.messages m where m.campaign_id = c.id and m.direction = 'in' and m.is_optout) as optouts
from public.campaigns c
left join public.message_queue q on q.campaign_id = c.id
group by c.id;

create or replace view public.number_stats with (security_invoker = true) as
select
  n.id as number_id,
  (select count(*) from public.messages m
     where m.number_id = n.id and m.direction = 'out' and m.campaign_id is not null
       and (m.created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date) as sent_today,
  (select count(*) from public.messages m where m.number_id = n.id and m.direction = 'out' and m.campaign_id is not null) as sent_total,
  (select count(distinct m.lead_id) from public.messages m where m.number_id = n.id and m.direction = 'out' and m.campaign_id is not null) as leads_contacted,
  (select count(distinct m.lead_id) from public.messages m where m.number_id = n.id and m.direction = 'in'
     and exists (select 1 from public.messages o where o.lead_id = m.lead_id and o.number_id = n.id and o.direction = 'out' and o.campaign_id is not null)) as leads_replied,
  (select count(*) from public.message_queue q where q.number_id = n.id and q.status = 'failed'
     and q.created_at > now() - interval '7 days') as failures_7d
from public.whatsapp_numbers n;

-- ---------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------

-- Primeiro acesso: cria settings e semeia os segmentos padrão
create or replace function public.ensure_user_setup()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  insert into settings (user_id) values (uid) on conflict do nothing;
  if not exists (select 1 from segments where user_id = uid) then
    perform seed_segments(uid);
  end if;
end $$;
grant execute on function public.ensure_user_setup() to authenticated;

-- Conta uma requisição ao Google ANTES de fazê-la. Retorna o novo total,
-- ou null se a cota do mês já acabou (nesse caso nada é incrementado).
create or replace function public.increment_google_usage(p_user uuid, p_limit int)
returns int language plpgsql security definer set search_path = public as $$
declare p date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
        v int;
begin
  insert into google_usage (user_id, period, requests) values (p_user, p, 0)
  on conflict do nothing;
  update google_usage set requests = requests + 1
   where user_id = p_user and period = p and requests < p_limit
  returning requests into v;
  return v;
end $$;
revoke execute on function public.increment_google_usage(uuid, int) from public, anon, authenticated;

-- Pega mensagens vencidas: no máximo 1 por número, nunca dois envios
-- simultâneos no mesmo número, nunca a mesma mensagem duas vezes.
create or replace function public.claim_due_messages()
returns setof public.message_queue language plpgsql security definer set search_path = public as $$
declare n record; q public.message_queue;
begin
  -- envio que travou no meio (função caiu): marca como falha, nunca reenvia
  update message_queue set status = 'failed', error = 'Envio interrompido (tempo esgotado). Não reenviado para evitar duplicidade.'
   where status = 'sending' and locked_at < now() - interval '5 minutes';

  for n in
    select w.id from whatsapp_numbers w
     where not w.paused and w.status = 'connected'
       and not exists (select 1 from message_queue s where s.number_id = w.id and s.status = 'sending')
     for update skip locked
  loop
    select mq.* into q from message_queue mq
      join campaigns c on c.id = mq.campaign_id
     where mq.number_id = n.id and mq.status = 'scheduled' and mq.scheduled_at <= now()
       and c.status = 'running'
     order by mq.scheduled_at
     limit 1
     for update of mq skip locked;
    if found then
      update message_queue set status = 'sending', locked_at = now() where id = q.id
      returning * into q;
      return next q;
    end if;
  end loop;
end $$;
revoke execute on function public.claim_due_messages() from public, anon, authenticated;

-- Aplica a agenda calculada pelo app: [{id, number_id, scheduled_at}, ...]
create or replace function public.apply_schedule(p_items jsonb)
returns void language sql security definer set search_path = public as $$
  update message_queue q
     set number_id = x.number_id, scheduled_at = x.scheduled_at, status = 'scheduled', locked_at = null
    from jsonb_to_recordset(p_items) as x(id uuid, number_id uuid, scheduled_at timestamptz)
   where q.id = x.id and q.status in ('scheduled','sending');
$$;
revoke execute on function public.apply_schedule(jsonb) from public, anon, authenticated;

-- Adiciona uma tag a vários leads (respeita RLS: security invoker)
create or replace function public.add_tag_to_leads(p_ids uuid[], p_tag text)
returns void language sql security invoker set search_path = public as $$
  update leads set tags = (select array(select distinct unnest(tags || array[btrim(p_tag)])))
   where id = any(p_ids) and btrim(p_tag) <> '';
$$;
grant execute on function public.add_tag_to_leads(uuid[], text) to authenticated;

-- Listas pros filtros (cidades e categorias distintas)
create or replace function public.lead_facets()
returns table(kind text, value text, n bigint) language sql security invoker stable set search_path = public as $$
  select 'city', city, count(*) from leads where city is not null group by city
  union all
  select 'category', category, count(*) from leads where category is not null group by category
  order by 1, 3 desc;
$$;
grant execute on function public.lead_facets() to authenticated;

-- Espaço usado (aproximado) pelos dados do usuário
create or replace function public.user_storage_bytes()
returns bigint language sql security definer set search_path = public stable as $$
  select coalesce((select sum(pg_column_size(l.*)) from leads l where l.user_id = auth.uid()), 0)
       + coalesce((select sum(pg_column_size(m.*)) from messages m where m.user_id = auth.uid()), 0)
       + coalesce((select sum(pg_column_size(e.*)) from lead_events e where e.user_id = auth.uid()), 0)
       + coalesce((select sum(pg_column_size(q.*)) from message_queue q where q.user_id = auth.uid()), 0);
$$;
grant execute on function public.user_storage_bytes() to authenticated;

-- Apaga tudo (menos configurações, números conectados e a blocklist,
-- que precisa continuar valendo pela LGPD)
create or replace function public.wipe_user_data()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  delete from messages where user_id = uid;
  delete from message_queue where user_id = uid;
  delete from campaign_templates where user_id = uid;
  delete from campaigns where user_id = uid;
  delete from lead_events where user_id = uid;
  delete from leads where user_id = uid;
  delete from search_jobs where user_id = uid;
end $$;
grant execute on function public.wipe_user_data() to authenticated;

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['messages','search_jobs','whatsapp_numbers','campaigns','leads']
  loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Cron: a cada minuto chama /api/cron/tick do app (envio + buscas).
-- URL e segredo ficam em app_config, preenchidos pelo próprio app no
-- primeiro acesso — não precisa editar nada aqui.
-- ---------------------------------------------------------------------
create or replace function public.kroma_cron_tick()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare cfg record;
begin
  select * into cfg from app_config where id = 1;
  if cfg.app_url is null or cfg.cron_secret is null then return; end if;
  -- só chama se tiver trabalho pendente (economiza execução na Vercel)
  if not exists (select 1 from message_queue where status = 'scheduled' and scheduled_at <= now())
     and not exists (select 1 from search_jobs where status in ('queued','running')
                        and (locked_until is null or locked_until < now()))
     and not exists (select 1 from whatsapp_numbers where status <> 'disconnected'
                        and (last_status_at is null or last_status_at < now() - interval '10 minutes')) then
    return;
  end if;
  perform net.http_post(
    url := rtrim(cfg.app_url, '/') || '/api/cron/tick',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || cfg.cron_secret),
    timeout_milliseconds := 60000
  );
end $$;
revoke execute on function public.kroma_cron_tick() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kroma-tick') then
    perform cron.unschedule('kroma-tick');
  end if;
  perform cron.schedule('kroma-tick', '* * * * *', 'select public.kroma_cron_tick()');
end $$;

-- ---------------------------------------------------------------------
-- Segmentos padrão (semeados por usuário no primeiro acesso)
-- ---------------------------------------------------------------------
create or replace function public.seed_segments(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  sec record; nm text; i int := 0;
begin
  for sec in
    select * from (values
      (1,  'Saúde & Bem-estar', 'heart-pulse', array['Dentista','Clínica odontológica','Ortodontista','Clínica médica','Clínica de estética','Cirurgia plástica','Dermatologista','Cardiologista','Ortopedia','Ginecologista','Pediatria','Psicólogo','Psiquiatria','Nutricionista','Fisioterapeuta','Academia','Pilates','Studio de yoga','Crossfit','Personal trainer','Spa','Clínica de depilação','Esmalteria','Podologia','Estúdio de tatuagem','Clínica de micropigmentação','Laboratório de análises','Farmácia']),
      (2,  'Pet & Veterinária', 'paw-print', array['Pet shop','Veterinária','Clínica veterinária','Pet grooming','Hotel para pets','Adestramento']),
      (3,  'Beleza & Estética', 'scissors', array['Salão de beleza','Barbearia','Cabeleireiro','Instituto de beleza','Manicure','Design de sobrancelhas','Limpeza de pele','Lash designer']),
      (4,  'Automotivo', 'car', array['Oficina mecânica','Lava a jato','Borracharia','Auto elétrica','Funilaria e pintura','Concessionária','Revenda de veículos','Som automotivo','Insulfilm','Estacionamento','Locadora de veículos','Troca de óleo']),
      (5,  'Alimentação', 'utensils', array['Restaurante','Pizzaria','Hamburgueria','Churrascaria','Comida japonesa','Sushi','Bar','Padaria','Cafeteria','Sorveteria','Confeitaria','Lanchonete','Food truck','Marmitaria','Hortifruti','Peixaria','Açougue']),
      (6,  'Hospedagem & Turismo', 'bed', array['Hotel','Pousada','Hostel','Agência de viagens']),
      (7,  'Educação', 'graduation-cap', array['Escola particular','Colégio','Creche','Pré-vestibular','Cursinho preparatório','Escola de idiomas','Autoescola','Escola de música','Escola de dança','Escola de artes marciais','Escola de programação','Faculdade','Coaching']),
      (8,  'Varejo', 'shopping-bag', array['Loja de roupas','Loja de calçados','Joalheria','Ótica','Livraria','Papelaria','Artigos esportivos','Móveis e decoração','Floricultura','Loja de eletrônicos','Loja de brinquedos','Material de construção','Farmácia de manipulação','Loja de suplementos']),
      (9,  'Construção & Reforma', 'hammer', array['Construtora','Arquitetura','Engenharia civil','Eletricista','Encanador','Pintor','Gesso e drywall','Serralheria','Marmoraria','Vidraçaria','Impermeabilização','Ar condicionado','Reformas e construção','Piscinas e spas']),
      (10, 'Serviços', 'wrench', array['Lavanderia','Dedetizadora','Desentupidora','Chaveiro','Segurança e monitoramento','Jardinagem e paisagismo','Limpeza de estofados','Mudança','Fotografia','Gráfica','Cuidado de idosos']),
      (11, 'Jurídico & Contábil', 'scale', array['Advogado','Escritório de advocacia','Contabilidade','Contador','Imobiliária','Corretora de seguros','Consultoria tributária','Planejamento financeiro']),
      (12, 'Tech & Negócios', 'laptop', array['Agência de marketing','Desenvolvimento de sites','Desenvolvimento de apps','Design gráfico','Gestão de tráfego','Redes sociais','Criação de conteúdo','SEO','Agência de publicidade','Suporte de TI','CFTV e câmeras','Coworking','E-commerce']),
      (13, 'Eventos', 'party-popper', array['Buffet de festas','Espaço de eventos','Salão de festas infantis','Decoração de festas','Cerimonialista','Assessoria de casamentos','DJ','Fotógrafo de eventos','Filmagem de eventos','Animador infantil','Mágico','Aluguel de mobiliário']),
      (14, 'Indústria Alimentícia B2B', 'factory', array['Fabricante de máquinas de padaria','Fabricante de equipamentos para restaurantes','Distribuidor de insumos alimentícios','Fabricante de embalagens alimentícias','Fornecedor de insumos para indústria de alimentos','Processadora de alimentos','Distribuidora de alimentos a granel']),
      (15, 'Energia & Elétrico', 'zap', array['Distribuidora de energia elétrica','Fabricante de painéis elétricos','Empresa de automação elétrica','Fornecedor de transformadores','Fornecedor de geradores','Instaladora de subestações','Empresa de eficiência energética','Fornecedor de cabos e fios industriais','Manutenção elétrica industrial']),
      (16, 'Transporte & Logística', 'truck', array['Transportadora regional','Distribuidora de peças para caminhão','Empresa de logística frigorífica','Transportadora de cargas especiais','Empresa de armazenagem e distribuição','Operador logístico','Frota e locação de caminhões','Oficina para caminhões']),
      (17, 'Construção Industrial', 'building', array['Fabricante de elevadores','Empresa de impermeabilização industrial','Fornecedor de estruturas metálicas','Fabricante de esquadrias de alumínio','Fabricante de coberturas industriais','Empresa de fundações e estacas','Fornecedor de pré-moldados de concreto','Instaladora de pisos industriais']),
      (18, 'Metalurgia & Usinagem', 'cog', array['Metalúrgica','Tornearia mecânica','Fabricante de moldes e matrizes','Empresa de usinagem CNC','Fabricante de peças sob encomenda','Caldeiraria e solda','Fundição e forjaria','Tratamento de superfícies','Galvanoplastia','Fabricante de ferramentas e utensílios industriais']),
      (19, 'Agronegócio', 'tractor', array['Distribuidor de insumos agrícolas','Fabricante de equipamentos agrícolas','Empresa de irrigação','Revenda de tratores e máquinas','Armazém e silos de grãos','Empresa de defensivos agrícolas','Análise de solo e consultoria agronômica','Produtora de sementes','Beneficiadora de grãos','Avicultura e suinocultura industrial']),
      (20, 'Saúde Hospitalar B2B', 'hospital', array['Distribuidor de equipamentos médicos','Fabricante de móveis hospitalares','Empresa de manutenção de equipamentos hospitalares','Distribuidor de materiais hospitalares','Fornecedor de gases medicinais','Empresa de esterilização e autoclave','Distribuidora de medicamentos','Fabricante de uniformes hospitalares','Terceirização de limpeza hospitalar'])
    ) as v(ord, section, icon, names)
    order by ord
  loop
    foreach nm in array sec.names loop
      i := i + 1;
      insert into segments (user_id, section, icon, name, is_custom, sort)
      values (p_user, sec.section, sec.icon, nm, false, i)
      on conflict do nothing;
    end loop;
  end loop;
end $$;
revoke execute on function public.seed_segments(uuid) from public, anon, authenticated;
