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
  starredServer?: string
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

// Cross-device "Continue Watching" sync. Keyed by authenticated user account ID.
//
// Expected table (run once in the Supabase SQL editor):
//
//   create table if not exists account_watch_history (
//     key              text primary key, -- user_id::content_id(::s#e#)
//     id               text,
//     user_id          text not null,
//     content_id       text not null,
//     content_type     text not null default 'movie',
//     season_number    integer,
//     episode_number   integer,
//     progress_seconds numeric not null default 0,
//     duration_seconds numeric not null default 0,
//     completed        boolean not null default false,
//     data             jsonb not null default '{}'::jsonb,
//     updated_at       timestamptz not null default now()
//   );
//   alter table account_watch_history enable row level security;
//
//   -- Row Level Security (RLS) policies:
//   -- Authenticated users may select/insert/update only their own rows:
//   -- create policy "Users can view own watch progress" on account_watch_history
//   --   for select using (auth.uid()::text = user_id or auth.jwt()->>'email' = user_id);
//   -- create policy "Users can update own watch progress" on account_watch_history
//   --   for all using (auth.uid()::text = user_id or auth.jwt()->>'email' = user_id);

export type WatchProgressRecord = {
  id: string
  user_id: string
  content_id: string
  content_type: 'movie' | 'tv' | 'episode'
  season_number: number | null
  episode_number: number | null
  progress_seconds: number
  duration_seconds: number
  updated_at: string
  completed: boolean
  movie?: Record<string, unknown>
}

/**
 * Builds the unique constraint key for a user's movie or episode progress.
 * Guarantees exactly one record per movie or episode per user.
 */
export function buildWatchRecordKey(
  userId: string,
  contentId: string,
  seasonNumber?: number | null,
  episodeNumber?: number | null,
): string {
  const normUser = userId.trim().toLowerCase()
  const normContent = contentId.trim()
  if (seasonNumber != null && episodeNumber != null) {
    return `${normUser}::${normContent}::s${seasonNumber}e${episodeNumber}`
  }
  return `${normUser}::${normContent}`
}

export async function fetchWatchHistory(
  config: SupabaseConfig,
  key: string,
): Promise<Record<string, unknown> | null> {
  const url = `${config.url}/rest/v1/account_watch_history?key=eq.${encodeURIComponent(
    key,
  )}&select=data`

  const response = await fetch(url, { headers: restHeaders(config) })
  if (!response.ok) {
    throw new Error(`Supabase watch-history read failed (${response.status}).`)
  }

  const rows = (await response.json()) as Array<{ data?: Record<string, unknown> }>
  if (!rows.length) {
    return null
  }
  return rows[0].data && typeof rows[0].data === 'object' ? rows[0].data : {}
}

export async function saveWatchHistory(
  config: SupabaseConfig,
  key: string,
  data: Record<string, unknown>,
): Promise<void> {
  const url = `${config.url}/rest/v1/account_watch_history?on_conflict=key`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...restHeaders(config),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([{ key, data, updated_at: new Date().toISOString() }]),
  })

  if (!response.ok) {
    throw new Error(`Supabase watch-history write failed (${response.status}).`)
  }
}

export async function updateMovieProgress(
  config: SupabaseConfig,
  key: string,
  movieId: string,
  movieData: Record<string, unknown>,
): Promise<void> {
  // Fast path: Atomic Postgres RPC (merges single movie into jsonb history)
  try {
    const url = `${config.url}/rest/v1/rpc/update_movie_progress`
    const response = await fetch(url, {
      method: 'POST',
      headers: restHeaders(config),
      body: JSON.stringify({
        p_key: key,
        p_movie_id: movieId,
        p_movie_data: movieData,
      }),
    })
    if (response.ok) {
      return
    }
  } catch {
    // Fallback below if RPC fails
  }

  // Fallback: Read full history, merge, and save
  const current = (await fetchWatchHistory(config, key)) ?? {}
  current[movieId] = movieData
  await saveWatchHistory(config, key, current)
}

/**
 * Fetch all watch progress records for an authenticated user.
 * Discovers both itemized per-movie/episode records and legacy composite rows.
 */
