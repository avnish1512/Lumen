import dns from 'node:dns/promises'
import net from 'node:net'

export interface UrlSecurityOptions {
  /**
   * ONLY for unit/integration tests spinning up ephemeral 127.0.0.1 mock HTTP servers.
   * Never exposed via IPC or UI settings.
   */
  allowLoopbackForTests?: boolean
  timeoutMs?: number
  maxRedirects?: number
  userAgent?: string
}

export class UrlSecurityError extends Error {
  public readonly code: 'INVALID_URL' | 'SSRF_BLOCKED' | 'UNREACHABLE' | 'REDIRECT_LIMIT'

  constructor(
    message: string,
    code: 'INVALID_URL' | 'SSRF_BLOCKED' | 'UNREACHABLE' | 'REDIRECT_LIMIT',
  ) {
    super(message)
    this.name = 'UrlSecurityError'
    this.code = code
  }
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.goog',
])

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let result = 0
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null
    const octet = Number(part)
    if (octet < 0 || octet > 255) return null
    result = ((result << 8) | octet) >>> 0
  }
  return result
}

function inCidr4(ipInt: number, baseStr: string, prefixLen: number): boolean {
  const baseInt = ipv4ToInt(baseStr)
  if (baseInt === null) return false
  const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0
  return (ipInt & mask) === (baseInt & mask)
}

function extractMappedIpv4(ip6: string): string | null {
  const lower = ip6.toLowerCase()
  const mappedPrefix = '::ffff:'
  if (!lower.startsWith(mappedPrefix)) return null
  const tail = lower.slice(mappedPrefix.length)
  if (net.isIP(tail) === 4) return tail
  // Check hex representation ::ffff:7f00:0001
  const hexMatch = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(tail)
  if (!hexMatch) return null
  const hi = parseInt(hexMatch[1], 16)
  const lo = parseInt(hexMatch[2], 16)
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const version = net.isIP(ip)
  if (version === 4) {
    const ipInt = ipv4ToInt(ip)
    if (ipInt === null) return true
    return (
      inCidr4(ipInt, '0.0.0.0', 8) ||
      inCidr4(ipInt, '10.0.0.0', 8) ||
      inCidr4(ipInt, '100.64.0.0', 10) ||
      inCidr4(ipInt, '127.0.0.0', 8) ||
      inCidr4(ipInt, '169.254.0.0', 16) ||
      inCidr4(ipInt, '172.16.0.0', 12) ||
      inCidr4(ipInt, '192.0.0.0', 24) ||
      inCidr4(ipInt, '192.0.2.0', 24) ||
      inCidr4(ipInt, '192.168.0.0', 16) ||
      inCidr4(ipInt, '198.18.0.0', 15) ||
      inCidr4(ipInt, '198.51.100.0', 24) ||
      inCidr4(ipInt, '203.0.113.0', 24) ||
      inCidr4(ipInt, '224.0.0.0', 4) ||
      inCidr4(ipInt, '240.0.0.0', 4)
    )
  }

  if (version === 6) {
    const zoneIdx = ip.indexOf('%')
    const cleanIp = (zoneIdx >= 0 ? ip.slice(0, zoneIdx) : ip).toLowerCase()
    if (cleanIp === '::' || cleanIp === '::1') return true
    const mapped4 = extractMappedIpv4(cleanIp)
    if (mapped4) return isPrivateOrReservedIp(mapped4)
    const firstWord = parseInt(cleanIp.split(':')[0] || '0', 16)
    // fc00::/7 (Unique Local)
    if ((firstWord & 0xfe00) === 0xfc00) return true
    // fe80::/10 (Link-local)
    if ((firstWord & 0xffc0) === 0xfe80) return true
    // ff00::/8 (Multicast)
    if ((firstWord & 0xff00) === 0xff00) return true
    // 2001:db8::/32 (Documentation)
    if (cleanIp.startsWith('2001:db8:') || cleanIp.startsWith('2001:0db8:')) return true
    return false
  }

  return true
}

export function validateUrlSyntax(rawUrl: string): URL {
  const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!trimmed || trimmed.length > 2048) {
    throw new UrlSecurityError('Please enter a valid HTTP or HTTPS URL (max 2048 characters).', 'INVALID_URL')
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new UrlSecurityError('The URL format is invalid.', 'INVALID_URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UrlSecurityError(
      `Unsupported URL protocol "${parsed.protocol}". Only http:// and https:// URLs are allowed.`,
      'INVALID_URL',
    )
  }

  if (!parsed.hostname) {
    throw new UrlSecurityError('URL must contain a valid hostname.', 'INVALID_URL')
  }

  if (parsed.username || parsed.password) {
    throw new UrlSecurityError('URLs containing embedded credentials are blocked for security.', 'SSRF_BLOCKED')
  }

  return parsed
}

