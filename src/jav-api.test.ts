import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCachedJavCatalog,
  getJavCacheKey,
  INITIAL_JAV_POSTS,
  fetchJavCatalog,
  prefetchJavCatalog,
} from './jav-api'

describe('jav-api caching & performance', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('generates consistent cache keys for categories and sort orders', () => {
    const key1 = getJavCacheKey('All', 'views', 1, '')
    const key2 = getJavCacheKey('All', 'views', 1, '')
    expect(key1).toBe(key2)

    const keyUncensored = getJavCacheKey('Uncensored', 'views', 1, '')
    expect(keyUncensored).not.toBe(key1)
  })

  it('immediately returns pre-warmed seed posts for default view (page 1, All, views) with 0ms latency', () => {
    const cached = getCachedJavCatalog({ page: 1, category: 'All', orderBy: 'views' })
    expect(cached).not.toBeNull()
    expect(cached?.posts.length).toBeGreaterThan(0)
    expect(cached?.posts[0].id).toBe(INITIAL_JAV_POSTS[0].id)
    expect(cached?.totalPosts).toBeGreaterThan(0)
    expect(cached?.totalPages).toBeGreaterThan(0)
  })

  it('contains valid high quality metadata in INITIAL_JAV_POSTS', () => {
    expect(INITIAL_JAV_POSTS.length).toBe(24)
    const first = INITIAL_JAV_POSTS[0]
    expect(first.title).toBeTruthy()
    expect(first.thumbnail).toBeTruthy()
    expect(first.embed_url).toContain('server.apijav.com')
    expect(first.code).toBeTruthy()
  })

  it('handles network failure gracefully by falling back to cached seed data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')))

    const result = await fetchJavCatalog({ page: 1, category: 'All', orderBy: 'views' })
    expect(result.posts.length).toBeGreaterThan(0)
    expect(result.posts[0].id).toBe(INITIAL_JAV_POSTS[0].id)

    vi.unstubAllGlobals()
  })

  it('prefetches without throwing an error in browser-like environment', () => {
    expect(() => prefetchJavCatalog()).not.toThrow()
  })
})
