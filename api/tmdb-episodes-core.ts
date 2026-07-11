import { type TmdbAuth } from './tmdb-watch-core.js'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'

const CACHE_TTL = 12 * 60 * 60 * 1000 // 12 hours
const cache = new Map<string, { value: TmdbEpisode[]; expiresAt: number }>()

export type TmdbEpisode = {
  number: number
  name: string
  overview: string
  still: string
  runtime: string
}

type TmdbSeasonResponse = {
  episodes?: Array<{
    episode_number?: number
    name?: string
    overview?: string
    still_path?: string | null
    runtime?: number | null
  }>
}

function applyTmdbAuth(url: URL, auth: TmdbAuth) {
  if (auth.readAccessToken) {
    return { headers: { Authorization: `Bearer ${auth.readAccessToken}` } }
  }
  if (auth.apiKey) {
    url.searchParams.set('api_key', auth.apiKey)
  }
  return undefined
}

export async function fetchTmdbSeasonEpisodes(
  authChain: TmdbAuth[],
  tmdbId: number,
  season: number,
): Promise<TmdbEpisode[]> {
  if (!tmdbId || authChain.length === 0) {
    return []
  }

  const cacheKey = `${tmdbId}:${season}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  for (const auth of authChain) {
    try {
      const url = new URL(`${TMDB_BASE_URL}/tv/${tmdbId}/season/${season}`, TMDB_BASE_URL)
      url.searchParams.set('language', 'en-US')
      const response = await fetch(url, applyTmdbAuth(url, auth))

      if (!response.ok) {
        continue
      }

      const body = (await response.json()) as TmdbSeasonResponse
      const episodes = (body.episodes ?? [])
        .filter((episode) => typeof episode.episode_number === 'number')
        .map((episode) => ({
          number: episode.episode_number as number,
          name: episode.name || `Episode ${episode.episode_number}`,
          overview: episode.overview || '',
          still: episode.still_path
            ? `${TMDB_IMAGE_BASE_URL}/w780${episode.still_path}`
            : '',
          runtime: episode.runtime ? `${episode.runtime}m` : '',
        }))

      cache.set(cacheKey, { value: episodes, expiresAt: Date.now() + CACHE_TTL })
      return episodes
    } catch {
      continue
    }
  }

  return []
}
