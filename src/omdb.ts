export type OmdbRating = {
  Source: string
  Value: string
}

export type OmdbSearchItem = {
  Title: string
  Year: string
  imdbID: string
  Type: string
  Poster: string
}

export type OmdbDetail = OmdbSearchItem & {
  Rated?: string
  Released?: string
  Runtime?: string
  Genre?: string
  Director?: string
  Writer?: string
  Actors?: string
  Plot?: string
  Language?: string
  Country?: string
  Awards?: string
  Ratings?: OmdbRating[]
  Metascore?: string
  imdbRating?: string
  imdbVotes?: string
  BoxOffice?: string
  Response?: string
  Error?: string
}

type OmdbSearchResponse = {
  Search?: OmdbSearchItem[]
  totalResults?: string
  Response: string
  Error?: string
}

type OmdbIdsResponse = {
  Response: string
  results?: OmdbDetail[]
  Error?: string
}

export type MediaCollection = {
  top: Movie[]
  thrilling: Movie[]
  adventure: Movie[]
  kidsFamily: Movie[]
}

export type Movie = {
  id: string
  tmdbId?: number
  tmdbType?: 'movie' | 'tv'
  streamSeason?: number
  streamEpisode?: number
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
  ratings: OmdbRating[]
  badges: string[]
  isFull: boolean
}

export const featuredMovieIds = [
  'tt1375666',
  'tt0816692',
  'tt0111161',
  'tt0468569',
  'tt0133093',
  'tt0109830',
  'tt0110912',
  'tt4154796',
  'tt1745960',
  'tt0068646',
]

export const featuredTvShowIds = [
  'tt0944947',
  'tt0903747',
  'tt4574334',
  'tt1475582',
  'tt0108778',
  'tt7366338',
  'tt3032476',
  'tt1520211',
  'tt2861424',
  'tt0413573',
]

const movieCollectionIds = {
  top: featuredMovieIds,
  thrilling: [
    'tt0102926',
    'tt0114369',
    'tt0209144',
    'tt1130884',
    'tt2267998',
    'tt1392214',
    'tt0443706',
    'tt0477348',
    'tt0482571',
    'tt2872718',
  ],
  adventure: [
    'tt0082971',
    'tt0107290',
    'tt0120737',
    'tt0325980',
    'tt1392190',
    'tt0816692',
    'tt1160419',
    'tt0454876',
    'tt1663202',
    'tt0088763',
  ],
  kidsFamily: [
    'tt0114709',
    'tt0266543',
    'tt0110357',
    'tt0198781',
    'tt0126029',
    'tt4468740',
    'tt2096673',
    'tt2380307',
    'tt0317705',
    'tt0245429',
  ],
}

const tvShowCollectionIds = {
  top: featuredTvShowIds,
  thrilling: [
    'tt5753856',
    'tt5290382',
    'tt2356777',
    'tt2085059',
    'tt2401256',
    'tt2243973',
    'tt2802850',
    'tt5071412',
    'tt1796960',
    'tt6048596',
  ],
  adventure: [
    'tt0417299',
    'tt0411008',
    'tt8111088',
    'tt11737520',
    'tt0436992',
    'tt5180504',
    'tt5607976',
    'tt3581920',
    'tt2306299',
    'tt1199099',
  ],
  kidsFamily: [
    'tt7678620',
    'tt0206512',
    'tt1305826',
    'tt1865718',
    'tt0168366',
    'tt0852863',
    'tt5531466',
    'tt8688814',
    'tt3061046',
    'tt0983983',
  ],
}

const fallbackPosters = [
  '/media/arrival-poster.jpg',
  '/media/northpoint-poster.jpg',
  '/media/sundown-poster.jpg',
  '/media/glass-poster.jpg',
  '/media/afterimage-poster.jpg',
  '/media/golden-poster.jpg',
]

const fallbackHeroImages = [
  '/media/arrival-hero.jpg',
  '/media/northpoint-hero.jpg',
  '/media/sundown-hero.jpg',
  '/media/glass-hero.jpg',
  '/media/afterimage-hero.jpg',
  '/media/golden-hero.jpg',
]

const fallbackStillImages = [
  '/media/arrival-still.jpg',
  '/media/northpoint-still.jpg',
  '/media/sundown-still.jpg',
  '/media/glass-still.jpg',
  '/media/afterimage-still.jpg',
  '/media/golden-still.jpg',
]

function safeText(value: string | undefined, fallback = 'N/A') {
  if (!value || value === 'N/A') {
    return fallback
  }

  return value
}

function fallbackPoster(rank: number) {
  return fallbackPosters[(rank - 1) % fallbackPosters.length]
}

function fallbackHero(rank: number) {
  return fallbackHeroImages[(rank - 1) % fallbackHeroImages.length]
}

function fallbackStill(rank: number) {
  return fallbackStillImages[(rank - 1) % fallbackStillImages.length]
}

function posterFor(movie: Pick<OmdbSearchItem, 'Poster'>, rank: number) {
  return movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : fallbackPoster(rank)
}

