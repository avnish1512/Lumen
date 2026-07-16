import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

import type { Movie } from '../omdb'
import type { PoolInputs } from './logic'

/**
 * Integration test for the Watch Recommender state hook (design "Integration
 * Test"; tasks.md 4.5).
 *
 * This exercises the *hook wired to its logic and adapter* — the reducer, the
 * pure pool/selection logic, and the async orchestration — while mocking only
 * the single I/O boundary (`fetchPoolInputs` from `./adapter`). Mocking at the
 * adapter boundary lets each test deterministically drive a resolved-with-pool,
 * resolved-but-empty, or rejected outcome and assert the resulting state-machine
 * transitions:
 *
 *   idle → loading → ready → shuffle        (happy path + shuffle without refetch)
 *   loading → error → retry → ready          (failure then recovery)
 *
 * It also confirms the hook honours the adapter's failure-vs-empty distinction
 * (Req 8.1 vs 8.2) and that `shuffle` never re-invokes the adapter (Req 6.2).
 *
 * The real `PoolFetchError` class is preserved via a partial mock so the hook's
 * `error instanceof PoolFetchError` branch behaves as in production.
 *
 * _Requirements: 2.2, 6.2, 7.1, 7.2, 8.1, 8.2, 8.3_
 */

// Hoisted mock fn so it can be referenced from the (hoisted) vi.mock factory
// and from the test bodies. It stands in for the adapter's single I/O call.
const { fetchPoolInputsMock } = vi.hoisted(() => ({
  fetchPoolInputsMock: vi.fn<(...args: unknown[]) => Promise<PoolInputs>>(),
}))

// Partial mock: keep the real module (crucially the `PoolFetchError` class the
// hook checks with `instanceof`) and swap only `fetchPoolInputs`.
vi.mock('./adapter', async (importActual) => {
  const actual = await importActual<typeof import('./adapter')>()
  return {
    ...actual,
    fetchPoolInputs: fetchPoolInputsMock,
  }
})

import { useWatchRecommender } from './useWatchRecommender'
import { PoolFetchError } from './adapter'

// -----------------------------------------------------------------------------
// Test data helpers
// -----------------------------------------------------------------------------

/** Builds a minimal, valid `Movie`; only `id`/`poster` need to vary here. */
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

const EMPTY_COLLECTION = { top: [], thrilling: [], adventure: [], kidsFamily: [] }

/**
 * Wraps the given movies as `PoolInputs` whose TMDB home rails put them in the
 * movie collection's `top`, so `buildCandidatePool('movie', ...)` yields them.
 */
function movieRailsInputs(movies: Movie[]): PoolInputs {
  return {
    homeRails: {
      featuredMovies: [],
      featuredTvShows: [],
      movieCollection: { ...EMPTY_COLLECTION, top: movies },
      newReleases: [],
      trendingNow: [],
      tvShowCollection: { ...EMPTY_COLLECTION },
    },
  }
}

