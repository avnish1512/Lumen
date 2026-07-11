// Client helpers for the Anikoto anime API. These always go through our own
// `/api/anikoto` proxy (server-side), never to anikotoapi.site directly, so we
// respect Anikoto's per-IP rate limits and keep traffic cache-friendly.

export type AnikotoEpisode = {
  id?: string | number
  number?: number
  title?: string
  embed_url?: {
    sub?: string
    dub?: string
  }
  [key: string]: unknown
}

export type AnikotoSeries = {
  ok?: boolean
  id?: string | number
  title?: string
  episodes?: AnikotoEpisode[]
  terms_by_type?: Record<string, string[]>
  [key: string]: unknown
}

export type AnikotoRecentResponse = {
  ok?: boolean
  page?: number
  per_page?: number
  data?: unknown[]
  [key: string]: unknown
}

async function requestProxy<T>(params: URLSearchParams): Promise<T> {
  const response = await fetch(`/api/anikoto?${params}`)
  const body = (await response.json()) as T & { ok?: boolean; error?: string }

  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error ?? 'Could not load Anikoto data.')
  }

  return body
}

export function fetchRecentAnime(page = 1, perPage = 20) {
  const params = new URLSearchParams({
    action: 'recent',
    page: String(page),
    per_page: String(perPage),
  })

  return requestProxy<AnikotoRecentResponse>(params)
}

export function fetchAnimeSeries(id: string | number) {
  const params = new URLSearchParams({
    action: 'series',
    id: String(id),
  })

  return requestProxy<AnikotoSeries>(params)
}
