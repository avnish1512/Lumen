import { type TmdbAuth } from './tmdb-watch-core.js'

// Use the api.tmdb.org alias — some ISPs (notably in IN) block
// api.themoviedb.org at the network level, which left every season empty and
// forced the guessed season/episode counts + repeated poster fallback.
const TMDB_BASE_URL = 'https://api.tmdb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'

const CACHE_TTL = 12 * 60 * 60 * 1000 // 12 hours
const cache = new Map<string, { value: TmdbEpisode[]; expiresAt: number }>()
const seasonsCache = new Map<string, { value: TmdbSeasonInfo[]; expiresAt: number }>()

export type TmdbEpisode = {
  number: number
  name: string
  overview: string
  still: string
  runtime: string
  airDate: string
}

export type TmdbSeasonInfo = {
  season: number
  episodeCount: number
}

type TmdbSeasonResponse = {
  episodes?: Array<{
    episode_number?: number
    name?: string
    overview?: string
    still_path?: string | null
    runtime?: number | null
    air_date?: string | null
  }>
}

type TmdbTvDetailResponse = {
  seasons?: Array<{
    season_number?: number
    episode_count?: number
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
      // Concatenate (don't use new URL(path, base)) so the "/3" API version is
      // preserved.
      const url = new URL(`${TMDB_BASE_URL}/tv/${tmdbId}/season/${season}`)
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
          // w300 thumbnails load far faster than w780 for the episode rail.
          still: episode.still_path
            ? `${TMDB_IMAGE_BASE_URL}/w300${episode.still_path}`
            : '',
          runtime: episode.runtime ? `${episode.runtime}m` : '',
          airDate: episode.air_date ?? '',
        }))

      cache.set(cacheKey, { value: episodes, expiresAt: Date.now() + CACHE_TTL })
      return episodes
    } catch {
      continue
    }
  }

  return []
}

/** Real season list for a TV id (from TMDB), so the season dropdown and
 * per-season episode counts are accurate instead of guessed. Season 0
 * (Specials) is excluded. */
export async function fetchTmdbTvSeasons(
  authChain: TmdbAuth[],
  tmdbId: number,
): Promise<TmdbSeasonInfo[]> {
  if (!tmdbId || authChain.length === 0) {
    return []
  }

  const cacheKey = `${tmdbId}`
  const cached = seasonsCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  for (const auth of authChain) {
    try {
      const url = new URL(`${TMDB_BASE_URL}/tv/${tmdbId}`)
      url.searchParams.set('language', 'en-US')
      const response = await fetch(url, applyTmdbAuth(url, auth))

      if (!response.ok) {
        continue
      }

      const body = (await response.json()) as TmdbTvDetailResponse
      const seasons = (body.seasons ?? [])
        .filter(
          (season) =>
            typeof season.season_number === 'number' &&
            season.season_number > 0 &&
            (season.episode_count ?? 0) > 0,
        )
        .map((season) => ({
          season: season.season_number as number,
          episodeCount: season.episode_count as number,
        }))

      seasonsCache.set(cacheKey, { value: seasons, expiresAt: Date.now() + CACHE_TTL })
      return seasons
    } catch {
      continue
    }
  }

  return []
}
