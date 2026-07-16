import type { Movie } from '../omdb'
import type { Category, RecommenderState } from './types'

/**
 * Watch Recommender — state hook module.
 *
 * This file is built up across tasks. It currently holds the pure reducer, the
 * action types, and the initial state (task 4.1). The `useWatchRecommender`
 * hook (task 4.4) is appended below the reducer, and it dispatches the actions
 * defined here after driving the fetch adapter (task 4.3, separate file).
 *
 * The reducer is a pure, deterministic function of `(state, action)`. All
 * randomness (recommendation selection / shuffle) lives in the hook, which
 * computes the concrete `Movie` values and hands them to the reducer via the
 * `resolved`/`shuffle` actions. This keeps the reducer free of I/O and RNG so
 * it can be unit- and property-tested in isolation (design Property 6).
 */

// -----------------------------------------------------------------------------
// Actions (Requirements 2.2, 2.3, 6.4, 7.1, 8.2)
// -----------------------------------------------------------------------------

/**
 * Actions accepted by the recommender reducer.
 *
 * User-driven actions:
 * - `selectCategory`: the viewer picks a category; begins retrieval (Req 2.2).
 * - `shuffle`: re-select from the current pool without re-fetching (Req 6.2);
 *   carries the already-computed replacement so the reducer stays RNG-free.
 * - `retry`: re-run retrieval for the retained category (Req 8.3).
 * - `reset`: return to `idle` (e.g. the picker is closed) (Req 2.3).
 *
 * Internal fetch-resolution actions (dispatched by the hook once a retrieval
 * settles; only meaningful while `loading`):
 * - `resolved`: retrieval produced a non-empty pool and a picked title (Req 2.2).
 * - `empty`: retrieval succeeded but the pool was empty (Req 8.2).
 * - `failed`: retrieval failed at the transport level (Req 8.1).
 */
export type RecommenderAction =
  | { type: 'selectCategory'; category: Category }
  | { type: 'shuffle'; recommendation: Movie }
  | { type: 'retry' }
  | { type: 'reset' }
  | { type: 'resolved'; pool: Movie[]; recommendation: Movie }
  | { type: 'empty' }
  | { type: 'failed'; errorMessage: string }

// -----------------------------------------------------------------------------
// Initial state
// -----------------------------------------------------------------------------

/**
 * The initial reducer state: `idle`, with no category, empty pool, no
 * recommendation, and no error. Satisfies the `idle` invariant
 * (`category === null` and `recommendation === null`) (Req 2.3).
 */
export const initialRecommenderState: RecommenderState = {
  status: 'idle',
  category: null,
  pool: [],
  recommendation: null,
  errorMessage: null,
}

// -----------------------------------------------------------------------------
// Reducer (state machine)
// -----------------------------------------------------------------------------

/**
 * Pure reducer implementing the recommender state machine:
 *
 *   idle ──selectCategory──▶ loading ──resolved──▶ ready
 *                                     ──empty────▶ empty
 *                                     ──failed───▶ error
 *   ready ──shuffle──▶ ready        (new pick, same category & pool)
 *   ready/empty/error ──selectCategory──▶ loading   (supersedes)
 *   empty/error ──retry──▶ loading  (same category)
 *   any ──reset──▶ idle
 *
 * Invariants enforced here (design "Data Models" / Property 6):
 * - `status === 'idle'` iff `category === null` and `recommendation === null`.
 * - `status === 'ready'` implies `recommendation !== null` and `pool.length >= 1`.
 * - `status === 'empty'` implies `pool.length === 0`.
 * - `shuffle` and `retry` never change `category` (Req 6.4).
 *
 * Unknown or out-of-phase actions (e.g. a fetch-resolution action arriving when
 * not `loading`, or `shuffle` when not `ready`) leave the state unchanged.
 */
