import { type TmdbAuth, normalizeWatchRegion } from './tmdb-watch-core'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'

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
  tmdbType: 'movie'
  type: string
  year: string
}

export type TmdbHomeRails = {
  newReleases: TmdbHomeMovie[]
  trendingNow: TmdbHomeMovie[]
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

function dateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return nextDate
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

export async function fetchTmdbHomeRails(
  authChain: TmdbAuth[],
  options: { region?: string } = {},
): Promise<TmdbHomeRails> {
  if (authChain.length === 0) {
    throw new Error('TMDB_API_READ_ACCESS_TOKEN or TMDB_API_KEY is missing.')
  }

  const region = normalizeWatchRegion(options.region)
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

  return {
    newReleases,
    trendingNow,
  }
}
