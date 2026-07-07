import { type TmdbAuth, normalizeWatchRegion } from './tmdb-watch-core.js'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'
const STREAMING_AVAILABILITY_BASE_URL = 'https://api.movieofthenight.com/v4'
const tmdbHomeRailsTimeoutMs = 9000

let preferredStreamingAvailabilityKeyIndex = 0

type TmdbListMovie = {
  adult?: boolean
  backdrop_path?: string
  genre_ids?: number[]
  id: number
  original_title?: string
  overview?: string
  poster_path?: string
  release_date?: string
  title?: string
  vote_average?: number
}

type TmdbMovieListResponse = {
  results?: TmdbListMovie[]
  status_code?: number
  status_message?: string
}

type TmdbMovieDetails = TmdbListMovie & {
  credits?: {
    cast?: Array<{ name?: string }>
    crew?: Array<{ job?: string; name?: string }>
  }
  external_ids?: {
    imdb_id?: string
  }
  genres?: Array<{
    id: number
    name: string
  }>
  release_dates?: {
    results?: Array<{
      iso_3166_1?: string
      release_dates?: Array<{
        certification?: string
      }>
    }>
  }
  runtime?: number
}

type StreamingImageSizes = Record<string, string | undefined>

type StreamingAvailabilityShow = {
  cast?: string[]
  creators?: string[] | null
  directors?: string[] | null
  firstAirYear?: number | null
  genres?: Array<{ name?: string }>
  id: string
  imageSet?: {
    horizontalBackdrop?: StreamingImageSizes
    horizontalPoster?: StreamingImageSizes
    verticalBackdrop?: StreamingImageSizes
    verticalPoster?: StreamingImageSizes
  }
  imdbId?: string
  lastAirYear?: number | null
  originalTitle?: string
  overview?: string
  rating?: number
  releaseYear?: number | null
  runtime?: number | null
  showType?: 'movie' | 'series'
  title?: string
  tmdbId?: string
}

type StreamingAvailabilitySearchResponse = {
  shows?: StreamingAvailabilityShow[]
}

type StreamingAvailabilityMediaCollection = {
  adventure: TmdbHomeMovie[]
  kidsFamily: TmdbHomeMovie[]
  thrilling: TmdbHomeMovie[]
  top: TmdbHomeMovie[]
}

export type StreamingAvailabilityConfig = {
  apiKeys: string[]
  baseUrl: string
  catalogs: string
  country: string
}

export type TmdbHomeMovie = {
  awards: string
  badges: string[]
  boxOffice: string
  cast: string[]
  director: string
  genres: string[]
  hero: string
  id: string
  isFull: boolean
  label: string
  logoTitle: string
  maturity: string
  poster: string
  progress: number
  rank: number
  rating: string
  ratings: Array<{ Source: string; Value: string }>
  runtime: string
  still: string
  synopsis: string
  title: string
  tmdbId: number
  tmdbType: 'movie' | 'tv'
  type: string
  year: string
}

export type TmdbHomeRails = {
  featuredMovies: TmdbHomeMovie[]
  featuredTvShows: TmdbHomeMovie[]
  movieCollection: StreamingAvailabilityMediaCollection
  newReleases: TmdbHomeMovie[]
  trendingNow: TmdbHomeMovie[]
  tvShowCollection: StreamingAvailabilityMediaCollection
}

const genreNamesById: Record<number, string> = {
  12: 'Adventure',
  14: 'Fantasy',
  16: 'Animation',
  18: 'Drama',
  27: 'Horror',
  28: 'Action',
  35: 'Comedy',
  36: 'History',
  37: 'Western',
  53: 'Thriller',
  80: 'Crime',
  99: 'Documentary',
  878: 'Sci-Fi',
  9648: 'Mystery',
  10402: 'Music',
  10749: 'Romance',
  10751: 'Family',
  10752: 'War',
  10770: 'TV Movie',
}

const fallbackPosters = [
  'https://image.tmdb.org/t/p/w780/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
  'https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
  'https://image.tmdb.org/t/p/w780/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg',
  'https://image.tmdb.org/t/p/w780/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
  'https://image.tmdb.org/t/p/w780/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
  'https://image.tmdb.org/t/p/w780/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg',
]

const fallbackStills = [
  'https://image.tmdb.org/t/p/w1280/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
  'https://image.tmdb.org/t/p/w1280/pbrkL804c8yAv3zBZR4QPEafpAR.jpg',
  'https://image.tmdb.org/t/p/w1280/kXfqcdQKsToO0OUXHcrrNCHDBzO.jpg',
  'https://image.tmdb.org/t/p/w1280/hkBaDkMWbLaf8B1lsWsKX7Ew3Xq.jpg',
  'https://image.tmdb.org/t/p/w1280/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
  'https://image.tmdb.org/t/p/w1280/3h1JZGDhZ8nzxdgvkxha0qBqi05.jpg',
]

type FallbackHomeMovie = {
  cast: string[]
  director: string
  genres: string[]
  id: string
  maturity: string
  rating: string
  runtime: string
  synopsis: string
  title: string
  tmdbId: number
  year: string
}

