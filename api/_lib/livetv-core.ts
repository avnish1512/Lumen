// Server-side helper for the "Streamed" live-sports API. The upstream domain
// rotates often (streamed.pk / streamed.su / streamed.watch / ...), and calling
// it directly from the browser left the app hanging on a dead host with no
// timeout (an endless "loading" spinner, worst on mobile networks).
//
// This proxy fixes that: it runs server-side (same-origin for the client, so no
// CORS/WebView issues), times out fast, and tries a list of known mirror hosts
// until one answers. Override the host list with STREAMED_API_BASE (a single
// site base like "https://streamed.pk") when you know the current one.

const DEFAULT_SITES = [
  'https://streamed.pk',
  'https://streamed.watch',
  'https://streamed.su',
  'https://streamed.st',
]

const requestTimeoutMs = 8000
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const SPORTS_CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const MATCH_CACHE_TTL = 30 * 1000 // 30 seconds (live data)
const STREAM_CACHE_TTL = 20 * 1000 // 20 seconds

type Env = Record<string, string | undefined>

type CachedEntry = { body: unknown; expiresAt: number }
const cache = new Map<string, CachedEntry>()

// Remember the last host that answered so we don't re-probe dead mirrors on
// every request.
let resolvedSite: string | null = null

function siteList(env: Env): string[] {
  if (env.STREAMED_API_BASE) {
    return [env.STREAMED_API_BASE.replace(/\/+$/, '')]
  }
  const ordered = resolvedSite
    ? [resolvedSite, ...DEFAULT_SITES.filter((s) => s !== resolvedSite)]
    : DEFAULT_SITES
  return ordered
}

function readCache(key: string) {
  const entry = cache.get(key)
  if (entry && entry.expiresAt > Date.now()) return entry.body
  if (entry) cache.delete(key)
  return null
}

function writeCache(key: string, body: unknown, ttl: number) {
  cache.set(key, { body, expiresAt: Date.now() + ttl })
}

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
  try {
    return await fetch(url, {
      headers: { Accept: accept, 'User-Agent': BROWSER_UA },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

// Fetch a JSON API path (e.g. "matches/live"), trying each mirror until one
// answers. The first host that responds is remembered for later requests.
async function requestJson(env: Env, path: string, ttl: number): Promise<unknown> {
  const cacheKey = `json:${path}`
  const cached = readCache(cacheKey)
  if (cached) return cached

  let lastError: unknown = null
  for (const site of siteList(env)) {
    try {
      const response = await fetchWithTimeout(`${site}/api/${path}`, 'application/json')
      if (!response.ok) {
        lastError = new Error(`${site} returned ${response.status}.`)
        continue
      }
      const body = (await response.json()) as unknown
      resolvedSite = site
      writeCache(cacheKey, body, ttl)
      return body
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All Streamed mirrors are unreachable.')
}

export function fetchLiveSports(env: Env) {
  return requestJson(env, 'sports', SPORTS_CACHE_TTL)
}

export function fetchLiveMatches(env: Env, scope: string) {
  const safeScope = (scope || 'live').trim()
  const path =
    safeScope === 'live'
      ? 'matches/live'
      : safeScope === 'all-today'
        ? 'matches/all-today'
        : safeScope === 'all'
          ? 'matches/all'
          : `matches/${encodeURIComponent(safeScope)}`
  return requestJson(env, path, MATCH_CACHE_TTL)
}

export function fetchLiveStreams(env: Env, source: string, id: string) {
  return requestJson(
    env,
    `stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
    STREAM_CACHE_TTL,
  )
}

export type LiveImage = {
  body: ArrayBuffer
  contentType: string
}

// Proxy a badge/poster image by its site-relative path (e.g.
// "/api/images/badge/abc.webp"), trying each mirror until one serves it.
export async function fetchLiveImage(env: Env, path: string): Promise<LiveImage | null> {
  if (!path.startsWith('/')) return null

  for (const site of siteList(env)) {
    try {
      const response = await fetchWithTimeout(`${site}${path}`, 'image/webp,image/*,*/*;q=0.8')
      if (!response.ok) continue
      const contentType = response.headers.get('content-type') ?? 'image/webp'
      if (!contentType.startsWith('image/')) continue
      resolvedSite = site
      return { body: await response.arrayBuffer(), contentType }
    } catch {
      // try next mirror
    }
  }
  return null
}