export function recommenderReducer(
  state: RecommenderState,
  action: RecommenderAction,
): RecommenderState {
  switch (action.type) {
    // A viewer picks a category. Valid from any status; a new selection
    // supersedes an in-flight or terminal one. Enters `loading` and clears any
    // prior pool/recommendation/error so invariants for the new phase hold.
    case 'selectCategory':
      return {
        status: 'loading',
        category: action.category,
        pool: [],
        recommendation: null,
        errorMessage: null,
      }

    // Re-select within the current pool. Only meaningful while `ready`; keeps
    // the same `category` and `pool` and swaps in the new recommendation. The
    // replacement is precomputed by the hook and is a member of the pool, so
    // the `ready` invariant (recommendation !== null, pool.length >= 1) holds.
    case 'shuffle':
      if (state.status !== 'ready') {
        return state
      }
      return {
        ...state,
        recommendation: action.recommendation,
      }

    // Re-run retrieval for the retained category. Valid from the terminal
    // failure/empty states; never changes `category` (Req 6.4).
    case 'retry':
      if (
        state.category === null ||
        (state.status !== 'error' && state.status !== 'empty')
      ) {
        return state
      }
      return {
        status: 'loading',
        category: state.category,
        pool: [],
        recommendation: null,
        errorMessage: null,
      }

    // Return to the initial idle state (e.g. the picker/modal is closed).
    case 'reset':
      return initialRecommenderState

    // Retrieval settled with a usable pool and a chosen title. Only applied
    // while `loading`. Guards the `ready` invariant: an empty pool or missing
    // recommendation degrades to `empty` rather than an invalid `ready`.
    case 'resolved':
      if (state.status !== 'loading') {
        return state
      }
      if (action.pool.length === 0 || action.recommendation === null) {
        return {
          ...state,
          status: 'empty',
          pool: [],
          recommendation: null,
          errorMessage: null,
        }
      }
      return {
        ...state,
        status: 'ready',
        pool: action.pool,
        recommendation: action.recommendation,
        errorMessage: null,
      }

    // Retrieval succeeded but produced no titles. Only applied while `loading`.
    // Enforces the `empty` invariant (`pool.length === 0`).
    case 'empty':
      if (state.status !== 'loading') {
        return state
      }
      return {
        ...state,
        status: 'empty',
        pool: [],
        recommendation: null,
        errorMessage: null,
      }

    // Retrieval failed at the transport level. Only applied while `loading`.
    // Retains `category` so `retry` can re-run the same request (Req 8.3).
    case 'failed':
      if (state.status !== 'loading') {
        return state
      }
      return {
        ...state,
        status: 'error',
        pool: [],
        recommendation: null,
        errorMessage: action.errorMessage,
      }

    default:
      return state
  }
}

// -----------------------------------------------------------------------------
// State hook (Requirements 2.2, 6.2, 6.4, 7.1, 7.2, 8.1, 8.3)
// -----------------------------------------------------------------------------

import { useCallback, useReducer, useRef } from 'react'
import {
  buildCandidatePool,
  selectRecommendation,
  shuffleRecommendation,
} from './logic'
import { fetchPoolInputs, PoolFetchError } from './adapter'

/**
 * Public surface of the recommender hook (design "State Hook"). Exposes the
 * current `state` plus the four viewer-facing actions.
 */
export interface UseWatchRecommender {
  state: RecommenderState
  selectCategory: (category: Category) => void
  shuffle: () => void
  retry: () => void
  reset: () => void
}

/**
 * Fallback error message used when a rejection is not a `PoolFetchError` (i.e.
 * an unexpected failure without a human-readable message of its own).
 */
const GENERIC_ERROR_MESSAGE =
  'Something went wrong while finding a recommendation. Please try again.'

