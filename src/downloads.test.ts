import { describe, it, expect } from 'vitest'
import {
  formatBytes,
  getTotalStorageUsed,
  estimateMediaSize,
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
  })

  it('calculates total storage used', async () => {
    const storage = await getTotalStorageUsed()
    expect(storage).toBeDefined()
    expect(typeof storage.formatted).toBe('string')
  })
})