const fallbackNewReleaseMovies: FallbackHomeMovie[] = [
  {
    cast: ['Timothee Chalamet', 'Zendaya', 'Rebecca Ferguson'],
    director: 'Denis Villeneuve',
    genres: ['Adventure', 'Sci-Fi'],
    id: 'tt15239678',
    maturity: 'PG-13',
    rating: '8.5',
    runtime: '166 min',
    synopsis:
      'Paul Atreides joins forces with Chani and the Fremen while war gathers across Arrakis.',
    title: 'Dune: Part Two',
    tmdbId: 693134,
    year: '2024',
  },
  {
    cast: ['Amy Poehler', 'Maya Hawke', 'Kensington Tallman'],
    director: 'Kelsey Mann',
    genres: ['Animation', 'Family', 'Comedy'],
    id: 'tt22022452',
    maturity: 'PG',
    rating: '7.5',
    runtime: '96 min',
    synopsis:
      'Riley enters her teenage years as new emotions arrive at headquarters.',
    title: 'Inside Out 2',
    tmdbId: 1022789,
    year: '2024',
  },
  {
    cast: ['Ryan Reynolds', 'Hugh Jackman', 'Emma Corrin'],
    director: 'Shawn Levy',
    genres: ['Action', 'Comedy'],
    id: 'tt6263850',
    maturity: 'R',
    rating: '7.6',
    runtime: '128 min',
    synopsis:
      'Deadpool pulls Wolverine into a messy mission that could reshape their worlds.',
    title: 'Deadpool & Wolverine',
    tmdbId: 533535,
    year: '2024',
  },
  {
    cast: ['Cillian Murphy', 'Emily Blunt', 'Robert Downey Jr.'],
    director: 'Christopher Nolan',
    genres: ['Drama', 'History'],
    id: 'tt15398776',
    maturity: 'R',
    rating: '8.1',
    runtime: '181 min',
    synopsis:
      'A physicist leads a secret wartime project and faces the consequences of his work.',
    title: 'Oppenheimer',
    tmdbId: 872585,
    year: '2023',
  },
  {
    cast: ['Margot Robbie', 'Ryan Gosling', 'America Ferrera'],
    director: 'Greta Gerwig',
    genres: ['Comedy', 'Fantasy'],
    id: 'tt1517268',
    maturity: 'PG-13',
    rating: '7.0',
    runtime: '114 min',
    synopsis:
      'Barbie leaves her perfect world for a bright and complicated human one.',
    title: 'Barbie',
    tmdbId: 346698,
    year: '2023',
  },
  {
    cast: ['Robert Pattinson', 'Zoe Kravitz', 'Paul Dano'],
    director: 'Matt Reeves',
    genres: ['Action', 'Crime', 'Drama'],
    id: 'tt1877830',
    maturity: 'PG-13',
    rating: '7.7',
    runtime: '177 min',
    synopsis:
      'Batman follows a trail of corruption while a masked killer targets Gotham.',
    title: 'The Batman',
    tmdbId: 414906,
    year: '2022',
  },
  {
    cast: ['Tom Cruise', 'Miles Teller', 'Jennifer Connelly'],
    director: 'Joseph Kosinski',
    genres: ['Action', 'Drama'],
    id: 'tt1745960',
    maturity: 'PG-13',
    rating: '8.2',
    runtime: '130 min',
    synopsis:
      'Maverick returns to train elite pilots for a mission with impossible stakes.',
    title: 'Top Gun: Maverick',
    tmdbId: 361743,
    year: '2022',
  },
  {
    cast: ['Sam Worthington', 'Zoe Saldana', 'Sigourney Weaver'],
    director: 'James Cameron',
    genres: ['Adventure', 'Sci-Fi'],
    id: 'tt1630029',
    maturity: 'PG-13',
    rating: '7.6',
    runtime: '192 min',
    synopsis:
      'Jake and Neytiri protect their family as a new threat reaches Pandora.',
    title: 'Avatar: The Way of Water',
    tmdbId: 76600,
    year: '2022',
  },
  {
    cast: ['Shameik Moore', 'Hailee Steinfeld', 'Oscar Isaac'],
    director: 'Joaquim Dos Santos',
    genres: ['Animation', 'Action', 'Adventure'],
    id: 'tt9362722',
    maturity: 'PG',
    rating: '8.6',
    runtime: '140 min',
    synopsis:
      'Miles Morales crosses the multiverse and challenges what it means to be Spider-Man.',
    title: 'Spider-Man: Across the Spider-Verse',
    tmdbId: 569094,
    year: '2023',
  },
  {
    cast: ['Timothee Chalamet', 'Rebecca Ferguson', 'Oscar Isaac'],
    director: 'Denis Villeneuve',
    genres: ['Adventure', 'Sci-Fi'],
    id: 'tt1160419',
    maturity: 'PG-13',
    rating: '7.8',
    runtime: '155 min',
    synopsis:
      'A noble family is drawn into a dangerous struggle over a desert planet.',
    title: 'Dune',
    tmdbId: 438631,
    year: '2021',
  },
]