/** A promise plus its resolve/reject handles, for controlling async timing. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  fetchPoolInputsMock.mockReset()
})

// -----------------------------------------------------------------------------
// Flow: idle → loading → ready → shuffle
// -----------------------------------------------------------------------------

describe('useWatchRecommender integration: idle → loading → ready → shuffle', () => {
  it('starts idle, shows loading during retrieval, then reaches ready with a recommendation', async () => {
    // A deferred lets us observe the `loading` state before retrieval settles.
    const gate = deferred<PoolInputs>()
    fetchPoolInputsMock.mockReturnValue(gate.promise)

    const { result } = renderHook(() => useWatchRecommender())

    // idle: no category, nothing displayed (Req 2.3).
    expect(result.current.state.status).toBe('idle')
    expect(result.current.state.category).toBeNull()
    expect(result.current.state.recommendation).toBeNull()

    // selectCategory → loading immediately (Req 2.2, 7.1); retrieval in flight.
    act(() => {
      result.current.selectCategory('movie')
    })
    expect(result.current.state.status).toBe('loading')
    expect(result.current.state.category).toBe('movie')

    // Settle retrieval with a non-empty pool.
    await act(async () => {
      gate.resolve(movieRailsInputs([makeMovie('a'), makeMovie('b')]))
      await gate.promise
    })

    // ready: loading indicator gone (Req 7.2), a recommendation is shown.
    await waitFor(() => {
      expect(result.current.state.status).toBe('ready')
    })
    expect(result.current.state.recommendation).not.toBeNull()
    expect(result.current.state.pool.length).toBe(2)
    expect(fetchPoolInputsMock).toHaveBeenCalledTimes(1)
  })

  it('shuffle picks a different recommendation, retains the category, and does not re-fetch', async () => {
    fetchPoolInputsMock.mockResolvedValue(
      movieRailsInputs([makeMovie('a'), makeMovie('b')]),
    )

    const { result } = renderHook(() => useWatchRecommender())

    act(() => {
      result.current.selectCategory('movie')
    })
    await waitFor(() => {
      expect(result.current.state.status).toBe('ready')
    })

    const firstPick = result.current.state.recommendation
    expect(firstPick).not.toBeNull()
    expect(fetchPoolInputsMock).toHaveBeenCalledTimes(1)

    // shuffle re-selects from the current pool without re-fetching (Req 6.2).
    act(() => {
      result.current.shuffle()
    })

    expect(result.current.state.status).toBe('ready')
    // Category is retained across shuffle (Req 6.4).
    expect(result.current.state.category).toBe('movie')
    // With two distinct titles, shuffle avoids the current one (Req 6.3).
    expect(result.current.state.recommendation?.id).not.toBe(firstPick?.id)
    // No additional retrieval was triggered by shuffle (Req 6.2).
    expect(fetchPoolInputsMock).toHaveBeenCalledTimes(1)
  })
})

// -----------------------------------------------------------------------------
// Flow: loading → error → retry → ready
// -----------------------------------------------------------------------------

describe('useWatchRecommender integration: loading → error → retry', () => {
  it('enters error on a failed retrieval and recovers to ready on retry without changing category', async () => {
    // First retrieval rejects (transport failure), second succeeds.
    fetchPoolInputsMock
      .mockRejectedValueOnce(new PoolFetchError('Could not reach the source.'))
      .mockResolvedValueOnce(movieRailsInputs([makeMovie('a'), makeMovie('b')]))

    const { result } = renderHook(() => useWatchRecommender())

    act(() => {
      result.current.selectCategory('movie')
    })

    // Failure → error state with a message and the category retained (Req 8.1).
    await waitFor(() => {
      expect(result.current.state.status).toBe('error')
    })
    expect(result.current.state.errorMessage).toBe('Could not reach the source.')
    expect(result.current.state.category).toBe('movie')
    expect(fetchPoolInputsMock).toHaveBeenCalledTimes(1)

    // retry re-runs retrieval for the same category (Req 8.3).
    act(() => {
      result.current.retry()
    })
    await waitFor(() => {
      expect(result.current.state.status).toBe('ready')
    })
    expect(result.current.state.category).toBe('movie')
    expect(result.current.state.recommendation).not.toBeNull()
    expect(result.current.state.errorMessage).toBeNull()
    expect(fetchPoolInputsMock).toHaveBeenCalledTimes(2)
  })
})

// -----------------------------------------------------------------------------
// Adapter failure-vs-empty distinction (Req 8.1 vs 8.2)
// -----------------------------------------------------------------------------

describe('useWatchRecommender integration: failure vs empty distinction', () => {
  it('maps a rejected retrieval to the error state', async () => {
    fetchPoolInputsMock.mockRejectedValue(
      new PoolFetchError('Network unreachable.'),
    )

    const { result } = renderHook(() => useWatchRecommender())

    act(() => {
      result.current.selectCategory('drama')
    })

    await waitFor(() => {
      expect(result.current.state.status).toBe('error')
    })
    expect(result.current.state.errorMessage).toBe('Network unreachable.')
    expect(result.current.state.pool).toHaveLength(0)
  })

  it('maps a successful-but-empty retrieval to the empty state', async () => {
    // Resolves successfully, but the inputs produce no candidate titles.
    fetchPoolInputsMock.mockResolvedValue({})

    const { result } = renderHook(() => useWatchRecommender())

    act(() => {
      result.current.selectCategory('movie')
    })

    await waitFor(() => {
      expect(result.current.state.status).toBe('empty')
    })
    expect(result.current.state.pool).toHaveLength(0)
    expect(result.current.state.recommendation).toBeNull()
    // An empty result is not an error: no error message is surfaced (Req 8.2).
    expect(result.current.state.errorMessage).toBeNull()
  })
})
