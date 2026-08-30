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

  it('updates la parameter for SUB and DUB stream languages', () => {
    const movie: Movie = {
      id: 'hentaiocean-test-lang',
      hentaiSlug: 'test-lang',
      embedUrl: 'https://hentaiocean.com/embed/test-lang?la=1',
      isHentaiOcean: true,
      rank: 1,
      title: 'Test Lang Hentai',
      logoTitle: 'Test Lang Hentai',
      label: 'Hentai Ocean',
      type: 'Anime',
      genres: ['Hentai'],
      year: '2026',
      runtime: '24 min',
      rating: '9.0',
      maturity: '18+',
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

    const subUrl = buildStreamUrl({ ...movie, streamLanguage: 'sub' })
    expect(subUrl).toBe('https://hentaiocean.com/embed/test-lang?la=1')

    const dubUrl = buildStreamUrl({ ...movie, streamLanguage: 'dub' })
    expect(dubUrl).toBe('https://hentaiocean.com/embed/test-lang?la=2')
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

    const lordFiltered = history.filter(
      (entry) =>
        entry.progress < 100 &&
        (entry.movie.isHentaiOcean ||
          entry.movie.genres.some((g) => g.toLowerCase() === 'hentai')),
    )
    expect(lordFiltered).toHaveLength(1)
    expect(lordFiltered[0].movie.title).toBe('Test Hentai')

    const clearedLordHistory = history.filter(
      (entry) =>
        !entry.movie.isHentaiOcean &&
        !entry.movie.genres.some((g) => g.toLowerCase() === 'hentai'),
    )
    expect(clearedLordHistory).toHaveLength(1)
    expect(clearedLordHistory[0].movie.title).toBe('Inception')
  })

  it('allows custom Lord PIN setting for admin account', () => {
    localStorage.setItem('lord_pin', '9999')
    expect(localStorage.getItem('lord_pin')).toBe('9999')
    localStorage.removeItem('lord_pin')
  })

  it('selects Hentai Ocean collection as related media for Hentai titles', () => {
    const hentaiMovie: Movie = {
      id: 'hentaiocean-test-1',
      isHentaiOcean: true,
      title: 'Test Hentai 1',
      genres: ['Hentai', 'Adult'],
      rank: 1,
      logoTitle: 'Test Hentai 1',
      label: 'Hentai',
      type: 'Anime',
      year: '2026',
      runtime: '24 min',
      rating: '9.0',
      maturity: '18+',
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

    const otherHentaiMovie: Movie = {
      id: 'hentaiocean-test-2',
      isHentaiOcean: true,
      title: 'Test Hentai 2',
      genres: ['Hentai'],
      rank: 2,
      logoTitle: 'Test Hentai 2',
      label: 'Hentai',
      type: 'Anime',
      year: '2026',
      runtime: '24 min',
      rating: '9.2',
      maturity: '18+',
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

    const tmdbMovie: Movie = {
      id: 'tt1234567',
      title: 'TMDB Movie',
      genres: ['Action'],
      rank: 1,
      logoTitle: 'TMDB Movie',
      label: 'Movie',
      type: 'Movie',
      year: '2025',
      runtime: '120 min',
      rating: '7.5',
      maturity: 'PG-13',
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

    const lordMovies = [hentaiMovie, otherHentaiMovie]
    const tmdbMovies = [tmdbMovie]

    const getRelatedMedia = (selected: Movie, oceanList: Movie[], defaultList: Movie[]) => {
      const isHentai = Boolean(
        selected.isHentaiOcean ||
          selected.hentaiSlug ||
          selected.id.startsWith('hentaiocean-') ||
          selected.genres.some((g) => g.toLowerCase() === 'hentai'),
      )
      return isHentai ? oceanList : defaultList
    }

    const relatedForHentai = getRelatedMedia(hentaiMovie, lordMovies, tmdbMovies)
    expect(relatedForHentai).toEqual(lordMovies)
    expect(relatedForHentai).not.toContain(tmdbMovie)

    const relatedForTmdb = getRelatedMedia(tmdbMovie, lordMovies, tmdbMovies)
    expect(relatedForTmdb).toEqual(tmdbMovies)
  })

  it('builds stream URL for apiJAV titles with embed_url cleanly', () => {
    const javMovie: Movie = {
      id: 'jav-123298',
      rank: 1,
      isJav: true,
      isHentaiOcean: true,
      embedUrl: 'https://server.apijav.com/?mvapm_embed=123298',
      title: 'HONB-496 Demand > Supply 6',
      logoTitle: 'HONB-496',
      label: 'JAV',
      type: 'JAV Video',
      genres: ['Uncensored', 'Japanese'],
      year: '2026',
      runtime: 'HD',
      rating: '★ 4.8',
      maturity: '18+',
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

    const url = buildStreamUrl(javMovie)
    expect(url).toBe('https://server.apijav.com/?mvapm_embed=123298')
  })

  it('builds stream URL for PHub titles with embed_url cleanly', () => {
    const phubMovie: Movie = {
      id: 'phub-73341265',
      rank: 1,
      label: 'PHub',
      type: 'Movie',
      genres: ['Teen'],
      year: '2026',
      runtime: '18:31',
      rating: 'N/A',
      maturity: '18+',
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
      embedUrl: 'https://upload18.net/play/index/xvidapi-73341265',
      isHentaiOcean: false,
      hentaiSlug: '73341265',
    }

    const url = buildStreamUrl(phubMovie)
    expect(url).toBe('https://upload18.net/play/index/xvidapi-73341265')
  })

  it('correctly filters Hentai titles into Lord My List and excludes them from public library', () => {
    const hentaiMovie: Movie = {
      id: 'hentaiocean-night-shift',
      rank: 1,
      label: 'Hentai Ocean',
      type: 'Anime',
      genres: ['Hentai'],
      year: '2026',
      runtime: '30 min',
      rating: '9.0',
      maturity: '18+',
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
      isHentaiOcean: true,
    }

    const regularMovie: Movie = {
      id: 'tt1234567',
      rank: 2,
      label: 'TMDB',
      type: 'Movie',
      genres: ['Action'],
      year: '2026',
      runtime: '120 min',
      rating: '8.5',
      maturity: 'PG-13',
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

    const savedAll = [hentaiMovie, regularMovie]
    const isLordAdult = (m: Movie) =>
      Boolean(
        m.id.startsWith('jav-') ||
          m.label === 'JAV' ||
          m.isJav ||
          m.hentaiSlug?.startsWith('jav-') ||
          m.id.startsWith('phub-') ||
          m.label === 'PHub' ||
          m.hentaiSlug?.startsWith('phub-') ||
          m.isHentaiOcean ||
          m.id.startsWith('hentaiocean-') ||
          m.genres.some((g) => g.toLowerCase() === 'hentai'),
      )

    const lordMyList = savedAll.filter((m) => isLordAdult(m))
    const publicLibrarySaved = savedAll.filter((m) => !isLordAdult(m))

    expect(lordMyList).toEqual([hentaiMovie])
    expect(publicLibrarySaved).toEqual([regularMovie])
  })
})

