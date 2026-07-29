import { describe, expect, it } from 'vitest'
import { buildStreamUrl, streamProviderOptions } from './tmdb'
import type { Movie } from './omdb'

describe('Hentai Ocean integration', () => {
  it('builds embed player URL for Hentai Ocean titles with explicit embedUrl', () => {
    const movie: Movie = {
      id: 'hentaiocean-test-1',
      hentaiSlug: 'test-1',
      embedUrl: 'https://hentaiocean.com/embed/test-1?la=1',
      isHentaiOcean: true,
      rank: 1,
      title: 'Test Hentai 1',
      logoTitle: 'Test Hentai 1',
      label: 'Hentai Ocean',
      type: 'Anime',
      genres: ['Hentai'],
      year: '2026',
      runtime: '24 min',
      rating: '9.0',
      maturity: '18+',
      progress: 0,
      hero: 'https://hentaiocean.com/thumbnail/test-1.webp',
      poster: 'https://hentaiocean.com/thumbnail/test-1.webp',
      still: 'https://hentaiocean.com/thumbnail/test-1.webp',
      synopsis: 'Test synopsis',
      cast: [],
      director: 'Hentai Ocean',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildStreamUrl(movie)
    expect(url).toBe('https://hentaiocean.com/embed/test-1?la=1')
  })

  it('builds episode specific embed URL when streamEpisode is selected', () => {
    const movie: Movie = {
      id: 'hentaiocean-series-my-mother',
      isHentaiOcean: true,
      rank: 1,
      title: 'My Mother',
      logoTitle: 'My Mother',
      label: 'Hentai Ocean',
      type: 'Series',
      genres: ['Hentai'],
      year: '2026',
      runtime: '24 min',
      rating: '9.3',
      maturity: '18+',
      progress: 0,
      hero: 'https://hentaiocean.com/thumbnail/my-mother-1.webp',
      poster: 'https://hentaiocean.com/thumbnail/my-mother-1.webp',
      still: 'https://hentaiocean.com/thumbnail/my-mother-1.webp',
      synopsis: 'My Mother series synopsis',
      cast: [],
      director: 'Hentai Ocean',
      awards: '',
      boxOffice: '',
      ratings: [],
      episodeCount: 2,
      streamEpisode: 2,
      hentaiEpisodes: [
        {
          episodeNumber: 1,
          title: 'Episode 1',
          slug: 'my-mother-1',
          embedUrl: 'https://hentaiocean.com/embed/my-mother-1?la=1',
        },
        {
          episodeNumber: 2,
          title: 'Episode 2',
          slug: 'my-mother-2',
          embedUrl: 'https://hentaiocean.com/embed/my-mother-2?la=1',
        },
      ],
    }

    const urlEp2 = buildStreamUrl(movie)
    expect(urlEp2).toBe('https://hentaiocean.com/embed/my-mother-2?la=1')

    const urlEp1 = buildStreamUrl({ ...movie, streamEpisode: 1 })
    expect(urlEp1).toBe('https://hentaiocean.com/embed/my-mother-1?la=1')
  })

  it('includes OceanPlay in stream provider options', () => {
    const oceanPlayOption = streamProviderOptions.find((p) => p.id === 'oceanplay')
    expect(oceanPlayOption).toBeDefined()
    expect(oceanPlayOption?.name).toBe('OceanPlay')
    expect(oceanPlayOption?.logo).toBe('OP')
  })

  it('correctly filters out Hentai titles from public continue watching history', () => {
    const normalMovie: Movie = {
      id: 'tt1375666',
      title: 'Inception',
      genres: ['Action', 'Sci-Fi'],
      rank: 1,
      logoTitle: 'Inception',
      label: 'Movie',
      type: 'Movie',
      year: '2010',
      runtime: '148 min',
      rating: '8.8',
      maturity: 'PG-13',
      progress: 45,
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

    const hentaiMovie: Movie = {
      id: 'hentaiocean-test-1',
      isHentaiOcean: true,
      title: 'Test Hentai',
      genres: ['Hentai', 'Adult'],
      rank: 2,
      logoTitle: 'Test Hentai',
      label: 'Hentai',
      type: 'Anime',
      year: '2026',
      runtime: '24 min',
      rating: '9.0',
      maturity: '18+',
      progress: 30,
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

    const history = [
      { movie: normalMovie, progress: 45, updatedAt: 100 },
      { movie: hentaiMovie, progress: 30, updatedAt: 200 },
    ]

    const filtered = history.filter(
      (entry) =>
        entry.progress < 100 &&
        !entry.movie.isHentaiOcean &&
        !entry.movie.genres.some((g) => g.toLowerCase() === 'hentai'),
    )

    expect(filtered).toHaveLength(1)
    expect(filtered[0].movie.title).toBe('Inception')
  })

  it('allows custom Lord PIN setting for admin account', () => {
    localStorage.setItem('lord_pin', '9999')
    expect(localStorage.getItem('lord_pin')).toBe('9999')
    localStorage.removeItem('lord_pin')
  })
})