const fallbackTrendingMovies: FallbackHomeMovie[] = [
  {
    cast: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Elliot Page'],
    director: 'Christopher Nolan',
    genres: ['Action', 'Adventure', 'Sci-Fi'],
    id: 'tt1375666',
    maturity: 'PG-13',
    rating: '8.8',
    runtime: '148 min',
    synopsis:
      'A skilled thief enters dreams to steal secrets, then takes one last job.',
    title: 'Inception',
    tmdbId: 27205,
    year: '2010',
  },
  {
    cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain'],
    director: 'Christopher Nolan',
    genres: ['Adventure', 'Drama', 'Sci-Fi'],
    id: 'tt0816692',
    maturity: 'PG-13',
    rating: '8.7',
    runtime: '169 min',
    synopsis:
      'Explorers travel through a wormhole to find humanity a new home.',
    title: 'Interstellar',
    tmdbId: 157336,
    year: '2014',
  },
  {
    cast: ['Christian Bale', 'Heath Ledger', 'Aaron Eckhart'],
    director: 'Christopher Nolan',
    genres: ['Action', 'Crime', 'Drama'],
    id: 'tt0468569',
    maturity: 'PG-13',
    rating: '9.0',
    runtime: '152 min',
    synopsis:
      'Batman faces a criminal mastermind whose chaos pushes Gotham to the edge.',
    title: 'The Dark Knight',
    tmdbId: 155,
    year: '2008',
  },
  {
    cast: ['Keanu Reeves', 'Laurence Fishburne', 'Carrie-Anne Moss'],
    director: 'The Wachowskis',
    genres: ['Action', 'Sci-Fi'],
    id: 'tt0133093',
    maturity: 'R',
    rating: '8.7',
    runtime: '136 min',
    synopsis:
      'A hacker discovers reality is a simulated prison and joins the fight to break it.',
    title: 'The Matrix',
    tmdbId: 603,
    year: '1999',
  },
  {
    cast: ['Robert Downey Jr.', 'Chris Evans', 'Scarlett Johansson'],
    director: 'Anthony Russo',
    genres: ['Action', 'Adventure'],
    id: 'tt4154796',
    maturity: 'PG-13',
    rating: '8.4',
    runtime: '181 min',
    synopsis:
      'The Avengers assemble for one last attempt to reverse a devastating loss.',
    title: 'Avengers: Endgame',
    tmdbId: 299534,
    year: '2019',
  },
  {
    cast: ['Tom Hardy', 'Charlize Theron', 'Nicholas Hoult'],
    director: 'George Miller',
    genres: ['Action', 'Adventure'],
    id: 'tt1392190',
    maturity: 'R',
    rating: '8.1',
    runtime: '120 min',
    synopsis:
      'A loner and a rebel warrior flee across a brutal wasteland.',
    title: 'Mad Max: Fury Road',
    tmdbId: 76341,
    year: '2015',
  },
  {
    cast: ['Sam Neill', 'Laura Dern', 'Jeff Goldblum'],
    director: 'Steven Spielberg',
    genres: ['Adventure', 'Sci-Fi'],
    id: 'tt0107290',
    maturity: 'PG-13',
    rating: '8.2',
    runtime: '127 min',
    synopsis:
      'A theme park full of cloned dinosaurs becomes a fight for survival.',
    title: 'Jurassic Park',
    tmdbId: 329,
    year: '1993',
  },
  {
    cast: ['Elijah Wood', 'Ian McKellen', 'Viggo Mortensen'],
    director: 'Peter Jackson',
    genres: ['Adventure', 'Fantasy'],
    id: 'tt0120737',
    maturity: 'PG-13',
    rating: '8.9',
    runtime: '178 min',
    synopsis:
      'A young hobbit begins a dangerous journey to destroy a powerful ring.',
    title: 'The Lord of the Rings',
    tmdbId: 120,
    year: '2001',
  },
  {
    cast: ['Johnny Depp', 'Geoffrey Rush', 'Orlando Bloom'],
    director: 'Gore Verbinski',
    genres: ['Action', 'Adventure'],
    id: 'tt0325980',
    maturity: 'PG-13',
    rating: '8.1',
    runtime: '143 min',
    synopsis:
      'A blacksmith and a pirate captain chase a cursed ship across the sea.',
    title: 'Pirates of the Caribbean',
    tmdbId: 22,
    year: '2003',
  },
  {
    cast: ['Michael J. Fox', 'Christopher Lloyd', 'Lea Thompson'],
    director: 'Robert Zemeckis',
    genres: ['Adventure', 'Comedy'],
    id: 'tt0088763',
    maturity: 'PG',
    rating: '8.5',
    runtime: '116 min',
    synopsis:
      'A teenager accidentally travels through time and has to repair his own future.',
    title: 'Back to the Future',
    tmdbId: 105,
    year: '1985',
  },
]

function normalizeStreamingCountry(value?: string) {
  return normalizeWatchRegion(value).toLowerCase()
}

function normalizeStreamingCatalogs(value?: string) {
  return (
    value
      ?.split(',')
      .map((catalog) => catalog.trim().toLowerCase())
      .filter(Boolean)
      .join(',') || 'apple'
  )
}

function parseStreamingAvailabilityApiKeys(value?: string) {
  return (value ?? '')
    .split(/[\s,]+/)
    .map((key) => key.trim())
    .filter(Boolean)
}

