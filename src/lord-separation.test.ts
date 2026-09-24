import { describe, it, expect } from 'vitest'
import {
  isPhubMovie,
  isPhub1Movie,
  isPhub2Movie,
  isPhub3Movie,
  isJavMovie,
  isHentaiMovie,
  isLordAdultMovie,
  sanitizeMovieEmbed,
} from './App'
import { normalizeMovie } from './omdb'
import { buildStreamUrl, streamProviderOptions, type Movie } from './tmdb'

describe('Lord Section Separation from Apple and Netflix UI', () => {
  const badSisterMovie: Movie = {
    id: '369557',
    tmdbId: 369557,
    title: 'Bad Sister',
    rank: 1,
    logoTitle: 'Bad Sister',
    type: 'Movie',
    genres: ['Drama', 'Thriller'],
    year: '2015',
    runtime: '86 min',
    rating: '★ 6.2',
    maturity: 'TV-14',
    progress: 0,
    hero: '',
    poster: '',
    still: '',
    synopsis:
      "As a top student at St. Adeline's Catholic Boarding School, Zoe senses that something is not quite right about the school's new nun...",
    cast: ['Alyssa Milano', 'Sierra McCormick'],
    director: 'Doug Campbell',
    awards: '',
    boxOffice: '',
    ratings: [],
    label: 'Movie',
    tmdbType: 'movie',
  }

  it('ensures Bad Sister (TMDB movie with numeric ID) is NOT recognized as any Lord adult content', () => {
    expect(isPhubMovie(badSisterMovie)).toBe(false)
    expect(isPhub1Movie(badSisterMovie)).toBe(false)
    expect(isPhub2Movie(badSisterMovie)).toBe(false)
    expect(isPhub3Movie(badSisterMovie)).toBe(false)
    expect(isJavMovie(badSisterMovie)).toBe(false)
    expect(isHentaiMovie(badSisterMovie)).toBe(false)
    expect(isLordAdultMovie(badSisterMovie)).toBe(false)
  })

  it('ensures a numeric ID TMDB title without explicit tmdbId is not recognized as PHub 2', () => {
    const movieWithoutExplicitTmdbId: Movie = {
      ...badSisterMovie,
      tmdbId: undefined,
    }

    expect(isPhub2Movie(movieWithoutExplicitTmdbId)).toBe(false)
    expect(isPhubMovie(movieWithoutExplicitTmdbId)).toBe(false)
    expect(isLordAdultMovie(movieWithoutExplicitTmdbId)).toBe(false)
  })

  it('cleanses and strips accidental upload18 embedUrl from Bad Sister or mainstream movies', () => {
    const taintedBadSister: Movie = {
      ...badSisterMovie,
      embedUrl: 'https://upload18.net/play/index/xvidapi-369557',
    }

    // sanitizeMovieEmbed strips the adult embed
    const sanitized = sanitizeMovieEmbed(taintedBadSister)
    expect(sanitized.embedUrl).toBeUndefined()

    // normalizeMovie also strips the adult embed for mainstream titles
    const normalized = normalizeMovie(taintedBadSister)
    expect(normalized.embedUrl).toBeUndefined()

    // And isPhub2Movie / isLordAdultMovie strictly returns false
    expect(isPhub2Movie(taintedBadSister)).toBe(false)
    expect(isLordAdultMovie(taintedBadSister)).toBe(false)
  })

  it('ensures Watch screen server selection offers Apple UI servers (not restricted to Upload18)', () => {
    const isPhub3Video = isPhub3Movie(badSisterMovie)
    const isPhub2Video = isPhub2Movie(badSisterMovie)
    const isPhub1Video = isPhub1Movie(badSisterMovie)
    const isJavVideo = isJavMovie(badSisterMovie)
    const isHentai = isHentaiMovie(badSisterMovie)

    expect(isPhub2Video).toBe(false)
    expect(isPhub3Video).toBe(false)
    expect(isPhub1Video).toBe(false)
    expect(isJavVideo).toBe(false)
    expect(isHentai).toBe(false)

    const animeProviderIds = ['filmu', 'nhdapi', 'yenime', 'clickhost', 'megaplay', 'megabuzz', 'megavid']
    const isAnimeMovie = false

    const filteredOptions = isJavVideo
      ? streamProviderOptions.filter((provider) => provider.id === 'apijav')
      : isPhub3Video
        ? streamProviderOptions.filter((provider) => provider.id === 'eporner')
        : isPhub2Video
          ? streamProviderOptions.filter((provider) => provider.id === 'upload18')
          : isPhub1Video
            ? streamProviderOptions.filter((provider) => provider.id === 'phubplay')
            : isHentai
              ? streamProviderOptions.filter((provider) => provider.id === 'oceanplay')
              : streamProviderOptions.filter((provider) => {
                  if (
                    provider.id === 'oceanplay' ||
                    provider.id === 'apijav' ||
                    provider.id === 'phubplay' ||
                    provider.id === 'upload18' ||
                    provider.id === 'eporner'
                  )
                    return false
                  const isAnimeProvider = animeProviderIds.includes(provider.id)
                  return isAnimeMovie
                    ? badSisterMovie.tmdbId
                      ? true
                      : isAnimeProvider
                    : !isAnimeProvider || provider.id === 'filmu' || provider.id === 'nhdapi'
                })

    // Upload18 and other adult servers must NOT be present
    expect(filteredOptions.some((p) => p.id === 'upload18')).toBe(false)
    expect(filteredOptions.some((p) => p.id === 'apijav')).toBe(false)
    expect(filteredOptions.some((p) => p.id === 'eporner')).toBe(false)

    // Mainstream servers for Apple UI must be present
    expect(filteredOptions.some((p) => p.id === 'rivestream')).toBe(true)
    expect(filteredOptions.some((p) => p.id === 'vidrift')).toBe(true)
    expect(filteredOptions.some((p) => p.id === 'filmu')).toBe(true)
  })

  it('buildStreamUrl generates mainstream stream url rather than Upload18 for Bad Sister', () => {
    const url = buildStreamUrl(badSisterMovie, 'rivestream')
    expect(url).toContain('rivestream.app')
    expect(url).not.toContain('upload18.net')
    expect(url).not.toContain('xvidapi')

    // Even if upload18 was passed erroneously, it does not generate an upload18 URL for Bad Sister
    const upload18Attempt = buildStreamUrl(badSisterMovie, 'upload18' as any)
    expect(upload18Attempt).not.toContain('upload18.net')
  })

  it('ensures Bad Sister is counted in Apple continue watching and NOT in Lord continue watching', () => {
    const history = {
      '369557': {
        movie: badSisterMovie,
        updatedAt: 1000,
        progress: 30,
      },
    }

    const continueWatchingLumen = Object.values(history).filter(
      (entry) => entry.progress < 100 && !isLordAdultMovie(entry.movie) && !entry.movie.isAnime
    )
    const continueWatchingPhub2 = Object.values(history).filter(
      (entry) => entry.progress < 100 && isPhub2Movie(entry.movie)
    )
    const continueWatchingLord = Object.values(history).filter(
      (entry) => entry.progress < 100 && isHentaiMovie(entry.movie)
    )

    expect(continueWatchingLumen).toHaveLength(1)
    expect(continueWatchingLumen[0].movie.title).toBe('Bad Sister')
    expect(continueWatchingPhub2).toHaveLength(0)
    expect(continueWatchingLord).toHaveLength(0)
  })

  it('preserves genuine Lord PHub 2 videos while isolating them from Apple/Netflix UI', () => {
    const genuinePhub2Movie: Movie = {
      id: 'phub2-73341265',
      title: 'Genuine PHub Video',
      rank: 1,
      logoTitle: '4K',
      type: 'PHub Video',
      genres: ['4K'],
      year: '2026',
      runtime: '30:00',
      rating: '★ 5.0',
      maturity: '18+',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'Genuine adult video',
      cast: [],
      director: '',
      awards: '',
      boxOffice: '',
      ratings: [],
      label: 'PHub 2',
      hentaiSlug: 'phub2-73341265',
    }

    expect(isPhub2Movie(genuinePhub2Movie)).toBe(true)
    expect(isLordAdultMovie(genuinePhub2Movie)).toBe(true)

    const url = buildStreamUrl(genuinePhub2Movie, 'upload18')
    expect(url).toBe('https://upload18.net/play/index/xvidapi-73341265')
  })
})
