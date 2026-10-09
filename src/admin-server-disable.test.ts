import { describe, expect, it, beforeEach } from 'vitest'
import { streamProviderOptions, type StreamProvider } from './tmdb'

describe('Admin Server Disabling feature', () => {
  const adminDisabledServersKey = 'lumen.disabledServers.admin'

  beforeEach(() => {
    window.localStorage.clear()
  })

  function readDisabledServers(): string[] {
    try {
      const saved = window.localStorage.getItem(adminDisabledServersKey)
      if (!saved) return []
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed.map((s) => String(s).trim()).filter(Boolean) : []
    } catch {
      return []
    }
  }

  function saveDisabledServers(servers: string[]) {
    try {
      if (servers && servers.length > 0) {
        window.localStorage.setItem(adminDisabledServersKey, JSON.stringify(servers))
      } else {
        window.localStorage.removeItem(adminDisabledServersKey)
      }
    } catch {}
  }

  it('reads and saves disabled servers to localStorage', () => {
    expect(readDisabledServers()).toEqual([])

    saveDisabledServers(['autoembed', 'primesrc'])
    expect(readDisabledServers()).toEqual(['autoembed', 'primesrc'])

    // Clearing/empty array removes key
    saveDisabledServers([])
    expect(readDisabledServers()).toEqual([])
    expect(window.localStorage.getItem(adminDisabledServersKey)).toBeNull()
  })

  it('filters out disabled servers for non-admin users', () => {
    const disabledList = ['autoembed', 'vidcore']
    const isAdmin = false

    const allMainstream = streamProviderOptions.filter(
      (p) => !['oceanplay', 'apijav', 'phubplay', 'upload18', 'eporner'].includes(p.id)
    )

    const userVisibleServers = allMainstream.filter(
      (p) => isAdmin || !disabledList.includes(p.id)
    )

    expect(userVisibleServers.some((p) => p.id === 'autoembed')).toBe(false)
    expect(userVisibleServers.some((p) => p.id === 'vidcore')).toBe(false)
    expect(userVisibleServers.some((p) => p.id === 'rivestream')).toBe(true)
    expect(userVisibleServers.some((p) => p.id === 'embedwave')).toBe(true)
  })

  it('keeps all servers visible for admin users so admin can toggle them', () => {
    const disabledList = ['autoembed', 'vidcore']
    const isAdmin = true

    const allMainstream = streamProviderOptions.filter(
      (p) => !['oceanplay', 'apijav', 'phubplay', 'upload18', 'eporner'].includes(p.id)
    )

    const adminVisibleServers = allMainstream.filter(
      (p) => isAdmin || !disabledList.includes(p.id)
    )

    expect(adminVisibleServers.some((p) => p.id === 'autoembed')).toBe(true)
    expect(adminVisibleServers.some((p) => p.id === 'vidcore')).toBe(true)
    expect(adminVisibleServers.some((p) => p.id === 'rivestream')).toBe(true)
  })

  it('automatically falls back to an enabled mainstream server if chosen provider is disabled', () => {
    const mainstreamProviders: StreamProvider[] = [
      'rivestream', 'vidrift', 'vidcore', 'embedwave', 'vsembed', 'vidsrcbuzz',
      'cinesrc', 'embedapi', 'vidphantom', 'mgeb', 'autoembed', 'primesrc', 'embedmaster', 'filmu'
    ]
    const disabledList = ['autoembed']
    const isAdmin = false
    const defaultStreamProvider: StreamProvider = 'rivestream'
    const rawChosen: StreamProvider = 'autoembed'

    const enabledMainstreamFallback = mainstreamProviders.find((p) => !disabledList.includes(p)) ?? defaultStreamProvider
    const chosenProvider = (!isAdmin && disabledList.includes(rawChosen))
      ? enabledMainstreamFallback
      : rawChosen

    expect(chosenProvider).toBe('rivestream')
    expect(chosenProvider).not.toBe('autoembed')
  })

  it('preserves admin selection even if the server is currently disabled', () => {
    const mainstreamProviders: StreamProvider[] = [
      'rivestream', 'vidrift', 'vidcore', 'embedwave', 'vsembed', 'vidsrcbuzz',
      'cinesrc', 'embedapi', 'vidphantom', 'mgeb', 'autoembed', 'primesrc', 'embedmaster', 'filmu'
    ]
    const disabledList = ['autoembed']
    const isAdmin = true
    const defaultStreamProvider: StreamProvider = 'rivestream'
    const rawChosen: StreamProvider = 'autoembed'

    const enabledMainstreamFallback = mainstreamProviders.find((p) => !disabledList.includes(p)) ?? defaultStreamProvider
    const chosenProvider = (!isAdmin && disabledList.includes(rawChosen))
      ? enabledMainstreamFallback
      : rawChosen

    expect(chosenProvider).toBe('autoembed')
  })
})
