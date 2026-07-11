// KinoCheck trailer API (https://api.kinocheck.com).
// Returns the official YouTube trailer id for a movie or show by TMDB/IMDb id.
// Free tier allows 1000 requests/day; an optional API key raises the limit.

const KINOCHECK_BASE_URL = 'https://api.kinocheck.com'
const kinocheckTimeoutMs = 8000

const CACHE_TTL = 12 * 60 * 60 * 1000 // 12 hours
const cache = new Map<string, { value: KinocheckTrailer; expiresAt: number }>()

export type KinocheckTrailer = { youtubeId: string; title?: string } | null

type KinocheckVideo = {
  youtube_video_id?: string
  title?: string
}

type KinocheckResponse = {
  trailer?: KinocheckVideo | null
  videos?: KinocheckVideo[]
}

export type KinocheckQuery = {
  tmdbId?: string
  imdbId?: string
  type?: 'movie' | 'tv'
}

export async function fetchKinocheckTrailer(
  query: KinocheckQuery,
  apiKey?: string,
): Promise<KinocheckTrailer> {
  const { tmdbId, imdbId, type } = query

  if (!tmdbId && !imdbId) {
    return null
  }

  const cacheKey = `${type ?? 'movie'}:${tmdbId ?? ''}:${imdbId ?? ''}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const endpoint = type === 'tv' ? 'shows' : 'movies'
  const params = new URLSearchParams({ language: 'en', categories: 'Trailer' })
  if (tmdbId) {
    params.set('tmdb_id', tmdbId)
  } else if (imdbId) {
    params.set('imdb_id', imdbId)
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (apiKey) {
    headers['X-Api-Key'] = apiKey
    headers['X-Api-Host'] = 'api.kinocheck.com'
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), kinocheckTimeoutMs)

  try {
    const response = await fetch(`${KINOCHECK_BASE_URL}/${endpoint}?${params}`, {
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      return null
    }

    const body = (await response.json()) as KinocheckResponse
    const video =
      body.trailer ?? (Array.isArray(body.videos) ? body.videos[0] : null)
    const youtubeId = video?.youtube_video_id

    const value: KinocheckTrailer = youtubeId
      ? { youtubeId, title: video?.title }
      : null

    cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL })
    return value
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