export async function assertSafeRemoteUrl(
  rawUrl: string,
  options?: UrlSecurityOptions,
): Promise<URL> {
  const parsed = validateUrlSyntax(rawUrl)
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (!options?.allowLoopbackForTests) {
    if (
      BLOCKED_HOSTNAMES.has(hostname) ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.localhost')
    ) {
      throw new UrlSecurityError(
        `Access to internal or local hostname "${hostname}" is blocked.`,
        'SSRF_BLOCKED',
      )
    }

    if (net.isIP(hostname) !== 0) {
      if (isPrivateOrReservedIp(hostname)) {
        throw new UrlSecurityError(
          `Direct access to private or reserved IP address "${hostname}" is blocked.`,
          'SSRF_BLOCKED',
        )
      }
      return parsed
    }

    let records: Array<{ address: string; family: number }>
    try {
      records = await dns.lookup(hostname, { all: true, verbatim: true })
    } catch {
      throw new UrlSecurityError(
        `Host "${hostname}" could not be resolved or is unreachable.`,
        'UNREACHABLE',
      )
    }

    if (!records || records.length === 0) {
      throw new UrlSecurityError(`No DNS records found for "${hostname}".`, 'UNREACHABLE')
    }

    for (const record of records) {
      if (isPrivateOrReservedIp(record.address)) {
        throw new UrlSecurityError(
          `Blocked request: "${hostname}" resolved to restricted address ${record.address}.`,
          'SSRF_BLOCKED',
        )
      }
    }
  } else {
    // Even in local mock server test mode, allow ONLY literal 127.0.0.1 / ::1 / localhost,
    // still blocking private LAN/metadata ranges like 10.x, 192.168.x, 169.254.x!
    const isTestLoopback =
      hostname === '127.0.0.1' || hostname === '::1' || hostname === 'localhost'
    if (!isTestLoopback && net.isIP(hostname) !== 0 && isPrivateOrReservedIp(hostname)) {
      throw new UrlSecurityError(
        `Direct access to private or reserved IP address "${hostname}" is blocked.`,
        'SSRF_BLOCKED',
      )
    }
  }

  return parsed
}

export interface SafeFetchResult {
  response: Response
  finalUrl: string
  redirectChain: string[]
}

const DEFAULT_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export async function safeFetchWithRedirects(
  rawUrl: string,
  init: {
    method?: 'GET' | 'HEAD'
    headers?: Record<string, string>
    signal?: AbortSignal
  } = {},
  securityOptions?: UrlSecurityOptions,
): Promise<SafeFetchResult> {
  const maxRedirects = securityOptions?.maxRedirects ?? 5
  const timeoutMs = securityOptions?.timeoutMs ?? 15_000
  const redirectChain: string[] = []
  let currentUrl = (await assertSafeRemoteUrl(rawUrl, securityOptions)).toString()

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs)
    const onExternalAbort = () => controller.abort(init.signal?.reason)

    if (init.signal) {
      if (init.signal.aborted) {
        clearTimeout(timeoutId)
        throw new DOMException('Aborted', 'AbortError')
      }
      init.signal.addEventListener('abort', onExternalAbort, { once: true })
    }

    let response: Response
    try {
      response = await fetch(currentUrl, {
        method: init.method ?? 'GET',
        headers: {
          'User-Agent': securityOptions?.userAgent ?? DEFAULT_BROWSER_UA,
          ...init.headers,
        },
        redirect: 'manual',
        signal: controller.signal,
      })
    } catch (err) {
      if (init.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      const message = err instanceof Error ? err.message : 'Network request failed'
      throw new UrlSecurityError(`Failed to reach "${currentUrl}": ${message}`, 'UNREACHABLE')
    } finally {
      clearTimeout(timeoutId)
      init.signal?.removeEventListener('abort', onExternalAbort)
    }

    const isRedirect =
      response.status === 301 ||
      response.status === 302 ||
      response.status === 303 ||
      response.status === 307 ||
      response.status === 308

    if (isRedirect) {
      const location = response.headers.get('location')
      // Drain redirect body cleanly so sockets are not leaked
      await response.body?.cancel().catch(() => {})
      if (!location) {
        return { response, finalUrl: currentUrl, redirectChain }
      }
      if (hop === maxRedirects) {
        throw new UrlSecurityError(`Too many redirects (exceeded ${maxRedirects} hops).`, 'REDIRECT_LIMIT')
      }
      const nextRawUrl = new URL(location, currentUrl).toString()
      const validatedNext = await assertSafeRemoteUrl(nextRawUrl, securityOptions)
      redirectChain.push(currentUrl)
      currentUrl = validatedNext.toString()
      continue
    }

    return { response, finalUrl: currentUrl, redirectChain }
  }

  throw new UrlSecurityError('Unexpected redirect loop.', 'REDIRECT_LIMIT')
}