/**
 * `useWatchRecommender` — orchestrates asynchronous candidate retrieval and the
 * recommender state machine (see `recommenderReducer` above).
 *
 * Exposes the four viewer-facing actions plus the current `state`:
 * - `selectCategory(category)`: enter `loading`, fetch the category's pool via
 *   the adapter, build the pool, pick a recommendation, and settle into
 *   `ready` / `empty` / `error` (Req 2.2, 7.1, 7.2, 8.1).
 * - `shuffle()`: re-select from the *current* pool without re-fetching, keeping
 *   the same category (Req 6.2, 6.4).
 * - `retry()`: re-run retrieval for the retained category (Req 8.3).
 * - `reset()`: return to `idle`.
 *
 * Stale-response guard: every retrieval-initiating action bumps a monotonic
 * request id (`requestIdRef`). When an async retrieval settles, its result is
 * applied only if its captured id still matches the latest one; a newer
 * `selectCategory`/`retry` therefore supersedes any in-flight request and
 * prevents a slow earlier fetch from overwriting a newer recommendation. This
 * mirrors the `selectedMovieIdRef` guard used in `App.tsx`.
 */
export function useWatchRecommender(): UseWatchRecommender {
  const [state, dispatch] = useReducer(
    recommenderReducer,
    initialRecommenderState,
  )

  // Monotonic id identifying the most recently initiated retrieval. Bumped on
  // every `selectCategory`/`retry`; async results compare against it to detect
  // (and discard) stale responses.
  const requestIdRef = useRef(0)

  // Mirror of the latest state so the memoized `shuffle`/`retry` callbacks can
  // read the current pool/recommendation/category without being re-created on
  // every state change (avoids stale closures while keeping stable references).
  const stateRef = useRef(state)
  stateRef.current = state

  // Shared retrieval routine used by both `selectCategory` and `retry`. It runs
  // the adapter for the given category, builds the pool, selects a
  // recommendation, and dispatches the matching resolution action — but only if
  // its `requestId` is still the latest (otherwise the response is stale and is
  // dropped).
  const runFetch = useCallback((category: Category, requestId: number) => {
    fetchPoolInputs(category)
      .then((inputs) => {
        if (requestIdRef.current !== requestId) {
          return
        }
        const pool = buildCandidatePool(category, inputs)
        const recommendation = selectRecommendation(pool)
        if (pool.length === 0 || recommendation === null) {
          dispatch({ type: 'empty' })
          return
        }
        dispatch({ type: 'resolved', pool, recommendation })
      })
      .catch((error: unknown) => {
        if (requestIdRef.current !== requestId) {
          return
        }
        const errorMessage =
          error instanceof PoolFetchError && error.message
            ? error.message
            : GENERIC_ERROR_MESSAGE
        dispatch({ type: 'failed', errorMessage })
      })
  }, [])

  // The viewer picks a category: enter `loading` immediately (loading indicator
  // — Req 7.1), then kick off retrieval under a fresh request id so any earlier
  // in-flight fetch is superseded (Req 2.2).
  const selectCategory = useCallback(
    (category: Category) => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      dispatch({ type: 'selectCategory', category })
      runFetch(category, requestId)
    },
    [runFetch],
  )

  // Re-select from the current pool without re-fetching, retaining the category
  // (Req 6.2, 6.4). No-op unless a recommendation is currently displayed; the
  // reducer also guards `shuffle` to the `ready` status.
  const shuffle = useCallback(() => {
    const { status, pool, recommendation } = stateRef.current
    if (status !== 'ready') {
      return
    }
    const next = shuffleRecommendation(pool, recommendation)
    if (next === null) {
      return
    }
    dispatch({ type: 'shuffle', recommendation: next })
  }, [])

  // Re-run retrieval for the retained category (Req 8.3). Only meaningful from a
  // terminal `error`/`empty` state; bumps the request id so it too supersedes
  // any straggling response.
  const retry = useCallback(() => {
    const { category } = stateRef.current
    if (category === null) {
      return
    }
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    dispatch({ type: 'retry' })
    runFetch(category, requestId)
  }, [runFetch])

  // Return to `idle` (e.g. the picker/modal is closed). Invalidate any in-flight
  // retrieval so a late response cannot resurrect a recommendation after reset.
  const reset = useCallback(() => {
    requestIdRef.current += 1
    dispatch({ type: 'reset' })
  }, [])

  return { state, selectCategory, shuffle, retry, reset }
}
