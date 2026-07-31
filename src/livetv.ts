// Live TV powered by the Streamed sports API. All requests go through our own
// `/api/livetv` proxy (never to the upstream host directly): the Streamed
// domain rotates and can hang, so the proxy runs server-side with a timeout and
// mirror fallback. This also keeps the call same-origin, which fixes the
// endless "loading" spinner seen in the mobile WebView.

const PROXY = '/api/livetv'
// How long the client waits before giving up on the proxy, so the UI shows an
// error instead of spinning forever if every upstream mirror is down.
const CLIENT_TIMEOUT_MS = 15000

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

async function fetchJson<T>(params: URLSearchParams): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS)
  try {
    const response = await fetch(`${PROXY}?${params}`, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Live TV request failed (${response.status}).`)
    }
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timeout)
  }
}

let sportsCache: LiveSport[] | null = null

/** All available sport categories (used to build the filter chips). */
export async function fetchLiveSports(): Promise<LiveSport[]> {
  if (sportsCache) {
    return sportsCache
  }
  try {
    const sports = await fetchJson<LiveSport[]>(new URLSearchParams({ action: 'sports' }))
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
  const matches = await fetchJson<LiveMatch[]>(
    new URLSearchParams({ action: 'matches', scope: String(scope) }),
  )
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
      new URLSearchParams({ action: 'streams', source, id }),
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

/** Proxy a site-relative image path through our backend. */
function proxyImagePath(path: string): string {
  return `${PROXY}?action=image&path=${encodeURIComponent(path)}`
}

/** Full URL for a team badge id (from `team.badge`). */
export function liveBadgeUrl(badge?: string): string {
  if (!badge) {
    return ''
  }
  return proxyImagePath(`/api/images/badge/${badge}.webp`)
}

/**
 * Best-effort poster URL for a match. Prefers the match's own poster path, then
 * falls back to a team-badge composite poster, then to a single badge.
 */
export function liveMatchPoster(match: LiveMatch): string {
  const poster = match.poster?.trim()
  if (poster) {
    // Absolute external posters are used as-is; site-relative ones are proxied.
    if (poster.startsWith('http')) {
      return poster
    }
    const path = poster.startsWith('/') ? poster : `/${poster}`
    return proxyImagePath(`${path}${path.endsWith('.webp') ? '' : '.webp'}`)
  }
  const home = match.teams?.home?.badge
  const away = match.teams?.away?.badge
  if (home && away) {
    return proxyImagePath(`/api/images/poster/${home}/${away}.webp`)
  }
  return liveBadgeUrl(home || away)
}
