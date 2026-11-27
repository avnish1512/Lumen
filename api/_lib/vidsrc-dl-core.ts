export const VIDSRC_DL_BASE = 'https://dl.vidsrc.party'

export interface VidsrcDlQueryParams {
  id: string
  mediaType?: 'movie' | 'tv' | 'anime'
  season?: number | string
  episode?: number | string
  quality?: string
  format?: 'mp4' | 'mkv'
  sub?: string
  lang?: string
  audio?: string
}

export function buildVidsrcDownloadApiUrl(params: VidsrcDlQueryParams): string {
  const cleanId = encodeURIComponent(String(params.id || '').trim())
  const isTv = params.mediaType === 'tv' || params.mediaType === 'anime'

  let basePath = `${VIDSRC_DL_BASE}/api/download/movie/${cleanId}`
  if (isTv && params.season !== undefined && params.season !== '') {
    const cleanSeason = encodeURIComponent(String(params.season).trim())
    if (params.episode !== undefined && params.episode !== '') {
      const cleanEpisode = encodeURIComponent(String(params.episode).trim())
      basePath = `${VIDSRC_DL_BASE}/api/download/tv/${cleanId}/${cleanSeason}/${cleanEpisode}`
    } else {
      basePath = `${VIDSRC_DL_BASE}/api/download/tv/${cleanId}/${cleanSeason}`
    }
  }

  const qs = new URLSearchParams()
  if (params.quality) qs.set('quality', params.quality)
  if (params.format) qs.set('format', params.format)
  if (params.sub) qs.set('sub', params.sub)
  if (params.lang) qs.set('lang', params.lang)
  if (params.audio) qs.set('audio', params.audio)

  const queryStr = qs.toString()
  return queryStr ? `${basePath}?${queryStr}` : basePath
}

export async function fetchVidsrcDownloadOptions(
  params: VidsrcDlQueryParams,
  env?: Record<string, string | undefined>,
  timeoutMs = 15_000,
): Promise<{ status: number; data: unknown }> {
  const cleanId = String(params.id || '').trim()
  if (!cleanId) {
    return { status: 400, data: { error: 'Missing TMDB or IMDb ID.' } }
  }

  const targetUrl = buildVidsrcDownloadApiUrl(params)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  const apiKey = (env?.DOWNLOAD_API_KEY || env?.VIDSRC_DL_API_KEY || '').trim()
  if (apiKey) {
    headers['x-api-key'] = apiKey
  }

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
    clearTimeout(timer)
    const text = await res.text()
    try {
      return { status: res.status, data: JSON.parse(text) }
    } catch {
      return {
        status: res.status,
        data: { error: text || `Download server returned HTTP ${res.status}.` },
      }
    }
  } catch (err) {
    clearTimeout(timer)
    return {
      status: 502,
      data: {
        error: err instanceof Error ? err.message : 'Could not reach dl.vidsrc.party.',
      },
    }
  }
}
