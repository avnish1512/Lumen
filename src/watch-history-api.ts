// Cross-device "Continue Watching" sync client.
// Associated with the authenticated user's account and backed by Supabase via /api/watch-history.
// Supports offline queuing, conflict resolution (timestamp-based), batching, and throttling.

import { getSessionToken } from './accounts-api'

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
  movie?: Record<string, any>
}

export type WatchHistoryItem = {
  movie: any
  progress: number // Percentage (0-100)
  progressSeconds: number
  durationSeconds: number
  seasonNumber: number | null
  episodeNumber: number | null
  completed: boolean
  updatedAt: number
  recordId?: string
  userId?: string
}

export type WatchHistoryMap = Record<string, WatchHistoryItem>

const OFFLINE_QUEUE_KEY = 'lumen.watch-progress.offline-queue'

function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getSessionToken()
  const headers: Record<string, string> = { ...extra }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

/**
 * Read the pending offline progress queue from localStorage.
 */
export function readOfflineQueue(): WatchProgressRecord[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Write the pending offline progress queue to localStorage.
 */
export function writeOfflineQueue(queue: WatchProgressRecord[]): void {
  try {
    if (queue.length > 0) {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    } else {
      localStorage.removeItem(OFFLINE_QUEUE_KEY)
    }
  } catch {
    // Quota or access error
  }
}

/**
 * Add a record to the offline sync queue. Replaces any existing pending
 * update for the same content / episode.
 */
export function enqueueOfflineProgress(record: WatchProgressRecord): void {
  const current = readOfflineQueue()
  const key = record.id || `${record.user_id}::${record.content_id}`
  const filtered = current.filter((r) => (r.id || `${r.user_id}::${r.content_id}`) !== key)
  filtered.push(record)
  writeOfflineQueue(filtered)
}

/**
 * Flush all pending offline progress records to Supabase.
 */
export async function flushOfflineProgressQueue(): Promise<boolean> {
  const queue = readOfflineQueue()
  if (queue.length === 0) return true

  try {
    const response = await fetch('/api/watch-history', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ records: queue }),
    })

    if (response.ok) {
      writeOfflineQueue([])
      return true
    }
    return false
  } catch {
    // Still offline or transient error
    return false
  }
}

// Automatically flush pending offline progress when network connectivity returns.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushOfflineProgressQueue()
  })
}

/**
 * Fetch all watch progress records for the authenticated account from Supabase.
 * Returns both the normalized record list and an instant-lookup map.
 */
export async function fetchAccountWatchProgress(
  userEmail?: string,
): Promise<{ records: WatchProgressRecord[]; history: WatchHistoryMap } | null> {
  if (userEmail && userEmail.toLowerCase() === 'guest@apple-tv.com') {
    return { records: [], history: {} }
  }

  const queryParam = userEmail ? `?key=${encodeURIComponent(userEmail.toLowerCase())}` : ''

  try {
    const response = await fetch(`/api/watch-history${queryParam}`, {
      headers: getAuthHeaders(),
    })

    if (response.status === 401 || response.status === 403) {
      return null
    }

    const data = (await response.json()) as {
      ok?: boolean
      records?: WatchProgressRecord[]
      history?: Record<string, any>
    }

    if (!response.ok || !data.ok) {
      return null
    }

    const records = Array.isArray(data.records) ? data.records : []
    const rawHistory = data.history && typeof data.history === 'object' ? data.history : {}
    const normalizedHistory: WatchHistoryMap = {}

    // First populate from rawHistory
    for (const [key, item] of Object.entries(rawHistory)) {
      if (!item || typeof item !== 'object') continue
      const obj = item as Record<string, any>
      const movie = obj.movie && typeof obj.movie === 'object' ? obj.movie : obj
      const duration = typeof obj.durationSeconds === 'number' ? obj.durationSeconds : (typeof movie.durationSeconds === 'number' ? movie.durationSeconds : 7200)
      const progressSec = typeof obj.progressSeconds === 'number' ? obj.progressSeconds : (typeof obj.progress === 'number' ? Math.round((obj.progress / 100) * duration) : 0)
      const pct = typeof obj.progress === 'number' ? obj.progress : (duration > 0 ? Math.min(100, Math.round((progressSec / duration) * 100)) : 0)
      const completed = Boolean(obj.completed || pct >= 95 || (duration > 0 && progressSec >= 0.95 * duration))

      normalizedHistory[key] = {
        movie: {
          ...movie,
          progress: pct,
          progressSeconds: progressSec,
          durationSeconds: duration,
        },
        progress: pct,
        progressSeconds: progressSec,
        durationSeconds: duration,
        seasonNumber: obj.seasonNumber ?? movie.streamSeason ?? null,
        episodeNumber: obj.episodeNumber ?? movie.streamEpisode ?? null,
        completed,
        updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now(),
        recordId: obj.recordId,
        userId: obj.userId,
      }
    }

    // Next overlay from high-fidelity records
    for (const rec of records) {
      if (!rec || !rec.content_id) continue
      const duration = rec.duration_seconds > 0 ? rec.duration_seconds : 7200
      const progressSec = rec.progress_seconds >= 0 ? rec.progress_seconds : 0
      const pct = duration > 0 ? Math.min(100, Math.round((progressSec / duration) * 100)) : 0
      const completed = Boolean(rec.completed || pct >= 95 || (duration > 0 && progressSec >= 0.95 * duration))
      const updatedAtMs = new Date(rec.updated_at || Date.now()).getTime()

      const existing = normalizedHistory[rec.content_id]
      if (!existing || updatedAtMs >= existing.updatedAt) {
        normalizedHistory[rec.content_id] = {
          movie: {
            ...(rec.movie ?? existing?.movie ?? { id: rec.content_id }),
            progress: pct,
            progressSeconds: progressSec,
            durationSeconds: duration,
            streamSeason: rec.season_number ?? undefined,
            streamEpisode: rec.episode_number ?? undefined,
          },
          progress: pct,
          progressSeconds: progressSec,
          durationSeconds: duration,
          seasonNumber: rec.season_number,
          episodeNumber: rec.episode_number,
          completed,
          updatedAt: updatedAtMs,
          recordId: rec.id,
          userId: rec.user_id,
        }
      }
    }

    return { records, history: normalizedHistory }
  } catch {
    return null
  }
}