function streamingAvailabilityApiKeysFromEnv(
  env: Record<string, string | undefined>,
) {
  const apiKeys = [
    env.STREAMING_AVAILABILITY_API_KEY,
    env.MOTN_API_KEY,
    ...parseStreamingAvailabilityApiKeys(env.STREAMING_AVAILABILITY_API_KEYS),
    ...parseStreamingAvailabilityApiKeys(env.MOTN_API_KEYS),
  ]
  const seen = new Set<string>()

  return apiKeys
    .map((key) => key?.trim())
    .filter((key): key is string => Boolean(key))
    .filter((key) => {
      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
}

export function streamingAvailabilityConfigFromEnv(
  env: Record<string, string | undefined>,
): StreamingAvailabilityConfig | null {
  const apiKeys = streamingAvailabilityApiKeysFromEnv(env)

  if (apiKeys.length === 0) {
    return null
  }

  return {
    apiKeys,
    baseUrl:
      env.STREAMING_AVAILABILITY_BASE_URL?.trim() ||
      STREAMING_AVAILABILITY_BASE_URL,
    catalogs: normalizeStreamingCatalogs(
      env.STREAMING_AVAILABILITY_CATALOGS ||
        env.STREAMING_AVAILABILITY_SERVICE,
    ),
    country: normalizeStreamingCountry(
      env.STREAMING_AVAILABILITY_COUNTRY || env.TMDB_WATCH_REGION,
    ),
  }
}

function dateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return nextDate
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('TMDB request timed out.'))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timeout)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timeout)
        reject(error)
      },
    )
  })
}

async function requestStreamingAvailability<T>(
  config: StreamingAvailabilityConfig,
  path: string,
  params: Record<string, string>,
) {
  const baseUrl = config.baseUrl.endsWith('/')
    ? config.baseUrl
    : `${config.baseUrl}/`
  const url = new URL(path.replace(/^\/+/, ''), baseUrl)

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })

  const apiKeys = config.apiKeys

  for (const apiKey of orderedStreamingAvailabilityApiKeys(apiKeys)) {
    const keyIndex = apiKeys.indexOf(apiKey)
    const response = await fetch(url, {
      headers: {
        'X-API-Key': apiKey,
      },
    })
    const text = await response.text()

    if (response.ok) {
      preferredStreamingAvailabilityKeyIndex = Math.max(0, keyIndex)
      return JSON.parse(text) as T
    }

    if (
      shouldRotateStreamingAvailabilityKey(response.status, text) &&
      apiKeys.length > 1
    ) {
      preferredStreamingAvailabilityKeyIndex = (keyIndex + 1) % apiKeys.length
      continue
    }

    throw new Error(`Streaming Availability returned ${response.status}.`)
  }

  throw new Error('Streaming Availability key pool is exhausted.')
}

function orderedStreamingAvailabilityApiKeys(apiKeys: string[]) {
  const startIndex = Math.min(
    preferredStreamingAvailabilityKeyIndex,
    apiKeys.length - 1,
  )

  return apiKeys.slice(startIndex).concat(apiKeys.slice(0, startIndex))
}

function shouldRotateStreamingAvailabilityKey(status: number, body: string) {
  const message = body.toLowerCase()

  return (
    status === 401 ||
    status === 403 ||
    status === 429 ||
    message.includes('limit') ||
    message.includes('quota') ||
    message.includes('rate') ||
    message.includes('too many')
  )
}

function bestStreamingImage(
  sizes: StreamingImageSizes | undefined,
  preferredWidths: string[],
) {
  if (!sizes) {
    return ''
  }

  for (const width of preferredWidths) {
    const image = sizes[width]

    if (image) {
      return image
    }
  }

  return Object.values(sizes).find(Boolean) ?? ''
}

function streamingPosterFor(show: StreamingAvailabilityShow, rank: number) {
  return (
    bestStreamingImage(show.imageSet?.verticalPoster, [
      'w720',
      'w600',
      'w480',
      'w360',
      'w240',
    ]) ||
    bestStreamingImage(show.imageSet?.horizontalPoster, [
      'w720',
      'w480',
      'w360',
    ]) ||
    fallbackPosters[(rank - 1) % fallbackPosters.length]
  )
}

function streamingStillFor(show: StreamingAvailabilityShow, rank: number) {
  return (
    bestStreamingImage(show.imageSet?.horizontalBackdrop, [
      'w1440',
      'w1080',
      'w720',
      'w480',
      'w360',
    ]) ||
    bestStreamingImage(show.imageSet?.horizontalPoster, [
      'w1440',
      'w1080',
      'w720',
      'w480',
      'w360',
    ]) ||
    bestStreamingImage(show.imageSet?.verticalBackdrop, [
      'w720',
      'w600',
      'w480',
    ]) ||
    fallbackStills[(rank - 1) % fallbackStills.length]
  )
}

function streamingTmdbId(show: StreamingAvailabilityShow) {
  const [, id] = (show.tmdbId ?? '').split('/')
  const tmdbId = Number(id)

  return Number.isFinite(tmdbId) && tmdbId > 0 ? tmdbId : null
}

function streamingYear(show: StreamingAvailabilityShow) {
  if (show.showType === 'series') {
    if (show.firstAirYear && show.lastAirYear) {
      return show.firstAirYear === show.lastAirYear
        ? String(show.firstAirYear)
        : `${show.firstAirYear}-${show.lastAirYear}`
    }

    return show.firstAirYear ? String(show.firstAirYear) : 'Unknown'
  }

  return show.releaseYear ? String(show.releaseYear) : 'Unknown'
}

function streamingGenres(show: StreamingAvailabilityShow) {
  const genres =
    show.genres
      ?.map((genre) => genre.name)
      .filter((name): name is string => Boolean(name))
      .slice(0, 4) ?? []

  return genres.length > 0 ? genres : [show.showType === 'series' ? 'Series' : 'Movie']
}

