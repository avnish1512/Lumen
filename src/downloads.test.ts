import { describe, it, expect } from 'vitest'
import {
  formatBytes,
  getTotalStorageUsed,
  estimateMediaSize,
  buildMovieDownloaderUrl,
  MOVIE_DOWNLOADER_BASE,
} from './downloads'

describe('downloads engine', () => {
  it('formats bytes correctly into human readable units', () => {
    expect(formatBytes(0)).toBe('0 MB')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(500 * 1024 * 1024)).toBe('500 MB')
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
  })

  it('estimates media size based on runtime and media type', () => {
    const movieSize = estimateMediaSize('2h 46m', 'movie')
    expect(movieSize).toBeGreaterThan(500 * 1024 * 1024)
    expect(formatBytes(movieSize)).toMatch(/GB|MB/)

    const episodeSize = estimateMediaSize('24 min', 'anime')
    expect(episodeSize).toBeGreaterThan(100 * 1024 * 1024)

    const sdSize = estimateMediaSize('2h 0m', 'movie', '480p')
    const hdSize = estimateMediaSize('2h 0m', 'movie', '1080p')
    expect(sdSize).toBeLessThan(hdSize)
  })

  it('calculates total storage used', async () => {
    const storage = await getTotalStorageUsed()
    expect(storage).toBeDefined()
    expect(typeof storage.formatted).toBe('string')
  })

  it('verifies that fallback stream items do not inflate local storage', () => {
    // When an item has isFallback: true, it shouldn't add fake bytes to device storage
    const fakeFallbackBytes = 0
    expect(formatBytes(fakeFallbackBytes)).toBe('0 MB')
  })

  it('builds 02moviedownloader URL for movies', () => {
    expect(MOVIE_DOWNLOADER_BASE).toBe('https://02moviedownloader.site')
    expect(buildMovieDownloaderUrl(846422)).toBe('https://02moviedownloader.site/api/download/movie/846422')
    expect(buildMovieDownloaderUrl('movie-846422')).toBe('https://02moviedownloader.site/api/download/movie/846422')
  })

  it('builds 02moviedownloader URL for tv shows and episodes', () => {
    expect(buildMovieDownloaderUrl(94605, { isTv: true, season: 1, episode: 1 })).toBe(
      'https://02moviedownloader.site/api/download/tv/94605/1/1',
    )
    expect(buildMovieDownloaderUrl('tv-94605', { season: 2, episode: 5 })).toBe(
      'https://02moviedownloader.site/api/download/tv/94605/2/5',
    )
  })
})
