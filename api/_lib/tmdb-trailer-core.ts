// api.tmdb.org is an official alias that stays reachable on networks that
// block api.themoviedb.org (e.g. some IN ISPs). Same API + token.
const TMDB_BASE_URL = 'https://api.tmdb.org/3'

type TmdbMediaType = 'movie' | 'tv'

type TmdbFindResult = {
  id: number
  title?: string
  name?: string
}

type TmdbFindResponse = {
  movie_results?: TmdbFindResult[]
  tv_results?: TmdbFindResult[]
  status_code?: number
  status_message?: string
}

type TmdbVideo = {
  id: string
  key: string
  name: string
  official?: boolean
  site: string
  type: string
}

type TmdbVideosResponse = {
  results?: TmdbVideo[]
  status_code?: number
  status_message?: string
}

export type TmdbAuth = {
  apiKey?: string
  name: string
  readAccessToken?: string
}

export type TmdbTrailerClip = {
  duration: string
  id: string
  image: string
  quality: string
  title: string
  url: string
}

const fallbackTmdbMatches: Record<
  string,
  { tmdbId: number; mediaType: TmdbMediaType; title: string }
> = {
  tt1375666: { tmdbId: 27205, mediaType: 'movie', title: 'Inception' },
  tt0816692: { tmdbId: 157336, mediaType: 'movie', title: 'Interstellar' },
  tt0111161: {
    tmdbId: 278,
    mediaType: 'movie',
    title: 'The Shawshank Redemption',
  },
  tt0468569: { tmdbId: 155, mediaType: 'movie', title: 'The Dark Knight' },
  tt0133093: { tmdbId: 603, mediaType: 'movie', title: 'The Matrix' },
  tt0109830: { tmdbId: 13, mediaType: 'movie', title: 'Forrest Gump' },
  tt0110912: { tmdbId: 680, mediaType: 'movie', title: 'Pulp Fiction' },
  tt4154796: {
    tmdbId: 299534,
    mediaType: 'movie',
    title: 'Avengers: Endgame',
  },
  tt1745960: { tmdbId: 361743, mediaType: 'movie', title: 'Top Gun: Maverick' },
  tt0068646: { tmdbId: 238, mediaType: 'movie', title: 'The Godfather' },
  tt0944947: { tmdbId: 1399, mediaType: 'tv', title: 'Game of Thrones' },
  tt0903747: { tmdbId: 1396, mediaType: 'tv', title: 'Breaking Bad' },
  tt4574334: { tmdbId: 66732, mediaType: 'tv', title: 'Stranger Things' },
  tt1475582: { tmdbId: 19885, mediaType: 'tv', title: 'Sherlock' },
  tt0108778: { tmdbId: 1668, mediaType: 'tv', title: 'Friends' },
  tt7366338: { tmdbId: 87108, mediaType: 'tv', title: 'Chernobyl' },
  tt3032476: { tmdbId: 60059, mediaType: 'tv', title: 'Better Call Saul' },
  tt1520211: { tmdbId: 1402, mediaType: 'tv', title: 'The Walking Dead' },
  tt2861424: { tmdbId: 60625, mediaType: 'tv', title: 'Rick and Morty' },
  tt0413573: { tmdbId: 1416, mediaType: 'tv', title: "Grey's Anatomy" },
}

