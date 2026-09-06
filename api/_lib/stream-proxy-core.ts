export type ProxyRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
}

export type ProxyResponse = {
  statusCode: number
  headersSent?: boolean
  setHeader: (name: string, value: string) => void
  write: (chunk: Uint8Array | string) => boolean | void
  end: (data?: string | Uint8Array) => void
}

/**
 * Stream Proxy Core
 * Proxies media streams (MP4/HLS chunks) with open CORS headers and forwards upstream
 * Referer/User-Agent headers so the browser's download manager can ingest video blobs
 * into IndexedDB without CORS errors.
 */

const ALLOWED_CUSTOM_HEADERS = new Set(['referer', 'user-agent', 'origin', 'range'])

/**
 * Validates that targetUrl is a valid http/https URL and does not target internal/private/loopback/cloud metadata addresses.
 */
export function isSafeProxyUrl(targetUrl: string): { safe: boolean; error?: string } {
  let parsed: URL
  try {
    parsed = new URL(targetUrl)
  } catch {
    return { safe: false, error: 'Invalid URL format.' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, error: 'Only http and https protocols are allowed.' }
  }

  const hostname = parsed.hostname.toLowerCase().trim()

  if (!hostname) {
    return { safe: false, error: 'Missing hostname in target URL.' }
  }

  // Reject internal hostnames and cloud metadata services
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'instance-data'
  ) {
    return { safe: false, error: 'Access to internal or loopback hosts is forbidden.' }
  }

  // Check IPv4 addresses and blocked subnets
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4Match) {
    const octets = [
      parseInt(ipv4Match[1], 10),
      parseInt(ipv4Match[2], 10),
      parseInt(ipv4Match[3], 10),
      parseInt(ipv4Match[4], 10),
    ]
    if (octets.some((o) => o > 255)) {
      return { safe: false, error: 'Invalid IPv4 address.' }
    }

    const [a, b] = octets
    if (a === 0) return { safe: false, error: 'Access to 0.0.0.0/8 is forbidden.' }
    if (a === 127) return { safe: false, error: 'Access to loopback address is forbidden.' }
    if (a === 10) return { safe: false, error: 'Access to private network is forbidden.' }
    if (a === 172 && b >= 16 && b <= 31) return { safe: false, error: 'Access to private network is forbidden.' }
    if (a === 192 && b === 168) return { safe: false, error: 'Access to private network is forbidden.' }
    if (a === 169 && b === 254) return { safe: false, error: 'Access to cloud metadata / link-local address is forbidden.' }
    if (a === 100 && b >= 64 && b <= 127) return { safe: false, error: 'Access to CGNAT address is forbidden.' }
  }

  // Check IPv6 addresses
  if (hostname.startsWith('[') || hostname.includes(':')) {
    const cleanV6 = hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (
      cleanV6 === '::1' ||
      cleanV6 === '::' ||
      cleanV6.startsWith('fe80:') ||
      cleanV6.startsWith('fc') ||
      cleanV6.startsWith('fd')
    ) {
      return { safe: false, error: 'Access to IPv6 private/loopback/link-local address is forbidden.' }
    }
  }

  // Reject integer or hex representations of IP addresses (e.g. 2130706433, 0x7f000001)
  if (/^0x[0-9a-f]+$/i.test(hostname) || /^\d+$/.test(hostname)) {
    return { safe: false, error: 'Integer or hexadecimal IP representations are forbidden.' }
  }

  return { safe: true }
}

export function filterSafeHeaders(headers?: Record<string, string>): Record<string, string> {
  if (!headers || typeof headers !== 'object') return {}
  const safe: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value !== 'string') continue
    const lower = key.toLowerCase().trim()
    if (ALLOWED_CUSTOM_HEADERS.has(lower)) {
      safe[key] = value.replace(/[\r\n]/g, '').trim()
    }
  }
  return safe
}

export async function handleStreamProxyRequest(
  req: ProxyRequest,
  res: ProxyResponse,
  targetUrl: string,
  customHeaders?: Record<string, string>,
): Promise<void> {
  // Add permissive CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Authorization')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const check = isSafeProxyUrl(targetUrl)
  if (!check.safe) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: check.error || 'Valid http/https target URL is required.' }))
    return
  }

  try {
    const safeCustomHeaders = filterSafeHeaders(customHeaders)
    const upstreamHeaders: Record<string, string> = {
      'User-Agent':
        (req.headers['user-agent'] as string) ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: '*/*',
      ...safeCustomHeaders,
    }

    if (req.headers.range) {
      upstreamHeaders.Range = req.headers.range as string
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers: upstreamHeaders,
    })

    res.statusCode = upstreamResponse.status

    // Forward relevant headers
    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
    ]

    for (const header of headersToForward) {
      const val = upstreamResponse.headers.get(header)
      if (val) {
        res.setHeader(header, val)
      }
    }

    if (!upstreamResponse.body) {
      res.end()
      return
    }

    // Stream the body chunks directly to the response
    const reader = upstreamResponse.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        res.write(value)
      }
    }
    res.end()
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to proxy stream chunk.',
        }),
      )
    } else {
      res.end()
    }
  }
}
