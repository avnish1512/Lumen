const MOVIEGLU_BASE_URL = 'https://api-gate2.movieglu.com/'
const trailerCache = new Map<
  string,
  {
    expiresAt: number
    trailers: MovieGluTrailerClip[]
  }
>()
const trailerCacheTtlMs = 24 * 60 * 60 * 1000

export type MovieGluConfig = {
  apiKey: string
  apiVersion: string
  authorization: string
  baseUrl: string
  client: string
  geolocation: string
  territory: string
}

type MovieGluFilm = {
  film_id?: number | string
  film_name?: string
  film_title?: string
  imdb_title_id?: string
  title?: string
}

type MovieGluSearchResponse = {
  films?: MovieGluFilm[]
  status?: {
    state?: string
    message?: string
  }
}

type MovieGluRawTrailer = {
  film_trailer?: string
  quality?: string
  region?: string
  trailer_id?: number | string
  trailer_image?: string
  trailer_name?: string
  version?: number | string
}

type MovieGluTrailersResponse = {
  trailers?: MovieGluRawTrailer[] | Record<string, MovieGluRawTrailer[]>
  status?: {
    state?: string
    message?: string
  }
}

export type MovieGluTrailerClip = {
  duration: string
  id: string
  image: string
  quality: string
  title: string
  url: string
}

export function movieGluConfigFromEnv(
  env: Record<string, string | undefined>,
): MovieGluConfig {
  return {
    apiKey: env.MOVIEGLU_API_KEY ?? '',
    apiVersion: env.MOVIEGLU_API_VERSION ?? 'v201',
    authorization: env.MOVIEGLU_AUTHORIZATION ?? '',
    baseUrl: env.MOVIEGLU_BASE_URL ?? MOVIEGLU_BASE_URL,
    client: env.MOVIEGLU_CLIENT ?? '',
    geolocation: env.MOVIEGLU_GEOLOCATION ?? '',
    territory: env.MOVIEGLU_TERRITORY ?? 'IN',
  }
}

export function hasMovieGluConfig(config: MovieGluConfig) {
  return Boolean(
    config.apiKey.trim() &&
      config.authorization.trim() &&
      config.client.trim() &&
      config.geolocation.trim() &&
      config.territory.trim(),
  )
}

function normalizedTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function movieGluHeaders(config: MovieGluConfig) {
  return {
    authorization: config.authorization,
    client: config.client,
    'api-version': config.apiVersion,
    'device-datetime': new Date().toISOString(),
    geolocation: config.geolocation,
    territory: config.territory,
    'x-api-key': config.apiKey,
  }
}

async function requestMovieGlu<T>(
  config: MovieGluConfig,
  endpoint: string,
  params: Record<string, string>,
) {
  const url = new URL(endpoint, config.baseUrl)

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })

  const response = await fetch(url, {
    headers: movieGluHeaders(config),
  })
  const text = await response.text()
  const body = text ? (JSON.parse(text) as T) : ({} as T)

  if (!response.ok) {
    throw new Error(`MovieGlu request failed with ${response.status}.`)
  }

  return body
}

function filmName(film: MovieGluFilm) {
  return film.film_name ?? film.film_title ?? film.title ?? ''
}

async function findMovieGluFilmId(
  config: MovieGluConfig,
  imdbId: string,
  title: string,
) {
  const data = await requestMovieGlu<MovieGluSearchResponse>(
    config,
    'filmLiveSearch/',
    {
      n: '10',
      query: title,
    },
  )
  const films = data.films ?? []
  const normalizedMovieTitle = normalizedTitle(title)
  const matchedFilm =
    films.find((film) => film.imdb_title_id === imdbId) ??
    films.find((film) => normalizedTitle(filmName(film)) === normalizedMovieTitle) ??
    films[0]

  return matchedFilm?.film_id ? String(matchedFilm.film_id) : ''
}

function trailerList(data: MovieGluTrailersResponse) {
  const trailers = data.trailers

  if (Array.isArray(trailers)) {
    return trailers
  }

  if (trailers && typeof trailers === 'object') {
    return Object.values(trailers).flat()
  }

  return []
}

function qualityRank(quality: string) {
  const normalizedQuality = quality.toLowerCase()

  if (normalizedQuality.includes('high') || normalizedQuality.includes('hd')) {
    return 3
  }

  if (normalizedQuality.includes('med')) {
    return 2
  }

  return 1
}

export async function fetchMovieGluTrailerClips(
  config: MovieGluConfig,
  movie: { imdbId: string; title: string },
) {
  if (!hasMovieGluConfig(config)) {
    throw new Error('MovieGlu trailer API is not configured on the server.')
  }

  const cacheKey = [
    config.territory,
    config.geolocation,
    movie.imdbId,
    normalizedTitle(movie.title),
  ].join(':')
  const cached = trailerCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.trailers
  }

  const filmId = await findMovieGluFilmId(config, movie.imdbId, movie.title)

  if (!filmId) {
    trailerCache.set(cacheKey, {
      expiresAt: Date.now() + trailerCacheTtlMs,
      trailers: [],
    })
    return []
  }

  const data = await requestMovieGlu<MovieGluTrailersResponse>(
    config,
    'trailers/',
    {
      film_id: filmId,
    },
  )
  const seenUrls = new Set<string>()

  const trailers = trailerList(data)
    .filter((trailer) => trailer.film_trailer)
    .sort(
      (left, right) =>
        qualityRank(right.quality ?? '') - qualityRank(left.quality ?? ''),
    )
    .filter((trailer) => {
      const url = trailer.film_trailer ?? ''

      if (seenUrls.has(url)) {
        return false
      }

      seenUrls.add(url)
      return true
    })
    .slice(0, 4)
    .map((trailer, index) => {
      const quality = trailer.quality ?? ''
      const version = trailer.version ? ` ${trailer.version}` : ''

      return {
        duration: quality ? quality.toUpperCase() : 'Trailer',
        id: String(trailer.trailer_id ?? `${filmId}-${index}`),
        image: trailer.trailer_image ?? '',
        quality,
        title: trailer.trailer_name ?? `${movie.title} Trailer${version}`,
        url: trailer.film_trailer ?? '',
      } satisfies MovieGluTrailerClip
    })

  trailerCache.set(cacheKey, {
    expiresAt: Date.now() + trailerCacheTtlMs,
    trailers,
  })

  return trailers
}