/**
 * Save progress for a movie or episode to Supabase.
 * If offline, retains progress in local offline queue and syncs when back online.
 */
export async function saveWatchProgressRecord(
  record: WatchProgressRecord,
): Promise<{ ok: boolean; queuedOffline?: boolean }> {
  if (!record.user_id || record.user_id.toLowerCase() === 'guest@apple-tv.com') {
    return { ok: true }
  }

  // If browser is known to be offline, queue locally right away
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineProgress(record)
    return { ok: true, queuedOffline: true }
  }

  try {
    const response = await fetch('/api/watch-history', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ record }),
    })

    if (!response.ok) {
      // Server error or network glitch: queue for retry
      enqueueOfflineProgress(record)
      return { ok: false, queuedOffline: true }
    }

    return { ok: true }
  } catch {
    // Network failure: retain locally
    enqueueOfflineProgress(record)
    return { ok: false, queuedOffline: true }
  }
}

export function watchProgressToMovie(record: WatchProgressRecord): any {
  const duration = record.duration_seconds > 0 ? record.duration_seconds : 7200
  const progressSec = record.progress_seconds >= 0 ? record.progress_seconds : 0
  const pct = duration > 0 ? Math.min(100, Math.round((progressSec / duration) * 100)) : 0
  const completed = Boolean(record.completed || pct >= 95 || (duration > 0 && progressSec >= 0.95 * duration))

  return {
    ...(record.movie ?? { id: record.content_id }),
    progress: pct,
    progressSeconds: progressSec,
    durationSeconds: duration,
    streamSeason: record.season_number ?? undefined,
    streamEpisode: record.episode_number ?? undefined,
    completed,
  }
}

export function recordsToWatchHistoryMap(records: WatchProgressRecord[]): WatchHistoryMap {
  const map: WatchHistoryMap = {}
  for (const rec of records) {
    if (!rec || !rec.content_id) continue
    const duration = rec.duration_seconds > 0 ? rec.duration_seconds : 7200
    const progressSec = rec.progress_seconds >= 0 ? rec.progress_seconds : 0
    const pct = duration > 0 ? Math.min(100, Math.round((progressSec / duration) * 100)) : 0
    const completed = Boolean(rec.completed || pct >= 95 || (duration > 0 && progressSec >= 0.95 * duration))
    const updatedAtMs = new Date(rec.updated_at || Date.now()).getTime()

    map[rec.content_id] = {
      movie: watchProgressToMovie(rec),
      progress: pct,
      progressSeconds: progressSec,
      durationSeconds: duration,
      seasonNumber: rec.season_number,
      episodeNumber: rec.episode_number,
      completed,
      updatedAt: updatedAtMs,
      recordId: rec.id,
      userId: rec.user_id,
    }
  }
  return map
}

export const getOfflineQueue = readOfflineQueue
export const addToOfflineQueue = enqueueOfflineProgress
export const flushOfflineQueue = flushOfflineProgressQueue

/**
 * Resolve conflict between local history and server history.
 * Newer timestamp wins; stale local updates cannot overwrite newer server progress.
 */
