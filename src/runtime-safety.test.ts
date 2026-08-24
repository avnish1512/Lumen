import { describe, expect, it } from 'vitest'
import { compactRuntime, episodeRuntime, getEpisodeDuration } from './App'
import type { Movie } from './omdb'

describe('runtime parsing safety', () => {
  it('compactRuntime safely handles undefined, null, empty string, and valid runtime formats', () => {
    // Edge cases that previously threw "Cannot read properties of undefined (reading 'match')"
    expect(compactRuntime(undefined)).toBe('')
    expect(compactRuntime(null)).toBe('')
    expect(compactRuntime('')).toBe('')
    // @ts-expect-error runtime might be non-string at runtime
    expect(compactRuntime(123)).toBe('')

    // Formatted runtime tests
    expect(compactRuntime('120 min')).toBe('2h')
    expect(compactRuntime('125 min')).toBe('2h 5m')
    expect(compactRuntime('45 min')).toBe('45m')
    expect(compactRuntime('1 hr 30 min')).toBe('1h 30m')
  })

  it('episodeRuntime safely handles movies with missing runtime or undefined movie', () => {
    expect(episodeRuntime(undefined)).toBe('')
    expect(episodeRuntime(null)).toBe('')

    const movieWithoutRuntime = {
      id: 'test-1',
      title: 'Test Movie',
    } as unknown as Movie

    expect(episodeRuntime(movieWithoutRuntime, 1, 1)).toBe('')

    const movieWithRuntime = {
      id: 'test-2',
      title: 'Test Movie 2',
      runtime: '50 min',
    } as unknown as Movie

    expect(episodeRuntime(movieWithRuntime, 1, 1)).toBe('50m')

    const animeWithDuration = {
      id: 'test-3',
      title: 'Anime Test',
      isAnime: true,
      episodeRuntimeMinutes: 24,
    } as unknown as Movie

    expect(episodeRuntime(animeWithDuration, 1, 1)).toBe('24m')
  })

  it('getEpisodeDuration safely handles missing movie/runtime inputs', () => {
    expect(getEpisodeDuration(undefined, 1)).toBe('')
    expect(getEpisodeDuration(null, 1)).toBe('')

    const blankMovie = { id: 'blank' } as unknown as Movie
    expect(getEpisodeDuration(blankMovie, 1)).toBe('')
    expect(getEpisodeDuration(blankMovie, 1, undefined, undefined)).toBe('')
    expect(getEpisodeDuration(blankMovie, 1, '45 min')).toBe('45m')
    expect(getEpisodeDuration(blankMovie, 1, 60)).toBe('1h')
  })
})
