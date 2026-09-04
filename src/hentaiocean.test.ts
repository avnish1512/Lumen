import { describe, expect, it } from 'vitest'
import { buildStreamUrl, streamProviderOptions } from './tmdb'
import type { Movie } from './omdb'
import { isPhubMovie, isPhub1Movie, isPhub2Movie, isPhub3Movie, isJavMovie, isHentaiMovie, isLordAdultMovie } from './App'

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

  it('correctly resolves stream URL for porn-api / sex-api embed in PHub titles', () => {
    const phubMovie: Movie = {
      id: 'phub-adara-jordin-blonde-yoga-masturbation-joi',
      title: 'Adara Jordin Blonde Yoga',
      logoTitle: 'Adara Jordin Blonde Yoga',
      rank: 1,
      label: 'PHub',
      type: 'PHub Video',
      genres: ['Amateur', 'MILF'],
      year: '2026',
      runtime: '00:10:06',
      rating: '★ 4.9',
      maturity: '18+',
      progress: 0,
      hero: 'https://porn-api.com/public/images/poster.webp',
      poster: 'https://porn-api.com/public/images/poster.webp',
      still: 'https://porn-api.com/public/images/thumb.webp',
      synopsis: 'Blonde beauty',
      cast: ['Adara Jordin'],
      director: 'PHub',
      awards: 'HD',
      boxOffice: '34,530 views',
      ratings: [],
      embedUrl: 'https://sex-api.com/embed/play/386U_HxPOYceabLx',
      isHentaiOcean: false,
      hentaiSlug: 'phub-adara-jordin-blonde-yoga-masturbation-joi',
    }

    const url = buildStreamUrl(phubMovie)
    expect(url).toBe('https://sex-api.com/embed/play/386U_HxPOYceabLx')
  })

  it('correctly resolves stream URL for legacy upload18 embed in PHub titles', () => {
    const phubMovie: Movie = {
      id: 'phub-73341265',
      title: '18 Year Old Latina Beauty',
      logoTitle: '18 Year Old Latina Beauty',
      rank: 1,
      label: 'PHub',
      type: 'Movie',
      genres: ['Teen'],
      year: '2026',
      runtime: '20:00',
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
      title: 'Night Shift Nurses',
      logoTitle: 'Night Shift Nurses',
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
      title: 'Action Movie',
      logoTitle: 'Action Movie',
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

  it('correctly isolates continue watching history so Lord content only appears on Lord page', () => {
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

    const phubMovie: Movie = {
      id: 'phub-blonde-yoga-joi',
      title: 'PHub Video 1',
      label: 'PHub',
      type: 'PHub Video',
      genres: ['PHub', '4K Ultra HD'],
      rank: 3,
      logoTitle: '4K',
      year: '2026',
      runtime: '15 min',
      rating: '★ 4.9',
      maturity: '18+',
      progress: 20,
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

    const javMovie: Movie = {
      id: 'jav-998877',
      isJav: true,
      title: 'JAV Video 1',
      label: 'JAV',
      type: 'JAV Video',
      genres: ['JAV', 'Uncensored'],
      rank: 4,
      logoTitle: 'JAV',
      year: '2026',
      runtime: '120 min',
      rating: '★ 4.8',
      maturity: '18+',
      progress: 50,
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

    expect(isLordAdultMovie(normalMovie)).toBe(false)
    expect(isLordAdultMovie(hentaiMovie)).toBe(true)
    expect(isLordAdultMovie(phubMovie)).toBe(true)
    expect(isLordAdultMovie(javMovie)).toBe(true)

    expect(isPhubMovie(phubMovie)).toBe(true)
    expect(isPhubMovie(javMovie)).toBe(false)
    expect(isPhubMovie(normalMovie)).toBe(false)

    expect(isJavMovie(javMovie)).toBe(true)
    expect(isJavMovie(phubMovie)).toBe(false)
    expect(isJavMovie(normalMovie)).toBe(false)

    expect(isHentaiMovie(hentaiMovie)).toBe(true)
    expect(isHentaiMovie(phubMovie)).toBe(false)
    expect(isHentaiMovie(javMovie)).toBe(false)

    const history = [
      { movie: normalMovie, progress: 45, updatedAt: 100 },
      { movie: hentaiMovie, progress: 30, updatedAt: 200 },
      { movie: phubMovie, progress: 20, updatedAt: 300 },
      { movie: javMovie, progress: 50, updatedAt: 400 },
    ]

    // Public continue watching (Apple TV / Netflix clone)
    const publicContinueWatching = history
      .filter((entry) => entry.progress < 100 && !isLordAdultMovie(entry.movie))
      .map((entry) => entry.movie)

    expect(publicContinueWatching).toHaveLength(1)
    expect(publicContinueWatching[0].title).toBe('Inception')

    // PHub continue watching
    const phubContinueWatching = history
      .filter((entry) => entry.progress < 100 && isPhubMovie(entry.movie))
      .map((entry) => entry.movie)

    expect(phubContinueWatching).toHaveLength(1)
    expect(phubContinueWatching[0].title).toBe('PHub Video 1')

    // JAV continue watching
    const javContinueWatching = history
      .filter((entry) => entry.progress < 100 && isJavMovie(entry.movie))
      .map((entry) => entry.movie)

    expect(javContinueWatching).toHaveLength(1)
    expect(javContinueWatching[0].title).toBe('JAV Video 1')

    // Lord collection (Hentai) continue watching
    const lordContinueWatching = history
      .filter((entry) => entry.progress < 100 && isHentaiMovie(entry.movie))
      .map((entry) => entry.movie)

    expect(lordContinueWatching).toHaveLength(1)
    expect(lordContinueWatching[0].title).toBe('Test Hentai')
  })

  it('strictly isolates Continue Watching between PHub 1, PHub 2, PHub 3, JAV, and Hentai', () => {
    const phub1Movie: Movie = {
      id: 'phub-video-1',
      title: 'PHub 1 Video',
      label: 'PHub',
      type: 'PHub Video',
      genres: ['PHub'],
      rank: 1,
      logoTitle: '4K',
      year: '2026',
      runtime: '15 min',
      rating: '4.8',
      maturity: '18+',
      progress: 40,
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

    const phub2Movie: Movie = {
      id: 'phub2-video-2',
      title: 'PHub 2 Video',
      label: 'PHub 2',
      type: 'PHub Video',
      genres: ['PHub'],
      rank: 2,
      logoTitle: 'HD',
      year: '2026',
      runtime: '20 min',
      rating: '4.7',
      maturity: '18+',
      progress: 60,
      hero: '',
      poster: '',
      still: '',
      synopsis: '',
      cast: [],
      director: '',
      awards: '',
      boxOffice: '',
      ratings: [],
      embedUrl: 'https://upload18.net/play/index/xvidapi-video-2',
    }

    const phub3Movie: Movie = {
      id: 'phub3-video-3',
      title: 'PHub 3 Video',
      label: 'PHub 3',
      type: 'PHub Video',
      genres: ['PHub'],
      rank: 3,
      logoTitle: 'HD',
      year: '2026',
      runtime: '25 min',
      rating: '4.9',
      maturity: '18+',
      progress: 75,
      hero: '',
      poster: '',
      still: '',
      synopsis: '',
      cast: [],
      director: '',
      awards: '',
      boxOffice: '',
      ratings: [],
      embedUrl: 'https://www.eporner.com/embed/video-3/',
    }

    const javMovie: Movie = {
      id: 'jav-video-4',
      title: 'JAV Video',
      label: 'JAV',
      isJav: true,
      genres: ['JAV'],
      rank: 4,
      logoTitle: 'JAV',
      type: 'JAV Video',
      year: '2026',
      runtime: '120 min',
      rating: '5.0',
      maturity: '18+',
      progress: 50,
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
      id: 'hentaiocean-video-5',
      title: 'Hentai Video',
      label: 'Hentai Ocean',
      isHentaiOcean: true,
      genres: ['Hentai'],
      rank: 5,
      logoTitle: 'Hentai',
      type: 'Anime',
      year: '2026',
      runtime: '30 min',
      rating: '9.2',
      maturity: '18+',
      progress: 80,
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

    // Helper checks
    expect(isPhub1Movie(phub1Movie)).toBe(true)
    expect(isPhub1Movie(phub2Movie)).toBe(false)
    expect(isPhub1Movie(phub3Movie)).toBe(false)
    expect(isPhub1Movie(javMovie)).toBe(false)
    expect(isPhub1Movie(hentaiMovie)).toBe(false)

    expect(isPhub2Movie(phub2Movie)).toBe(true)
    expect(isPhub2Movie(phub1Movie)).toBe(false)
    expect(isPhub2Movie(phub3Movie)).toBe(false)
    expect(isPhub2Movie(javMovie)).toBe(false)

    expect(isPhub3Movie(phub3Movie)).toBe(true)
    expect(isPhub3Movie(phub1Movie)).toBe(false)
    expect(isPhub3Movie(phub2Movie)).toBe(false)
    expect(isPhub3Movie(javMovie)).toBe(false)

    expect(isJavMovie(javMovie)).toBe(true)
    expect(isJavMovie(phub1Movie)).toBe(false)
    expect(isJavMovie(phub2Movie)).toBe(false)
    expect(isJavMovie(phub3Movie)).toBe(false)

    expect(isHentaiMovie(hentaiMovie)).toBe(true)
    expect(isHentaiMovie(phub1Movie)).toBe(false)
    expect(isHentaiMovie(phub2Movie)).toBe(false)
    expect(isHentaiMovie(phub3Movie)).toBe(false)
    expect(isHentaiMovie(javMovie)).toBe(false)

    const allHistory = [
      { movie: phub1Movie, progress: 40, updatedAt: 1 },
      { movie: phub2Movie, progress: 60, updatedAt: 2 },
      { movie: phub3Movie, progress: 75, updatedAt: 3 },
      { movie: javMovie, progress: 50, updatedAt: 4 },
      { movie: hentaiMovie, progress: 80, updatedAt: 5 },
    ]

    // Verify PHub 1 only contains PHub 1
    const phub1List = allHistory.filter((e) => isPhub1Movie(e.movie)).map((e) => e.movie)
    expect(phub1List).toEqual([phub1Movie])

    // Verify PHub 2 only contains PHub 2
    const phub2List = allHistory.filter((e) => isPhub2Movie(e.movie)).map((e) => e.movie)
    expect(phub2List).toEqual([phub2Movie])

    // Verify PHub 3 only contains PHub 3
    const phub3List = allHistory.filter((e) => isPhub3Movie(e.movie)).map((e) => e.movie)
    expect(phub3List).toEqual([phub3Movie])

    // Verify JAV only contains JAV
    const javList = allHistory.filter((e) => isJavMovie(e.movie)).map((e) => e.movie)
    expect(javList).toEqual([javMovie])

    // Verify Hentai only contains Hentai
    const hentaiList = allHistory.filter((e) => isHentaiMovie(e.movie)).map((e) => e.movie)
    expect(hentaiList).toEqual([hentaiMovie])

    // Verify none leak to public (Apple TV / Netflix)
    const publicList = allHistory.filter((e) => !isLordAdultMovie(e.movie)).map((e) => e.movie)
    expect(publicList).toHaveLength(0)
  })
})


