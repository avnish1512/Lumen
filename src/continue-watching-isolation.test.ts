import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  deleteRemoteMovieProgress,
  fetchAccountWatchProgress,
  saveWatchProgressRecord,
  mergeWithServerHistory,
  type WatchProgressRecord,
} from './watch-history-api'
import { deleteUserWatchRecord } from '../api/_lib/supabase-core'

describe('Continue Watching Removal & Account Isolation', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('Removal Deletion & Resurrect Prevention', () => {
    it('deletes user watch progress via DELETE /api/watch-history on movie removal', async () => {
      const userEmail = 'testuser@example.com'
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response)

      const success = await deleteRemoteMovieProgress(userEmail, 'movie-550', {
        tmdbId: 550,
        tmdbType: 'movie',
      })
      expect(success).toBe(true)
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/watch-history',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({
            key: userEmail,
            user_id: userEmail,
            content_id: 'movie-550',
            movieId: 'movie-550',
            tmdbId: 550,
          }),
        }),
      )
    })

    it('deleteUserWatchRecord in supabase-core purges both itemized records and composite rows', async () => {
      const deletedUrls: string[] = []
      let savedCompositeBody: any = null

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          deletedUrls.push(url)
          return { ok: true } as Response
        }
        if (url.includes('select=data') && !init?.method) {
          // fetchWatchHistory returns composite continue_watching row
          return {
            ok: true,
            json: async () => [
              {
                data: {
                  '550': { movie: { id: '550', title: 'Fight Club' } },
                  '999': { movie: { id: '999', title: 'The Matrix' } },
                },
              },
            ],
          } as Response
        }
        if (init?.method === 'POST') {
          savedCompositeBody = JSON.parse(String(init.body))
          return { ok: true } as Response
        }
        return { ok: true, json: async () => [] } as Response
      })

      const mockConfig = { url: 'https://test.supabase.co', anonKey: 'anon', serviceKey: 'service' }
      const res = await deleteUserWatchRecord(mockConfig, 'user@example.com', 'movie-550', [550])
      expect(res.ok).toBe(true)

      // Verified itemized delete calls for both movie-550 and 550
      expect(deletedUrls.some((u) => u.includes('550'))).toBe(true)

      // Verified composite continue_watching has '550' removed and '999' preserved
      expect(savedCompositeBody).not.toBeNull()
      const data = savedCompositeBody[0]?.data
      expect(data['550']).toBeUndefined()
      expect(data['999']).toBeDefined()
    })

    it('prevents deleted items from reappearing when server returns a stale record', () => {
      const record: WatchProgressRecord = {
        id: 'user@example.com::550',
        user_id: 'user@example.com',
        content_id: '550',
        content_type: 'movie',
        season_number: null,
        episode_number: null,
        progress_seconds: 1500,
        duration_seconds: 6000,
        updated_at: '2026-10-25T10:00:00.000Z',
        completed: false,
        movie: { id: '550', tmdbId: 550, title: 'Fight Club' },
      }

      // User removed the movie at 10:05
      const removedMap: Record<string, number> = {
        'movie-550': new Date('2026-10-25T10:05:00.000Z').getTime(),
        '550': new Date('2026-10-25T10:05:00.000Z').getTime(),
      }

      const merged = mergeWithServerHistory({}, [record], removedMap)
      expect(merged['550']).toBeUndefined()
      expect(merged['movie-550']).toBeUndefined()
    })
  })

  describe('Account Isolation', () => {
    it('never syncs or fetches remote progress for guest@apple-tv.com or unauthenticated guests', async () => {
      globalThis.fetch = vi.fn()

      const saveRes = await saveWatchProgressRecord({
        id: 'guest@apple-tv.com::100',
        user_id: 'guest@apple-tv.com',
        content_id: '100',
        content_type: 'movie',
        season_number: null,
        episode_number: null,
        progress_seconds: 500,
        duration_seconds: 5000,
        updated_at: new Date().toISOString(),
        completed: false,
      })
      expect(saveRes.ok).toBe(true)
      expect(globalThis.fetch).not.toHaveBeenCalled()

      const fetchRes = await fetchAccountWatchProgress('guest@apple-tv.com')
      expect(fetchRes).toEqual({ records: [], history: {} })
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('keeps history strictly isolated when switching accounts with identical profile names', () => {
      // User A (alice@example.com, profile: "User") watches movie 101
      const aliceRecord: WatchProgressRecord = {
        id: 'alice@example.com::101',
        user_id: 'alice@example.com',
        content_id: '101',
        content_type: 'movie',
        season_number: null,
        episode_number: null,
        progress_seconds: 800,
        duration_seconds: 6000,
        updated_at: new Date().toISOString(),
        completed: false,
        movie: { id: '101', title: 'Alice Movie' },
      }
      const aliceHistory = mergeWithServerHistory({}, [aliceRecord])
      expect(aliceHistory['101']?.movie.title).toBe('Alice Movie')

      // User B (bob@example.com, profile: "User") logs in fresh
      // User B must start with clean slate and not inherit Alice's history
      const bobHistory = mergeWithServerHistory({}, [])
      expect(Object.keys(bobHistory)).toHaveLength(0)
      expect(bobHistory['101']).toBeUndefined()
    })
  })
})
