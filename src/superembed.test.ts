import { describe, expect, it } from 'vitest'
import {
  buildSuperEmbedRequestUrl,
  isSuperEmbedRedirectUrl,
  superEmbedOptionsFromParams,
} from '../api/_lib/superembed-core'
import { buildStreamUrl } from './tmdb'
import type { Movie } from './omdb'

describe('SuperEmbed core module', () => {
  it('parses options correctly from URLSearchParams', () => {
    const params = new URLSearchParams('video_id=12345&s=1&e=5&tmdb=1')
    const options = superEmbedOptionsFromParams(params)

    expect(options).toEqual({
      videoId: '12345',
      season: '1',
      episode: '5',
      tmdb: '1',
      preferredServer: undefined,
    })
  })

  it('returns null if video_id is missing', () => {
    const params = new URLSearchParams('season=1&episode=5')
    const options = superEmbedOptionsFromParams(params)

    expect(options).toBeNull()
  })

  it('builds valid SuperEmbed request URL with query parameters', () => {
    const url = buildSuperEmbedRequestUrl({
      videoId: 'tt1234567',
      tmdb: '1',
      season: '2',
      episode: '4',
      preferredServer: '25',
    })

    const parsed = new URL(url)
    expect(parsed.origin).toBe('https://getsuperembed.link')
    expect(parsed.searchParams.get('video_id')).toBe('tt1234567')
    expect(parsed.searchParams.get('tmdb')).toBe('1')
    expect(parsed.searchParams.get('season')).toBe('2')
    expect(parsed.searchParams.get('episode')).toBe('4')
    expect(parsed.searchParams.get('preferred_server')).toBe('25')
  })

  it('validates HTTPS redirect URLs', () => {
    expect(isSuperEmbedRedirectUrl('https://superembed.stream/play/123')).toBe(true)
    expect(isSuperEmbedRedirectUrl('  https://superembed.stream/play/123  ')).toBe(true)
    expect(isSuperEmbedRedirectUrl('http://insecure.com')).toBe(false)
    expect(isSuperEmbedRedirectUrl('Error: Server unavailable')).toBe(false)
  })

  it('builds active vidsrc.pm URL for Old Server (vidsync) provider', () => {
    const movie: Movie = {
      id: 'tt1375666',
      tmdbId: 27205,
      tmdbType: 'movie',
      title: 'Inception',
      genres: ['Action'],
      rank: 1,
      logoTitle: 'Inception',
      label: 'Movie',
      type: 'Movie',
      year: '2010',
      runtime: '148 min',
      rating: '8.8',
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

    const url = buildStreamUrl(movie, 'vidsync')
    expect(url).toContain('https://vidsrc.pm/embed/movie/27205')
  })
})
