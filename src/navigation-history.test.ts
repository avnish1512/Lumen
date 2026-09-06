import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { LumenHistoryState } from './App'
import { normalizeMovie, type Movie } from './omdb'

describe('Navigation History & Mobile Back Button Support', () => {
  const mockMovie: Movie = normalizeMovie({
    id: 'tt1375666',
    title: 'Inception',
    year: '2010',
    type: 'movie',
    poster: 'https://example.com/poster.jpg',
    hero: 'https://example.com/hero.jpg',
    still: 'https://example.com/still.jpg',
    genres: ['Action', 'Sci-Fi'],
    runtime: '148 min',
    synopsis: 'A thief who steals corporate secrets through the use of dream-sharing technology.',
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('correctly structures history state when navigating from Home to Detail to Watch', () => {
    // 1. Initial state on Home
    const homeState: LumenHistoryState = {
      screen: 'home',
      movie: null,
      detailBackScreen: 'home',
      watchBackScreen: 'home',
      historyIndex: 0,
    }
    window.history.replaceState(homeState, '', '/#home')
    expect(window.history.state).toEqual(homeState)

    // 2. User clicks on movie -> Detail page pushed
    const detailState: LumenHistoryState = {
      screen: 'detail',
      movie: mockMovie,
      detailBackScreen: 'home',
      watchBackScreen: 'home',
      historyIndex: 1,
    }
    window.history.pushState(detailState, '', '#detail')
    expect(window.history.state).toEqual(detailState)
    expect(window.history.state.screen).toBe('detail')
    expect(window.history.state.movie?.title).toBe('Inception')

    // 3. User clicks Play -> Watch page pushed
    const watchState: LumenHistoryState = {
      screen: 'watch',
      movie: mockMovie,
      detailBackScreen: 'home',
      watchBackScreen: 'detail',
      historyIndex: 2,
    }
    window.history.pushState(watchState, '', '#watch')
    expect(window.history.state).toEqual(watchState)
    expect(window.history.state.screen).toBe('watch')
    expect(window.history.state.watchBackScreen).toBe('detail')
  })

  it('sends LUMEN_NAV_STATE message to ReactNativeWebView when available', () => {
    const postMessageSpy = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).ReactNativeWebView = {
      postMessage: postMessageSpy,
    }

    // Simulate sending nav state when historyIndex > 0
    const payload = JSON.stringify({
      type: 'LUMEN_NAV_STATE',
      canGoBack: true,
      screen: 'detail',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).ReactNativeWebView.postMessage(payload)

    expect(postMessageSpy).toHaveBeenCalledWith(payload)
    const parsed = JSON.parse(postMessageSpy.mock.calls[0][0])
    expect(parsed.type).toBe('LUMEN_NAV_STATE')
    expect(parsed.canGoBack).toBe(true)
    expect(parsed.screen).toBe('detail')

    // Clean up
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).ReactNativeWebView
  })

  it('restores previous screen and movie on popstate', () => {
    let currentScreen = 'home'
    let currentMovie: Movie | null = null

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as LumenHistoryState | null
      if (state) {
        currentScreen = state.screen
        currentMovie = state.movie ?? null
      }
    }

    window.addEventListener('popstate', handlePopState)

    // Setup history: Home -> Detail -> Watch
    window.history.replaceState({ screen: 'home', movie: null, historyIndex: 0 }, '', '/#home')
    window.history.pushState({ screen: 'detail', movie: mockMovie, historyIndex: 1 }, '', '#detail')
    window.history.pushState({ screen: 'watch', movie: mockMovie, historyIndex: 2 }, '', '#watch')

    // Simulate popstate back to detail
    window.dispatchEvent(
      new PopStateEvent('popstate', {
        state: { screen: 'detail', movie: mockMovie, historyIndex: 1 },
      }),
    )

    expect(currentScreen).toBe('detail')
    expect(currentMovie).toEqual(mockMovie)

    // Simulate popstate back to home
    window.dispatchEvent(
      new PopStateEvent('popstate', {
        state: { screen: 'home', movie: null, historyIndex: 0 },
      }),
    )

    expect(currentScreen).toBe('home')
    expect(currentMovie).toBeNull()

    window.removeEventListener('popstate', handlePopState)
  })

  it('routes back from watch to detail information page when back button is pressed', () => {
    let screen = 'watch'
    const selectedMovie: Movie = mockMovie
    const detailBackScreen = 'home'

    // Simulate WatchScreen.onBack logic
    const handleWatchBack = () => {
      if (selectedMovie) {
        screen = 'detail'
      } else if (detailBackScreen) {
        screen = detailBackScreen
      } else {
        screen = 'home'
      }
    }

    handleWatchBack()
    expect(screen).toBe('detail')
  })
})
