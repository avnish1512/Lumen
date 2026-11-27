export const IPAPI_IS_BASE = 'https://api.ipapi.is'
export const DEFAULT_IPAPI_IS_KEY = 'b64c8de9731c086866b5'

export function resolveIpApiKey(env?: Record<string, string | undefined>): string {
  const fromEnv = (env?.IPAPI_IS_KEY || env?.VITE_IPAPI_IS_KEY || '').trim()
  return fromEnv || DEFAULT_IPAPI_IS_KEY
}

function isPrivateIpString(ip: string): boolean {
  const clean = ip.trim().toLowerCase()
  if (!clean) return true
  if (clean === '::1' || clean === 'localhost' || clean.startsWith('fe80:') || clean.startsWith('fc') || clean.startsWith('fd')) {
    return true
  }
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(clean)
  if (!v4) return false
  const [a, b] = [Number(v4[1]), Number(v4[2])]
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

export function extractClientPublicIp(
  headers?: Record<string, string | string[] | undefined>,
  remoteAddress?: string,
): string | undefined {
  const xffRaw = headers?.['x-forwarded-for']
  const xff = Array.isArray(xffRaw) ? xffRaw[0] : xffRaw
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first && !isPrivateIpString(first)) return first
  }

  const realIpRaw = headers?.['x-real-ip']
  const realIp = Array.isArray(realIpRaw) ? realIpRaw[0] : realIpRaw
  if (realIp && !isPrivateIpString(realIp)) return realIp.trim()

  if (remoteAddress && !isPrivateIpString(remoteAddress)) {
    return remoteAddress.replace(/^::ffff:/i, '').trim()
  }

  return undefined
}

export interface IpApiProxyRequest {
  query?: string
  ips?: string[]
  apiKey?: string
  timeoutMs?: number
}

export interface IpApiProxyResponse {
  status: number
  data: unknown
}

export async function proxyIpApiLookup({
  query,
  ips,
  apiKey = DEFAULT_IPAPI_IS_KEY,
  timeoutMs = 5000,
}: IpApiProxyRequest): Promise<IpApiProxyResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    // Use POST so the API key stays in the JSON body rather than URLs/logs.
    if (Array.isArray(ips) && ips.length > 0) {
      const cleanedIps = ips
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 100)
      if (cleanedIps.length === 0) {
        return { status: 400, data: { error: 'No valid IPs provided.', error_code: 'ERR_INVALID_BULK_INPUT_EMPTY' } }
      }
      const res = await fetch(IPAPI_IS_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ ips: cleanedIps, key: apiKey }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      const text = await res.text()
      try {
        return { status: res.status, data: JSON.parse(text) }
      } catch {
        return { status: res.status, data: { error: text || `HTTP ${res.status}` } }
      }
    }

    const trimmedQuery = (query || '').trim()
    if (trimmedQuery) {
      const res = await fetch(IPAPI_IS_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ q: trimmedQuery, key: apiKey }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      const text = await res.text()
      try {
        return { status: res.status, data: JSON.parse(text) }
      } catch {
        return { status: res.status, data: { error: text || `HTTP ${res.status}` } }
      }
    }

    // No explicit query: GET without q looks up the caller/server egress IP.
    const res = await fetch(`${IPAPI_IS_BASE}/?key=${encodeURIComponent(apiKey)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    const text = await res.text()
    try {
      return { status: res.status, data: JSON.parse(text) }
    } catch {
      return { status: res.status, data: { error: text || `HTTP ${res.status}` } }
    }
  } catch (err) {
    clearTimeout(timer)
    return {
      status: 502,
      data: {
        error: err instanceof Error ? err.message : 'Failed to reach ipapi.is.',
      },
    }
  }
}
