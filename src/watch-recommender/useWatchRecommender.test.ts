import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

import type { Movie } from '../omdb'
import type { RecommenderState } from './types'
import {
  recommenderReducer,
  initialRecommenderState,
  type RecommenderAction,
} from './useWatchRecommender'

/**
 * Property-based test for the Watch Recommender reducer (design Property 6).
 *
 * The reducer is a pure, deterministic state machine. This test folds an
 * arbitrary sequence of actions through it, starting from
 * `initialRecommenderState`, and asserts the state invariants hold after every
 * single step — not just at the end — so any transient violation is caught.
 *
 * All property tests run a minimum of 100 iterations (fast-check `numRuns`).
 */

// -----------------------------------------------------------------------------
// Arbitraries
// -----------------------------------------------------------------------------

/**
 * Builds a minimal, valid `Movie`. Only `id` needs to vary for reducer
 * invariants (identity/membership); the remaining fields are deterministic
 * defaults so the object satisfies the `Movie` type.
 */
function makeMovie(id: string): Movie {
  return {
    id,
    tmdbType: 'movie',
    rank: 1,
    title: `Title ${id}`,
    logoTitle: `Title ${id}`,
    label: 'Featured',
    type: 'Movie',
    genres: ['Drama'],
    year: '2024',
    runtime: '120 min',
    rating: '7.5',
    maturity: 'PG',
    progress: 0,
    hero: '',
    poster: `poster-${id}`,
    still: '',
    synopsis: 'Synopsis.',
    cast: [],
    director: '',
    awards: '',
    boxOffice: '',
    ratings: [],
  }
}

const movieArb: fc.Arbitrary<Movie> = fc
  .nat({ max: 100_000 })
  .map((n) => makeMovie(`m-${n}`))

/** A non-empty pool of movies with globally-unique ids. */
const nonEmptyPoolArb: fc.Arbitrary<Movie[]> = fc
  .uniqueArray(fc.nat({ max: 100_000 }), { minLength: 1, maxLength: 6 })
  .map((nums) => nums.map((n) => makeMovie(`m-${n}`)))

/**
 * An arbitrary reducer action covering every action shape: the user-driven
 * `selectCategory`/`shuffle`/`retry`/`reset` and the internal
 * `resolved`/`empty`/`failed`. `resolved` always carries a non-empty pool and a
 * concrete recommendation (mirroring the hook, which only dispatches `resolved`
 * with real values). Because actions are generated blindly, many will be
 * out-of-phase (e.g. `shuffle` while not `ready`); the reducer must keep the
 * invariants intact regardless.
 */
const actionArb: fc.Arbitrary<RecommenderAction> = fc.oneof(
  fc
    .constantFrom<'movie' | 'tv' | 'anime' | 'drama'>(
      'movie',
      'tv',
      'anime',
      'drama',
    )
    .map((category) => ({ type: 'selectCategory', category }) as const),
  movieArb.map(
    (recommendation) => ({ type: 'shuffle', recommendation }) as const,
  ),
  fc.constant({ type: 'retry' } as const),
  fc.constant({ type: 'reset' } as const),
  fc
    .record({ pool: nonEmptyPoolArb, pick: fc.nat() })
    .map(
      ({ pool, pick }) =>
        ({
          type: 'resolved',
          pool,
          recommendation: pool[pick % pool.length],
        }) as const,
    ),
  fc.constant({ type: 'empty' } as const),
  fc
    .string({ minLength: 1, maxLength: 20 })
    .map((errorMessage) => ({ type: 'failed', errorMessage }) as const),
)

// -----------------------------------------------------------------------------
// Invariant checks
// -----------------------------------------------------------------------------

/** Asserts every design Property 6 invariant on a single state value. */
function assertInvariants(state: RecommenderState): void {
  // idle iff (category === null and recommendation === null)
  const isIdle = state.status === 'idle'
  const looksIdle = state.category === null && state.recommendation === null
  expect(isIdle).toBe(looksIdle)

  // ready implies recommendation !== null and pool.length >= 1
  if (state.status === 'ready') {
    expect(state.recommendation).not.toBeNull()
    expect(state.pool.length).toBeGreaterThanOrEqual(1)
  }

  // empty implies pool.length === 0
  if (state.status === 'empty') {
    expect(state.pool.length).toBe(0)
  }
}

// -----------------------------------------------------------------------------
// Property 6
// -----------------------------------------------------------------------------

// Feature: watch-recommender, Property 6: Reducer state invariants hold across all actions
describe('Property 6: Reducer state invariants hold across all actions', () => {
  it('preserves all state invariants after every action in any sequence', () => {
    fc.assert(
      fc.property(
        fc.array(actionArb, { minLength: 1, maxLength: 30 }),
        (actions) => {
          // The initial state must itself satisfy the invariants.
          assertInvariants(initialRecommenderState)

          let state = initialRecommenderState
          for (const action of actions) {
            const prev = state
            state = recommenderReducer(state, action)

            // Invariants hold after every single step, not just at the end.
            assertInvariants(state)

            // shuffle and retry never change the category (Req 6.4).
            if (action.type === 'shuffle' || action.type === 'retry') {
              expect(state.category).toBe(prev.category)
            }
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