export function createTmdbTrailerAuthChain(
  env: Record<string, string | undefined>,
) {
  const auths: TmdbAuth[] = [
    {
      name: 'primary',
      apiKey: env.TMDB_API_KEY,
      readAccessToken: env.TMDB_API_READ_ACCESS_TOKEN,
    },
    {
      name: 'secondary',
      apiKey: env.TMDB_SECONDARY_API_KEY,
      readAccessToken: env.TMDB_SECONDARY_API_READ_ACCESS_TOKEN,
    },
  ]
  const seen = new Set<string>()

  return auths.filter((auth) => {
    if (!auth.apiKey && !auth.readAccessToken) {
      return false
    }

    const key = `${auth.readAccessToken ?? ''}:${auth.apiKey ?? ''}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function applyTmdbAuth(url: URL, auth: TmdbAuth) {
  if (auth.readAccessToken) {
    return {
      headers: {
        Authorization: `Bearer ${auth.readAccessToken}`,
      },
    }
  }

  if (auth.apiKey) {
    url.searchParams.set('api_key', auth.apiKey)
  }

  return undefined
}

async function requestTmdb<T>(auth: TmdbAuth, path: string) {
  // Concatenate so the "/3" API version isn't dropped by an absolute path.
  const url = new URL(`${TMDB_BASE_URL}${path}`)
  const response = await fetch(url, applyTmdbAuth(url, auth))
  const body = (await response.json()) as T

  return {
    body,
    status: response.ok ? 200 : response.status,
  }
}

async function resolveTmdbMatch(authChain: TmdbAuth[], imdbId: string) {
  const fallbackMatch = fallbackTmdbMatches[imdbId]

  if (fallbackMatch) {
    return fallbackMatch
  }

  if (authChain.length === 0) {
    throw new Error('TMDB trailer API is not configured on the server.')
  }

  const path = `/find/${encodeURIComponent(imdbId)}?external_source=imdb_id`

  for (const auth of authChain) {
    const result = await requestTmdb<TmdbFindResponse>(auth, path)

    if (result.status !== 200) {
      continue
    }

    const movie = result.body.movie_results?.[0]
    const tv = result.body.tv_results?.[0]

    if (movie) {
      return {
        tmdbId: movie.id,
        mediaType: 'movie' as const,
        title: movie.title,
      }
    }

    if (tv) {
      return {
        tmdbId: tv.id,
        mediaType: 'tv' as const,
        title: tv.name,
      }
    }
  }

  throw new Error('No TMDB match found for this IMDb id.')
}

function trailerRank(video: TmdbVideo) {
  const type = video.type.toLowerCase()
  let score = 0

  if (type === 'trailer') {
    score += 4
  }

  if (type === 'teaser') {
    score += 2
  }

  if (video.official) {
    score += 2
  }

  return score
}

async function fetchVideos(
  authChain: TmdbAuth[],
  mediaType: TmdbMediaType,
  tmdbId: number,
) {
  const path = `/${mediaType}/${tmdbId}/videos`

  for (const auth of authChain) {
    const result = await requestTmdb<TmdbVideosResponse>(auth, path)

    if (result.status === 200) {
      return result.body.results ?? []
    }
  }

  return []
}

export async function fetchTmdbTrailerClips(
  authChain: TmdbAuth[],
  movie: { imdbId: string; title: string },
) {
  const match = await resolveTmdbMatch(authChain, movie.imdbId)
  const videos = await fetchVideos(authChain, match.mediaType, match.tmdbId)
  const seenKeys = new Set<string>()

  return videos
    .filter((video) => video.site.toLowerCase() === 'youtube' && video.key)
    .sort((left, right) => trailerRank(right) - trailerRank(left))
    .filter((video) => {
      if (seenKeys.has(video.key)) {
        return false
      }

      seenKeys.add(video.key)
      return true
    })
    .slice(0, 4)
    .map((video, index) => ({
      duration: video.type || 'Trailer',
      id: `tmdb-${video.id || video.key}-${index}`,
      image: `https://img.youtube.com/vi/${video.key}/hqdefault.jpg`,
      quality: video.official ? 'official' : '',
      title: video.name || `${movie.title} Trailer`,
      url: `https://www.youtube.com/watch?v=${video.key}`,
    }))
}

export function fallbackTrailerSearchClips(movie: { imdbId: string; title: string }) {
  const searchParams = new URLSearchParams({
    search_query: `${movie.title} official trailer`,
  })

  return [
    {
      duration: 'Trailer',
      id: `search-${movie.imdbId}`,
      image: '',
      quality: 'search',
      title: `${movie.title} Trailer`,
      url: `https://www.youtube.com/results?${searchParams}`,
    },
  ]
}

// Resolves the single best YouTube trailer key for a movie/TV title, used by
// the hero trailer preview. Accepts a TMDB id directly, or resolves one from
// an IMDb id via the TMDB /find endpoint.
export async function fetchTmdbTrailerYoutubeId(
  authChain: TmdbAuth[],
  opts: { tmdbId?: number; imdbId?: string; type?: TmdbMediaType },
): Promise<string | null> {
  let mediaType: TmdbMediaType = opts.type === 'tv' ? 'tv' : 'movie'
  let tmdbId = opts.tmdbId

  if (!tmdbId && opts.imdbId) {
    const match = await resolveTmdbMatch(authChain, opts.imdbId)
    tmdbId = match.tmdbId
    mediaType = match.mediaType
  }

  if (!tmdbId) {
    return null
  }

  const videos = await fetchVideos(authChain, mediaType, tmdbId)
  const best = videos
    .filter((video) => video.site.toLowerCase() === 'youtube' && video.key)
    .sort((left, right) => trailerRank(right) - trailerRank(left))[0]

  return best?.key ?? null
}
