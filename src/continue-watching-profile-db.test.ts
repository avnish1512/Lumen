import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildWatchRecordKey,
  fetchUserWatchProgress,
  saveUserWatchRecord,
  deleteUserWatchRecord,
} from '../api/_lib/supabase-core'
import {
  fetchAccountWatchProgress,
  saveWatchProgressRecord,
  clearWatchProgressCache,
  type WatchProgressRecord,
} from './watch-history-api'

describe('Profile-Aware Continue Watching Database & API Integration', () => {
  const originalFetch = globalThis.fetch
  const mockConfig = { url: 'https://test.supabase.co', serviceKey: 'service-key' }

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    clearWatchProgressCache()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('1. Key Generation with Profile Support', () => {
    it('generates profile-isolated keys for movies', () => {
      const keyAlice = buildWatchRecordKey('user@example.com', 'movie-550', null, null, 'alice')
      const keyBob = buildWatchRecordKey('user@example.com', 'movie-550', null, null, 'bob')

      expect(keyAlice).toBe('user@example.com::alice::movie-550')
      expect(keyBob).toBe('user@example.com::bob::movie-550')
      expect(keyAlice).not.toBe(keyBob)
    })

    it('generates profile-isolated keys for TV episodes', () => {
      const key = buildWatchRecordKey('user@example.com', 'tv-1399', 1, 3, 'alice')
      expect(key).toBe('user@example.com::alice::tv-1399::s1e3')
    })

    it('maintains backwards compatibility when profileName is omitted', () => {
      const legacyKey = buildWatchRecordKey('user@example.com', 'movie-550')
      expect(legacyKey).toBe('user@example.com::movie-550')
    })
  })

  describe('2. Supabase Core Fetch & Save Operations', () => {
    it('queries Supabase using profile prefix', async () => {
      let requestedUrl = ''
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        requestedUrl = url
        return {
          ok: true,
          json: async () => [
            {
              key: 'user@example.com::alice::movie-550',
              data: {
                id: 'user@example.com::alice::movie-550',
                user_id: 'user@example.com',
                profile_name: 'alice',
                content_id: 'movie-550',
                progress_seconds: 1200,
                duration_seconds: 7200,
                updated_at: new Date().toISOString(),
                completed: false,
                movie: { id: 'movie-550', title: 'Fight Club' },
              },
            },
          ],
        } as Response
      })

      const res = await fetchUserWatchProgress(mockConfig, 'user@example.com', 'alice')
      expect(requestedUrl).toContain(encodeURIComponent('user@example.com::alice'))
      expect(res.records.length).toBe(1)
      expect(res.history['movie-550']).toBeDefined()
    })

    it('saves watch progress record with profile_name in payload and key', async () => {
      let savedBody: any = null
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          savedBody = JSON.parse(String(init.body))
        }
        return {
          ok: true,
          json: async () => [],
        } as Response
      })

      const record: WatchProgressRecord = {
        id: '',
        user_id: 'user@example.com',
        content_id: 'movie-550',
        content_type: 'movie',
        season_number: null,
        episode_number: null,
        progress_seconds: 300,
        duration_seconds: 7200,
        updated_at: new Date().toISOString(),
        completed: false,
        movie: { id: 'movie-550', title: 'Fight Club' },
      }

      const res = await saveUserWatchRecord(mockConfig, 'user@example.com', record, 'alice')
      expect(res.ok).toBe(true)
      expect(savedBody).not.toBeNull()
      expect(savedBody[0].key).toBe('user@example.com::alice::movie-550')
      expect(savedBody[0].data.profile_name).toBe('alice')
    })

    it('deletes watch progress targeting the specific profile', async () => {
      const deletedUrls: string[] = []
      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          deletedUrls.push(url)
        }
        return {
          ok: true,
          json: async () => [],
        } as Response
      })

      const res = await deleteUserWatchRecord(mockConfig, 'user@example.com', 'movie-550', [], 'alice')
      expect(res.ok).toBe(true)
      expect(deletedUrls.some((u) => u.includes(encodeURIComponent('user@example.com::alice')))).toBe(true)
      expect(deletedUrls.some((u) => u.includes('550'))).toBe(true)
    })
  })

  describe('3. Client API Profile Caching & Requests', () => {
    it('sends profile query parameter when fetching account watch progress', async () => {
      let requestedUrl = ''
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        requestedUrl = url
        return {
          ok: true,
          json: async () => ({
            ok: true,
            records: [],
            history: {},
          }),
        } as Response
      })

      await fetchAccountWatchProgress('user@example.com', 'alice')
      expect(requestedUrl).toContain('key=user%40example.com')
      expect(requestedUrl).toContain('profile=alice')
    })

    it('caches fetch responses briefly to prevent redundant network bursts', async () => {
      let callCount = 0
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++
        return {
          ok: true,
          json: async () => ({
            ok: true,
            records: [],
            history: { 'movie-1': { movie: { id: 'movie-1' }, progress: 50, updatedAt: Date.now() } },
          }),
        } as Response
      })

      // First call -> hits network
      const first = await fetchAccountWatchProgress('user@example.com', 'alice')
      expect(callCount).toBe(1)
      expect(first?.history['movie-1']).toBeDefined()

      // Second call immediately after -> served from memory cache (0ms)
      const second = await fetchAccountWatchProgress('user@example.com', 'alice')
      expect(callCount).toBe(1)
      expect(second?.history['movie-1']).toBeDefined()

      // Saving a record invalidates cache so subsequent call gets fresh data
      await saveWatchProgressRecord({
        id: 'user@example.com::alice::movie-2',
        user_id: 'user@example.com',
        profile_name: 'alice',
        content_id: 'movie-2',
        content_type: 'movie',
        season_number: null,
        episode_number: null,
        progress_seconds: 100,
        duration_seconds: 7200,
        updated_at: new Date().toISOString(),
        completed: false,
      })

      await fetchAccountWatchProgress('user@example.com', 'alice')
      expect(callCount).toBe(3) // 1 fetch + 1 save + 1 refreshed fetch
    })
  })
})
