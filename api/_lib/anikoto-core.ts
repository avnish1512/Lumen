// Server-side helper for the Anikoto anime API (https://anikotoapi.site).
//
// Anikoto is intended for server-side use only: it is rate limited per IP
// (60 requests / 120s) and abuse can lead to a 403 ban. We therefore call it
// from our own backend (Vercel function / Vite dev middleware), cache the
// responses, and serve our frontend from this proxy instead of letting the
// browser hit Anikoto directly.

const ANIKOTO_BASE_URL = 'https://anikotoapi.site'
const anikotoRequestTimeoutMs = 9000

const RECENT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const SERIES_CACHE_TTL = 60 * 60 * 1000 // 1 hour

type CachedEntry = {
  body: unknown
  expiresAt: number
}

const cache = new Map<string, CachedEntry>()

function readCache(key: string) {
  const entry = cache.get(key)

  if (entry && entry.expiresAt > Date.now()) {
    return entry.body
  }

  if (entry) {
    cache.delete(key)
  }

  return null
}

function writeCache(key: string, body: unknown, ttl: number) {
  cache.set(key, { body, expiresAt: Date.now() + ttl })
}

async function requestAnikoto(path: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), anikotoRequestTimeoutMs)

  try {
    const response = await fetch(`${ANIKOTO_BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    const text = await response.text()

    if (!response.ok) {
      throw new Error(
        `Anikoto returned ${response.status}${text ? `: ${text.slice(0, 120)}` : '.'}`,
      )
    }

    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new Error('Anikoto returned a non-JSON response.')
    }
  } finally {
    clearTimeout(timeout)
  }
}

function clampNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? '', 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(Math.max(parsed, min), max)
}

export async function fetchAnikotoRecent(page?: string, perPage?: string) {
  const safePage = clampNumber(page, 1, 1, 500)
  const safePerPage = clampNumber(perPage, 20, 1, 50)
  const cacheKey = `recent:${safePage}:${safePerPage}`

  const cached = readCache(cacheKey)
  if (cached) {
    return cached
  }

  const body = await requestAnikoto(
    `/recent-anime?page=${safePage}&per_page=${safePerPage}`,
  )
  writeCache(cacheKey, body, RECENT_CACHE_TTL)
  return body
}

export async function fetchAnikotoSeries(id: string) {
  const safeId = encodeURIComponent(id.trim())
  const cacheKey = `series:${safeId}`

  const cached = readCache(cacheKey)
  if (cached) {
    return cached
  }

  const body = await requestAnikoto(`/series/${safeId}`)
  writeCache(cacheKey, body, SERIES_CACHE_TTL)
  return body
}
