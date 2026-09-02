import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchGlobalPhubSeed, updateGlobalPhubSeed } from './profiles-api'

describe('PHub Admin Refresh and Seed Sync', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('identifies avnishpc00@gmail.com as the only valid admin for refresh', async () => {
    const adminEmail = 'avnishpc00@gmail.com'
    const nonAdminEmail = 'user@example.com'

    // Mock fetch for updateGlobalPhubSeed
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, seed: 998877 }),
    } as Response)

    // Non-admin should be rejected immediately without calling API
    const nonAdminResult = await updateGlobalPhubSeed(nonAdminEmail, 12345)
    expect(nonAdminResult.ok).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()

    // Admin should proceed with API call
    const adminResult = await updateGlobalPhubSeed(adminEmail, 998877)
    expect(adminResult.ok).toBe(true)
    expect(adminResult.seed).toBe(998877)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/phub-refresh',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          adminEmail: 'avnishpc00@gmail.com',
          seed: 998877,
          adminKey: '',
        }),
      }),
    )
  })

  it('correctly retrieves global PHub seed from server', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, seed: 445566 }),
    } as Response)

    const seed = await fetchGlobalPhubSeed()
    expect(seed).toBe(445566)
    expect(global.fetch).toHaveBeenCalledWith('/api/phub-refresh')
  })

  it('handles server errors gracefully when fetching global PHub seed', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const seed = await fetchGlobalPhubSeed()
    expect(seed).toBeNull()
  })

  it('rotates videos and hero selection when seed changes', () => {
    const sampleVideos = [
      { id: 'vid-1', title: 'Video 1' },
      { id: 'vid-2', title: 'Video 2' },
      { id: 'vid-3', title: 'Video 3' },
      { id: 'vid-4', title: 'Video 4' },
      { id: 'vid-5', title: 'Video 5' },
    ]

    function rotateByOffset<T>(items: T[], offset: number): T[] {
      if (!items || items.length === 0) return items
      const shift = Math.abs(offset) % items.length
      return [...items.slice(shift), ...items.slice(0, shift)]
    }

    const seedA = 100
    const seedB = 102

    const rotatedA = rotateByOffset(sampleVideos, seedA)
    const rotatedB = rotateByOffset(sampleVideos, seedB)

    // Hero movie is the first item in the rotated list
    const heroA = rotatedA[0]
    const heroB = rotatedB[0]

    expect(heroA.id).not.toBe(heroB.id)
    expect(rotatedA).not.toEqual(rotatedB)
  })
})
