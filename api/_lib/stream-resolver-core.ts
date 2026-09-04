/**
 * Stream Resolver Engine for Lumen Downloads
 * Resolves movies, series, and anime into direct, downloadable stream URLs (.mp4 or .m3u8)
 * and generates CORS-proxied URLs for direct browser IndexedDB ingestion.
 */

export type ResolveStreamRequest = {
  id?: string
  tmdbId?: number | string
  imdbId?: string
  title: string
  year?: string
  mediaType?: 'movie' | 'tv' | 'anime' | 'drama'
  season?: number
  episode?: number
  provider?: string
  server?: string
  quality?: string
  directUrl?: string
}

export type ResolvedStream = {
  ok: boolean
  streamUrl?: string
  format?: 'mp4' | 'hls' | 'stream'
  quality?: string
  headers?: Record<string, string>
  proxiedUrl?: string
  source?: string
  error?: string
}

const REQUEST_TIMEOUT_MS = 8000

/**
 * Checks if a URL is already a direct playable/downloadable binary video
 */
export function isDirectBinaryUrl(url?: string): boolean {
  if (!url) return false
  const clean = url.trim().toLowerCase()
  return (
    clean.endsWith('.mp4') ||
    clean.includes('.mp4?') ||
    clean.endsWith('.m3u8') ||
    clean.includes('.m3u8?') ||
    clean.endsWith('.webm') ||
    clean.includes('.webm?') ||
    clean.startsWith('blob:')
  )
}

/**
 * Builds a CORS-proxied URL that browser fetch can download without cross-origin blocks
 */
export function buildProxiedStreamUrl(
  streamUrl: string,
  customHeaders?: Record<string, string>,
): string {
  const params = new URLSearchParams({ url: streamUrl })
  if (customHeaders && Object.keys(customHeaders).length > 0) {
    params.set('headers', JSON.stringify(customHeaders))
  }
  return `/api/stream-proxy?${params.toString()}`
}

/**
 * Attempt to resolve direct stream for anime via Anikoto / MegaPlay
 */
async function resolveAnimeStream(
  req: ResolveStreamRequest,
): Promise<ResolvedStream | null> {
  const ep = req.episode ?? 1

  // 1. Try Anikoto public API if available
  if (req.id || req.title) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      const searchQuery = encodeURIComponent(req.title.trim())
      const searchRes = await fetch(`https://anikotoapi.site/search?keyword=${searchQuery}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      clearTimeout(timeout)

      if (searchRes.ok) {
        const data = (await searchRes.json()) as { results?: Array<{ id: string }> }
        if (data.results && data.results.length > 0) {
          const animeId = data.results[0].id
          const epRes = await fetch(`https://anikotoapi.site/episode?id=${animeId}&ep=${ep}`)
          if (epRes.ok) {
            const epData = (await epRes.json()) as { stream?: string; sources?: Array<{ url: string; isM3U8?: boolean }> }
            const streamUrl = epData.stream || epData.sources?.[0]?.url
            if (streamUrl && isDirectBinaryUrl(streamUrl)) {
              return {
                ok: true,
                streamUrl,
                format: streamUrl.includes('.m3u8') ? 'hls' : 'mp4',
                quality: '1080p',
                proxiedUrl: buildProxiedStreamUrl(streamUrl, { Referer: 'https://anikotoapi.site/' }),
                source: 'Anikoto',
              }
            }
          }
        }
      }
    } catch {
      // Best-effort
    }
  }

  return null
}

/**
 * Attempt to resolve direct stream for movies/TV shows via SuperEmbed / VidSrc / CineSrc
 */