export function mergeWithServerHistory(
  localHistory: WatchHistoryMap,
  serverHistory: WatchHistoryMap | WatchProgressRecord[],
  removedMap?: Record<string, number>,
): WatchHistoryMap {
  const serverMap: WatchHistoryMap = Array.isArray(serverHistory)
    ? recordsToWatchHistoryMap(serverHistory)
    : serverHistory
  const merged: WatchHistoryMap = { ...localHistory }

  const isRemoved = (key: string, item: WatchHistoryItem) => {
    if (!removedMap || Object.keys(removedMap).length === 0) return false
    const itemTime = item.updatedAt || 0
    const check = (id?: string | number | null) => {
      if (!id) return false
      const s = String(id).trim()
      const rem = removedMap[s]
      return typeof rem === 'number' && (itemTime === 0 || rem >= itemTime)
    }
    if (check(key) || check(key.replace(/^(movie|tv)-/, ''))) return true
    const m = item.movie
    if (m) {
      if (check(m.id) || (m.id && check(String(m.id).replace(/^(movie|tv)-/, '')))) return true
      if (m.tmdbId && (check(m.tmdbId) || check(`movie-${m.tmdbId}`) || check(`tv-${m.tmdbId}`))) return true
      if (m.title && check(`title:${String(m.title).trim().toLowerCase()}`)) return true
    }
    return false
  }

  for (const [key, serverItem] of Object.entries(serverMap)) {
    if (!serverItem) continue
    if (isRemoved(key, serverItem)) continue
    const localItem = merged[key]

    if (!localItem) {
      // Local has no entry, use server
      merged[key] = serverItem
      continue
    }

    const serverTime = serverItem.updatedAt || 0
    const localTime = localItem.updatedAt || 0

    // Authoritative resolution:
    // If server timestamp is greater or equal to local timestamp, server progress wins.
    // Stale local data never overwrites newer server progress.
    if (serverTime >= localTime) {
      merged[key] = {
        ...serverItem,
        movie: {
          ...(localItem.movie ?? {}),
          ...(serverItem.movie ?? {}),
          progress: serverItem.progress,
          progressSeconds: serverItem.progressSeconds,
          durationSeconds: serverItem.durationSeconds,
        },
      }
    }
  }

  return merged
}

// Backwards-compatible aliases for existing calls
export async function fetchRemoteWatchHistory(
  key: string,
): Promise<Record<string, any> | null> {
  const userEmail = key.includes('::') ? key.split('::')[0] : key
  const res = await fetchAccountWatchProgress(userEmail)
  return res ? res.history : null
}

export async function saveRemoteWatchHistory(
  key: string,
  history: Record<string, any>,
): Promise<void> {
  const userEmail = (key.includes('::') ? key.split('::')[0] : key).trim().toLowerCase()
  if (!userEmail || userEmail === 'guest@apple-tv.com') {
    return
  }
  try {
    await fetch('/api/watch-history', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ key, user_id: userEmail, history }),
    })
  } catch {
    // best-effort
  }
}

export async function deleteRemoteMovieProgress(
  key: string,
  movieId: string,
  extra?: { tmdbId?: number | string; tmdbType?: string },
): Promise<boolean> {
  const userEmail = (key.includes('::') ? key.split('::')[0] : key).trim().toLowerCase()
  if (!userEmail || userEmail === 'guest@apple-tv.com') {
    return true
  }

  try {
    const response = await fetch('/api/watch-history', {
      method: 'DELETE',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        key,
        user_id: userEmail,
        content_id: movieId,
        movieId,
        tmdbId: extra?.tmdbId,
      }),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function saveRemoteMovieProgress(
  key: string,
  movieId: string,
  movieData: Record<string, any>,
): Promise<void> {
  const userEmail = (key.includes('::') ? key.split('::')[0] : key).trim().toLowerCase()
  if (!userEmail || userEmail === 'guest@apple-tv.com') {
    return
  }
  const progressSec = typeof movieData.progressSeconds === 'number'
    ? movieData.progressSeconds
    : (typeof movieData.progress === 'number' ? Math.round((movieData.progress / 100) * 7200) : 0)
  const durationSec = typeof movieData.durationSeconds === 'number' ? movieData.durationSeconds : 7200

  const record: WatchProgressRecord = {
    id: `${userEmail}::${movieId}`,
    user_id: userEmail,
    content_id: movieId,
    content_type: movieData.tmdbType === 'tv' || movieData.type === 'series' ? 'tv' : 'movie',
    season_number: typeof movieData.streamSeason === 'number' ? movieData.streamSeason : null,
    episode_number: typeof movieData.streamEpisode === 'number' ? movieData.streamEpisode : null,
    progress_seconds: progressSec,
    duration_seconds: durationSec,
    updated_at: new Date(movieData.updatedAt || Date.now()).toISOString(),
    completed: Boolean(movieData.completed || (durationSec > 0 && progressSec >= 0.95 * durationSec)),
    movie: movieData.movie ?? movieData,
  }

  await saveWatchProgressRecord(record)
}

