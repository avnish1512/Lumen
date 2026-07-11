// Live TV integration powered by the iptv-org public API.
// Data is served as static JSON from GitHub Pages with permissive CORS
// (`Access-Control-Allow-Origin: *`), so it can be fetched directly from the
// browser in both local dev (Vite) and production (Vercel) without a proxy.
//
// Source: https://github.com/iptv-org/api

const API_BASE = 'https://iptv-org.github.io/api'

export type LiveChannel = {
  id: string
  name: string
  country: string
  countryName: string
  flag: string
  categories: string[]
  url: string
  quality?: string
}

type RawChannel = {
  id: string
  name: string
  country?: string
  categories?: string[]
  is_nsfw?: boolean
  closed?: string | null
}

type RawStream = {
  channel?: string | null
  url?: string
  quality?: string | null
  label?: string | null
}

type RawCountry = {
  code: string
  name: string
  flag?: string
}

type RawCategory = {
  id: string
  name: string
}

let channelsCache: LiveChannel[] | null = null
let categoriesCache: Map<string, string> | null = null
let inFlight: Promise<LiveChannel[]> | null = null

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}/${path}`)

  if (!response.ok) {
    throw new Error(`iptv-org ${path} request failed (${response.status}).`)
  }

  return (await response.json()) as T
}

function scoreStream(stream: RawStream) {
  let score = 0

  // Prefer streams that are not flagged (geo-blocked / offline) and use HTTPS.
  if (!stream.label) score += 4
  if (stream.url?.startsWith('https://')) score += 2

  const quality = Number.parseInt(stream.quality ?? '', 10)
  if (Number.isFinite(quality)) score += Math.min(quality, 1080) / 1080

  return score
}

/**
 * Fetches and joins iptv-org channels + streams + countries into a flat,
 * ready-to-render list of playable live channels. Results are cached for the
 * lifetime of the page.
 */
export async function fetchLiveChannels(): Promise<LiveChannel[]> {
  if (channelsCache) {
    return channelsCache
  }

  if (inFlight) {
    return inFlight
  }

  inFlight = (async () => {
    const [channels, streams, countries] = await Promise.all([
      fetchJson<RawChannel[]>('channels.json'),
      fetchJson<RawStream[]>('streams.json'),
      fetchJson<RawCountry[]>('countries.json'),
    ])

    const countryByCode = new Map<string, RawCountry>()
    for (const country of countries) {
      countryByCode.set(country.code, country)
    }

    // Keep the best-scoring stream per channel.
    const bestStreamByChannel = new Map<string, RawStream>()
    for (const stream of streams) {
      if (!stream.channel || !stream.url) {
        continue
      }

      const current = bestStreamByChannel.get(stream.channel)
      if (!current || scoreStream(stream) > scoreStream(current)) {
        bestStreamByChannel.set(stream.channel, stream)
      }
    }

    const list: LiveChannel[] = []
    for (const channel of channels) {
      if (channel.is_nsfw || channel.closed) {
        continue
      }

      const stream = bestStreamByChannel.get(channel.id)
      if (!stream?.url) {
        continue
      }

      const country = channel.country ? countryByCode.get(channel.country) : undefined

      list.push({
        id: channel.id,
        name: channel.name,
        country: channel.country ?? '',
        countryName: country?.name ?? channel.country ?? 'Unknown',
        flag: country?.flag ?? '📺',
        categories: channel.categories ?? [],
        url: stream.url,
        quality: stream.quality ?? undefined,
      })
    }

    list.sort((a, b) => a.name.localeCompare(b.name))
    channelsCache = list
    return list
  })()

  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}

export async function fetchLiveCategories(): Promise<Map<string, string>> {
  if (categoriesCache) {
    return categoriesCache
  }

  try {
    const categories = await fetchJson<RawCategory[]>('categories.json')
    const map = new Map<string, string>()
    for (const category of categories) {
      map.set(category.id, category.name)
    }
    categoriesCache = map
    return map
  } catch {
    return new Map()
  }
}

let hlsPromise: Promise<any> | null = null

/**
 * Lazily loads hls.js from a CDN so we can play `.m3u8` live streams in
 * browsers that do not support HLS natively (Chrome / Android WebView).
 */
export function loadHlsJs(): Promise<any> {
  const existing = (window as unknown as { Hls?: unknown }).Hls
  if (existing) {
    return Promise.resolve(existing)
  }

  if (hlsPromise) {
    return hlsPromise
  }

  hlsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js'
    script.async = true
    script.onload = () => resolve((window as unknown as { Hls?: unknown }).Hls)
    script.onerror = () => {
      hlsPromise = null
      reject(new Error('Failed to load the live TV player.'))
    }
    document.head.appendChild(script)
  })

  return hlsPromise
}