export async function fetchUserWatchProgress(
  config: SupabaseConfig,
  userId: string,
): Promise<{ records: WatchProgressRecord[]; history: Record<string, unknown> }> {
  const normUser = userId.trim().toLowerCase()
  const url = `${config.url}/rest/v1/account_watch_history?key=like.${encodeURIComponent(
    normUser,
  )}::*&select=key,data,updated_at`

  const response = await fetch(url, { headers: restHeaders(config) })
  if (!response.ok) {
    throw new Error(`Supabase watch progress read failed (${response.status}).`)
  }

  const rows = (await response.json()) as Array<{
    key: string
    data?: Record<string, unknown>
    updated_at?: string
  }>

  const records: WatchProgressRecord[] = []
  const historyMap: Record<string, unknown> = {}

  for (const row of rows) {
    const data = row.data
    if (!data || typeof data !== 'object') continue

    // Case 1: Individual record
    if (typeof data.content_id === 'string' && typeof data.user_id === 'string') {
      const rec = data as unknown as WatchProgressRecord
      records.push(rec)
      const contentId = rec.content_id
      const progressPercent =
        rec.duration_seconds > 0
          ? Math.min(100, Math.round((rec.progress_seconds / rec.duration_seconds) * 100))
          : 0

      historyMap[contentId] = {
        movie: rec.movie ?? { id: contentId },
        progress: progressPercent,
        progressSeconds: rec.progress_seconds,
        durationSeconds: rec.duration_seconds,
        seasonNumber: rec.season_number,
        episodeNumber: rec.episode_number,
        completed: rec.completed,
        updatedAt: new Date(rec.updated_at || row.updated_at || Date.now()).getTime(),
      }
      continue
    }

    // Case 2: Legacy composite dictionary of movies
    for (const [keyId, item] of Object.entries(data)) {
      if (!item || typeof item !== 'object') continue
      const obj = item as Record<string, unknown>
      const movie = (obj.movie && typeof obj.movie === 'object' ? obj.movie : obj) as Record<string, unknown>
      const progress = typeof obj.progress === 'number' ? obj.progress : 0
      const updatedAtMs = typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now()
      const contentId = String(movie.id ?? keyId)
      const season = typeof movie.streamSeason === 'number' ? movie.streamSeason : null
      const episode = typeof movie.streamEpisode === 'number' ? movie.streamEpisode : null
      const durationSec = typeof obj.durationSeconds === 'number' ? obj.durationSeconds : 7200
      const progressSec =
        typeof obj.progressSeconds === 'number'
          ? obj.progressSeconds
          : Math.round((progress / 100) * durationSec)

      const rec: WatchProgressRecord = {
        id: buildWatchRecordKey(normUser, contentId, season, episode),
        user_id: normUser,
        content_id: contentId,
        content_type: movie.tmdbType === 'tv' || movie.type === 'series' ? 'tv' : 'movie',
        season_number: season,
        episode_number: episode,
        progress_seconds: progressSec,
        duration_seconds: durationSec,
        updated_at: new Date(updatedAtMs).toISOString(),
        completed: Boolean(obj.completed || progress >= 95),
        movie,
      }

      // Only add if not already populated by a higher-fidelity itemized record
      if (!historyMap[contentId]) {
        records.push(rec)
        historyMap[contentId] = {
          ...obj,
          movie,
          progress,
          progressSeconds: progressSec,
          durationSeconds: durationSec,
          seasonNumber: season,
          episodeNumber: episode,
          completed: rec.completed,
          updatedAt: updatedAtMs,
        }
      }
    }
  }

  return { records, history: historyMap }
}

/**
 * Saves or updates a user's watch progress with conflict resolution.
 * If server already has a newer updated_at timestamp, the older incoming
 * update is discarded to prevent stale writes.
 */
