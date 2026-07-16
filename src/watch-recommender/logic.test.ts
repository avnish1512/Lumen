import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

import type { Movie } from '../omdb'
import type { TmdbHomeRails } from '../tmdb'
import type { Category } from './types'
import type { PoolInputs } from './logic'
import {
  buildCandidatePool,
  selectRecommendation,
  shuffleRecommendation,
  resolvePoster,
  POSTER_PLACEHOLDER,
} from './logic'

/**
 * Property-based tests for the Watch Recommender pure logic module.
 *
 * This file is shared across the logic property tests (Properties 1–5). Each
 * property lives in its own `describe` block so later tasks can append their
 * blocks without disturbing existing ones. Shared arbitraries and factories
 * live at the top so every block can reuse them.
 *
 * All property tests run a minimum of 100 iterations (fast-check `numRuns`).
 */

// -----------------------------------------------------------------------------
// Shared test helpers and arbitraries
// -----------------------------------------------------------------------------

/**
 * Builds a fully-populated, valid `Movie` from a small set of overrides. Only
 * the fields relevant to the logic under test vary; the rest are filled with
 * deterministic defaults so the object satisfies the `Movie` type.
 */
function makeMovie(
  id: string,
  opts: { poster?: string; kind?: 'movie' | 'tv' } = {},
): Movie {
  const kind = opts.kind ?? 'movie'
  return {
    id,
    tmdbType: kind,
    rank: 1,
    title: `Title ${id}`,
    logoTitle: `Title ${id}`,
    label: 'Featured',
    type: kind === 'tv' ? 'Series' : 'Movie',
    genres: ['Drama'],
    year: '2024',
    runtime: '120 min',
    rating: '7.5',
    maturity: 'PG',
    progress: 0,
    hero: '',
    poster: opts.poster ?? `poster-${id}`,
    still: '',
    synopsis: 'Synopsis.',
    cast: [],
    director: '',
    awards: '',
    boxOffice: '',
    ratings: [],
  }
}

/**
 * A bucket of movies whose ids all share `prefix`, guaranteeing that ids are
 * globally disjoint across buckets that use different prefixes. Uniqueness of
 * the numeric suffix keeps ids unique within the bucket.
 */
function movieBucketArb(
  prefix: string,
  kind: 'movie' | 'tv' = 'movie',
): fc.Arbitrary<Movie[]> {
  return fc
    .uniqueArray(fc.nat({ max: 100_000 }), { maxLength: 6 })
    .map((nums) => nums.map((n) => makeMovie(`${prefix}-${n}`, { kind })))
}

/**
 * The mixed `trendingNow` rail: contains both movie and TV entries so the
 * sourcing filter (movie entries only, for the movie category) is exercised.
 */
const trendingArb: fc.Arbitrary<Movie[]> = fc
  .uniqueArray(
    fc.record({
      n: fc.nat({ max: 100_000 }),
      kind: fc.constantFrom<'movie' | 'tv'>('movie', 'tv'),
    }),
    { selector: (r) => r.n, maxLength: 8 },
  )
  .map((rows) => rows.map((r) => makeMovie(`tr-${r.n}`, { kind: r.kind })))

/**
 * A `TmdbHomeRails` value where each rail draws from a disjoint id namespace so
 * the origin of any pooled title is unambiguous.
 */
const homeRailsArb: fc.Arbitrary<TmdbHomeRails> = fc
  .record({
    movieCollectionTop: movieBucketArb('mc', 'movie'),
    featuredMovies: movieBucketArb('fm', 'movie'),
    trendingNow: trendingArb,
    tvCollectionTop: movieBucketArb('tc', 'tv'),
    featuredTvShows: movieBucketArb('ftv', 'tv'),
  })
  .map((r) => ({
    featuredMovies: r.featuredMovies,
    featuredTvShows: r.featuredTvShows,
    movieCollection: {
      top: r.movieCollectionTop,
      thrilling: [],
      adventure: [],
      kidsFamily: [],
    },
    newReleases: [],
    trendingNow: r.trendingNow,
    tvShowCollection: {
      top: r.tvCollectionTop,
      thrilling: [],
      adventure: [],
      kidsFamily: [],
    },
  }))

