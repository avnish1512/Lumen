import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchAccountWatchProgress,
  saveWatchProgressRecord,
  mergeWithServerHistory,
  getOfflineQueue,
  addToOfflineQueue,
  flushOfflineQueue,
  watchProgressToMovie,
  type WatchProgressRecord,
} from './watch-history-api'
import {
  createSessionToken,
  verifySessionToken,
  extractBearerToken,
} from '../api/_lib/auth-token'
import {
  setSessionToken,
  clearSessionToken,
} from './accounts-api'
import {
  appendStartTimeToUrl,
  formatPlaybackSeconds,
  parseRuntimeSeconds,
} from './App'
import type { Movie } from './omdb'

describe('Cross-Device Continue Watching Synchronization', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    clearSessionToken()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('1. Account-Based Data Storage & Isolation', () => {
    it('associates watch progress records with the user account ID and stores in database', async () => {
      const userEmail = 'user1@example.com'
      const sessionToken = createSessionToken(userEmail)
      setSessionToken(sessionToken)

      const mockRecord: WatchProgressRecord = {
        id: `${userEmail}::550`,
        user_id: userEmail,
        content_id: '550',
        content_type: 'movie',
        season_number: null,
        episode_number: null,
        progress_seconds: 2100, // 35 minutes
        duration_seconds: 6000,
        updated_at: new Date().toISOString(),
        completed: false,
        movie: {
          id: '550',
          title: 'Fight Club',
          year: '1999',
          type: 'movie',
          poster: 'https://image.tmdb.org/t/p/w500/test.jpg',
          genres: ['Drama'],
        },
      }

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, data: mockRecord }),
      } as Response)

      const res = await saveWatchProgressRecord(mockRecord)
      expect(res.ok).toBe(true)
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/watch-history',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${sessionToken}`,
          }),
          body: JSON.stringify({ record: mockRecord }),
        }),
      )
    })

    it('isolates watch histories between different accounts', async () => {
      const userA = 'alice@example.com'
      const userB = 'bob@example.com'

      const recordA: WatchProgressRecord = {
        id: `${userA}::101`,
        user_id: userA,
        content_id: '101',
        content_type: 'movie',
        season_number: null,
        episode_number: null,
        progress_seconds: 2100,
        duration_seconds: 7200,
        updated_at: '2026-10-20T10:00:00.000Z',
        completed: false,
        movie: { id: '101', title: 'Inception', year: '2010', type: 'movie', genres: [] },
      }

      const recordB: WatchProgressRecord = {
        id: `${userB}::202`,
        user_id: userB,
        content_id: '202',
        content_type: 'movie',
        season_number: null,
        episode_number: null,
        progress_seconds: 1200,
        duration_seconds: 6000,
        updated_at: '2026-10-20T11:00:00.000Z',
        completed: false,
        movie: { id: '202', title: 'Interstellar', year: '2014', type: 'movie', genres: [] },
      }

      // Alice merges her records into her local history
      const localAlice = mergeWithServerHistory({}, [recordA])
      expect(Object.keys(localAlice)).toHaveLength(1)
      expect(localAlice['101']?.movie.title).toBe('Inception')

      // Bob logs in: Alice's state is cleared, Bob merges only his records
      const localBob = mergeWithServerHistory({}, [recordB])
      expect(Object.keys(localBob)).toHaveLength(1)
      expect(localBob['202']?.movie.title).toBe('Interstellar')
      expect(localBob['101']).toBeUndefined()
    })

    it('restores watch history from server after local storage is cleared', async () => {
      const userEmail = 'persisted@example.com'
      const token = createSessionToken(userEmail)
      setSessionToken(token)

      const serverRecord: WatchProgressRecord = {
        id: `${userEmail}::303`,
        user_id: userEmail,
        content_id: '303',
        content_type: 'movie',
        season_number: null,
        episode_number: null,
        progress_seconds: 2100,
        duration_seconds: 6000,
        updated_at: '2026-10-20T12:00:00.000Z',
        completed: false,
        movie: { id: '303', title: 'The Matrix', year: '1999', type: 'movie', genres: [] },
      }

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          records: [serverRecord],
          watchHistory: {
            '303': {
              movie: serverRecord.movie,
              updatedAt: new Date(serverRecord.updated_at).getTime(),
              progress: 35,
              progressSeconds: 2100,
              durationSeconds: 6000,
              completed: false,
            },
          },
        }),
      } as Response)

      // Clearing local storage simulates browser cache clear / new device
      localStorage.clear()

      const result = await fetchAccountWatchProgress(userEmail)
      expect(result).not.toBeNull()
      expect(result?.records).toHaveLength(1)
      expect(result?.records[0]?.content_id).toBe('303')
      expect(result?.history['303']?.progressSeconds).toBe(2100)
    })
  })

  describe('2. Playback Progress Saving & Formatting', () => {
    it('formats playback seconds accurately into MM:SS and H:MM:SS', () => {
      expect(formatPlaybackSeconds(0)).toBe('')
      expect(formatPlaybackSeconds(45)).toBe('0:45')
      expect(formatPlaybackSeconds(2100)).toBe('35:00') // 35 minutes
      expect(formatPlaybackSeconds(3665)).toBe('1:01:05') // 1 hour 1 minute 5 seconds
      expect(formatPlaybackSeconds(7200)).toBe('2:00:00')
    })

    it('parses runtime strings accurately into total seconds', () => {
      expect(parseRuntimeSeconds('120 min')).toBe(7200)
      expect(parseRuntimeSeconds('2h 15m')).toBe(8100)
      expect(parseRuntimeSeconds('45m')).toBe(2700)
      expect(parseRuntimeSeconds('invalid')).toBe(7200) // Fallback default
    })

    it('appends playback start time parameters to stream URLs', () => {
      const baseEmbed = 'https://vidsrc.cc/v2/embed/movie/550'
      const resumedUrl = appendStartTimeToUrl(baseEmbed, 2100)
      expect(resumedUrl).toBe('https://vidsrc.cc/v2/embed/movie/550?start_time=2100&t=2100#t=2100')

      // Avoids duplicating if already present
      const alreadyHas = 'https://stream.provider/play?start_time=100'
      expect(appendStartTimeToUrl(alreadyHas, 200)).toBe(alreadyHas)
    })

    it('preserves TV season and episode numbers in progress records', () => {
      const user = 'tvwatcher@example.com'
      const record: WatchProgressRecord = {
        id: `${user}::1399::s2e5`,
        user_id: user,
        content_id: '1399',
        content_type: 'tv',
        season_number: 2,
        episode_number: 5,
        progress_seconds: 1450,
        duration_seconds: 3000,
        updated_at: new Date().toISOString(),
        completed: false,
        movie: {
          id: '1399',
          title: 'Game of Thrones',
          year: '2011',
          type: 'series',
          streamSeason: 2,
          streamEpisode: 5,
          genres: [],
        },
      }

      const movie = watchProgressToMovie(record)
      expect(movie.streamSeason).toBe(2)
      expect(movie.streamEpisode).toBe(5)
      expect(movie.progressSeconds).toBe(1450)
      expect(movie.durationSeconds).toBe(3000)
    })
  })

  describe('3. Multi-Device Conflict Resolution & Synchronization', () => {
    it('gives precedence to newer server timestamp over stale local record', () => {
      const contentId = '404'
      const localHistory = {
        [contentId]: {
          movie: { id: contentId, title: 'Avatar', year: '2009', type: 'movie', genres: [] } as Movie,
          updatedAt: 1700000000000, // Older timestamp
          progress: 20,
          progressSeconds: 1200,
          durationSeconds: 6000,
          completed: false,
          seasonNumber: null,
          episodeNumber: null,
        },
      }

      const newerServerRecord: WatchProgressRecord = {
        id: `user@example.com::${contentId}`,
        user_id: 'user@example.com',
        content_id: contentId,
        content_type: 'movie',
        season_number: null,
        episode_number: null,
        progress_seconds: 2100, // Watched to 35m on laptop
        duration_seconds: 6000,
        updated_at: new Date(1700005000000).toISOString(), // Newer timestamp (+5000s)
        completed: false,
        movie: { id: contentId, title: 'Avatar', year: '2009', type: 'movie', genres: [] },
      }

      const merged = mergeWithServerHistory(localHistory, [newerServerRecord])
      expect(merged[contentId]?.progressSeconds).toBe(2100)
      expect(merged[contentId]?.progress).toBe(35)
      expect(merged[contentId]?.updatedAt).toBe(1700005000000)
    })

    it('preserves newer local record if server update is older', () => {
      const contentId = '505'
      const newerLocalTime = 1700010000000
      const localHistory = {
        [contentId]: {
          movie: { id: contentId, title: 'Titanic', year: '1997', type: 'movie', genres: [] } as Movie,
          updatedAt: newerLocalTime, // User just watched on this device
          progress: 50,
          progressSeconds: 3000,
          durationSeconds: 6000,
          completed: false,
          seasonNumber: null,
          episodeNumber: null,
        },
      }

      const olderServerRecord: WatchProgressRecord = {
        id: `user@example.com::${contentId}`,
        user_id: 'user@example.com',
        content_id: contentId,
        content_type: 'movie',
        season_number: null,
        episode_number: null,
        progress_seconds: 1500,
        duration_seconds: 6000,
        updated_at: new Date(1700000000000).toISOString(), // Older timestamp
        completed: false,
      }

      const merged = mergeWithServerHistory(localHistory, [olderServerRecord])
      expect(merged[contentId]?.progressSeconds).toBe(3000)
      expect(merged[contentId]?.progress).toBe(50)
      expect(merged[contentId]?.updatedAt).toBe(newerLocalTime)
    })
  })

  describe('4. Security & Server Session Verification', () => {
    it('creates, signs, and verifies HMAC-SHA256 session tokens', () => {
      const token = createSessionToken('user-123')
      expect(token).toBeDefined()
      expect(token.split('.')).toHaveLength(2)

      const payload = verifySessionToken(token)
      expect(payload).not.toBeNull()
      expect(payload?.userId).toBe('user-123')
    })

    it('rejects tampered or malformed session tokens', () => {
      const validToken = createSessionToken('user-123')
      const [, sig] = validToken.split('.')
      
      // Tamper with payload
      const tamperedPayload = Buffer.from(JSON.stringify({ userId: 'hacker', exp: 9999999999 })).toString('base64url')
      const tamperedToken = `${tamperedPayload}.${sig}`
      expect(verifySessionToken(tamperedToken)).toBeNull()

      // Malformed token
      expect(verifySessionToken('not-a-token')).toBeNull()
    })

    it('extracts Bearer token correctly from authorization headers', () => {
      expect(extractBearerToken('Bearer my-secret-token')).toBe('my-secret-token')
      expect(extractBearerToken('bearer my-lowercase-token')).toBe('my-lowercase-token')
      expect(extractBearerToken('')).toBeNull()
      expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull()
    })
  })

  describe('5. Device & Offline Queue Synchronization', () => {
    it('stores pending progress records locally when network is unavailable', async () => {
      const record: WatchProgressRecord = {
        id: 'offline@example.com::777',
        user_id: 'offline@example.com',
        content_id: '777',
        content_type: 'movie',
        season_number: null,
        episode_number: null,
        progress_seconds: 1800,
        duration_seconds: 5400,
        updated_at: new Date().toISOString(),
        completed: false,
      }

      // Mock network failure
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch (offline)'))

      const res = await saveWatchProgressRecord(record)
      expect(res.ok).toBe(false)
      expect(res.queuedOffline).toBe(true)

      const queue = getOfflineQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0]?.content_id).toBe('777')
      expect(queue[0]?.progress_seconds).toBe(1800)
    })

    it('flushes offline queue to the server when network reconnects', async () => {
      const record1: WatchProgressRecord = {
        id: 'user@example.com::888',
        user_id: 'user@example.com',
        content_id: '888',
        content_type: 'movie',
        season_number: null,
        episode_number: null,
        progress_seconds: 900,
        duration_seconds: 3600,
        updated_at: new Date().toISOString(),
        completed: false,
      }
      addToOfflineQueue(record1)
      expect(getOfflineQueue()).toHaveLength(1)

      // Network returns
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, count: 1 }),
      } as Response)

      await flushOfflineQueue()
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/watch-history',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ records: [record1] }),
        }),
      )
      expect(getOfflineQueue()).toHaveLength(0)
    })
  })

  describe('6. Completion Rules & Filtering', () => {
    it('marks titles with progress >= 95% as completed', () => {
      const record: WatchProgressRecord = {
        id: 'user@example.com::999',
        user_id: 'user@example.com',
        content_id: '999',
        content_type: 'movie',
        season_number: null,
        episode_number: null,
        progress_seconds: 5800,
        duration_seconds: 6000, // 96.6%
        updated_at: new Date().toISOString(),
        completed: true,
      }

      const history = mergeWithServerHistory({}, [record])
      expect(history['999']?.completed).toBe(true)
      expect(history['999']?.progress).toBeGreaterThanOrEqual(95)
    })
  })
})
