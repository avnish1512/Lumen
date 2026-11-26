import { describe, it, expect } from 'vitest'
import {
  isAdultEmbedMovie,
  isLordAdultMovie,
  isHentaiMovie,
  isJavMovie,
  isPhubMovie,
  isPhub1Movie,
} from './App'
import {
  adultEmbedToMovie,
  getCachedAdultEmbedCatalog,
  INITIAL_ADULTEMBED_VIDEOS,
} from './adultembed-api'
import { buildStreamUrl, streamProviderOptions } from './tmdb'
import { normalizeMovie } from './omdb'
import {
  buildAdultEmbedTarget,
  resolveAdultEmbedApiKey,
  DEFAULT_ADULTEMBED_API_KEY,
} from '../api/_lib/adultembed-core'

describe('AdultEmbed Lord tab integration', () => {
  it('provides pre-warmed initial catalog for 0ms Frame-1 render', () => {
    expect(INITIAL_ADULTEMBED_VIDEOS.length).toBeGreaterThanOrEqual(10)
    const cached = getCachedAdultEmbedCatalog({ sort: 'popular', page: 1 })
    expect(cached).not.toBeNull()
    expect(cached!.results.length).toBe(INITIAL_ADULTEMBED_VIDEOS.length)
  })

  it('normalizes AdultEmbed videos with strict Lord separation markers', () => {
    const sample = INITIAL_ADULTEMBED_VIDEOS[0]
    const movie = adultEmbedToMovie(sample)

    expect(movie.id).toBe(`ae-${sample.id}`)
    expect(movie.label).toBe('PHub 1')
    expect(movie.type).toBe('PHub 1 Video')
    expect(movie.tmdbId).toBeUndefined()
    expect(isAdultEmbedMovie(movie)).toBe(true)
    expect(isLordAdultMovie(movie)).toBe(true)
    expect(isJavMovie(movie)).toBe(false)
    expect(isPhubMovie(movie)).toBe(false)
    expect(isPhub1Movie(movie)).toBe(false)
    expect(isHentaiMovie(movie)).toBe(false)
    expect(buildStreamUrl(movie, 'adultembed')).toBe(sample.embed?.url)
  })

  it('does not misclassify AdultEmbed videos tagged Hentai into HentaiOcean', () => {
    const taggedMovie = adultEmbedToMovie({
      id: 999888,
      title: 'AdultEmbed Sample',
      thumbnail: 'https://adultembed.com/media/thumbnails/webp/pz-999888.webp',
      categories: [{ name: 'Hentai', slug: 'hentai' }],
      embed: { url: 'https://pornalizer.app/player/embed/999888/' },
    })

    expect(isAdultEmbedMovie(taggedMovie)).toBe(true)
    expect(isHentaiMovie(taggedMovie)).toBe(false)
    expect(buildStreamUrl(taggedMovie, 'adultembed')).toBe(
      'https://pornalizer.app/player/embed/999888/',
    )
  })

  it('maintains strict separation from mainstream TMDB titles', () => {
    const mainstreamMovie = normalizeMovie({
      id: '369557',
      tmdbId: 369557,
      tmdbType: 'movie',
      title: 'Bad Sister',
      embedUrl: 'https://adultembed.com/player/embed/12345/',
    })

    expect(mainstreamMovie.embedUrl).toBeUndefined()
    expect(isAdultEmbedMovie(mainstreamMovie)).toBe(false)
    expect(isLordAdultMovie(mainstreamMovie)).toBe(false)

    const url = buildStreamUrl(mainstreamMovie, 'rivestream')
    expect(url).toContain('rivestream.app')
    expect(url).not.toContain('adultembed.com')
    expect(url).not.toContain('pornalizer.app')

    const aeOption = streamProviderOptions.find((p) => p.id === 'adultembed')
    expect(aeOption).toBeDefined()
    expect(aeOption?.name).toBe('PHub 1')
  })

  it('builds valid AdultEmbed v1 proxy URLs and resolves configured API key', () => {
    expect(resolveAdultEmbedApiKey()).toBe(DEFAULT_ADULTEMBED_API_KEY)
    expect(resolveAdultEmbedApiKey({ ADULTEMBED_API_KEY: 'custom-key' })).toBe('custom-key')

    const searchTarget = buildAdultEmbedTarget(
      new URLSearchParams('action=search&tags=anal&sort=popular&per_page=20&orientation=all'),
    )
    expect(searchTarget.url).toBe(
      'https://adultembed.com/api/v1/search?orientation=all&tags=anal&sort=popular&per_page=20',
    )
    expect(searchTarget.method).toBe('GET')

    const trendingTarget = buildAdultEmbedTarget(
      new URLSearchParams('action=trending&period=week&per_page=24'),
    )
    expect(trendingTarget.url).toContain('https://adultembed.com/api/v1/videos/trending?')

    const relatedTarget = buildAdultEmbedTarget(
      new URLSearchParams('action=related&id=7185437&limit=12'),
    )
    expect(relatedTarget.url).toBe(
      'https://adultembed.com/api/v1/videos/7185437/related?limit=12',
    )
  })
})