export async function saveUserWatchRecord(
  config: SupabaseConfig,
  userId: string,
  record: WatchProgressRecord,
): Promise<{ ok: boolean; conflictSkipped?: boolean }> {
  const normUser = userId.trim().toLowerCase()
  const key = buildWatchRecordKey(
    normUser,
    record.content_id,
    record.season_number,
    record.episode_number,
  )

  const incomingDate = new Date(record.updated_at || Date.now()).getTime()

  // Conflict resolution check: ensure incoming is newer than existing record
  try {
    const existingUrl = `${config.url}/rest/v1/account_watch_history?key=eq.${encodeURIComponent(
      key,
    )}&select=data,updated_at`
    const res = await fetch(existingUrl, { headers: restHeaders(config) })
    if (res.ok) {
      const rows = (await res.json()) as Array<{ data?: Record<string, unknown>; updated_at?: string }>
      if (rows.length > 0 && rows[0].data) {
        const existingData = rows[0].data
        const existingTimestamp = existingData.updated_at
          ? new Date(String(existingData.updated_at)).getTime()
          : rows[0].updated_at
            ? new Date(rows[0].updated_at).getTime()
            : 0

        if (existingTimestamp > incomingDate) {
          // Server has newer progress; discard stale update
          return { ok: true, conflictSkipped: true }
        }
      }
    }
  } catch {
    // Proceed to save on lookup failure
  }

  const payloadRecord: WatchProgressRecord = {
    ...record,
    id: key,
    user_id: normUser,
    updated_at: new Date(incomingDate).toISOString(),
  }

  const url = `${config.url}/rest/v1/account_watch_history?on_conflict=key`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...restHeaders(config),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([
      {
        key,
        data: payloadRecord,
        updated_at: payloadRecord.updated_at,
      },
    ]),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Supabase watch progress write failed (${response.status}). ${detail}`.trim())
  }

  return { ok: true }
}

/**
 * Batch save multiple progress records (e.g. flushing an offline queue).
 */
export async function batchSaveUserWatchRecords(
  config: SupabaseConfig,
  userId: string,
  records: WatchProgressRecord[],
): Promise<{ ok: boolean; savedCount: number }> {
  let savedCount = 0
  for (const record of records) {
    try {
      const res = await saveUserWatchRecord(config, userId, record)
      if (res.ok) savedCount++
    } catch {
      // Continue saving remaining records
    }
  }
  return { ok: true, savedCount }
}

/**
 * Deletes a user's watch progress record(s) from Supabase.
 * Purges itemized row(s) and cleans legacy composite dictionary entries.
 */
export async function deleteUserWatchRecord(
  config: SupabaseConfig,
  userId: string,
  contentId: string,
  extraIds: Array<string | number> = [],
): Promise<{ ok: boolean }> {
  const normUser = userId.trim().toLowerCase()
  if (!normUser || !contentId) return { ok: false }

  const idsToDelete = new Set<string>()
  const clean = (id: string | number) => String(id).trim()
  idsToDelete.add(clean(contentId))
  idsToDelete.add(clean(contentId).replace(/^(movie|tv)-/, ''))
  for (const extra of extraIds) {
    if (extra != null && String(extra).trim()) {
      const s = clean(extra)
      idsToDelete.add(s)
      idsToDelete.add(s.replace(/^(movie|tv)-/, ''))
    }
  }

  // 1. Delete itemized progress rows matching user + content IDs
  for (const id of idsToDelete) {
    if (!id) continue
    try {
      const deleteUrl = `${config.url}/rest/v1/account_watch_history?key=like.${encodeURIComponent(
        `${normUser}::${id}`,
      )}*`
      await fetch(deleteUrl, {
        method: 'DELETE',
        headers: restHeaders(config),
      })
    } catch {
      // Best-effort delete
    }
  }

  // 2. Also remove from legacy composite continue_watching dictionary
  try {
    const compositeKey = `${normUser}::continue_watching`
    const existing = await fetchWatchHistory(config, compositeKey)
    if (existing) {
      let modified = false
      for (const [key, item] of Object.entries(existing)) {
        const itemMovie = (item as any)?.movie || item
        const itemId = String((itemMovie as any)?.id || key)
        const itemTmdbId = String((itemMovie as any)?.tmdbId || '')
        if (
          idsToDelete.has(itemId) ||
          idsToDelete.has(itemId.replace(/^(movie|tv)-/, '')) ||
          (itemTmdbId && idsToDelete.has(itemTmdbId))
        ) {
          delete existing[key]
          modified = true
        }
      }
      if (modified) {
        await saveWatchHistory(config, compositeKey, existing)
      }
    }
  } catch {
    // Best-effort
  }

  return { ok: true }
}