const dramaListArb: fc.Arbitrary<Movie[]> = movieBucketArb('dr', 'movie')
const animeListArb: fc.Arbitrary<Movie[]> = movieBucketArb('an', 'movie')

const categoryArb: fc.Arbitrary<Category> = fc.constantFrom<Category>(
  'movie',
  'tv',
  'anime',
  'drama',
)

/**
 * `PoolInputs` where each source may independently be present or absent, so the
 * function is exercised with partial inputs as well as fully-populated ones.
 * All present sources use disjoint id namespaces (see `makeMovie` prefixes).
 */
const poolInputsArb = fc.record({
  homeRails: fc.option(homeRailsArb, { nil: undefined }),
  dramaList: fc.option(dramaListArb, { nil: undefined }),
  animeList: fc.option(animeListArb, { nil: undefined }),
})

/**
 * Mirrors the private `isMovieEntry` rule in `logic.ts`: entries carrying a
 * `tmdbType` are movies exactly when `tmdbType === 'movie'`. All generated
 * movies set `tmdbType`, so this fully determines the movie/TV split.
 */
function isGeneratedMovieEntry(movie: Movie): boolean {
  return movie.tmdbType === 'movie'
}

/**
 * The exact set of ids that the category's mapped data source can contribute,
 * per the design's sourcing rules. Any pooled id outside this set would mean a
 * title leaked from an unrelated source.
 */
function expectedSourceIds(
  category: Category,
  inputs: PoolInputs,
): Set<string> {
  const rails = inputs.homeRails
  switch (category) {
    case 'movie':
      return new Set([
        ...(rails?.movieCollection.top ?? []).map((m) => m.id),
        ...(rails?.trendingNow ?? []).filter(isGeneratedMovieEntry).map((m) => m.id),
        ...(rails?.featuredMovies ?? []).map((m) => m.id),
      ])
    case 'tv':
      return new Set([
        ...(rails?.tvShowCollection.top ?? []).map((m) => m.id),
        ...(rails?.featuredTvShows ?? []).map((m) => m.id),
      ])
    case 'drama':
      return new Set((inputs.dramaList ?? []).map((m) => m.id))
    case 'anime':
      return new Set((inputs.animeList ?? []).map((m) => m.id))
  }
}

// -----------------------------------------------------------------------------
// Property 1
// -----------------------------------------------------------------------------

// Feature: watch-recommender, Property 1: Candidate pool sourcing is category-correct
describe('Property 1: Candidate pool sourcing is category-correct', () => {
  it('draws every pooled title only from the source mapped to the category', () => {
    fc.assert(
      fc.property(categoryArb, poolInputsArb, (category, inputs) => {
        const pool = buildCandidatePool(category, inputs)
        const allowedIds = expectedSourceIds(category, inputs)

        // Every title in the pool must originate from the category's mapped
        // source; nothing from an unrelated source may appear.
        for (const movie of pool) {
          expect(allowedIds.has(movie.id)).toBe(true)
        }
      }),
      { numRuns: 200 },
    )
  })
})

// -----------------------------------------------------------------------------
// Property 2
// -----------------------------------------------------------------------------

/**
 * "Messy" arbitraries for Property 2. Unlike the disjoint, always-valid buckets
 * used by Property 1, these deliberately produce ids that collide (drawn from a
 * tiny pool so duplicates are frequent) and ids that are empty or missing, so
 * the dedup-and-drop logic in `buildCandidatePool` is actually exercised.
 */

// A small id pool guarantees frequent collisions within and across rails.
const collidingIdArb: fc.Arbitrary<string> = fc.constantFrom(
  'x1',
  'x2',
  'x3',
  'x4',
)

// An id that must be dropped: the empty string.
const emptyIdArb: fc.Arbitrary<string> = fc.constant('')

// A movie whose `id` is a colliding or empty string.
function messyMovieArb(kind: 'movie' | 'tv' = 'movie'): fc.Arbitrary<Movie> {
  return fc
    .oneof(
      { weight: 3, arbitrary: collidingIdArb },
      { weight: 1, arbitrary: emptyIdArb },
    )
    .map((id) => makeMovie(id, { kind }))
}

