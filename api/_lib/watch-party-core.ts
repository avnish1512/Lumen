// Watch-party (BFF) backend helpers on top of Supabase REST.
// Server-side only (uses the service-role key via supabase-core config).
//
// Table (run once in the Supabase SQL editor):
//
//   create extension if not exists "pgcrypto";
//   create table if not exists watch_parties (
//     id          uuid primary key default gen_random_uuid(),
//     host_email  text not null,
//     guest_email text not null,
//     movie       jsonb not null,
//     status      text not null default 'pending',   -- pending | accepted | ended
//     playback    jsonb not null default '{"playing":false,"time":0}'::jsonb,
//     updated_at  timestamptz not null default now(),
//     created_at  timestamptz not null default now()
//   );
//   alter table watch_parties enable row level security;

import type { SupabaseConfig } from './supabase-core.js'

function headers(config: SupabaseConfig, extra: Record<string, string> = {}) {
  return {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

const REST = (config: SupabaseConfig) => `${config.url}/rest/v1/watch_parties`

export type WatchParty = {
  id: string
  host_email: string
  guest_email: string
  movie: unknown
  status: 'pending' | 'accepted' | 'ended'
  playback: { playing: boolean; time: number }
  updated_at: string
}

/** All real sign-in accounts (used to build the friends list). Reads the
 * `accounts` table so newly added accounts appear and removed ones disappear. */
export async function listAccountEmails(config: SupabaseConfig): Promise<string[]> {
  const response = await fetch(`${config.url}/rest/v1/accounts?select=email`, {
    headers: headers(config),
  })
  if (!response.ok) {
    return []
  }
  const rows = (await response.json()) as Array<{ email?: string }>
  return rows.map((row) => row.email ?? '').filter(Boolean)
}

export async function createInvite(
  config: SupabaseConfig,
  hostEmail: string,
  guestEmail: string,
  movie: unknown,
): Promise<WatchParty | null> {
  const response = await fetch(`${REST(config)}`, {
    method: 'POST',
    headers: headers(config, { Prefer: 'return=representation' }),
    body: JSON.stringify([
      { host_email: hostEmail, guest_email: guestEmail, movie, status: 'pending' },
    ]),
  })
  if (!response.ok) {
    throw new Error(`Invite failed (${response.status}).`)
  }
  const rows = (await response.json()) as WatchParty[]
  return rows[0] ?? null
}

/** Pending invites addressed to `email` (most recent first). */
export async function incomingInvites(
  config: SupabaseConfig,
  email: string,
): Promise<WatchParty[]> {
  const url =
    `${REST(config)}?guest_email=eq.${encodeURIComponent(email)}` +
    `&status=eq.pending&order=created_at.desc&limit=5`
  const response = await fetch(url, { headers: headers(config) })
  if (!response.ok) {
    return []
  }
  return (await response.json()) as WatchParty[]
}

export async function getParty(
  config: SupabaseConfig,
  id: string,
): Promise<WatchParty | null> {
  const url = `${REST(config)}?id=eq.${encodeURIComponent(id)}&limit=1`
  const response = await fetch(url, { headers: headers(config) })
  if (!response.ok) {
    return null
  }
  const rows = (await response.json()) as WatchParty[]
  return rows[0] ?? null
}

export async function updateParty(
  config: SupabaseConfig,
  id: string,
  patch: Partial<Pick<WatchParty, 'status' | 'playback'>>,
): Promise<void> {
  const url = `${REST(config)}?id=eq.${encodeURIComponent(id)}`
  const response = await fetch(url, {
    method: 'PATCH',
    headers: headers(config),
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  })
  if (!response.ok) {
    throw new Error(`Update failed (${response.status}).`)
  }
}
