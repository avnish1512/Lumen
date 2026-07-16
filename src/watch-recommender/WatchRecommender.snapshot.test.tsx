import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import type { Movie } from '../omdb'
import {
  CategoryPicker,
  RecommendationCard,
  WatchRecommenderEntry,
} from './WatchRecommender'

/**
 * Skin and responsive snapshot tests for the Watch Recommender (Task 6.5).
 *
 * Two concerns are covered here:
 *
 * 1. Skin-class assertions (Requirements 1.3, 1.4, 9.3, 9.4): the entry control,
 *    category picker, and recommendation card must each carry the active skin's
 *    class — `apple-theme` for the Lumen skin, `netflix-theme` for the Anime
 *    skin — mirroring how `App.tsx` applies `app-shell ${designMode}-theme`.
 *
 * 2. Layout snapshots at mobile and desktop breakpoints (Requirements 9.1, 9.2).
 *    NOTE: jsdom does not apply CSS, so it does not evaluate the `@media`
 *    queries that drive the mobile-first → desktop layout adaptation. The
 *    responsive behavior here is entirely CSS-driven — no component reads the
 *    viewport width or subscribes to resize events. These snapshots therefore
 *    capture the DOM structure that the CSS styles against, and we set the
 *    viewport (`window.innerWidth`/`matchMedia` + a `resize` event) before each
 *    breakpoint purely to document intent and to exercise any future JS-driven
 *    responsive logic. The DOM is identical across breakpoints by design; the
 *    visual difference lives in `WatchRecommender.css`.
 */

// A minimal, valid `Movie` for card rendering. Mirrors the `makeMovie` factory
// used in `logic.test.ts`, fixed to a deterministic value so snapshots are
// stable across runs.
function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'snap-1',
    tmdbType: 'movie',
    rank: 1,
    title: 'The Grand Adventure',
    logoTitle: 'The Grand Adventure',
    label: 'Featured',
    type: 'Movie',
    genres: ['Drama', 'Adventure'],
    year: '2024',
    runtime: '120 min',
    rating: '7.5',
    maturity: 'PG',
    progress: 0,
    hero: '',
    poster: 'https://example.test/poster.jpg',
    still: '',
    synopsis: 'A sweeping tale.',
    cast: [],
    director: '',
    awards: '',
    boxOffice: '',
    ratings: [],
    ...overrides,
  }
}

const SKINS = ['apple', 'netflix'] as const
type Skin = (typeof SKINS)[number]

const BREAKPOINTS = [
  { name: 'mobile', width: 390 },
  { name: 'desktop', width: 1280 },
] as const

// Emulate a viewport width. jsdom doesn't apply CSS media queries, but we still
// set the width, provide a matchMedia stub, and dispatch a resize so any
// JS-driven responsive behavior would be exercised (there is none today).
function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const match = /min-width:\s*(\d+)/.exec(query)
      const minWidth = match ? Number(match[1]) : 0
      return {
        matches: width >= minWidth,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList
    },
  })
  window.dispatchEvent(new Event('resize'))
}

const noop = () => {}

afterEach(() => {
  cleanup()
})

// -----------------------------------------------------------------------------
// Skin-class assertions (Requirements 1.3, 1.4, 9.3, 9.4)
// -----------------------------------------------------------------------------

describe('Watch Recommender skin classes', () => {
  it.each(SKINS)(
    'entry control root carries the %s skin class',
    (skin: Skin) => {
      const { container } = render(
        <WatchRecommenderEntry designMode={skin} onOpenDetail={noop} />,
      )

      const root = container.querySelector('.watch-recommender')
      expect(root).not.toBeNull()
      expect(root).toHaveClass('watch-recommender', `${skin}-theme`)
    },
  )

  it.each(SKINS)(
    'category picker carries the %s skin class',
    (skin: Skin) => {
      const { getByTestId } = render(
        <CategoryPicker selected={null} onSelect={noop} designMode={skin} />,
      )

      const picker = getByTestId('wr-picker')
      expect(picker).toHaveClass('wr-picker', `${skin}-theme`)
    },
  )

  it.each(SKINS)(
    'recommendation card carries the %s skin class',
    (skin: Skin) => {
      const { getByTestId } = render(
        <RecommendationCard
          movie={makeMovie()}
          category="movie"
          designMode={skin}
          onOpenDetail={noop}
          onShuffle={noop}
        />,
      )

      const card = getByTestId('wr-card')
      expect(card).toHaveClass('wr-card', `${skin}-theme`)
    },
  )
})

// -----------------------------------------------------------------------------
// Layout snapshots per skin and breakpoint (Requirements 9.1, 9.2)
// -----------------------------------------------------------------------------

describe('Watch Recommender layout snapshots', () => {
  beforeEach(() => {
    // Reset to a mobile-first default before each snapshot; each test then
    // sets its own breakpoint explicitly.
    setViewportWidth(BREAKPOINTS[0].width)
  })

  for (const skin of SKINS) {
    for (const breakpoint of BREAKPOINTS) {
      it(`entry control — ${skin} skin @ ${breakpoint.name}`, () => {
        setViewportWidth(breakpoint.width)
        const { container } = render(
          <WatchRecommenderEntry designMode={skin} onOpenDetail={noop} />,
        )
        expect(container.firstChild).toMatchSnapshot()
      })

      it(`category picker — ${skin} skin @ ${breakpoint.name}`, () => {
        setViewportWidth(breakpoint.width)
        const { container } = render(
          <CategoryPicker
            selected="movie"
            onSelect={noop}
            designMode={skin}
          />,
        )
        expect(container.firstChild).toMatchSnapshot()
      })

      it(`recommendation card — ${skin} skin @ ${breakpoint.name}`, () => {
        setViewportWidth(breakpoint.width)
        const { container } = render(
          <RecommendationCard
            movie={makeMovie()}
            category="movie"
            designMode={skin}
            onOpenDetail={noop}
            onShuffle={noop}
          />,
        )
        expect(container.firstChild).toMatchSnapshot()
      })
    }
  }
})