function movieFromStreamingAvailability(
  show: StreamingAvailabilityShow,
  rank: number,
  label: string,
): TmdbHomeMovie | null {
  const tmdbId = streamingTmdbId(show)
  const title = show.title || show.originalTitle

  if (!tmdbId || !title) {
    return null
  }

  const id = show.imdbId || `streaming-${show.id}`
  const rating =
    typeof show.rating === 'number' && show.rating > 0
      ? (show.rating / 10).toFixed(1)
      : 'N/A'
  const poster = streamingPosterFor(show, rank)
  const still = streamingStillFor(show, rank)
  const isSeries = show.showType === 'series'
  const director =
    show.directors?.[0] || show.creators?.[0] || 'Director unavailable'

  return {
    awards: 'Awards unavailable',
    badges: rating === 'N/A' ? ['HD', 'Apple TV'] : ['HD', `Rating ${rating}`],
    boxOffice: 'Box office unavailable',
    cast: show.cast?.slice(0, 6) ?? ['Cast unavailable'],
    director,
    genres: streamingGenres(show),
    hero: still,
    id,
    isFull: true,
    label,
    logoTitle: logoTitle(title),
    maturity: 'NR',
    poster,
    progress: progressFor(id),
    rank,
    rating,
    ratings: rating === 'N/A' ? [] : [{ Source: 'Streaming Availability', Value: `${rating}/10` }],
    runtime: show.runtime ? `${show.runtime} min` : 'Runtime unavailable',
    still,
    synopsis:
      show.overview || 'No plot summary is available for this title yet.',
    title,
    tmdbId,
    tmdbType: isSeries ? 'tv' : 'movie',
    type: isSeries ? 'Series' : 'Movie',
    year: streamingYear(show),
  }
}

