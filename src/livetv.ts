// Live TV powered by the Streamed API (https://streamed.pk/docs).
// It exposes live sports events ("matches"), each with one or more stream
// "sources"; a source resolves to a list of embeddable streams (iframe URLs).
// The API is public (no auth) and CORS-enabled, so it is called directly from
// the browser in both dev (Vite) and production (Vercel) without a proxy.

const API_BASE = 'https://streamed.pk/api'
const SITE_BASE = 'https://streamed.pk'

export type LiveSport = {
  id: string
  name: string
}

export type LiveTeam = {
  name: string
  badge?: string
}

export type LiveMatchSource = {
  source: string
  id: string
}

export type LiveMatch = {
  id: string
  title: string
  category: string
  date: number
  poster?: string
  popular: boolean
  teams?: {
    home?: LiveTeam
    away?: LiveTeam
  }
  sources: LiveMatchSource[]
}

export type LiveStream = {
  id: string
  streamNo: number
  language: string
  hd: boolean
  embedUrl: string
  source: string
}

/** Which match list to load. Sport ids (e.g. "football") are also accepted. */
export type LiveMatchScope = 'live' | 'all-today' | 'all' | (string & {})

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}/${path}`)
  if (!response.ok) {
    throw new Error(`Streamed ${path} request failed (${response.status}).`)
  }
  return (await response.json()) as T
}

let sportsCache: LiveSport[] | null = null

/** All available sport categories (used to build the filter chips). */
export async function fetchLiveSports(): Promise<LiveSport[]> {
  if (sportsCache) {
    return sportsCache
  }
  try {
    const sports = await fetchJson<LiveSport[]>('sports')
    sportsCache = Array.isArray(sports) ? sports : []
    return sportsCache
  } catch {
    return []
  }
}

/**
 * Loads matches for a given scope:
 * - `live`      → currently live matches
 * - `all-today` → everything scheduled today
 * - `all`       → every available match
 * - `<sportId>` → matches for that sport category
 */
export async function fetchLiveMatches(
  scope: LiveMatchScope = 'live',
): Promise<LiveMatch[]> {
  const path =
    scope === 'live'
      ? 'matches/live'
      : scope === 'all-today'
        ? 'matches/all-today'
        : scope === 'all'
          ? 'matches/all'
          : `matches/${encodeURIComponent(scope)}`

  const matches = await fetchJson<LiveMatch[]>(path)
  if (!Array.isArray(matches)) {
    return []
  }
  // Newest/soonest first; popular surfaced within that ordering by the caller.
  return matches
}

/** Resolves the embeddable streams for one of a match's sources. */
export async function fetchLiveStreams(
  source: string,
  id: string,
): Promise<LiveStream[]> {
  try {
    const streams = await fetchJson<LiveStream[]>(
      `stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
    )
    return Array.isArray(streams) ? streams : []
  } catch {
    return []
  }
}

/**
 * Tries each of a match's sources in turn and returns the first non-empty set
 * of streams, so a match with a dead source still resolves to a playable feed.
 */
export async function fetchFirstAvailableStreams(
  match: LiveMatch,
): Promise<LiveStream[]> {
  for (const source of match.sources ?? []) {
    const streams = await fetchLiveStreams(source.source, source.id)
    if (streams.length > 0) {
      return streams
    }
  }
  return []
}

/** Full URL for a team badge id (from `team.badge`). */
export function liveBadgeUrl(badge?: string): string {
  if (!badge) {
    return ''
  }
  return `${API_BASE}/images/badge/${badge}.webp`
}

/**
 * Best-effort poster URL for a match. Prefers the match's own poster path, then
 * falls back to a team-badge composite poster, then to a single badge.
 */
export function liveMatchPoster(match: LiveMatch): string {
  const poster = match.poster?.trim()
  if (poster) {
    if (poster.startsWith('http')) {
      return poster
    }
    const path = poster.startsWith('/') ? poster : `/${poster}`
    return `${SITE_BASE}${path}${path.endsWith('.webp') ? '' : '.webp'}`
  }
  const home = match.teams?.home?.badge
  const away = match.teams?.away?.badge
  if (home && away) {
    return `${API_BASE}/images/poster/${home}/${away}.webp`
  }
  return liveBadgeUrl(home || away)
}
