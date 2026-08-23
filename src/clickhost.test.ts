import { describe, expect, it } from 'vitest'
import { buildClickHostUrl, buildStreamUrl, streamProviderOptions } from './tmdb'
import type { Movie } from './omdb'

describe('ClickHost anime server integration', () => {
  it('includes ClickHost in streamProviderOptions', () => {
    const clickhostOption = streamProviderOptions.find((p) => p.id === 'clickhost')
    expect(clickhostOption).toBeDefined()
    expect(clickhostOption?.name).toBe('ClickHost')
    expect(clickhostOption?.logo).toBe('CH')
  })

  it('builds valid ClickHost embed URL using tmdbId with season and episode', () => {
    const anime: Movie = {
      id: 'al-37854',
      tmdbId: 37854,
      isAnime: true,
      rank: 1,
      title: 'One Punch Man',
      logoTitle: 'One Punch Man',
      label: 'Anime Series',
      type: 'Series',
      genres: ['Action', 'Comedy'],
      year: '2015',
      runtime: '24 min',
      rating: '8.7',
      maturity: 'TV-14',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'A hero who can defeat any opponent with a single punch.',
      cast: [],
      director: '',
      awards: '',
      boxOffice: '',
      ratings: [],
      streamSeason: 1,
      streamEpisode: 3,
    }

    const url = buildStreamUrl(anime, 'clickhost')
    expect(url).toBe('https://embed-api.clickhost.xyz/embed/anime/37854/1/3')
  })

  it('builds valid ClickHost embed URL using slug/ID fallback when tmdbId is not present', () => {
    const anime: Movie = {
      id: 'one-punch-man',
      isAnime: true,
      rank: 1,
      title: 'One Punch Man',
      logoTitle: 'One Punch Man',
      label: 'Anime Series',
      type: 'Series',
      genres: ['Action'],
      year: '2015',
      runtime: '24 min',
      rating: '8.7',
      maturity: 'TV-14',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: '',
      cast: [],
      director: '',
      awards: '',
      boxOffice: '',
      ratings: [],
      streamSeason: 2,
      streamEpisode: 5,
    }

    const url = buildClickHostUrl(anime)
    expect(url).toBe('https://embed-api.clickhost.xyz/embed/anime/one-punch-man/2/5')
  })

  it('defaults season and episode to 1 if not specified', () => {
    const anime: Movie = {
      id: 'movie-12345',
      tmdbId: 12345,
      isAnime: true,
      rank: 1,
      title: 'Sample Anime',
      logoTitle: 'Sample Anime',
      label: 'Anime Series',
      type: 'Series',
      genres: ['Action'],
      year: '2024',
      runtime: '24 min',
      rating: '8.0',
      maturity: 'TV-14',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: '',
      cast: [],
      director: '',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildClickHostUrl(anime)
    expect(url).toBe('https://embed-api.clickhost.xyz/embed/anime/12345/1/1')
  })

  it('returns empty string if no valid identifier is present', () => {
    const movie: Movie = {
      id: '',
      rank: 1,
      title: 'Unknown Title',
      logoTitle: 'Unknown Title',
      label: 'Movie',
      type: 'Movie',
      genres: [],
      year: '2024',
      runtime: '90 min',
      rating: '7.0',
      maturity: 'PG',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: '',
      cast: [],
      director: '',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildClickHostUrl(movie)
    expect(url).toBe('')
  })
})
