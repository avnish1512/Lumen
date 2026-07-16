import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Movie } from '../omdb'
import type { PoolInputs } from './logic'
import { POSTER_PLACEHOLDER } from './logic'
import { WatchRecommenderEntry } from './WatchRecommender'

/**
 * Component / interaction tests for the Watch Recommender (task 6.4).
 *
 * These tests drive the real components (`WatchRecommenderEntry` → modal →
 * `CategoryPicker` / `RecommendationCard` / state views) and the real hook and
 * pure logic, mocking only the feature's single I/O boundary — the fetch
 * adapter (`./adapter#fetchPoolInputs`). Mocking there guarantees no real
 * network calls are made while letting each test deterministically drive the
 * `ready` / `empty` / `error` outcomes. `PoolFetchError` is kept real so the
 * hook's `instanceof PoolFetchError` message handling exercises production
 * code.
 *
 * `Math.random` is stubbed to `0` so selection/shuffle are deterministic:
 * `selectRecommendation` picks index 0, and `shuffleRecommendation` returns the
 * first alternative that differs from the current pick.
 *
 * Requirements exercised: 1.1, 1.2, 2.1, 2.2, 4.1, 4.2, 4.3, 4.5, 5.1, 5.2,
 * 5.3, 6.1, 7.1, 7.2, 8.1, 8.2, 8.3.
 */

// -----------------------------------------------------------------------------
// Adapter mock (the feature's only I/O boundary — no real network calls)
// -----------------------------------------------------------------------------

const { fetchPoolInputsMock } = vi.hoisted(() => ({
  fetchPoolInputsMock: vi.fn(),
}))

vi.mock('./adapter', async () => {
  const actual = await vi.importActual<typeof import('./adapter')>('./adapter')
  return {
    ...actual,
    // Keep the real `PoolFetchError` (spread above) so the hook's
    // `instanceof PoolFetchError` check keeps working; override only the fetch.
    fetchPoolInputs: (...args: [Parameters<typeof actual.fetchPoolInputs>[0]]) =>
      fetchPoolInputsMock(...args),
  }
})

// Imported after the mock is declared; `PoolFetchError` is the real class.
import { PoolFetchError } from './adapter'

// -----------------------------------------------------------------------------
// Test fixtures
// -----------------------------------------------------------------------------

/** Builds a minimal, valid `Movie`; only the fields under test are meaningful. */
function makeMovie(id: string, overrides: Partial<Movie> = {}): Movie {
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
    ...overrides,
  }
}

/**
 * A controllable promise so a test can assert the transient `loading` view
 * before allowing retrieval to settle.
 */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/**
 * Renders the entry control, opens the modal, and returns the `onOpenDetail`
 * spy plus a configured `userEvent` instance.
 */
async function openModal(designMode: 'apple' | 'netflix' = 'apple') {
  const onOpenDetail = vi.fn()
  const user = userEvent.setup()
  render(
    <WatchRecommenderEntry designMode={designMode} onOpenDetail={onOpenDetail} />,
  )
  await user.click(screen.getByTestId('wr-entry'))
  return { onOpenDetail, user }
}

/** Selects the Drama category (its inputs map straight through to the pool). */
function selectDrama(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getByTestId('wr-category-drama'))
}