function buildStreamingRail(
  shows: StreamingAvailabilityShow[],
  label: string,
  showType: 'movie' | 'series' = 'movie',
) {
  const seen = new Set<string>()

  return shows
    .filter((show) => {
      if (show.showType !== showType) {
        return false
      }

      const key = show.imdbId || show.tmdbId || show.id

      if (!key || seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
    .map((show, index) => movieFromStreamingAvailability(show, index + 1, label))
    .filter((movie): movie is TmdbHomeMovie => Boolean(movie))
    .slice(0, 10)
}

async function fetchStreamingAvailabilityRail(
  config: StreamingAvailabilityConfig,
  params: Record<string, string>,
  label: string,
  showType: 'movie' | 'series' = 'movie',
) {
  const response =
    await requestStreamingAvailability<StreamingAvailabilitySearchResponse>(
      config,
      '/shows/search/filters',
      {
        catalogs: config.catalogs,
        country: config.country,
        output_language: 'en',
        show_type: showType,
        ...params,
      },
    )

  return buildStreamingRail(response.shows ?? [], label, showType)
}

async function fetchStreamingAvailabilityTopRail(
  config: StreamingAvailabilityConfig,
  label: string,
  showType: 'movie' | 'series',
) {
  try {
    const response = await requestStreamingAvailability<
      StreamingAvailabilityShow[]
    >(config, '/shows/top', {
      country: config.country,
      output_language: 'en',
      service: config.catalogs.split(',')[0] || 'apple',
      show_type: showType,
    })
    const rail = buildStreamingRail(response, label, showType)

    if (rail.length > 0) {
      return rail
    }
  } catch {
    // Fall back to popularity when a service does not expose an official chart.
  }

  return fetchStreamingAvailabilityRail(
    config,
    {
      order_by: 'popularity_1week',
    },
    label,
    showType,
  )
}

async function fetchStreamingAvailabilityGenreRail(
  config: StreamingAvailabilityConfig,
  genre: string,
  label: string,
  showType: 'movie' | 'series' = 'movie',
) {
  return fetchStreamingAvailabilityRail(
    config,
    {
      genres: genre,
      order_by: 'popularity_1week',
    },
    label,
    showType,
  )
}

function fillStreamingCollection(
  collection: StreamingAvailabilityMediaCollection,
) {
  const fallback = collection.top

  return {
    top: collection.top,
    thrilling:
      collection.thrilling.length > 0 ? collection.thrilling : fallback,
    adventure:
      collection.adventure.length > 0 ? collection.adventure : fallback,
    kidsFamily:
      collection.kidsFamily.length > 0 ? collection.kidsFamily : fallback,
  }
}

function hasStreamingCollection(collection: StreamingAvailabilityMediaCollection) {
  return (
    collection.top.length > 0 ||
    collection.thrilling.length > 0 ||
    collection.adventure.length > 0 ||
    collection.kidsFamily.length > 0
  )
}

function fallbackCollection(
  top: TmdbHomeMovie[],
): StreamingAvailabilityMediaCollection {
  return {
    adventure: top,
    kidsFamily: top,
    thrilling: top,
    top,
  }
}

async function fetchStreamingAvailabilityHomeRails(
  config: StreamingAvailabilityConfig,
) {
  const [
    featuredMovies,
    featuredTvShows,
    movieTop,
    tvTop,
    psychologicalThrillers,
    adventureMovies,
    kidsFamilyMovies,
    newReleases,
    trendingNow,
    thrillingTvShows,
    adventureTvShows,
    kidsFamilyTvShows,
  ] = await Promise.all([
    fetchStreamingAvailabilityRail(
      config,
      {
        order_by: 'popularity_1week',
      },
      'Featured',
      'movie',
    ),
    fetchStreamingAvailabilityRail(
      config,
      {
        order_by: 'popularity_1week',
      },
      'Featured',
      'series',
    ),
    fetchStreamingAvailabilityTopRail(config, 'Top 10', 'movie'),
    fetchStreamingAvailabilityTopRail(config, 'Top 10', 'series'),
    fetchStreamingAvailabilityGenreRail(config, 'thriller', 'Thriller'),
    fetchStreamingAvailabilityGenreRail(config, 'adventure', 'Adventure'),
    fetchStreamingAvailabilityGenreRail(config, 'family', 'Family'),
    fetchStreamingAvailabilityRail(
      config,
      {
        order_by: 'release_date',
        order_direction: 'desc',
      },
      'New',
      'movie',
    ),
    fetchStreamingAvailabilityRail(
      config,
      {
        order_by: 'popularity_1week',
      },
      'Trending',
      'movie',
    ),
    fetchStreamingAvailabilityGenreRail(
      config,
      'thriller',
      'Thriller',
      'series',
    ),
    fetchStreamingAvailabilityGenreRail(
      config,
      'adventure',
      'Adventure',
      'series',
    ),
    fetchStreamingAvailabilityGenreRail(config, 'family', 'Family', 'series'),
  ])
  const movieCollection = fillStreamingCollection({
    adventure: adventureMovies,
    kidsFamily: kidsFamilyMovies,
    thrilling: psychologicalThrillers,
    top: movieTop,
  })
  const tvShowCollection = fillStreamingCollection({
    adventure: adventureTvShows,
    kidsFamily: kidsFamilyTvShows,
    thrilling: thrillingTvShows,
    top: tvTop,
  })

  return {
    featuredMovies:
      featuredMovies.length > 0 ? featuredMovies : movieCollection.top,
    featuredTvShows:
      featuredTvShows.length > 0 ? featuredTvShows : tvShowCollection.top,
    movieCollection,
    newReleases,
    trendingNow,
    tvShowCollection,
  }
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

async function requestTmdb<T>(
  auth: TmdbAuth,
  path: string,
  params: Record<string, string> = {},
) {
  const url = new URL(path, TMDB_BASE_URL)

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })

  const response = await fetch(url, applyTmdbAuth(url, auth))
  const body = (await response.json()) as T

  return {
    body,
    status: response.ok ? 200 : response.status,
  }
}

async function requestFirstOk<T>(
  authChain: TmdbAuth[],
  path: string,
  params: Record<string, string> = {},
) {
  for (const auth of authChain) {
    try {
      const result = await requestTmdb<T>(auth, path, params)

      if (result.status === 200) {
        return result.body
      }
    } catch {
      continue
    }
  }

  throw new Error('Could not reach TMDB.')
}

function logoTitle(title: string) {
  const words = title.toUpperCase().split(/\s+/).filter(Boolean)

  if (words.length <= 1 || title.length < 13) {
    return words.join(' ')
  }

  const midpoint = Math.ceil(words.length / 2)
  return `${words.slice(0, midpoint).join(' ')}\n${words
    .slice(midpoint)
    .join(' ')}`
}

function progressFor(id: string) {
  const total = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return 12 + (total % 72)
}

function imageUrl(
  path: string | undefined,
  size: 'w780' | 'w1280' | 'original',
  fallback: string,
) {
  return path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : fallback
}

function titleFor(item: TmdbListMovie | TmdbMovieDetails) {
  return item.title || item.original_title || 'Untitled'
}

function genresFor(item: TmdbListMovie, details: TmdbMovieDetails | null) {
  const genres =
    details?.genres?.map((genre) => genre.name).filter(Boolean) ??
    item.genre_ids
      ?.map((genreId) => genreNamesById[genreId])
      .filter((genre): genre is string => Boolean(genre)) ??
    []

  return genres.length > 0 ? genres.slice(0, 4) : ['Movie']
}

function maturityFor(details: TmdbMovieDetails | null, region: string) {
  const releases = details?.release_dates?.results ?? []
  const release =
    releases.find((item) => item.iso_3166_1 === region) ??
    releases.find((item) => item.iso_3166_1 === 'US')
  const certification = release?.release_dates?.find(
    (item) => item.certification,
  )?.certification

  return certification || 'NR'
}

function movieFromTmdb(
  item: TmdbListMovie,
  details: TmdbMovieDetails | null,
  rank: number,
  label: string,
  region: string,
): TmdbHomeMovie {
  const id = details?.external_ids?.imdb_id || `tmdb-movie-${item.id}`
  const title = titleFor(details ?? item)
  const rating =
    typeof item.vote_average === 'number' && item.vote_average > 0
      ? item.vote_average.toFixed(1)
      : 'N/A'
  const fallbackPoster = fallbackPosters[(rank - 1) % fallbackPosters.length]
  const fallbackStill = fallbackStills[(rank - 1) % fallbackStills.length]
  const poster = imageUrl(details?.poster_path ?? item.poster_path, 'w780', fallbackPoster)
  const still = imageUrl(
    details?.backdrop_path ?? item.backdrop_path,
    'w1280',
    fallbackStill,
  )
  const cast =
    details?.credits?.cast
      ?.map((member) => member.name)
      .filter((name): name is string => Boolean(name))
      .slice(0, 6) ?? []
  const director =
    details?.credits?.crew?.find((member) => member.job === 'Director')?.name ??
    'Director unavailable'
  const releaseYear =
    (details?.release_date ?? item.release_date ?? '').slice(0, 4) || 'Unknown'

  return {
    awards: 'Awards unavailable',
    badges: rating === 'N/A' ? ['HD', 'TMDB'] : ['HD', `TMDB ${rating}`],
    boxOffice: 'Box office unavailable',
    cast: cast.length > 0 ? cast : ['Cast unavailable'],
    director,
    genres: genresFor(item, details),
    hero: still,
    id,
    isFull: true,
    label,
    logoTitle: logoTitle(title),
    maturity: maturityFor(details, region),
    poster,
    progress: progressFor(id),
    rank,
    rating,
    ratings: rating === 'N/A' ? [] : [{ Source: 'TMDB', Value: `${rating}/10` }],
    runtime: details?.runtime ? `${details.runtime} min` : 'Runtime unavailable',
    still,
    synopsis:
      details?.overview ||
      item.overview ||
      'No plot summary is available for this movie yet.',
    title,
    tmdbId: item.id,
    tmdbType: 'movie',
    type: 'Movie',
    year: releaseYear,
  }
}

function fallbackHomeMovie(
  item: FallbackHomeMovie,
  rank: number,
  label: string,
): TmdbHomeMovie {
  const poster = fallbackPosters[(rank - 1) % fallbackPosters.length]
  const still = fallbackStills[(rank - 1) % fallbackStills.length]

  return {
    awards: 'Awards unavailable',
    badges: ['HD', `TMDB ${item.rating}`],
    boxOffice: 'Box office unavailable',
    cast: item.cast,
    director: item.director,
    genres: item.genres,
    hero: still,
    id: item.id,
    isFull: true,
    label,
    logoTitle: logoTitle(item.title),
    maturity: item.maturity,
    poster,
    progress: progressFor(item.id),
    rank,
    rating: item.rating,
    ratings: [{ Source: 'TMDB', Value: `${item.rating}/10` }],
    runtime: item.runtime,
    still,
    synopsis: item.synopsis,
    title: item.title,
    tmdbId: item.tmdbId,
    tmdbType: 'movie',
    type: 'Movie',
    year: item.year,
  }
}

function fallbackRail(items: FallbackHomeMovie[], label: string) {
  return items.map((item, index) => fallbackHomeMovie(item, index + 1, label))
}

function fallbackHomeRails(): TmdbHomeRails {
  const newReleases = fallbackRail(fallbackNewReleaseMovies, 'New')
  const trendingNow = fallbackRail(fallbackTrendingMovies, 'Trending')
  const movieCollection = fallbackCollection(trendingNow)
  const tvShowCollection = fallbackCollection([])

  return {
    featuredMovies: trendingNow,
    featuredTvShows: [],
    movieCollection,
    newReleases,
    trendingNow,
    tvShowCollection,
  }
}

async function fetchMovieList(
  authChain: TmdbAuth[],
  path: string,
  params: Record<string, string>,
) {
  const response = await requestFirstOk<TmdbMovieListResponse>(
    authChain,
    path,
    params,
  )

  return (response.results ?? [])
    .filter((movie) => !movie.adult)
    .filter((movie) => movie.poster_path || movie.backdrop_path)
}

function releaseTimeFor(movie: TmdbListMovie) {
  const time = Date.parse(movie.release_date ?? '')

  return Number.isNaN(time) ? 0 : time
}

function sortByNewestRelease(movies: TmdbListMovie[]) {
  return [...movies].sort((left, right) => {
    const releaseDelta = releaseTimeFor(right) - releaseTimeFor(left)

    if (releaseDelta !== 0) {
      return releaseDelta
    }

    return (right.vote_average ?? 0) - (left.vote_average ?? 0)
  })
}

function uniqueMovieItems(movies: TmdbListMovie[]) {
  const seen = new Set<number>()

  return movies.filter((movie) => {
    if (seen.has(movie.id)) {
      return false
    }

    seen.add(movie.id)
    return true
  })
}

async function fetchNewReleaseItems(authChain: TmdbAuth[], region: string) {
  const today = dateString(new Date())
  const earliestDate = dateString(addDays(new Date(), -150))
  const discoverParams = {
    include_adult: 'false',
    include_video: 'false',
    language: 'en-US',
    'primary_release_date.gte': earliestDate,
    'primary_release_date.lte': today,
    region,
    sort_by: 'primary_release_date.desc',
    with_release_type: '2|3|4|6',
  }

  try {
    const pages = await Promise.all(
      ['1', '2'].map((page) =>
        fetchMovieList(authChain, '/discover/movie', {
          ...discoverParams,
          page,
        }),
      ),
    )

    let releaseItems = pages.flat()

    if (releaseItems.length < 10) {
      try {
        releaseItems = releaseItems.concat(
          await fetchMovieList(authChain, '/movie/now_playing', {
            language: 'en-US',
            page: '1',
            region,
          }),
        )
      } catch {
        // Keep the discover results if the backup source is unavailable.
      }
    }

    const todayTime = Date.parse(today)

    return sortByNewestRelease(uniqueMovieItems(releaseItems))
      .filter((movie) => releaseTimeFor(movie) > 0)
      .filter((movie) => releaseTimeFor(movie) <= todayTime)
      .slice(0, 10)
  } catch {
    return sortByNewestRelease(
      await fetchMovieList(authChain, '/movie/now_playing', {
        language: 'en-US',
        page: '1',
        region,
      }),
    ).slice(0, 10)
  }
}

async function fetchMovieDetails(authChain: TmdbAuth[], tmdbId: number) {
  try {
    return await requestFirstOk<TmdbMovieDetails>(
      authChain,
      `/movie/${tmdbId}`,
      {
        append_to_response: 'external_ids,credits,release_dates',
        language: 'en-US',
      },
    )
  } catch {
    return null
  }
}

async function buildRail(
  authChain: TmdbAuth[],
  items: TmdbListMovie[],
  label: string,
  region: string,
) {
  const seen = new Set<number>()
  const uniqueItems = items
    .filter((item) => {
      if (seen.has(item.id)) {
        return false
      }

      seen.add(item.id)
      return true
    })
    .slice(0, 10)

  const details = await Promise.all(
    uniqueItems.map((item) => fetchMovieDetails(authChain, item.id)),
  )

  return uniqueItems.map((item, index) =>
    movieFromTmdb(item, details[index], index + 1, label, region),
  )
}

function completeHomeRails(
  liveRails: TmdbHomeRails | null,
  fallbackRails: TmdbHomeRails,
  tmdbRails: Partial<Pick<TmdbHomeRails, 'newReleases' | 'trendingNow'>> = {},
): TmdbHomeRails {
  return {
    featuredMovies:
      liveRails?.featuredMovies.length
        ? liveRails.featuredMovies
        : fallbackRails.featuredMovies,
    featuredTvShows:
      liveRails?.featuredTvShows.length
        ? liveRails.featuredTvShows
        : fallbackRails.featuredTvShows,
    movieCollection:
      liveRails && hasStreamingCollection(liveRails.movieCollection)
        ? fillStreamingCollection(liveRails.movieCollection)
        : fallbackRails.movieCollection,
    newReleases:
      liveRails?.newReleases.length
        ? liveRails.newReleases
        : tmdbRails.newReleases?.length
          ? tmdbRails.newReleases
          : fallbackRails.newReleases,
    trendingNow:
      liveRails?.trendingNow.length
        ? liveRails.trendingNow
        : tmdbRails.trendingNow?.length
          ? tmdbRails.trendingNow
          : fallbackRails.trendingNow,
    tvShowCollection:
      liveRails && hasStreamingCollection(liveRails.tvShowCollection)
        ? fillStreamingCollection(liveRails.tvShowCollection)
        : fallbackRails.tvShowCollection,
  }
}

function hasCompleteLiveHomeRails(rails: TmdbHomeRails) {
  return (
    rails.featuredMovies.length > 0 &&
    hasStreamingCollection(rails.movieCollection) &&
    rails.newReleases.length > 0 &&
    rails.trendingNow.length > 0
  )
}

type CachedRails = {
  data: TmdbHomeRails
  expiresAt: number
}

const railsCache: Record<string, CachedRails> = {}
const RAILS_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export async function fetchTmdbHomeRails(
  authChain: TmdbAuth[],
  options: {
    region?: string
    streamingAvailability?: StreamingAvailabilityConfig | null
  } = {},
): Promise<TmdbHomeRails> {
  const region = normalizeWatchRegion(options.region)
  const cacheKey = `${region}:${Boolean(options.streamingAvailability)}`
  const now = Date.now()

  if (railsCache[cacheKey] && railsCache[cacheKey].expiresAt > now) {
    return railsCache[cacheKey].data
  }

  const fallbackRails = fallbackHomeRails()
  let liveRails: TmdbHomeRails | null = null

  if (options.streamingAvailability) {
    try {
      liveRails = await withTimeout(
        fetchStreamingAvailabilityHomeRails(options.streamingAvailability),
        tmdbHomeRailsTimeoutMs,
      )

      if (hasCompleteLiveHomeRails(liveRails)) {
        railsCache[cacheKey] = {
          data: liveRails,
          expiresAt: Date.now() + RAILS_CACHE_TTL,
        }
        return liveRails
      }
    } catch {
      liveRails = null
    }
  }

  if (authChain.length === 0) {
    const result = completeHomeRails(liveRails, fallbackRails)
    railsCache[cacheKey] = {
      data: result,
      expiresAt: Date.now() + RAILS_CACHE_TTL,
    }
    return result
  }

  try {
    const dynamicRails = async (): Promise<TmdbHomeRails> => {
      const [newReleaseItems, trendingItems] = await Promise.all([
        fetchNewReleaseItems(authChain, region),
        fetchMovieList(authChain, '/trending/movie/day', {
          language: 'en-US',
          page: '1',
        }),
      ])

      const [newReleases, trendingNow] = await Promise.all([
        buildRail(authChain, newReleaseItems, 'New', region),
        buildRail(authChain, trendingItems, 'Trending', region),
      ])

      return completeHomeRails(liveRails, fallbackRails, {
        newReleases,
        trendingNow,
      })
    }

    const result = await withTimeout(dynamicRails(), tmdbHomeRailsTimeoutMs)
    railsCache[cacheKey] = {
      data: result,
      expiresAt: Date.now() + RAILS_CACHE_TTL,
    }
    return result
  } catch {
    const result = completeHomeRails(liveRails, fallbackRails)
    railsCache[cacheKey] = {
      data: result,
      expiresAt: Date.now() + RAILS_CACHE_TTL,
    }
    return result
  }
}
