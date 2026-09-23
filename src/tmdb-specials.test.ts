import { describe, expect, it, vi } from 'vitest'
import {
  fetchTmdbSeasonEpisodes,
  fetchTmdbTvSeasons,
} from '../api/_lib/tmdb-episodes-core'
import { buildVidRiftUrl } from './tmdb'
import type { Movie } from './omdb'
import tmdbEpisodesHandler from '../api/tmdb-episodes'

declare const process: { env: Record<string, string | undefined> }

describe('TMDB TV Specials (Season 0) integration', () => {
  it('includes Season 0 (Specials) in fetchTmdbTvSeasons and places it after regular seasons', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        seasons: [
          { season_number: 0, episode_count: 15, name: 'Specials' },
          { season_number: 1, episode_count: 12, name: 'Season 1' },
          { season_number: 2, episode_count: 8, name: 'Season 2' },
        ],
      }),
    }) as unknown as typeof fetch

    try {
      const authChain = [{ name: 'primary', apiKey: 'test-key' }]
      const seasons = await fetchTmdbTvSeasons(authChain, 262838)

      expect(seasons).toHaveLength(3)
      // Regular seasons should come first
      expect(seasons[0]).toEqual({ season: 1, episodeCount: 12, name: 'Season 1' })
      expect(seasons[1]).toEqual({ season: 2, episodeCount: 8, name: 'Season 2' })
      // Specials (Season 0) should be at the end
      expect(seasons[2]).toEqual({ season: 0, episodeCount: 15, name: 'Specials' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('fetches Season 0 episodes via fetchTmdbSeasonEpisodes without coercing 0 to 1', async () => {
    let requestedUrl = ''
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation((url: URL | string) => {
      requestedUrl = url.toString()
      return Promise.resolve({
        ok: true,
        json: async () => ({
          episodes: [
            {
              episode_number: 1,
              name: 'Ep 1-3 Deleted Moments',
              overview: 'Deleted moments from episodes 1 to 3',
              runtime: 42,
              air_date: '2024-08-12',
            },
          ],
        }),
      })
    }) as unknown as typeof fetch

    try {
      const authChain = [{ name: 'primary', apiKey: 'test-key' }]
      const episodes = await fetchTmdbSeasonEpisodes(authChain, 262838, 0)

      expect(requestedUrl).toContain('/tv/262838/season/0')
      expect(episodes).toHaveLength(1)
      expect(episodes[0].number).toBe(1)
      expect(episodes[0].name).toBe('Ep 1-3 Deleted Moments')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('builds valid TV stream URL for special episodes with streamSeason = 0', () => {
    const showWithSpecial: Movie = {
      id: 'tv-262838',
      tmdbId: 262838,
      tmdbType: 'tv',
      type: 'series',
      streamSeason: 0,
      streamEpisode: 3,
      rank: 1,
      title: "India's Got Latent",
      logoTitle: "India's Got Latent",
      label: 'Series',
      genres: ['Comedy'],
      year: '2024',
      runtime: '60 min',
      rating: '8.9',
      maturity: 'TV-14',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'Comedy talent show.',
      cast: [],
      director: '',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildVidRiftUrl(showWithSpecial)
    expect(url).toContain('/embed/tv/262838/0/3')
  })

  it('preserves season=0 in api/tmdb-episodes handler', async () => {
    const originalFetch = globalThis.fetch
    const requestedUrls: string[] = []
    globalThis.fetch = vi.fn().mockImplementation((url: URL | string) => {
      requestedUrls.push(url.toString())
      return Promise.resolve({
        ok: true,
        json: async () => ({
          episodes: [{ episode_number: 1, name: 'Special Ep 1' }],
        }),
      })
    }) as unknown as typeof fetch

    try {
      process.env.TMDB_API_KEY = 'test-key'
      let jsonResult: unknown = null
      let statusCode = 0

      const req = {
        method: 'GET',
        query: { tmdbId: '999999', season: '0' },
      }
      const res = {
        setHeader: vi.fn(),
        status: (code: number) => {
          statusCode = code
          return res
        },
        json: (body: unknown) => {
          jsonResult = body
        },
      }

      await tmdbEpisodesHandler(req as any, res as any)

      expect(statusCode).toBe(200)
      expect(requestedUrls.some((u) => u.includes('/tv/999999/season/0'))).toBe(true)
      expect((jsonResult as any).Response).toBe('True')
      expect((jsonResult as any).episodes).toHaveLength(1)
    } finally {
      globalThis.fetch = originalFetch
      delete process.env.TMDB_API_KEY
    }
  })
})