// A movie with a genuinely missing `id` field (property deleted), to exercise
// the non-string guard in the drop logic.
const missingIdMovieArb: fc.Arbitrary<Movie> = fc
  .constant(null)
  .map(() => {
    const clone = { ...makeMovie('placeholder') } as Partial<Movie>
    delete clone.id
    return clone as Movie
  })

// A list mixing colliding, empty, and missing-id movies.
function messyListArb(kind: 'movie' | 'tv' = 'movie'): fc.Arbitrary<Movie[]> {
  return fc.array(
    fc.oneof(
      { weight: 4, arbitrary: messyMovieArb(kind) },
      { weight: 1, arbitrary: missingIdMovieArb },
    ),
    { maxLength: 10 },
  )
}

/**
 * A `TmdbHomeRails` whose movie/TV rails are all populated with messy movies.
 * Because the same tiny id pool feeds every rail, ids collide across rails,
 * exercising cross-rail deduplication for the movie and TV categories.
 */
const messyHomeRailsArb: fc.Arbitrary<TmdbHomeRails> = fc
  .record({
    movieCollectionTop: messyListArb('movie'),
    featuredMovies: messyListArb('movie'),
    trendingNow: messyListArb('movie'),
    tvCollectionTop: messyListArb('tv'),
    featuredTvShows: messyListArb('tv'),
  })
  .map((r) => ({
    featuredMovies: r.featuredMovies,
    featuredTvShows: r.featuredTvShows,
    movieCollection: {
      top: r.movieCollectionTop,
      thrilling: [],
      adventure: [],
      kidsFamily: [],
    },
    newReleases: [],
    trendingNow: r.trendingNow,
    tvShowCollection: {
      top: r.tvCollectionTop,
      thrilling: [],
      adventure: [],
      kidsFamily: [],
    },
  }))

/**
 * `PoolInputs` where every source is populated with messy movies, so whichever
 * category is selected has duplicate and empty/missing ids to filter.
 */
const messyPoolInputsArb = fc.record({
  homeRails: fc.option(messyHomeRailsArb, { nil: undefined }),
  dramaList: fc.option(messyListArb('movie'), { nil: undefined }),
  animeList: fc.option(messyListArb('movie'), { nil: undefined }),
})

// Feature: watch-recommender, Property 2: Candidate pool contains only valid, unique Movie objects
describe('Property 2: Candidate pool contains only valid, unique Movie objects', () => {
  it('returns only valid Movie objects with non-empty, unique ids', () => {
    fc.assert(
      fc.property(categoryArb, messyPoolInputsArb, (category, inputs) => {
        const pool = buildCandidatePool(category, inputs)

        // Always a Movie[] (never null/undefined).
        expect(Array.isArray(pool)).toBe(true)

        const seen = new Set<string>()
        for (const movie of pool) {
          // Each entry is a valid Movie object with a non-empty string id
          // (entries with missing/empty ids must have been dropped).
          expect(movie).toBeTypeOf('object')
          expect(movie).not.toBeNull()
          expect(typeof movie.id).toBe('string')
          expect(movie.id.length).toBeGreaterThan(0)

          // No two entries share the same id (deduplication holds).
          expect(seen.has(movie.id)).toBe(false)
          seen.add(movie.id)
        }
      }),
      { numRuns: 200 },
    )
  })
})

// -----------------------------------------------------------------------------
// Property 3
// -----------------------------------------------------------------------------

/** A non-empty pool, used where the empty case is handled separately. */
const nonEmptyPoolArb: fc.Arbitrary<Movie[]> = fc
  .uniqueArray(fc.nat({ max: 100_000 }), { minLength: 1, maxLength: 8 })
  .map((nums) => nums.map((n) => makeMovie(`sel-${n}`)))

/** An RNG value in the half-open range [0, 1), matching Math.random's contract. */
const rngValueArb: fc.Arbitrary<number> = fc.double({
  min: 0,
  max: 1,
  maxExcluded: true,
  noNaN: true,
})

