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

export type Movie = {
  id: string
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

export async function fetchFeaturedMovies() {
  const params = new URLSearchParams({
    ids: featuredMovieIds.join(','),
  })
  const data = await requestOmdb<OmdbIdsResponse>(`/api/omdb?${params}`)

  return (data.results ?? [])
    .filter((item) => item.Response !== 'False')
    .map((item, index) => movieFromDetail(item, index + 1))
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