async function resolveMovieTvStream(
  req: ResolveStreamRequest,
): Promise<ResolvedStream | null> {
  const isTv = req.mediaType === 'tv' || (req.season && req.season > 0)
  const season = req.season ?? 1
  const episode = req.episode ?? 1
  let tmdb = req.tmdbId ? String(req.tmdbId) : ''
  let imdb = req.imdbId ? String(req.imdbId) : ''

  if (tmdb.startsWith('tt') && !imdb) {
    imdb = tmdb
    tmdb = ''
  }

  if (!tmdb && !imdb) {
    return null
  }

  const qualityLabel = req.quality || '1080p'
  const chosenServer = (req.server || 'auto').toLowerCase()

  // 1. SuperEmbed resolver check
  if (chosenServer === 'auto' || chosenServer === 'superembed' || chosenServer === 'vidsync') {
    try {
      const params = new URLSearchParams()
      params.set('video_id', imdb || tmdb)
      params.set('tmdb', imdb ? '0' : '1')
      if (isTv) {
        params.set('season', String(season))
        params.set('episode', String(episode))
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      const seRes = await fetch(`https://getsuperembed.link/?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: 'text/html,application/json,*/*' },
      })
      clearTimeout(timeout)

      if (seRes.ok) {
        const text = await seRes.text()
        const m3u8Match = text.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i)
        const mp4Match = text.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i)
        const foundUrl = mp4Match?.[1] || m3u8Match?.[1]

        if (foundUrl) {
          return {
            ok: true,
            streamUrl: foundUrl,
            format: foundUrl.includes('.m3u8') ? 'hls' : 'mp4',
            quality: qualityLabel,
            proxiedUrl: buildProxiedStreamUrl(foundUrl, { Referer: 'https://getsuperembed.link/' }),
            source: 'SuperEmbed',
          }
        }
      }
    } catch {
      // Best-effort
    }
  }

  // 2. CineSrc stream resolver check
  if (tmdb && (chosenServer === 'auto' || chosenServer === 'cinesrc')) {
    try {
      const cinesrcUrl = isTv
        ? `https://cinesrc.st/embed/tv/${tmdb}/${season}/${episode}`
        : `https://cinesrc.st/embed/movie/${tmdb}`

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      const res = await fetch(cinesrcUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'text/html,application/json,*/*',
        },
      })
      clearTimeout(timeout)

      if (res.ok) {
        const body = await res.text()
        const streamMatch = body.match(/(https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*)/i)
        if (streamMatch?.[1]) {
          const direct = streamMatch[1]
          return {
            ok: true,
            streamUrl: direct,
            format: direct.includes('.m3u8') ? 'hls' : 'mp4',
            quality: qualityLabel,
            proxiedUrl: buildProxiedStreamUrl(direct, { Referer: 'https://cinesrc.st/' }),
            source: 'CineSrc',
          }
        }
      }
    } catch {
      // Best-effort
    }
  }

  // 3. EmbedAPI resolver check
  if (tmdb && (chosenServer === 'auto' || chosenServer === 'embedapi')) {
    try {
      const embedApiUrl = isTv
        ? `https://embedapi.com/embed/tv/${tmdb}/${season}/${episode}`
        : `https://embedapi.com/embed/movie/${tmdb}`

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      const res = await fetch(embedApiUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'text/html,application/json,*/*',
        },
      })
      clearTimeout(timeout)

      if (res.ok) {
        const body = await res.text()
        const streamMatch = body.match(/(https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*)/i)
        if (streamMatch?.[1]) {
          const direct = streamMatch[1]
          return {
            ok: true,
            streamUrl: direct,
            format: direct.includes('.m3u8') ? 'hls' : 'mp4',
            quality: qualityLabel,
            proxiedUrl: buildProxiedStreamUrl(direct, { Referer: 'https://embedapi.com/' }),
            source: 'EmbedAPI',
          }
        }
      }
    } catch {
      // Best-effort
    }
  }

  // 4. PrimeSrc resolver check
  if (tmdb && (chosenServer === 'auto' || chosenServer === 'primesrc')) {
    try {
      const primeSrcUrl = isTv
        ? `https://primesrc.net/embed/tv/${tmdb}/${season}/${episode}`
        : `https://primesrc.net/embed/movie/${tmdb}`

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      const res = await fetch(primeSrcUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'text/html,application/json,*/*',
        },
      })
      clearTimeout(timeout)

      if (res.ok) {
        const body = await res.text()
        const streamMatch = body.match(/(https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*)/i)
        if (streamMatch?.[1]) {
          const direct = streamMatch[1]
          return {
            ok: true,
            streamUrl: direct,
            format: direct.includes('.m3u8') ? 'hls' : 'mp4',
            quality: qualityLabel,
            proxiedUrl: buildProxiedStreamUrl(direct, { Referer: 'https://primesrc.net/' }),
            source: 'PrimeSrc',
          }
        }
      }
    } catch {
      // Best-effort
    }
  }

  return null
}

/**
 * Main resolution handler: executes the resolution chain across anime, movies, and TV
 */
export async function resolveStreamSources(
  req: ResolveStreamRequest,
): Promise<ResolvedStream> {
  // Check if caller already provided a direct binary URL
  if (req.directUrl && isDirectBinaryUrl(req.directUrl)) {
    return {
      ok: true,
      streamUrl: req.directUrl,
      format: req.directUrl.includes('.m3u8') ? 'hls' : 'mp4',
      quality: 'HD',
      proxiedUrl: buildProxiedStreamUrl(req.directUrl),
      source: 'DirectStream',
    }
  }

  // 1. Anime resolution
  if (req.mediaType === 'anime') {
    const animeResult = await resolveAnimeStream(req)
    if (animeResult) return animeResult
  }

  // 2. Movie/TV resolution
  const movieResult = await resolveMovieTvStream(req)
  if (movieResult) return movieResult

  // 3. Fallback: return direct proxy with default stream resolver metadata
  return {
    ok: false,
    error: 'No direct downloadable stream could be resolved for this title. Using cached offline player package.',
  }
}
