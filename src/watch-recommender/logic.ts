import type { Movie } from '../omdb'
import type { TmdbHomeRails } from '../tmdb'
import type { Category } from './types'

/**
 * Watch Recommender — pure logic module.
 *
 * This file holds the deterministic, React-free, I/O-free core of the feature.
 * It is built up across tasks: candidate sourcing (this task), selection and
 * shuffle (task 2.4), and poster resolution (task 2.7) are appended below.
 */

// -----------------------------------------------------------------------------
// Candidate sourcing (Requirements 3.1, 3.2, 3.3)
// -----------------------------------------------------------------------------

/**
 * Which existing data source backs each category.
 *
 * - `tmdb-rails`: TMDB home rails (movies and TV shows)
 * - `tmdb-drama`: TMDB drama list (Korean/Chinese dramas)
 * - `anilist`:    AniList content mapped to `Movie`
 */
export type CategorySource = 'tmdb-rails' | 'tmdb-drama' | 'anilist'

/**
 * Maps a `Category` to the existing data source that backs it.
 * Movie and TV both draw from the TMDB home rails; Drama from the TMDB drama
 * list; Anime from AniList (Requirements 3.1, 3.2).
 */
export function categoryToSource(category: Category): CategorySource {
  switch (category) {
    case 'movie':
    case 'tv':
      return 'tmdb-rails'
    case 'drama':
      return 'tmdb-drama'
    case 'anime':
      return 'anilist'
  }
}

/**
 * Raw inputs already fetched by the caller. Building the pool is pure so it can
 * be tested without network access.
 */
export interface PoolInputs {
  homeRails?: TmdbHomeRails
  dramaList?: Movie[]
  animeList?: Movie[]
}

/**
 * Returns true when the entry represents a movie (as opposed to a TV show).
 * Used to pick out movie entries from the mixed `trendingNow` rail.
 */
function isMovieEntry(movie: Movie): boolean {
  if (movie.tmdbType) {
    return movie.tmdbType === 'movie'
  }
  const type = (movie.type ?? '').toLowerCase()
  return !type.includes('series') && !type.includes('tv')
}

/**
 * Returns a new array containing only entries with a usable (non-empty) `id`,
 * deduplicated by `id` while preserving first-seen order.
 */
function dedupeById(movies: Movie[]): Movie[] {
  const seen = new Set<string>()
  const result: Movie[] = []
  for (const movie of movies) {
    const id = movie?.id
    if (typeof id !== 'string' || id.length === 0) {
      continue
    }
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    result.push(movie)
  }
  return result
}

/**
 * Builds the candidate pool of `Movie` objects for the given category from the
 * supplied inputs.
 *
 * - `movie`: `homeRails.movieCollection.top`, movie entries of
 *   `homeRails.trendingNow`, and `homeRails.featuredMovies`
 * - `tv`:    `homeRails.tvShowCollection.top` and `homeRails.featuredTvShows`
 * - `drama`: `dramaList`
 * - `anime`: `animeList`
 *
 * Entries are deduplicated by `Movie.id`; entries with a missing/empty `id` are
 * dropped. Always returns a `Movie[]` (Requirements 3.1, 3.2, 3.3).
 */
export function buildCandidatePool(
  category: Category,
  inputs: PoolInputs,
): Movie[] {
  const rails = inputs.homeRails
  let raw: Movie[]

  switch (category) {
    case 'movie':
      raw = [
        ...(rails?.movieCollection.top ?? []),
        ...(rails?.trendingNow ?? []).filter(isMovieEntry),
        ...(rails?.featuredMovies ?? []),
      ]
      break
    case 'tv':
      raw = [
        ...(rails?.tvShowCollection.top ?? []),
        ...(rails?.featuredTvShows ?? []),
      ]
      break
    case 'drama':
      raw = [...(inputs.dramaList ?? [])]
      break
    case 'anime':
      raw = [...(inputs.animeList ?? [])]
      break
  }

  return dedupeById(raw)
}

// -----------------------------------------------------------------------------
// Selection and shuffle (Requirements 3.4, 3.5, 6.2, 6.3)
// -----------------------------------------------------------------------------

/**
 * Injectable random source so selection is deterministic in tests. Returns a
 * number in the range `[0, 1)`, matching the contract of `Math.random`.
 */
export type Rng = () => number

/**
 * Selects exactly one title from the pool using the supplied RNG.
 *
 * Returns `null` when the pool is empty, otherwise
 * `pool[floor(rng() * pool.length)]`. Never throws (Requirements 3.4, 3.5).
 */
