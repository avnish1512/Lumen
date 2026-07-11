import { type TmdbAuth } from './tmdb-watch-core.js'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'

type TmdbTvResult = {
  id: number
  name?: string
  original_name?: string
  title?: string
  original_title?: string
  overview?: string
  poster_path?: string
  backdrop_path?: string
  first_air_date?: string
  release_date?: string
  vote_average?: number
  origin_country?: string[]
}

type TmdbTvListResponse = {
  results?: TmdbTvResult[]
}

// A plain object shaped like the frontend `Movie` type. Kept loose here since
// api/ is compiled separately from src/.
export type DramaItem = {
  id: string
  tmdbId: number
  tmdbType: 'movie' | 'tv'
  streamSeason: number
  streamEpisode: number
  rank: number
  title: string
  logoTitle: string
  label: string
  type: string
  genres: string[]
  year: string
  runtime: string
  rating: string
  maturity: string
  progress: number
  hero: string
  poster: string
  still: string
  synopsis: string
  cast: string[]
  director: string
  awards: string
  boxOffice: string
  ratings: Array<{ Source: string; Value: string }>
  badges: string[]
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

async function requestTmdb(auth: TmdbAuth, path: string, params: Record<string, string>) {
  const url = new URL(path, TMDB_BASE_URL)
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })

  const response = await fetch(url, applyTmdbAuth(url, auth))
  if (!response.ok) {
    throw new Error(`TMDB returned ${response.status}.`)
  }
  return (await response.json()) as TmdbTvListResponse
}

async function requestFirstOk(authChain: TmdbAuth[], path: string, params: Record<string, string>) {
  for (const auth of authChain) {
    try {
      return await requestTmdb(auth, path, params)
    } catch {
      continue
    }
  }
  throw new Error('Could not reach TMDB.')
}

function imageUrl(path: string | undefined, size: 'w780' | 'w1280') {
  return path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : ''
}

function mapToDrama(
  item: TmdbTvResult & { title?: string; original_title?: string; release_date?: string },
  originLabel: string,
  rank: number,
  mediaType: 'tv' | 'movie',
): DramaItem | null {
  const title =
    mediaType === 'tv'
      ? item.name || item.original_name
      : item.title || item.original_title
  if (!title || (!item.poster_path && !item.backdrop_path)) {
    return null
  }

  const rating =
    typeof item.vote_average === 'number' && item.vote_average > 0
      ? item.vote_average.toFixed(1)
      : 'N/A'
  const poster = imageUrl(item.poster_path, 'w780')
  const still = imageUrl(item.backdrop_path, 'w1280') || poster
  const dateStr = mediaType === 'tv' ? item.first_air_date : item.release_date

  return {
    id: `tmdb-${mediaType}-${item.id}`,
    tmdbId: item.id,
    tmdbType: mediaType,
    streamSeason: 1,
    streamEpisode: 1,
    rank,
    title,
    logoTitle: title.toUpperCase(),
    label: originLabel,
    type: mediaType === 'tv' ? 'Series' : 'Movie',
    genres: ['Drama', originLabel],
    year: (dateStr ?? '').slice(0, 4) || 'Unknown',
    runtime: mediaType === 'tv' ? 'Series' : 'Movie',
    rating,
    maturity: 'NR',
    progress: 0,
    hero: still,
    poster: poster || still,
    still,
    synopsis: item.overview || 'No plot summary is available for this title yet.',
    cast: [],
    director: '',
    awards: '',
    boxOffice: '',
    ratings: rating === 'N/A' ? [] : [{ Source: 'TMDB', Value: `${rating}/10` }],
    badges: ['HD', originLabel],
  }
}

async function fetchDramasForCountry(
  authChain: TmdbAuth[],
  country: string,
  originLabel: string,
  mediaType: 'tv' | 'movie',
) {
  const path = mediaType === 'tv' ? '/discover/tv' : '/discover/movie'
  const response = await requestFirstOk(authChain, path, {
    with_origin_country: country,
    with_genres: '18',
    sort_by: 'popularity.desc',
    include_adult: 'false',
    language: 'en-US',
    page: '1',
  })

  return (response.results ?? [])
    .map((item, index) => mapToDrama(item, originLabel, index + 1, mediaType))
    .filter((item): item is DramaItem => Boolean(item))
    .slice(0, 20)
}

export async function fetchKoreanChineseDramas(authChain: TmdbAuth[]): Promise<DramaItem[]> {
  if (authChain.length === 0) {
    return []
  }

  const [krTv, krMovie, cnTv, cnMovie] = await Promise.all([
    fetchDramasForCountry(authChain, 'KR', 'Korean', 'tv').catch(() => []),
    fetchDramasForCountry(authChain, 'KR', 'Korean', 'movie').catch(() => []),
    fetchDramasForCountry(authChain, 'CN', 'Chinese', 'tv').catch(() => []),
    fetchDramasForCountry(authChain, 'CN', 'Chinese', 'movie').catch(() => []),
  ])

  // Interleave TV + movies across both origins so every rail has a mix.
  const pools = [krTv, cnTv, krMovie, cnMovie]
  const merged: DramaItem[] = []
  const max = Math.max(...pools.map((pool) => pool.length), 0)
  for (let index = 0; index < max; index += 1) {
    for (const pool of pools) {
      if (pool[index]) {
        merged.push(pool[index])
      }
    }
  }

  return merged.map((item, index) => ({ ...item, rank: index + 1 }))
}
