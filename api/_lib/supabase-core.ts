// Minimal Supabase REST helpers for cross-device profile storage.
// Uses the PostgREST endpoint directly (no @supabase/supabase-js dependency)
// with the service-role key, so this must only ever run server-side.
//
// Expected table (run once in the Supabase SQL editor):
//
//   create table if not exists account_profiles (
//     email      text primary key,
//     profiles   jsonb not null default '[]'::jsonb,
//     updated_at timestamptz not null default now()
//   );
//
//   -- Keep it locked down; only the service role (server) touches it.
//   alter table account_profiles enable row level security;

export type StoredProfile = {
  name: string
  avatarColor: string
}

export type SupabaseConfig = {
  url: string
  serviceKey: string
}

export function supabaseConfigFromEnv(
  env: Record<string, string | undefined>,
): SupabaseConfig | null {
  const url = env.SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return null
  }

  return { url: url.replace(/\/$/, ''), serviceKey }
}

function restHeaders(config: SupabaseConfig) {
  return {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    'Content-Type': 'application/json',
  }
}

export async function fetchAccountProfiles(
  config: SupabaseConfig,
  email: string,
): Promise<StoredProfile[] | null> {
  const url = `${config.url}/rest/v1/account_profiles?email=eq.${encodeURIComponent(
    email,
  )}&select=profiles`

  const response = await fetch(url, { headers: restHeaders(config) })

  if (!response.ok) {
    throw new Error(`Supabase read failed (${response.status}).`)
  }

  const rows = (await response.json()) as Array<{ profiles?: StoredProfile[] }>
  if (!rows.length) {
    return null
  }

  return Array.isArray(rows[0].profiles) ? rows[0].profiles : []
}

export async function saveAccountProfiles(
  config: SupabaseConfig,
  email: string,
  profiles: StoredProfile[],
): Promise<void> {
  // Upsert on the email primary key.
  const url = `${config.url}/rest/v1/account_profiles?on_conflict=email`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...restHeaders(config),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([
      { email, profiles, updated_at: new Date().toISOString() },
    ]),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Supabase write failed (${response.status}). ${detail}`.trim())
  }
}