beforeEach(() => {
  fetchPoolInputsMock.mockReset()
  // Deterministic selection: index 0, and shuffle picks the first alternative.
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// -----------------------------------------------------------------------------
// Entry control + picker (Requirements 1.1, 1.2, 2.1)
// -----------------------------------------------------------------------------

describe('Entry control and category picker', () => {
  it('renders the entry control with the "don\'t know what to watch" label', () => {
    render(<WatchRecommenderEntry designMode="apple" onOpenDetail={vi.fn()} />)

    const entry = screen.getByTestId('wr-entry')
    expect(entry).toBeInTheDocument()
    // Requirement 1.1: labeled to convey a "don't know what to watch" action.
    expect(entry).toHaveTextContent("I don't know what to watch")
    // The picker is not shown until the entry control is activated.
    expect(screen.queryByTestId('wr-picker')).not.toBeInTheDocument()
  })

  it('opens the picker when the entry control is activated (Req 1.2)', async () => {
    const { user } = { user: userEvent.setup() }
    render(<WatchRecommenderEntry designMode="apple" onOpenDetail={vi.fn()} />)

    await user.click(screen.getByTestId('wr-entry'))

    expect(screen.getByTestId('wr-modal')).toBeInTheDocument()
    expect(screen.getByTestId('wr-picker')).toBeInTheDocument()
  })

  it('renders exactly the four category options (Req 2.1)', async () => {
    const { user } = await openModal()

    const picker = screen.getByTestId('wr-picker')
    const options = within(picker).getAllByRole('button')

    // Exactly four options, in the expected labels.
    expect(options).toHaveLength(4)
    expect(options.map((o) => o.textContent)).toEqual([
      'Movie',
      'TV Show',
      'Anime',
      'Drama',
    ])
    // Each maps to a known category value.
    expect(within(picker).getByTestId('wr-category-movie')).toBeInTheDocument()
    expect(within(picker).getByTestId('wr-category-tv')).toBeInTheDocument()
    expect(within(picker).getByTestId('wr-category-anime')).toBeInTheDocument()
    expect(within(picker).getByTestId('wr-category-drama')).toBeInTheDocument()

    // The picker button count is unaffected by anything else `user` did.
    void user
  })
})

// -----------------------------------------------------------------------------
// Recommendation display (Requirements 2.2, 4.1, 4.2, 4.3, 4.5)
// -----------------------------------------------------------------------------

describe('Recommendation display', () => {
  it('shows a recommendation with poster, title, extra detail, and category label', async () => {
    const movieA = makeMovie('dr-a')
    const movieB = makeMovie('dr-b')
    fetchPoolInputsMock.mockResolvedValue({ dramaList: [movieA, movieB] } satisfies PoolInputs)

    const { user } = await openModal()
    await selectDrama(user)

    const card = await screen.findByTestId('wr-card')

    // Req 4.2: the title (Math.random=0 → index 0 → movieA).
    expect(within(card).getByTestId('wr-card-title')).toHaveTextContent('Title dr-a')
    // Req 4.5: the category label for the recommendation.
    expect(within(card).getByTestId('wr-card-category')).toHaveTextContent('Drama')
    // Req 4.1: the poster image (the movie's own poster here).
    const poster = within(card).getByTestId('wr-card-poster')
    expect(poster).toHaveAttribute('src', 'poster-dr-a')
    // Req 4.3: at least one extra detail (year / genres / rating).
    const meta = within(card).getByTestId('wr-card-meta')
    expect(meta).toHaveTextContent('2024')
    expect(meta).toHaveTextContent('Drama')
    expect(meta).toHaveTextContent('7.5')
  })

  it('falls back to the placeholder image when the poster is missing (Req 4.1/4.4)', async () => {
    const noPoster = makeMovie('dr-x', { poster: '' })
    fetchPoolInputsMock.mockResolvedValue({ dramaList: [noPoster] } satisfies PoolInputs)

    const { user } = await openModal()
    await selectDrama(user)

    const poster = await screen.findByTestId('wr-card-poster')
    expect(poster).toHaveAttribute('src', POSTER_PLACEHOLDER)
    expect(poster).toHaveAttribute('data-placeholder', 'true')
  })
})

// -----------------------------------------------------------------------------
// Acting on the recommendation (Requirements 5.1, 5.2, 5.3)
// -----------------------------------------------------------------------------

describe('Open details', () => {
  it('calls onOpenDetail with the exact recommended Movie object', async () => {
    const movieA = makeMovie('dr-a')
    const movieB = makeMovie('dr-b')
    fetchPoolInputsMock.mockResolvedValue({ dramaList: [movieA, movieB] } satisfies PoolInputs)

    const { onOpenDetail, user } = await openModal()
    await selectDrama(user)

    await screen.findByTestId('wr-card')
    await user.click(screen.getByTestId('wr-open-detail'))

    // Req 5.1/5.2/5.3: the exact Movie object flows to the existing nav flow.
    expect(onOpenDetail).toHaveBeenCalledTimes(1)
    expect(onOpenDetail).toHaveBeenCalledWith(movieA)
    // Referential identity, not just structural equality.
    expect(onOpenDetail.mock.calls[0][0]).toBe(movieA)
  })
})

// -----------------------------------------------------------------------------
// Shuffle (Requirements 6.1, 6.2)
// -----------------------------------------------------------------------------

describe('Shuffle', () => {
  it('re-selects a different title from the current pool without re-fetching', async () => {
    const movieA = makeMovie('dr-a')
    const movieB = makeMovie('dr-b')
    fetchPoolInputsMock.mockResolvedValue({ dramaList: [movieA, movieB] } satisfies PoolInputs)

    const { user } = await openModal()
    await selectDrama(user)

    await screen.findByTestId('wr-card')
    expect(screen.getByTestId('wr-card-title')).toHaveTextContent('Title dr-a')
    expect(fetchPoolInputsMock).toHaveBeenCalledTimes(1)

    await user.click(screen.getByTestId('wr-shuffle'))

    // A different title from the same pool is shown (Req 6.2, 6.3).
    await waitFor(() =>
      expect(screen.getByTestId('wr-card-title')).toHaveTextContent('Title dr-b'),
    )
    // Shuffle must not trigger another fetch (Req 6.2).
    expect(fetchPoolInputsMock).toHaveBeenCalledTimes(1)
  })
})

// -----------------------------------------------------------------------------
// Loading state (Requirements 7.1, 7.2)
// -----------------------------------------------------------------------------

describe('Loading view', () => {
  it('shows the loading indicator during retrieval and removes it on completion', async () => {
    const movieA = makeMovie('dr-a')
    const gate = deferred<PoolInputs>()
    fetchPoolInputsMock.mockReturnValue(gate.promise)

    const { user } = await openModal()
    await selectDrama(user)

    // Req 7.1: loading indicator visible while retrieval is in flight.
    expect(screen.getByTestId('wr-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('wr-card')).not.toBeInTheDocument()

    // Complete retrieval.
    gate.resolve({ dramaList: [movieA] })

    // Req 7.2: loading indicator removed once retrieval completes.
    await screen.findByTestId('wr-card')
    expect(screen.queryByTestId('wr-loading')).not.toBeInTheDocument()
  })
})

// -----------------------------------------------------------------------------
// Empty result (Requirement 8.2)
// -----------------------------------------------------------------------------

describe('Empty view', () => {
  it('shows the empty message when the pool has no titles', async () => {
    fetchPoolInputsMock.mockResolvedValue({ dramaList: [] } satisfies PoolInputs)

    const { user } = await openModal()
    await selectDrama(user)

    const empty = await screen.findByTestId('wr-empty')
    expect(empty).toHaveTextContent(/no recommendation available/i)
    expect(screen.queryByTestId('wr-card')).not.toBeInTheDocument()
  })
})

// -----------------------------------------------------------------------------
// Error + retry (Requirements 8.1, 8.3)
// -----------------------------------------------------------------------------

describe('Error view and retry', () => {
  it('shows an error message with a retry control on fetch failure (Req 8.1)', async () => {
    fetchPoolInputsMock.mockRejectedValue(
      new PoolFetchError('Could not reach the tmdb-drama data source.'),
    )

    const { user } = await openModal()
    await selectDrama(user)

    const error = await screen.findByTestId('wr-error')
    expect(error).toHaveTextContent('Could not reach the tmdb-drama data source.')
    expect(screen.getByTestId('wr-retry')).toBeInTheDocument()
  })

  it('re-fetches the same category when retry is activated (Req 8.3)', async () => {
    const movieA = makeMovie('dr-a')
    fetchPoolInputsMock.mockRejectedValueOnce(new PoolFetchError('Network down'))
    fetchPoolInputsMock.mockResolvedValueOnce({ dramaList: [movieA] } satisfies PoolInputs)

    const { user } = await openModal()
    await selectDrama(user)

    await screen.findByTestId('wr-error')
    expect(fetchPoolInputsMock).toHaveBeenCalledTimes(1)
    expect(fetchPoolInputsMock).toHaveBeenNthCalledWith(1, 'drama')

    await user.click(screen.getByTestId('wr-retry'))

    // Retry re-runs retrieval for the retained category, then succeeds.
    const card = await screen.findByTestId('wr-card')
    expect(within(card).getByTestId('wr-card-title')).toHaveTextContent('Title dr-a')
    expect(fetchPoolInputsMock).toHaveBeenCalledTimes(2)
    expect(fetchPoolInputsMock).toHaveBeenNthCalledWith(2, 'drama')
  })
})