// Feature: watch-recommender, Property 3: Selection returns exactly one pool member
describe('Property 3: Selection returns exactly one pool member', () => {
  it('returns null for an empty pool regardless of the RNG value', () => {
    fc.assert(
      fc.property(rngValueArb, (r) => {
        expect(selectRecommendation([], () => r)).toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  it('returns a member of the pool computed as pool[floor(rng * length)]', () => {
    fc.assert(
      fc.property(nonEmptyPoolArb, rngValueArb, (pool, r) => {
        const result = selectRecommendation(pool, () => r)

        // Exactly one title is returned (never null for a non-empty pool).
        expect(result).not.toBeNull()

        // It is deterministically the element at floor(rng * length).
        const expectedIndex = Math.floor(r * pool.length)
        expect(result).toBe(pool[expectedIndex])

        // And it is genuinely a member of the pool.
        expect(pool).toContain(result)
      }),
      { numRuns: 200 },
    )
  })

  it('reaches every index of the pool as the RNG value sweeps [0, 1)', () => {
    fc.assert(
      fc.property(nonEmptyPoolArb, (pool) => {
        // Sweeping representative RNG values across [0, 1) must reach every
        // index, including the boundaries 0 and length - 1.
        const reached = new Set<number>()
        for (let i = 0; i < pool.length; i++) {
          // A value squarely inside the i-th bucket of width 1/length.
          const r = (i + 0.5) / pool.length
          const result = selectRecommendation(pool, () => r)
          reached.add(pool.indexOf(result as Movie))
        }

        // Boundary indices 0 and length - 1 are reachable.
        expect(reached.has(0)).toBe(true)
        expect(reached.has(pool.length - 1)).toBe(true)
        // Every index in between is reachable too.
        expect(reached.size).toBe(pool.length)
      }),
      { numRuns: 100 },
    )
  })
})

// -----------------------------------------------------------------------------
// Property 4
// -----------------------------------------------------------------------------

/**
 * A pool of two or more `Movie` objects with globally-unique ids (unique numeric
 * suffixes), so "different from current" is meaningful and membership checks by
 * identity are unambiguous.
 */
const multiPoolArb: fc.Arbitrary<Movie[]> = fc
  .uniqueArray(fc.nat({ max: 100_000 }), { minLength: 2, maxLength: 8 })
  .map((nums) => nums.map((n) => makeMovie(`shf-${n}`)))

// Feature: watch-recommender, Property 4: Shuffle stays in the pool and avoids repetition when possible
describe('Property 4: Shuffle stays in the pool and avoids repetition when possible', () => {
  it('returns null for an empty pool regardless of current or RNG value', () => {
    fc.assert(
      fc.property(rngValueArb, (r) => {
        expect(shuffleRecommendation([], null, () => r)).toBeNull()
        // A stray `current` value must not change the empty-pool outcome.
        expect(
          shuffleRecommendation([], makeMovie('ghost'), () => r),
        ).toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  it('returns the sole title for a single-title pool', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100_000 }),
        rngValueArb,
        fc.boolean(),
        (n, r, currentIsSelf) => {
          const only = makeMovie(`solo-${n}`)
          // `current` is either the sole title itself or an unrelated title;
          // both must yield the sole title (never null).
          const current = currentIsSelf ? only : makeMovie(`other-${n}`)
          const result = shuffleRecommendation([only], current, () => r)
          expect(result).toBe(only)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('returns a pool member different from current when two or more distinct titles exist', () => {
    fc.assert(
      fc.property(
        multiPoolArb,
        rngValueArb,
        fc.nat(),
        (pool, r, currentPick) => {
          // Pick a `current` that is genuinely a member of the pool.
          const current = pool[currentPick % pool.length]
          const result = shuffleRecommendation(pool, current, () => r)

          // A non-empty pool always yields a title (never null).
          expect(result).not.toBeNull()
          // The result stays in the pool.
          expect(pool).toContain(result)
          // And it avoids repeating the current recommendation by id.
          expect(result?.id).not.toBe(current.id)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('always returns a member of the pool for any non-empty pool and current', () => {
    fc.assert(
      fc.property(
        nonEmptyPoolArb,
        // `current` may be a pool member or an outsider, exercising both paths.
        fc.option(fc.nat(), { nil: undefined }),
        rngValueArb,
        (pool, currentPick, r) => {
          const current =
            currentPick === undefined
              ? makeMovie('outsider')
              : pool[currentPick % pool.length]
          const result = shuffleRecommendation(pool, current, () => r)

          // The result stays in the pool (Requirement 6.2).
          expect(result).not.toBeNull()
          expect(pool).toContain(result)
        },
      ),
      { numRuns: 200 },
    )
  })
})

// -----------------------------------------------------------------------------
// Property 5
// -----------------------------------------------------------------------------

/**
 * Arbitraries for poster values. `resolvePoster` treats a poster as usable only
 * when it is a non-empty string after trimming, so the generators split into:
 *
 * - "present" posters: non-empty strings that also survive a `.trim()`
 *   (a leading/trailing space is padded on to prove trimming does not drop a
 *   genuinely present poster).
 * - "absent" posters: empty string, whitespace-only strings, and a genuinely
 *   missing `poster` field — all of which must fall back to the placeholder.
 */

// A poster string guaranteed non-empty after trimming (has a visible char).
const presentPosterArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => s.trim().length > 0)

// Whitespace-only strings (spaces, tabs, newlines) that trim to empty.
const whitespacePosterArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 6 })
  .map((chars) => chars.join(''))

// An "absent" poster: empty string or whitespace-only.
const absentPosterArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  whitespacePosterArb,
)

/** A Movie whose `poster` is a genuinely usable, present value. */
const moviePresentPosterArb: fc.Arbitrary<Movie> = fc
  .record({ n: fc.nat({ max: 100_000 }), poster: presentPosterArb })
  .map(({ n, poster }) => makeMovie(`pp-${n}`, { poster }))

/** A Movie whose `poster` is empty or whitespace-only (absent). */
const movieAbsentPosterArb: fc.Arbitrary<Movie> = fc
  .record({ n: fc.nat({ max: 100_000 }), poster: absentPosterArb })
  .map(({ n, poster }) => makeMovie(`ap-${n}`, { poster }))

/** A Movie whose `poster` field is missing entirely. */
const movieMissingPosterArb: fc.Arbitrary<Movie> = fc
  .nat({ max: 100_000 })
  .map((n) => {
    const clone = { ...makeMovie(`mp-${n}`) } as Partial<Movie>
    delete clone.poster
    return clone as Movie
  })

/** Any Movie, mixing present, empty/whitespace, and missing posters. */
const anyPosterMovieArb: fc.Arbitrary<Movie> = fc.oneof(
  moviePresentPosterArb,
  movieAbsentPosterArb,
  movieMissingPosterArb,
)

// Feature: watch-recommender, Property 5: Poster resolution always yields a usable image
describe('Property 5: Poster resolution always yields a usable image', () => {
  it('always returns a non-empty string for any movie', () => {
    fc.assert(
      fc.property(anyPosterMovieArb, (movie) => {
        const resolved = resolvePoster(movie)
        expect(typeof resolved).toBe('string')
        expect(resolved.length).toBeGreaterThan(0)
      }),
      { numRuns: 200 },
    )
  })

  it('returns the movie poster unchanged when it is present and non-empty', () => {
    fc.assert(
      fc.property(moviePresentPosterArb, (movie) => {
        // A genuinely present poster is returned as-is, never the placeholder.
        expect(resolvePoster(movie)).toBe(movie.poster)
      }),
      { numRuns: 200 },
    )
  })

  it('returns the (non-empty) placeholder when the poster is missing or empty', () => {
    fc.assert(
      fc.property(
        fc.oneof(movieAbsentPosterArb, movieMissingPosterArb),
        (movie) => {
          // The placeholder itself must be usable (non-empty).
          expect(POSTER_PLACEHOLDER.length).toBeGreaterThan(0)
          // Missing/empty/whitespace posters fall back to the placeholder.
          expect(resolvePoster(movie)).toBe(POSTER_PLACEHOLDER)
        },
      ),
      { numRuns: 200 },
    )
  })
})
