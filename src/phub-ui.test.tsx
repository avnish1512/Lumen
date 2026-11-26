import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LordScreen,
  formatYtCompactViews,
  formatYtRelativeTime,
} from './App'

describe('PHub 1, PHub 2, PHub 3 naming and YouTube Home UI', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({}),
        }),
      ),
    )
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('formats view counts and relative timestamps in YouTube style', () => {
    expect(formatYtCompactViews(1_300_000)).toBe('1.3M')
    expect(formatYtCompactViews(340_000)).toBe('340K')
    expect(formatYtCompactViews(1_900_000)).toBe('1.9M')
    expect(formatYtCompactViews(2_000_000)).toBe('2M')
    expect(formatYtCompactViews(950)).toBe('950')

    const sixDaysAgo = new Date(Date.now() - 6 * 86_400 * 1000).toISOString()
    expect(formatYtRelativeTime(sixDaysAgo)).toBe('6d ago')
  })

  it('renames AdultEmbed tab to PHub 1 and renders YouTube grid layout across PHub 1, 2, and 3', () => {
    const onPlay = vi.fn()
    const onBack = vi.fn()
    const onToggleSave = vi.fn()

    const { container, rerender } = render(
      <LordScreen
        movies={[]}
        rails={[]}
        loading={false}
        activeTab="adultembed"
        onPlay={onPlay}
        onBack={onBack}
        onToggleSave={onToggleSave}
      />,
    )

    expect(screen.queryByText('AdultEmbed')).not.toBeInTheDocument()
    expect(screen.getAllByText('PHub 1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('PHub 2').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('PHub 3').length).toBeGreaterThanOrEqual(1)

    const root = container.querySelector('.lord-screen')
    expect(root).toHaveClass('is-yt-phub')

    expect(container.querySelector('.lord-hero')).toBeInTheDocument()
    expect(container.querySelector('.yt-chips-scroller')).toBeInTheDocument()
    expect(container.querySelector('.yt-home-grid')).toBeInTheDocument()
    const cards = container.querySelectorAll('.yt-home-card')
    expect(cards.length).toBeGreaterThan(0)
    expect(cards[0].querySelector('.yt-home-thumb-wrap')).toBeInTheDocument()
    expect(cards[0].querySelector('.yt-home-avatar')).toBeInTheDocument()
    expect(cards[0].querySelector('.yt-home-title')).toBeInTheDocument()
    expect(cards[0].querySelector('.yt-home-channel')).toBeInTheDocument()
    expect(cards[0].querySelector('.yt-home-more-btn')).toBeInTheDocument()

    // Open 3-dots menu on the first card and trigger Save to My List
    const moreBtn = cards[0].querySelector('.yt-home-more-btn') as HTMLButtonElement
    fireEvent.click(moreBtn)
    const saveItem = screen.getByRole('menuitem', { name: 'Save to My List' })
    fireEvent.click(saveItem)
    expect(onToggleSave).toHaveBeenCalledTimes(1)

    // Switch to PHub 2 and confirm YouTube Home grid + chips render cleanly
    rerender(
      <LordScreen
        movies={[]}
        rails={[]}
        loading={false}
        activeTab="phub2"
        onPlay={onPlay}
        onBack={onBack}
        onToggleSave={onToggleSave}
      />,
    )
    expect(container.querySelector('.yt-phub-container')).toBeInTheDocument()
    expect(container.querySelectorAll('.yt-home-card').length).toBeGreaterThan(0)

    // Switch to PHub 3 and confirm YouTube Home grid + Indian category chip render cleanly
    rerender(
      <LordScreen
        movies={[]}
        rails={[]}
        loading={false}
        activeTab="phub3"
        onPlay={onPlay}
        onBack={onBack}
        onToggleSave={onToggleSave}
      />,
    )
    expect(container.querySelector('.yt-phub-container')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Indian' })).toBeInTheDocument()
    expect(container.querySelectorAll('.yt-home-card').length).toBeGreaterThan(0)
    const fetchCalls = vi.mocked(fetch).mock.calls.map((args) => String(args[0]))
    expect(fetchCalls.some((url) => url.includes('eporner') && url.includes('query=indian'))).toBe(true)
  })
})