function splitList(value: string | undefined, fallback: string[]) {
  if (!value || value === 'N/A') {
    return fallback
  }

  return value.split(',').map((item) => item.trim()).filter(Boolean)
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

function badgesFor(detail: Partial<OmdbDetail>) {
  const badges = ['HD']

  if (safeText(detail.imdbRating, '') !== '') {
    badges.push(`IMDb ${detail.imdbRating}`)
  }

  if (safeText(detail.Metascore, '') !== '') {
    badges.push(`META ${detail.Metascore}`)
  }

  badges.push('CC', 'SDH')
  return badges
}

export function movieFromDetail(detail: OmdbDetail, rank = 1): Movie {
  const poster = posterFor(detail, rank)
  const genres = splitList(detail.Genre, ['Movie'])

  return {
    id: detail.imdbID,
    rank,
    title: safeText(detail.Title, 'Untitled'),
    logoTitle: logoTitle(safeText(detail.Title, 'Untitled')),
    label: rank === 1 ? 'Featured' : detail.Released ? 'Movie Info' : 'Fresh Pick',
    type: safeText(detail.Type, 'movie').replace(/^\w/, (letter) =>
      letter.toUpperCase(),
    ),
    genres,
    year: safeText(detail.Year, 'Unknown'),
    runtime: safeText(detail.Runtime, 'Runtime unavailable'),
    rating: safeText(detail.imdbRating, 'N/A'),
    maturity: safeText(detail.Rated, 'NR'),
    progress: progressFor(detail.imdbID),
    hero: fallbackHero(rank),
    poster,
    still: fallbackStill(rank),
    synopsis: safeText(detail.Plot, 'No plot summary is available for this movie.'),
    cast: splitList(detail.Actors, ['Cast unavailable']).slice(0, 6),
    director: safeText(detail.Director, 'Director unavailable'),
    awards: safeText(detail.Awards, 'Awards unavailable'),
    boxOffice: safeText(detail.BoxOffice, 'Box office unavailable'),
    ratings: detail.Ratings ?? [],
    badges: badgesFor(detail),
    isFull: true,
  }
}

export function movieFromSearch(item: OmdbSearchItem, rank = 1): Movie {
  const poster = posterFor(item, rank)

  return {
    id: item.imdbID,
    rank,
    title: safeText(item.Title, 'Untitled'),
    logoTitle: logoTitle(safeText(item.Title, 'Untitled')),
    label: 'Search Result',
    type: safeText(item.Type, 'movie').replace(/^\w/, (letter) =>
      letter.toUpperCase(),
    ),
    genres: ['Movie'],
    year: safeText(item.Year, 'Unknown'),
    runtime: 'Open for runtime',
    rating: 'N/A',
    maturity: 'NR',
    progress: progressFor(item.imdbID),
    hero: fallbackHero(rank),
    poster,
    still: fallbackStill(rank),
    synopsis: 'Open this movie to load its full OMDb plot, cast, ratings, and release details.',
    cast: ['Open for cast'],
    director: 'Open for director',
    awards: 'Open for awards',
    boxOffice: 'Open for box office',
    ratings: [],
    badges: ['OMDb'],
    isFull: false,
  }
}

async function requestOmdb<T>(path: string): Promise<T> {
  const response = await fetch(path)
  const body = (await response.json()) as T & { Response?: string; Error?: string }

  if (!response.ok) {
    throw new Error(body.Error ?? 'Could not reach OMDb.')
  }

  if (body.Response === 'False') {
    throw new Error(body.Error ?? 'OMDb did not return results.')
  }

  return body
}

async function fetchFeaturedByIds(ids: string[]) {
  const params = new URLSearchParams({
    ids: ids.join(','),
  })
  const data = await requestOmdb<OmdbIdsResponse>(`/api/omdb?${params}`)

  return (data.results ?? [])
    .filter((item) => item.Response !== 'False')
    .map((item, index) => movieFromDetail(item, index + 1))
}

async function fetchCollectionByIds(ids: string[]) {
  try {
    return await fetchFeaturedByIds(ids)
  } catch {
    return []
  }
}

function fillCollection(collection: MediaCollection) {
  const fallback = collection.top

  return {
    top: collection.top,
    thrilling: collection.thrilling.length > 0 ? collection.thrilling : fallback,
    adventure: collection.adventure.length > 0 ? collection.adventure : fallback,
    kidsFamily:
      collection.kidsFamily.length > 0 ? collection.kidsFamily : fallback,
  }
}

async function fetchMediaCollection(
  collectionIds: typeof movieCollectionIds,
): Promise<MediaCollection> {
  const [top, thrilling, adventure, kidsFamily] = await Promise.all([
    fetchCollectionByIds(collectionIds.top),
    fetchCollectionByIds(collectionIds.thrilling),
    fetchCollectionByIds(collectionIds.adventure),
    fetchCollectionByIds(collectionIds.kidsFamily),
  ])

  if (top.length === 0) {
    throw new Error('OMDb did not return the top rail.')
  }

  return fillCollection({
    top,
    thrilling,
    adventure,
    kidsFamily,
  })
}

export async function fetchFeaturedMovies() {
  return fetchFeaturedByIds(featuredMovieIds)
}

export async function fetchFeaturedTvShows() {
  return fetchFeaturedByIds(featuredTvShowIds)
}

export async function fetchMovieCollection() {
  return fetchMediaCollection(movieCollectionIds)
}

export async function fetchTvShowCollection() {
  return fetchMediaCollection(tvShowCollectionIds)
}

export async function fetchMovieById(id: string, rank = 1) {
  const params = new URLSearchParams({ id })
  const data = await requestOmdb<OmdbDetail>(`/api/omdb?${params}`)
  return movieFromDetail(data, rank)
}

export async function searchMovies(query: string, page = 1) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
  })
  const data = await requestOmdb<OmdbSearchResponse>(`/api/omdb?${params}`)

  return (data.Search ?? []).map((item, index) =>
    movieFromSearch(item, index + 1),
  )
}
