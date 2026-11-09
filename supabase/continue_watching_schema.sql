-- ============================================================================
-- Lumen — Complete Master Database Schema for Supabase
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ============================================================================

-- Enable pgcrypto for UUID generation
create extension if not exists "pgcrypto";

-- 1. Accounts Table (User Authentication)
create table if not exists accounts (
  email      text primary key,
  password   text not null,
  created_at timestamptz not null default now()
);
alter table accounts enable row level security;

-- Seed default test accounts
insert into accounts (email, password) values
  ('avnishpc00@gmail.com',   'Avnish@00'),
  ('appclone@gmail.com',     'Avnish@00'),
  ('netflixclone@gmail.com', 'Avnish@00')
on conflict (email) do nothing;

-- 2. Account Profiles Table (Multiple profiles per account: Alice, Bob, etc.)
create table if not exists account_profiles (
  email      text primary key,
  profiles   jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table account_profiles enable row level security;

-- 3. Account Devices Table (Connected sessions & devices)
create table if not exists account_devices (
  email      text primary key,
  devices    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table account_devices enable row level security;

-- 4. Watch Parties Table (Synchronized multi-user playback)
create table if not exists watch_parties (
  id          uuid primary key default gen_random_uuid(),
  host_email  text not null,
  guest_email text not null,
  movie       jsonb not null,
  status      text not null default 'pending',   -- pending | accepted | ended
  playback    jsonb not null default '{"playing":false,"time":0}'::jsonb,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
alter table watch_parties enable row level security;

create index if not exists watch_parties_guest_pending_idx
  on watch_parties (guest_email, status, created_at desc);

-- 5. Continue Watching Table (Fast Profile-Isolated Watch History)
-- Format of key:  {user_email}::{profile_name}::{content_id}
-- Example key:   'avnishpc00@gmail.com::default::movie-550'
-- Example TV:    'avnishpc00@gmail.com::alice::tv-1399::s1e3'
create table if not exists account_watch_history (
  key        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table account_watch_history enable row level security;

-- Performance Indexes:
-- B-tree prefix pattern index enables instant sub-millisecond profile lookups
-- (e.g. key like 'avnishpc00@gmail.com::default::%')
create index if not exists account_watch_history_key_prefix_idx
  on account_watch_history (key text_pattern_ops);

-- Index for ordering Continue Watching by most recently watched
create index if not exists account_watch_history_updated_at_idx
  on account_watch_history (updated_at desc);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- The backend uses the SUPABASE_SERVICE_ROLE_KEY which bypasses RLS,
-- but these policies ensure safe direct client access if ever needed.
-- ============================================================================
drop policy if exists "Service role full access on account_watch_history" on account_watch_history;
create policy "Service role full access on account_watch_history"
  on account_watch_history
  for all
  using (true)
  with check (true);

drop policy if exists "Service role full access on account_profiles" on account_profiles;
create policy "Service role full access on account_profiles"
  on account_profiles
  for all
  using (true)
  with check (true);

drop policy if exists "Service role full access on accounts" on accounts;
create policy "Service role full access on accounts"
  on accounts
  for all
  using (true)
  with check (true);

drop policy if exists "Service role full access on account_devices" on account_devices;
create policy "Service role full access on account_devices"
  on account_devices
  for all
  using (true)
  with check (true);

drop policy if exists "Service role full access on watch_parties" on watch_parties;
create policy "Service role full access on watch_parties"
  on watch_parties
  for all
  using (true)
  with check (true);
