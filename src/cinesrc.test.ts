import { describe, expect, it } from 'vitest'
import { buildStreamUrl, streamProviderOptions } from './tmdb'
import type { Movie } from './omdb'

describe('CineSrc server integration', () => {
  it('includes CineSrc in streamProviderOptions', () => {
    const cinesrcOption = streamProviderOptions.find((p) => p.id === 'cinesrc')
    expect(cinesrcOption).toBeDefined()
    expect(cinesrcOption?.name).toBe('CineSrc')
    expect(cinesrcOption?.logo).toBe('CS')
  })

  it('builds valid CineSrc embed URL for a movie', () => {
    const movie: Movie = {
      id: 'movie-1084242',
      tmdbId: 1084242,
      tmdbType: 'movie',
      rank: 1,
      title: 'Sample Movie',
      logoTitle: 'Sample Movie',
      label: 'Feature Film',
      type: 'Movie',
      genres: ['Action', 'Thriller'],
      year: '2026',
      runtime: '120 min',
      rating: '8.5',
      maturity: 'PG-13',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'A test movie synopsis',
      cast: [],
      director: 'Director',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildStreamUrl(movie, 'cinesrc')
    expect(url).toBe('https://cinesrc.st/embed/movie/1084242?color=%2347A8FF')
  })

  it('builds valid CineSrc embed URL for a TV show with season and episode', () => {
    const tvShow: Movie = {
      id: 'tv-1396',
      tmdbId: 1396,
      tmdbType: 'tv',
      streamSeason: 2,
      streamEpisode: 5,
      rank: 1,
      title: 'Breaking Bad',
      logoTitle: 'Breaking Bad',
      label: 'TV Series',
      type: 'Series',
      genres: ['Crime', 'Drama'],
      year: '2008',
      runtime: '45 min',
      rating: '9.5',
      maturity: 'TV-MA',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'TV synopsis',
      cast: [],
      director: 'Vince Gilligan',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildStreamUrl(tvShow, 'cinesrc')
    expect(url).toBe('https://cinesrc.st/embed/tv/1396?s=2&e=5&color=%2347A8FF&autonext=true&autoskip=true')
  })

  it('defaults season and episode to 1 for TV shows when not provided', () => {
    const tvShow: Movie = {
      id: 'tv-1396',
      tmdbId: 1396,
      tmdbType: 'tv',
      rank: 1,
      title: 'Breaking Bad',
      logoTitle: 'Breaking Bad',
      label: 'TV Series',
      type: 'Series',
      genres: ['Crime', 'Drama'],
      year: '2008',
      runtime: '45 min',
      rating: '9.5',
      maturity: 'TV-MA',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'TV synopsis',
      cast: [],
      director: 'Vince Gilligan',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildStreamUrl(tvShow, 'cinesrc')
    expect(url).toBe('https://cinesrc.st/embed/tv/1396?s=1&e=1&color=%2347A8FF&autonext=true&autoskip=true')
  })

  it('includes EmbedAPI in streamProviderOptions', () => {
    const embedApiOption = streamProviderOptions.find((p) => p.id === 'embedapi')
    expect(embedApiOption).toBeDefined()
    expect(embedApiOption?.name).toBe('EmbedAPI')
    expect(embedApiOption?.logo).toBe('EA')
  })

  it('builds valid EmbedAPI embed URL for a movie', () => {
    const movie: Movie = {
      id: 'movie-94997',
      tmdbId: 94997,
      tmdbType: 'movie',
      rank: 1,
      title: 'Sample Movie',
      logoTitle: 'Sample Movie',
      label: 'Feature Film',
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
      synopsis: 'A test movie synopsis',
      cast: [],
      director: 'Director',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildStreamUrl(movie, 'embedapi')
    expect(url).toBe('https://watch.embed-api.stream/embed/movie/94997')
  })

  it('builds valid EmbedAPI embed URL for a TV show with season and episode', () => {
    const tvShow: Movie = {
      id: 'tv-94997',
      tmdbId: 94997,
      tmdbType: 'tv',
      streamSeason: 1,
      streamEpisode: 1,
      rank: 1,
      title: 'Sample TV',
      logoTitle: 'Sample TV',
      label: 'TV Series',
      type: 'Series',
      genres: ['Drama'],
      year: '2022',
      runtime: '45 min',
      rating: '8.5',
      maturity: 'TV-MA',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'TV synopsis',
      cast: [],
      director: 'Director',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildStreamUrl(tvShow, 'embedapi')
    expect(url).toBe('https://watch.embed-api.stream/embed/tv/94997/1/1')
  })

  it('includes VidPhantom in streamProviderOptions', () => {
    const vidPhantomOption = streamProviderOptions.find((p) => p.id === 'vidphantom')
    expect(vidPhantomOption).toBeDefined()
    expect(vidPhantomOption?.name).toBe('VidPhantom')
    expect(vidPhantomOption?.logo).toBe('VP')
  })

  it('builds valid VidPhantom embed URL for a movie', () => {
    const movie: Movie = {
      id: 'movie-666243',
      tmdbId: 666243,
      tmdbType: 'movie',
      rank: 1,
      title: 'Sample Movie',
      logoTitle: 'Sample Movie',
      label: 'Feature Film',
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
      synopsis: 'A test movie synopsis',
      cast: [],
      director: 'Director',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildStreamUrl(movie, 'vidphantom')
    expect(url).toBe('https://vidphantom.com/movie/666243')
  })

  it('builds valid VidPhantom embed URL for a TV show with season and episode', () => {
    const tvShow: Movie = {
      id: 'tv-94997',
      tmdbId: 94997,
      tmdbType: 'tv',
      streamSeason: 1,
      streamEpisode: 1,
      rank: 1,
      title: 'Sample TV',
      logoTitle: 'Sample TV',
      label: 'TV Series',
      type: 'Series',
      genres: ['Drama'],
      year: '2022',
      runtime: '45 min',
      rating: '8.5',
      maturity: 'TV-MA',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'TV synopsis',
      cast: [],
      director: 'Director',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildStreamUrl(tvShow, 'vidphantom')
    expect(url).toBe('https://vidphantom.com/tv/94997/1/1')
  })

  it('includes Mgeb in streamProviderOptions', () => {
    const mgebOption = streamProviderOptions.find((p) => p.id === 'mgeb')
    expect(mgebOption).toBeDefined()
    expect(mgebOption?.name).toBe('Mgeb')
    expect(mgebOption?.logo).toBe('MG')
  })

  it('builds valid Mgeb embed URL for a movie', () => {
    const movie: Movie = {
      id: 'movie-666243',
      tmdbId: 666243,
      tmdbType: 'movie',
      rank: 1,
      title: 'Sample Movie',
      logoTitle: 'Sample Movie',
      label: 'Feature Film',
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
      synopsis: 'A test movie synopsis',
      cast: [],
      director: 'Director',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildStreamUrl(movie, 'mgeb')
    expect(url).toBe('https://mgeb.top/embed/666243')
  })

  it('builds valid Mgeb embed URL for a TV show with season and episode', () => {
    const tvShow: Movie = {
      id: 'tv-94997',
      tmdbId: 94997,
      tmdbType: 'tv',
      streamSeason: 1,
      streamEpisode: 1,
      rank: 1,
      title: 'Sample TV',
      logoTitle: 'Sample TV',
      label: 'TV Series',
      type: 'Series',
      genres: ['Drama'],
      year: '2022',
      runtime: '45 min',
      rating: '8.5',
      maturity: 'TV-MA',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'TV synopsis',
      cast: [],
      director: 'Director',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildStreamUrl(tvShow, 'mgeb')
    expect(url).toBe('https://mgeb.top/embed/94997/1/1')
  })

  it('builds valid NHD embed URL for a movie and TV show', () => {
    const movie: Movie = {
      id: 'movie-666243',
      tmdbId: 666243,
      tmdbType: 'movie',
      rank: 1,
      title: 'Sample Movie',
      logoTitle: 'Sample Movie',
      label: 'Feature Film',
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
      synopsis: 'A test movie synopsis',
      cast: [],
      director: 'Director',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const movieUrl = buildStreamUrl(movie, 'nhdapi')
    expect(movieUrl).toContain('https://nhdapi.com/embed/movie/666243')

    const tvShow: Movie = {
      ...movie,
      id: 'tv-94997',
      tmdbId: 94997,
      tmdbType: 'tv',
      streamSeason: 2,
      streamEpisode: 3,
    }

    const tvUrl = buildStreamUrl(tvShow, 'nhdapi')
    expect(tvUrl).toContain('https://nhdapi.com/embed/tv/94997/2/3')
  })

  it('correctly distinguishes admin main account from regular accounts', async () => {
    const { isMainAccount, MAIN_ACCOUNT_EMAIL } = await import('./accounts-api')
    expect(isMainAccount(MAIN_ACCOUNT_EMAIL)).toBe(true)
    expect(isMainAccount('user@example.com')).toBe(false)
    expect(isMainAccount(null)).toBe(false)
    expect(isMainAccount(undefined)).toBe(false)
  })
})
