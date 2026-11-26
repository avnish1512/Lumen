export const ADULTEMBED_V1_BASE = 'https://adultembed.com/api/v1'
export const DEFAULT_ADULTEMBED_API_KEY =
  'ab77210e835eab9470549ada1aaed374807c58d579fac1e6db584db2af3a87a4'

const ALLOWED_FILTER_PARAMS = [
  'query',
  'orientation',
  'content_type',
  'tags',
  'categories',
  'performers',
  'studios',
  'min_duration',
  'max_duration',
  'lang',
  'updated_since',
  'published_since',
  'quality',
  'sort',
  'page',
  'per_page',
]

export function resolveAdultEmbedApiKey(env?: Record<string, string | undefined>): string {
  return (
    env?.ADULTEMBED_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.ADULTEMBED_API_KEY : undefined) ||
    DEFAULT_ADULTEMBED_API_KEY
  )
}

export function buildAdultEmbedTarget(searchParams: URLSearchParams): {
  url: string
  method: 'GET' | 'POST'
  cacheControl: string
} {
  const action = (searchParams.get('action') || 'search').trim().toLowerCase()
  const out = new URLSearchParams()

  const copyAllowed = (keys: string[]) => {
    for (const k of keys) {
      const val = searchParams.get(k)
      if (val !== null && val.trim() !== '') {
        out.set(k, val.trim())
      }
    }
  }

  if (action === 'video') {
    const id = encodeURIComponent((searchParams.get('id') || '').trim())
    copyAllowed(['lang'])
    const qs = out.toString()
    return {
      url: `${ADULTEMBED_V1_BASE}/videos/${id}${qs ? `?${qs}` : ''}`,
      method: 'GET',
      cacheControl: 's-maxage=600, stale-while-revalidate=1800',
    }
  }

  if (action === 'related') {
    const id = encodeURIComponent((searchParams.get('id') || '').trim())
    copyAllowed(['limit', 'lang'])
    const qs = out.toString()
    return {
      url: `${ADULTEMBED_V1_BASE}/videos/${id}/related${qs ? `?${qs}` : ''}`,
      method: 'GET',
      cacheControl: 's-maxage=900, stale-while-revalidate=1800',
    }
  }

  if (action === 'status') {
    const id = encodeURIComponent((searchParams.get('id') || '').trim())
    return {
      url: `${ADULTEMBED_V1_BASE}/videos/${id}/status`,
      method: 'GET',
      cacheControl: 'no-store',
    }
  }

  if (action === 'random') {
    copyAllowed([...ALLOWED_FILTER_PARAMS, 'count'])
    const qs = out.toString()
    return {
      url: `${ADULTEMBED_V1_BASE}/videos/random${qs ? `?${qs}` : ''}`,
      method: 'GET',
      cacheControl: 'no-store',
    }
  }

  if (action === 'trending') {
    copyAllowed([...ALLOWED_FILTER_PARAMS, 'period'])
    if (!out.has('per_page')) out.set('per_page', '24')
    if (!out.has('period')) out.set('period', 'week')
    const qs = out.toString()
    return {
      url: `${ADULTEMBED_V1_BASE}/videos/trending?${qs}`,
      method: 'GET',
      cacheControl: 's-maxage=600, stale-while-revalidate=1800',
    }
  }

  if (
    action === 'categories' ||
    action === 'tags' ||
    action === 'performers' ||
    action === 'studios'
  ) {
    copyAllowed(['query', 'sort', 'page', 'per_page'])
    if (!out.has('per_page')) out.set('per_page', '24')
    return {
      url: `${ADULTEMBED_V1_BASE}/${action}?${out.toString()}`,
      method: 'GET',
      cacheControl: 's-maxage=1800, stale-while-revalidate=3600',
    }
  }

  if (action === 'performer') {
    const slug = encodeURIComponent((searchParams.get('slug') || '').trim())
    return {
      url: `${ADULTEMBED_V1_BASE}/performers/${slug}`,
      method: 'GET',
      cacheControl: 's-maxage=1800, stale-while-revalidate=3600',
    }
  }

  if (action === 'suggest') {
    copyAllowed(['q', 'limit'])
    return {
      url: `${ADULTEMBED_V1_BASE}/suggest?${out.toString()}`,
      method: 'GET',
      cacheControl: 's-maxage=300, stale-while-revalidate=600',
    }
  }

  // Default: 'search'
  copyAllowed(ALLOWED_FILTER_PARAMS)
  if (!out.has('per_page')) out.set('per_page', '24')
  if (!out.has('sort')) out.set('sort', 'popular')
  return {
    url: `${ADULTEMBED_V1_BASE}/search?${out.toString()}`,
    method: 'GET',
    cacheControl: 's-maxage=600, stale-while-revalidate=1800',
  }
}

export async function proxyAdultEmbedRequest(options: {
  searchParams: URLSearchParams
  apiKey?: string
  siteUrl?: string
  timeoutMs?: number
}): Promise<{ status: number; cacheControl: string; data: unknown }> {
  const { url, method, cacheControl } = buildAdultEmbedTarget(options.searchParams)
  const apiKey = options.apiKey || resolveAdultEmbedApiKey()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 4500)

  try {
    const upstream = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey,
        ...(options.siteUrl ? { 'X-Site-URL': options.siteUrl } : {}),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    })
    const data = await upstream.json()
    return {
      status: upstream.status,
      cacheControl,
      data,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
