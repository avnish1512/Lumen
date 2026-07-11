// Accounts admin store (Supabase). Only the main/admin account may list, add,
// edit or remove accounts. A public `verify` path lets the login screen check a
// single credential without exposing the others.
//
// SECURITY NOTE: passwords are stored in plain text here because the product
// requirement is an admin panel that can *view* every account's password. This
// is intentionally insecure and only acceptable for a small private app. Do not
// reuse this pattern for a real multi-user product (hash passwords instead).
//
// Table (run once in the Supabase SQL editor):
//
//   create table if not exists accounts (
//     email      text primary key,
//     password   text not null,
//     created_at timestamptz not null default now()
//   );
//   alter table accounts enable row level security;

import type { SupabaseConfig } from './supabase-core.js'

export function adminEmailFromEnv(env: Record<string, string | undefined>): string {
  return (env.ADMIN_EMAIL ?? 'avnishpc00@gmail.com').toLowerCase()
}

function headers(config: SupabaseConfig, extra: Record<string, string> = {}) {
  return {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

const REST = (config: SupabaseConfig) => `${config.url}/rest/v1/accounts`

export type Account = { email: string; password: string }

export async function listAccounts(config: SupabaseConfig): Promise<Account[]> {
  const response = await fetch(`${REST(config)}?select=email,password&order=created_at.asc`, {
    headers: headers(config),
  })
  if (!response.ok) {
    return []
  }
  return (await response.json()) as Account[]
}

export async function saveAccount(
  config: SupabaseConfig,
  email: string,
  password: string,
  previousEmail?: string,
): Promise<void> {
  // Renaming the primary key (email) = delete the old row then upsert the new.
  if (previousEmail && previousEmail !== email) {
    await deleteAccount(config, previousEmail)
  }

  const response = await fetch(`${REST(config)}?on_conflict=email`, {
    method: 'POST',
    headers: headers(config, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify([{ email, password }]),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Account save failed (${response.status}). ${detail}`.trim())
  }
}

export async function deleteAccount(config: SupabaseConfig, email: string): Promise<void> {
  const response = await fetch(`${REST(config)}?email=eq.${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: headers(config, { Prefer: 'return=minimal' }),
  })
  if (!response.ok) {
    throw new Error(`Account delete failed (${response.status}).`)
  }
}

export async function verifyAccount(
  config: SupabaseConfig,
  email: string,
  password: string,
): Promise<boolean> {
  const url =
    `${REST(config)}?select=email&email=eq.${encodeURIComponent(email)}` +
    `&password=eq.${encodeURIComponent(password)}&limit=1`
  const response = await fetch(url, { headers: headers(config) })
  if (!response.ok) {
    return false
  }
  const rows = (await response.json()) as unknown[]
  return rows.length > 0
}
