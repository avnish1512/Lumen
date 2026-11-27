-- Lumen VPN Supabase Schema & Row Level Security Migration
-- Target: PostgreSQL (Supabase)

create extension if not exists "pgcrypto";

-- 1. Supported VPN Countries
create table if not exists vpn_countries (
  code        text primary key, -- ISO 3166-1 alpha-2 e.g. 'IN', 'US'
  name        text not null,
  flag_emoji  text not null default '',
  is_enabled  boolean not null default true,
  sort_order  integer not null default 100,
  created_at  timestamptz not null default now()
);

alter table vpn_countries enable row level security;

-- Public/authenticated clients may read enabled countries via API or RLS
drop policy if exists "vpn_countries_read_enabled" on vpn_countries;
create policy "vpn_countries_read_enabled"
  on vpn_countries
  for select
  using (is_enabled = true);

-- Seed baseline country catalog (servers must still be deployed and healthy to connect)
insert into vpn_countries (code, name, flag_emoji, is_enabled, sort_order) values
  ('IN', 'India', '🇮🇳', true, 1),
  ('US', 'United States', '🇺🇸', true, 2),
  ('GB', 'United Kingdom', '🇬🇧', true, 3),
  ('DE', 'Germany', '🇩🇪', true, 4),
  ('SG', 'Singapore', '🇸🇬', true, 5),
  ('JP', 'Japan', '🇯🇵', true, 6),
  ('CA', 'Canada', '🇨🇦', true, 7),
  ('AU', 'Australia', '🇦🇺', true, 8),
  ('NL', 'Netherlands', '🇳🇱', true, 9),
  ('FR', 'France', '🇫🇷', true, 10)
on conflict (code) do nothing;

-- 2. Operational WireGuard VPN Servers (Admin / service_role only)
create table if not exists vpn_servers (
  id                uuid primary key default gen_random_uuid(),
  country_code      text not null references vpn_countries(code) on delete restrict,
  name              text not null,
  region            text not null,
  public_ip         text not null,
  endpoint_host     text not null,
  endpoint_port     integer not null default 51820 check (endpoint_port between 1 and 65535),
  wg_public_key     text not null,
  subnet_cidr       text not null default '10.66.0.0/24',
  dns_servers       text not null default '1.1.1.1, 9.9.9.9',
  max_peers         integer not null default 50 check (max_peers > 0),
  active_peers      integer not null default 0 check (active_peers >= 0),
  status            text not null default 'offline' check (status in ('healthy', 'degraded', 'offline')),
  last_heartbeat_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table vpn_servers enable row level security;
-- No SELECT policy for anon/authenticated: administrative server details & public IPs
-- are only exposed safely through the authenticated VPN control plane API.

create index if not exists vpn_servers_country_status_idx
  on vpn_servers (country_code, status);

-- 3. Registered User VPN Devices (WireGuard Client Public Keys)
create table if not exists vpn_devices (
  id           uuid primary key default gen_random_uuid(),
  user_email   text not null,
  device_name  text not null default 'Lumen Client',
  platform     text not null default 'windows' check (platform in ('windows', 'macos', 'linux', 'android', 'ios', 'web')),
  wg_public_key text not null unique,
  assigned_ip  text not null,
  is_revoked   boolean not null default false,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table vpn_devices enable row level security;

drop policy if exists "vpn_devices_owner_select" on vpn_devices;
create policy "vpn_devices_owner_select"
  on vpn_devices
  for select
  using (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create index if not exists vpn_devices_user_email_idx
  on vpn_devices (lower(user_email), is_revoked);

-- 4. User VPN Sessions (No browsing content or DNS queries stored)
create table if not exists vpn_sessions (
  id                 uuid primary key default gen_random_uuid(),
  user_email         text not null,
  device_id          uuid references vpn_devices(id) on delete set null,
  server_id          uuid not null references vpn_servers(id) on delete cascade,
  country_code       text not null references vpn_countries(code) on delete restrict,
  status             text not null default 'connecting'
    check (status in ('connecting', 'connected', 'reconnecting', 'disconnected', 'error')),
  assigned_exit_ip   text not null,
  assigned_tunnel_ip text not null,
  connected_at       timestamptz,
  disconnected_at    timestamptz,
  expires_at         timestamptz not null default (now() + interval '12 hours'),
  created_at         timestamptz not null default now()
);

alter table vpn_sessions enable row level security;

drop policy if exists "vpn_sessions_owner_select" on vpn_sessions;
create policy "vpn_sessions_owner_select"
  on vpn_sessions
  for select
  using (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create index if not exists vpn_sessions_user_status_idx
  on vpn_sessions (lower(user_email), status, created_at desc);

-- 5. Daily Aggregate Usage Counters (Bandwidth cap enforcement without content logs)
create table if not exists vpn_usage_counters (
  user_email    text not null,
  period_date   date not null default current_date,
  bytes_rx      bigint not null default 0 check (bytes_rx >= 0),
  bytes_tx      bigint not null default 0 check (bytes_tx >= 0),
  session_count integer not null default 0 check (session_count >= 0),
  updated_at    timestamptz not null default now(),
  primary key (user_email, period_date)
);

alter table vpn_usage_counters enable row level security;

drop policy if exists "vpn_usage_owner_select" on vpn_usage_counters;
create policy "vpn_usage_owner_select"
  on vpn_usage_counters
  for select
  using (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