export function selectRecommendation(
  pool: Movie[],
  rng: Rng = Math.random,
): Movie | null {
  if (pool.length === 0) {
    return null
  }
  const index = Math.floor(rng() * pool.length)
  // Guard against an out-of-range RNG (e.g. a value of exactly 1) so the
  // function stays total and never returns `undefined`.
  const safeIndex = Math.min(Math.max(index, 0), pool.length - 1)
  return pool[safeIndex]
}

/**
 * Re-selects a title from the pool, avoiding `current` when alternatives exist.
 *
 * - Empty pool: returns `null`.
 * - Single-title pool: returns that sole title.
 * - Pool with two or more distinct titles (by `Movie.id`): returns a member of
 *   the pool whose `id` differs from `current`'s `id`.
 *
 * Never throws (Requirements 6.2, 6.3).
 */
export function shuffleRecommendation(
  pool: Movie[],
  current: Movie | null,
  rng: Rng = Math.random,
): Movie | null {
  if (pool.length === 0) {
    return null
  }
  if (pool.length === 1) {
    return pool[0]
  }

  // Candidates that differ from the current recommendation by identity (`id`).
  const currentId = current?.id
  const alternatives =
    typeof currentId === 'string' && currentId.length > 0
      ? pool.filter((movie) => movie.id !== currentId)
      : pool

  // When every entry shares `current`'s id (no distinct alternative), fall back
  // to selecting from the whole pool so the function stays total.
  const source = alternatives.length > 0 ? alternatives : pool
  return selectRecommendation(source, rng)
}

// -----------------------------------------------------------------------------
// Poster resolution (Requirements 4.1, 4.4)
// -----------------------------------------------------------------------------

/**
 * Placeholder image used when a `Movie` has no usable poster. Inlined as an SVG
 * data URI so it always resolves without a network request and is never empty
 * (Requirement 4.4).
 */
export const POSTER_PLACEHOLDER: string =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">' +
      '<rect width="300" height="450" fill="#1c1c1e"/>' +
      '<text x="150" y="225" fill="#8e8e93" font-family="sans-serif" font-size="20" ' +
      'text-anchor="middle" dominant-baseline="middle">No poster</text>' +
      '</svg>',
  )

/**
 * Resolves the image to display for a recommendation. Returns the movie's own
 * `poster` when present and non-empty, otherwise `POSTER_PLACEHOLDER`. Always
 * returns a non-empty string (Requirements 4.1, 4.4).
 */
export function resolvePoster(movie: Movie): string {
  const poster = movie?.poster
  if (typeof poster === 'string' && poster.trim().length > 0) {
    return poster
  }
  return POSTER_PLACEHOLDER
}

// -----------------------------------------------------------------------------
// Preference refinement — genre extraction and filtering (Requirement 10)
// -----------------------------------------------------------------------------

/**
 * Extracts the distinct genres present across a candidate pool, so the UI can
 * offer only genres that actually have titles (e.g. Sci-Fi, Romance, Thriller).
 *
 * Genres are trimmed, de-duplicated case-insensitively (first-seen casing is
 * kept), non-empty, and returned sorted alphabetically. Always returns a
 * `string[]` (Requirement 10.1).
 */
export function extractGenres(pool: Movie[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const movie of pool) {
    const genres = Array.isArray(movie?.genres) ? movie.genres : []
    for (const genre of genres) {
      if (typeof genre !== 'string') {
        continue
      }
      const trimmed = genre.trim()
      const key = trimmed.toLowerCase()
      if (trimmed.length === 0 || seen.has(key)) {
        continue
      }
      seen.add(key)
      result.push(trimmed)
    }
  }
  result.sort((a, b) => a.localeCompare(b))
  return result
}

/**
 * Restricts a candidate pool to titles matching the selected genre preference.
 *
 * - `genre === null` (or blank): returns the pool unchanged — "no preference",
 *   i.e. popular/trending content for the category (Requirement 10.3).
 * - otherwise: returns only titles whose `genres` include the selected genre
 *   (case-insensitive) (Requirement 10.2).
 *
 * Never throws; always returns a `Movie[]`.
 */
export function filterByGenre(pool: Movie[], genre: string | null): Movie[] {
  if (genre === null) {
    return pool
  }
  const target = genre.trim().toLowerCase()
  if (target.length === 0) {
    return pool
  }
  return pool.filter((movie) => {
    const genres = Array.isArray(movie?.genres) ? movie.genres : []
    return genres.some(
      (genreName) =>
        typeof genreName === 'string' &&
        genreName.trim().toLowerCase() === target,
    )
  })
}
