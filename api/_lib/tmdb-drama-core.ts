import { type TmdbAuth } from './tmdb-watch-core.js'

// Use the api.tmdb.org alias — some ISPs (notably in IN) block
// api.themoviedb.org at the network level, which leaves the drama rails empty.
// The alias serves the identical API/token and stays reachable.
const TMDB_BASE_URL = 'https://api.tmdb.org/3'
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
  // Note: concatenate (not new URL(path, base)) so the "/3" API version in the
  // base URL is preserved — an absolute `path` would otherwise replace it.
  const url = new URL(`${TMDB_BASE_URL}${path}`)
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

export type LordRail = { title: string; items: any[] }
export type LordContent = { results: any[]; rails: LordRail[] }

// Content for the PIN-locked "Lord" profile. Themed around ADULT ANIMATION —
// mature animated comedy/drama (TMDB keyword 210024 "adult animation" on the
// Animation genre) with include_adult=false, i.e. mainstream mature cartoons,
// NOT pornography.
const ADULT_ANIMATION_KEYWORD = '210024'

export async function discoverAdultAnimation(
  authChain: TmdbAuth[],
  mediaType: 'tv' | 'movie',
  sortBy: string,
  label: string,
): Promise<DramaItem[]> {
  const path = mediaType === 'tv' ? '/discover/tv' : '/discover/movie'
  const response = await requestFirstOk(authChain, path, {
    with_genres: '16',
    with_keywords: ADULT_ANIMATION_KEYWORD,
    include_adult: 'false',
    sort_by: sortBy,
    'vote_count.gte': '40',
    language: 'en-US',
    page: '1',
  })

  return (response.results ?? [])
    .map((item, index) => mapToDrama(item, label, index + 1, mediaType))
    .filter((item): item is DramaItem => Boolean(item))
    .slice(0, 18)
}

import { fetchHentaiOceanCollection } from './hentaiocean-core.js'

export async function fetchMatureCollection(
  _authChain?: TmdbAuth[],
): Promise<LordContent> {
  return fetchHentaiOceanCollection()
}

// Full-catalog title search (movies + TV) via TMDB multi-search. Used to power
// the app's search box so any TMDB title (e.g. "Business Proposal") is found,
// not just the pre-built drama rails. Results carry a tmdbId (no AniList id) so
// they stream through the TMDB player.
export async function searchTmdbTitles(
  authChain: TmdbAuth[],
  query: string,
): Promise<DramaItem[]> {
  const trimmed = query.trim()
  if (authChain.length === 0 || !trimmed) {
    return []
  }

  let response: { results?: Array<TmdbTvResult & { media_type?: string }> }
  try {
    response = (await requestFirstOk(authChain, '/search/multi', {
      query: trimmed,
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    })) as { results?: Array<TmdbTvResult & { media_type?: string }> }
  } catch {
    return []
  }

  return (response.results ?? [])
    .filter((item) => item.media_type === 'tv' || item.media_type === 'movie')
    .map((item, index) => {
      const mediaType: 'tv' | 'movie' = item.media_type === 'movie' ? 'movie' : 'tv'
      const label = mediaType === 'tv' ? 'Series' : 'Movie'
      return mapToDrama(item, label, index + 1, mediaType)
    })
    .filter((item): item is DramaItem => Boolean(item))
    .slice(0, 40)
}

// Distinct, category-specific drama rails (each rail is a different query so
// they don't repeat the same titles): K-Drama, C-Drama, New Releases, Rom-Com.
export type DramaRails = {
  kDrama: DramaItem[]
  cDrama: DramaItem[]
  newReleases: DramaItem[]
  romCom: DramaItem[]
}

async function fetchDiscover(
  authChain: TmdbAuth[],
  opts: { country: string; genres: string; sortBy: string; label: string },
) {
  const response = await requestFirstOk(authChain, '/discover/tv', {
    with_origin_country: opts.country,
    with_genres: opts.genres,
    sort_by: opts.sortBy,
    include_adult: 'false',
    'vote_count.gte': '20',
    language: 'en-US',
    page: '1',
  })

  return (response.results ?? [])
    .map((item, index) => mapToDrama(item, opts.label, index + 1, 'tv'))
    .filter((item): item is DramaItem => Boolean(item))
    .slice(0, 20)
}

function interleave(a: DramaItem[], b: DramaItem[]) {
  const merged: DramaItem[] = []
  const max = Math.max(a.length, b.length)
  for (let index = 0; index < max; index += 1) {
    if (a[index]) merged.push(a[index])
    if (b[index]) merged.push(b[index])
  }
  return merged
}

export async function fetchDramaRails(authChain: TmdbAuth[]): Promise<DramaRails> {
  if (authChain.length === 0) {
    return { kDrama: [], cDrama: [], newReleases: [], romCom: [] }
  }

  const [kDrama, cDrama, krNew, cnNew, krRom, cnRom] = await Promise.all([
    fetchDiscover(authChain, { country: 'KR', genres: '18', sortBy: 'popularity.desc', label: 'Korean' }).catch(() => []),
    fetchDiscover(authChain, { country: 'CN', genres: '18', sortBy: 'popularity.desc', label: 'Chinese' }).catch(() => []),
    fetchDiscover(authChain, { country: 'KR', genres: '18', sortBy: 'first_air_date.desc', label: 'Korean' }).catch(() => []),
    fetchDiscover(authChain, { country: 'CN', genres: '18', sortBy: 'first_air_date.desc', label: 'Chinese' }).catch(() => []),
    fetchDiscover(authChain, { country: 'KR', genres: '18,10749', sortBy: 'popularity.desc', label: 'Korean' }).catch(() => []),
    fetchDiscover(authChain, { country: 'CN', genres: '18,10749', sortBy: 'popularity.desc', label: 'Chinese' }).catch(() => []),
  ])

  const rerank = (list: DramaItem[]) => list.map((item, index) => ({ ...item, rank: index + 1 }))

  return {
    kDrama: rerank(kDrama),
    cDrama: rerank(cDrama),
    newReleases: rerank(interleave(krNew, cnNew)),
    romCom: rerank(interleave(krRom, cnRom)),
  }
}
