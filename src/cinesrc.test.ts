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
})
