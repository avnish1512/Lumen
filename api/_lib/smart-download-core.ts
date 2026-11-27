import crypto from 'node:crypto'
import dns from 'node:dns/promises'
import net from 'node:net'

export type SmartAppStatus =
  | 'Idle'
  | 'Analyzing URL'
  | 'Direct MP4 found'
  | 'Streaming-only source'
  | 'Protected or restricted source'
  | 'Unsupported URL'
  | 'Ready to download'
  | 'Downloading'
  | 'Completed'
  | 'Failed'

export type SmartDeliveryFormat =
  | 'Direct MP4'
  | 'HLS'
  | 'DASH'
  | 'Other supported format'
  | 'Unknown'

export interface SmartCandidateSource {
  url: string
  format: SmartDeliveryFormat
  sourceKind:
    | 'direct-endpoint'
    | 'video-tag'
    | 'source-tag'
    | 'meta-tag'
    | 'download-link'
    | 'json-ld'
  contentType?: string
  contentLength?: number
  verifiedMp4: boolean
  permitted: boolean
  reason?: string
}

export interface SmartAnalysisResult {
  id: string
  inputUrl: string
  finalUrl: string
  host: string
  status: SmartAppStatus
  deliveryFormat: SmartDeliveryFormat
  title: string
  httpStatus?: number
  contentType?: string
  contentLength?: number
  downloadable: boolean
  permittedSourceUrl?: string
  suggestedFileName: string
  explanation: string
  alternativeSuggestion?: string
  error?: string
  signals: {
    hasDrmSignals: boolean
    hasAntiBotOrChallenge: boolean
    hasAuthGate: boolean
    hasHlsManifest: boolean
    hasDashManifest: boolean
    explicitDownloadLinkFound: boolean
  }
  candidates: SmartCandidateSource[]
  analyzedAt: string
}

export interface SmartUrlSecurityOptions {
  allowLoopbackForTests?: boolean
  timeoutMs?: number
  maxRedirects?: number
  userAgent?: string
}

export class SmartUrlSecurityError extends Error {
  public readonly code: 'INVALID_URL' | 'SSRF_BLOCKED' | 'UNREACHABLE' | 'REDIRECT_LIMIT'

  constructor(
    message: string,
    code: 'INVALID_URL' | 'SSRF_BLOCKED' | 'UNREACHABLE' | 'REDIRECT_LIMIT',
  ) {
    super(message)
    this.name = 'SmartUrlSecurityError'
    this.code = code
  }
}

export const NO_PERMITTED_MP4_MESSAGE =
  'No permitted direct MP4 download source was found. This embed may be streaming-only or restricted.'

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.goog',
])

const WINDOWS_RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
])

const KNOWN_TEXT_PREFIXES = [
  '<!doctype',
  '<html',
  '<head',
  '<body',
  '<?xml',
  '{"',
  '[{"',
  '<svg',
  '<script',
]

const DRM_TEXT_PATTERNS = [
  /requestMediaKeySystemAccess/i,
  /com\.widevine\.alpha/i,
  /com\.microsoft\.playready/i,
  /com\.apple\.fps/i,
  /encrypted-media/i,
  /\bDRM[\s-]*protected\b/i,
]

const CHALLENGE_TEXT_PATTERNS = [
  /challenges\.cloudflare\.com\/turnstile/i,
  /cf-browser-verification/i,
  /checking your browser before accessing/i,
  /\bhcaptcha\.com\b/i,
  /google\.com\/recaptcha/i,
  /ddos-guard/i,
  /__ddg[12]_/i,
]

const AUTH_PAYWALL_PATTERNS = [
  /sign\s+in\s+to\s+watch/i,
  /subscription\s+required/i,
  /members\s+only/i,
  /access\s+denied/i,
]

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
    if ((firstWord & 0xfe00) === 0xfc00) return true
    if ((firstWord & 0xffc0) === 0xfe80) return true
    if (cleanIp.startsWith('ff')) return true
    return false
  }

  return true
}

export async function assertSafeRemoteUrl(
  rawUrl: string,
  options?: SmartUrlSecurityOptions,
): Promise<URL> {
  const trimmed = (rawUrl || '').trim()
  if (!trimmed) {
    throw new SmartUrlSecurityError('Please enter a video embed URL.', 'INVALID_URL')
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new SmartUrlSecurityError('The URL format is invalid.', 'INVALID_URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SmartUrlSecurityError(
      `Unsupported URL scheme "${parsed.protocol}". Only http:// and https:// URLs are supported.`,
      'INVALID_URL',
    )
  }

  if (parsed.username || parsed.password) {
    throw new SmartUrlSecurityError('URLs with embedded credentials are not allowed.', 'SSRF_BLOCKED')
  }

  const host = parsed.hostname.toLowerCase()
  const allowLoopback = Boolean(options?.allowLoopbackForTests)

  if (!allowLoopback) {
    if (
      BLOCKED_HOSTNAMES.has(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.localhost')
    ) {
      throw new SmartUrlSecurityError(
        'Access to local or internal hostnames is blocked for security.',
        'SSRF_BLOCKED',
      )
    }

    if (net.isIP(host) !== 0) {
      if (isPrivateOrReservedIp(host)) {
        throw new SmartUrlSecurityError(
          'Access to private or reserved IP ranges is blocked for security.',
          'SSRF_BLOCKED',
        )
      }
      return parsed
    }

    let records: Array<{ address: string; family: number }>
    try {
      records = await dns.lookup(host, { all: true, verbatim: true })
    } catch {
      throw new SmartUrlSecurityError(`Host "${host}" could not be resolved.`, 'UNREACHABLE')
    }

    if (!records || records.length === 0) {
      throw new SmartUrlSecurityError(`Host "${host}" resolved to no addresses.`, 'UNREACHABLE')
    }

    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        throw new SmartUrlSecurityError(
          `Host "${host}" resolved to a private or reserved network address and was blocked.`,
          'SSRF_BLOCKED',
        )
      }
    }
  } else {
    const isLoopback = host === '127.0.0.1' || host === '::1' || host === 'localhost'
    if (!isLoopback && net.isIP(host) !== 0 && isPrivateOrReservedIp(host)) {
      throw new SmartUrlSecurityError('Private IP address blocked.', 'SSRF_BLOCKED')
    }
  }

  return parsed
}

export async function safeFetchWithRedirects(
  rawUrl: string,
  init: RequestInit = {},
  options?: SmartUrlSecurityOptions,
): Promise<{ response: Response; finalUrl: string }> {
  const maxRedirects = options?.maxRedirects ?? 5
  const timeoutMs = options?.timeoutMs ?? 10000
  let currentUrl = rawUrl

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const safeUrl = await assertSafeRemoteUrl(currentUrl, options)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const headers = new Headers(init.headers)
    if (!headers.has('User-Agent')) {
      headers.set('User-Agent', options?.userAgent || DEFAULT_USER_AGENT)
    }

    let response: Response
    try {
      response = await fetch(safeUrl.toString(), {
        ...init,
        headers,
        redirect: 'manual',
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timer)
      const msg = err instanceof Error ? err.message : 'Network error'
      throw new SmartUrlSecurityError(`Could not reach "${safeUrl.hostname}": ${msg}`, 'UNREACHABLE')
    }
    clearTimeout(timer)

    if (
      response.status === 301 ||
      response.status === 302 ||
      response.status === 303 ||
      response.status === 307 ||
      response.status === 308
    ) {
      const location = response.headers.get('location')
      await response.body?.cancel().catch(() => {})
      if (!location) {
        return { response, finalUrl: safeUrl.toString() }
      }
      if (hop === maxRedirects) {
        throw new SmartUrlSecurityError('Too many redirects while resolving URL.', 'REDIRECT_LIMIT')
      }
      currentUrl = new URL(location, safeUrl).toString()
      continue
    }

    return { response, finalUrl: safeUrl.toString() }
  }

  throw new SmartUrlSecurityError('Redirect loop detected.', 'REDIRECT_LIMIT')
}

export function sanitizeFileName(rawName: string, fallback = 'video'): string {
  const withoutControls = Array.from(rawName || '')
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join('')

  let cleaned = withoutControls
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')

  if (cleaned.toLowerCase().endsWith('.mp4')) {
    cleaned = cleaned.slice(0, -4).replace(/[.\s]+$/g, '')
  }

  if (!cleaned) cleaned = fallback
  if (WINDOWS_RESERVED_NAMES.has(cleaned.toUpperCase())) {
    cleaned = `${cleaned}_video`
  }

  if (cleaned.length > 100) {
    cleaned = cleaned.slice(0, 100).trim()
  }

  return `${cleaned}.mp4`
}

export function deriveTitleFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    if (last) {
      return decodeURIComponent(last).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').trim() || parsed.hostname
    }
    return parsed.hostname
  } catch {
    return 'video'
  }
}

export function validateMp4HeaderBuffer(buffer: Uint8Array): {
  valid: boolean
  reason?: string
  majorBrand?: string
  looksLikeHtmlOrText?: boolean
} {
  if (!buffer || buffer.length < 12) {
    return {
      valid: false,
      reason: 'File is empty or too small to be a valid MP4 video container.',
    }
  }

  const headAscii = Buffer.from(buffer.subarray(0, Math.min(64, buffer.length)))
    .toString('utf8')
    .trimStart()
    .toLowerCase()

  for (const prefix of KNOWN_TEXT_PREFIXES) {
    if (headAscii.startsWith(prefix)) {
      return {
        valid: false,
        looksLikeHtmlOrText: true,
        reason: 'Received an HTML/JSON error page instead of binary MP4 video data.',
      }
    }
  }

  const boxSize =
    ((buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3]) >>> 0
  const boxType = Buffer.from(buffer.subarray(4, 8)).toString('ascii')

  if (boxType === 'ftyp') {
    const majorBrand = Buffer.from(buffer.subarray(8, 12)).toString('ascii')
    if (boxSize < 12) {
      return { valid: false, reason: 'Invalid MP4 ftyp header box size.' }
    }
    return { valid: true, majorBrand }
  }

  if ((boxType === 'free' || boxType === 'skip' || boxType === 'wide') && buffer.length >= 24) {
    if (boxSize >= 8 && boxSize + 8 <= buffer.length) {
      const nextType = Buffer.from(buffer.subarray(boxSize + 4, boxSize + 8)).toString('ascii')
      if (nextType === 'ftyp' || nextType === 'moov') {
        return { valid: true, majorBrand: nextType }
      }
    }
  }

  return {
    valid: false,
    reason: `Unrecognized media signature (expected MP4 ftyp box, found "${boxType.replace(/[^\x20-\x7E]/g, '?')}").`,
  }
}

export function detectFormatFromUrlAndType(rawUrl: string, contentType?: string): SmartDeliveryFormat {
  const ct = (contentType || '').toLowerCase()
  const lowerUrl = rawUrl.toLowerCase()
  const pathPart = lowerUrl.split('?')[0].split('#')[0]

  if (
    ct.includes('application/vnd.apple.mpegurl') ||
    ct.includes('application/x-mpegurl') ||
    pathPart.endsWith('.m3u8') ||
    /\.m3u8(\b|$)/i.test(lowerUrl)
  ) {
    return 'HLS'
  }
  if (ct.includes('application/dash+xml') || pathPart.endsWith('.mpd') || /\.mpd(\b|$)/i.test(lowerUrl)) {
    return 'DASH'
  }
  if (ct.includes('video/mp4') || pathPart.endsWith('.mp4')) {
    return 'Direct MP4'
  }
  if (
    ct.includes('video/webm') ||
    ct.includes('video/quicktime') ||
    pathPart.endsWith('.webm') ||
    pathPart.endsWith('.mov')
  ) {
    return 'Other supported format'
  }
  return 'Unknown'
}

function resolveMaybeUrl(raw: string | undefined, baseUrl: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:') || trimmed.startsWith('javascript:')) {
    return null
  }
  try {
    const resolved = new URL(trimmed, baseUrl)
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null
    return resolved.toString()
  } catch {
    return null
  }
}

function extractAttr(tag: string, attrName: string): string | undefined {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const match = re.exec(tag)
  return match?.[1] ?? match?.[2] ?? match?.[3]
}

function decodeBasicHtml(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim()
}

interface ExtractedCandidate {
  url: string
  format: SmartDeliveryFormat
  sourceKind: 'video-tag' | 'source-tag' | 'meta-tag' | 'download-link' | 'json-ld'
  contentTypeHint?: string
  explicitlyDisallowed?: boolean
  explicitlyPermitted?: boolean
}

function inspectHtmlDocument(html: string, baseUrl: string, headers: Headers) {
  const candidates: ExtractedCandidate[] = []
  const seen = new Set<string>()
  const pushCandidate = (cand: ExtractedCandidate) => {
    if (!seen.has(cand.url)) {
      seen.add(cand.url)
      candidates.push(cand)
    }
  }

  let title: string | undefined
  const ogTitleMatch = /<meta\b[^>]*(?:property|name)\s*=\s*["']og:title["'][^>]*>/i.exec(html)
  if (ogTitleMatch) {
    const content = extractAttr(ogTitleMatch[0], 'content')
    if (content) title = decodeBasicHtml(content)
  }
  if (!title) {
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
    if (titleMatch?.[1]) title = decodeBasicHtml(titleMatch[1])
  }

  let hasDrmSignals = DRM_TEXT_PATTERNS.some((p) => p.test(html))
  const hasAntiBotOrChallenge = CHALLENGE_TEXT_PATTERNS.some((p) => p.test(html))
  let hasAuthGate = AUTH_PAYWALL_PATTERNS.some((p) => p.test(html))
  let hasHlsManifest = /\.m3u8(\b|\?|["'&])/i.test(html)
  let hasDashManifest = /\.mpd(\b|\?|["'&])/i.test(html)
  let explicitDownloadLinkFound = false

  const wwwAuth = headers.get('www-authenticate')
  if (wwwAuth) hasAuthGate = true

  // 1. <video> & <source> tags
  for (const tagMatch of html.matchAll(/<(?:video|source)\b[^>]*>/gi)) {
    const tag = tagMatch[0]
    const isVideo = tag.toLowerCase().startsWith('<video')
    const controlsList = (extractAttr(tag, 'controlslist') || '').toLowerCase()
    const disallowed = controlsList.includes('nodownload')
    const src = resolveMaybeUrl(extractAttr(tag, 'src'), baseUrl)
    const typeHint = extractAttr(tag, 'type')
    if (src) {
      const format = detectFormatFromUrlAndType(src, typeHint)
      if (format === 'HLS') hasHlsManifest = true
      if (format === 'DASH') hasDashManifest = true
      pushCandidate({
        url: src,
        format,
        sourceKind: isVideo ? 'video-tag' : 'source-tag',
        contentTypeHint: typeHint,
        explicitlyDisallowed: disallowed,
      })
    }
  }

  // 2. <meta property="og:video...">
  for (const metaMatch of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = metaMatch[0]
    const prop = (extractAttr(tag, 'property') || extractAttr(tag, 'name') || '').toLowerCase()
    if (prop === 'og:video' || prop === 'og:video:url' || prop === 'og:video:secure_url') {
      const contentUrl = resolveMaybeUrl(extractAttr(tag, 'content'), baseUrl)
      if (contentUrl) {
        const format = detectFormatFromUrlAndType(contentUrl)
        if (format === 'HLS') hasHlsManifest = true
        if (format === 'DASH') hasDashManifest = true
        pushCandidate({
          url: contentUrl,
          format,
          sourceKind: 'meta-tag',
        })
      }
    }
  }

  // 3. Explicit <a download> or direct .mp4 links
  for (const linkMatch of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = linkMatch[0]
    const hasDownloadAttr = /\bdownload(?:\s*=|[\s>])/i.test(tag)
    const resolved = resolveMaybeUrl(extractAttr(tag, 'href'), baseUrl)
    if (!resolved) continue
    const format = detectFormatFromUrlAndType(resolved)
    if (hasDownloadAttr || format === 'Direct MP4') {
      explicitDownloadLinkFound = explicitDownloadLinkFound || hasDownloadAttr
      pushCandidate({
        url: resolved,
        format,
        sourceKind: 'download-link',
        explicitlyPermitted: hasDownloadAttr,
      })
    }
  }

  // 4. JSON-LD contentUrl
  for (const ldMatch of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(ldMatch[1]) as Record<string, unknown>
      const rawUrl = typeof data?.contentUrl === 'string' ? data.contentUrl : undefined
      const resolved = resolveMaybeUrl(rawUrl, baseUrl)
      if (resolved) {
        const format = detectFormatFromUrlAndType(resolved)
        if (format === 'HLS') hasHlsManifest = true
        if (format === 'DASH') hasDashManifest = true
        pushCandidate({
          url: resolved,
          format,
          sourceKind: 'json-ld',
        })
      }
    } catch {
      // ignore invalid json-ld
    }
  }

  // 5. Check iframes for EME/encrypted-media
  for (const iframeMatch of html.matchAll(/<iframe\b[^>]*>/gi)) {
    const allow = (extractAttr(iframeMatch[0], 'allow') || '').toLowerCase()
    if (allow.includes('encrypted-media')) {
      hasDrmSignals = true
    }
  }

  return {
    title,
    hasDrmSignals,
    hasAntiBotOrChallenge,
    hasAuthGate,
    hasHlsManifest,
    hasDashManifest,
    explicitDownloadLinkFound,
    candidates,
  }
}

function parseTotalLengthFromHeaders(headers: Headers, status: number): number | undefined {
  if (status === 206) {
    const contentRange = headers.get('content-range')
    const match = contentRange ? /\/(\d+)$/.exec(contentRange.trim()) : null
    if (match) {
      const total = Number(match[1])
      if (Number.isFinite(total) && total > 0) return total
    }
  }
  const lenHeader = headers.get('content-length')
  if (lenHeader) {
    const len = Number(lenHeader)
    if (Number.isFinite(len) && len > 0) return len
  }
  return undefined
}

async function readUpToBytes(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)
  const reader = body.getReader()
  const chunks: Buffer[] = []
  let received = 0
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read()
      if (done || !value) break
      const remaining = maxBytes - received
      const slice = value.length > remaining ? value.subarray(0, remaining) : value
      chunks.push(Buffer.from(slice))
      received += slice.length
      if (received >= maxBytes) break
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return Buffer.concat(chunks)
}

async function verifyMp4Candidate(
  candidateUrl: string,
  security?: SmartUrlSecurityOptions,
  explicitlyDisallowed = false,
): Promise<SmartCandidateSource> {
  try {
    const { response, finalUrl } = await safeFetchWithRedirects(
      candidateUrl,
      {
        method: 'GET',
        headers: {
          Accept: 'video/mp4,application/octet-stream;q=0.9,*/*;q=0.5',
          Range: 'bytes=0-2047',
        },
      },
      security,
    )

    const contentType = response.headers.get('content-type') || undefined
    const totalLength = parseTotalLengthFromHeaders(response.headers, response.status)

    if (response.status === 401 || response.status === 403 || response.status === 429) {
      await response.body?.cancel().catch(() => {})
      return {
        url: finalUrl,
        format: 'Direct MP4',
        sourceKind: 'direct-endpoint',
        contentType,
        contentLength: totalLength,
        verifiedMp4: false,
        permitted: false,
        reason: `Candidate source returned HTTP ${response.status} (access restricted).`,
      }
    }

    if (response.status >= 400) {
      await response.body?.cancel().catch(() => {})
      return {
        url: finalUrl,
        format: 'Unknown',
        sourceKind: 'direct-endpoint',
        contentType,
        verifiedMp4: false,
        permitted: false,
        reason: `Candidate source returned HTTP ${response.status}.`,
      }
    }

    const headBuf = await readUpToBytes(response.body, 2048)
    const lowerCt = (contentType || '').toLowerCase()

    if (
      lowerCt.includes('text/html') ||
      lowerCt.includes('application/json') ||
      lowerCt.includes('application/vnd.apple.mpegurl') ||
      lowerCt.includes('application/dash+xml')
    ) {
      const detected = detectFormatFromUrlAndType(finalUrl, contentType)
      return {
        url: finalUrl,
        format: detected,
        sourceKind: 'direct-endpoint',
        contentType,
        verifiedMp4: false,
        permitted: false,
        reason: `Endpoint returned non-MP4 content-type "${contentType}".`,
      }
    }

    const mp4Check = validateMp4HeaderBuffer(headBuf)
    if (!mp4Check.valid) {
      return {
        url: finalUrl,
        format: detectFormatFromUrlAndType(finalUrl, contentType),
        sourceKind: 'direct-endpoint',
        contentType,
        contentLength: totalLength,
        verifiedMp4: false,
        permitted: false,
        reason: mp4Check.reason,
      }
    }

    if (explicitlyDisallowed) {
      return {
        url: finalUrl,
        format: 'Direct MP4',
        sourceKind: 'direct-endpoint',
        contentType: contentType || 'video/mp4',
        contentLength: totalLength,
        verifiedMp4: true,
        permitted: false,
        reason: 'The embed page explicitly marks this video with nodownload.',
      }
    }

    return {
      url: finalUrl,
      format: 'Direct MP4',
      sourceKind: 'direct-endpoint',
      contentType: contentType || 'video/mp4',
      contentLength: totalLength,
      verifiedMp4: true,
      permitted: true,
      reason: `Verified unprotected MP4 container (${mp4Check.majorBrand || 'ftyp'}).`,
    }
  } catch (err) {
    return {
      url: candidateUrl,
      format: detectFormatFromUrlAndType(candidateUrl),
      sourceKind: 'direct-endpoint',
      verifiedMp4: false,
      permitted: false,
      reason: err instanceof Error ? err.message : 'Failed to inspect candidate URL.',
    }
  }
}

export async function analyzeSmartVideoUrl(
  inputUrl: string,
  security?: SmartUrlSecurityOptions,
): Promise<SmartAnalysisResult> {
  const id = crypto.randomUUID()
  const analyzedAt = new Date().toISOString()
  const fallbackTitle = deriveTitleFromUrl(inputUrl)

  let safeInitialUrl: URL
  try {
    safeInitialUrl = await assertSafeRemoteUrl(inputUrl, security)
  } catch (err) {
    const secErr = err instanceof SmartUrlSecurityError ? err : null
    const status: SmartAppStatus =
      secErr?.code === 'INVALID_URL'
        ? 'Unsupported URL'
        : secErr?.code === 'SSRF_BLOCKED'
          ? 'Protected or restricted source'
          : 'Failed'

    return {
      id,
      inputUrl,
      finalUrl: inputUrl,
      host: 'invalid',
      status,
      deliveryFormat: 'Unknown',
      title: fallbackTitle,
      downloadable: false,
      suggestedFileName: sanitizeFileName(fallbackTitle),
      explanation: secErr?.message || 'Could not validate URL.',
      error: secErr?.message,
      signals: {
        hasDrmSignals: false,
        hasAntiBotOrChallenge: false,
        hasAuthGate: false,
        hasHlsManifest: false,
        hasDashManifest: false,
        explicitDownloadLinkFound: false,
      },
      candidates: [],
      analyzedAt,
    }
  }

  let initialFetch: { response: Response; finalUrl: string }
  try {
    initialFetch = await safeFetchWithRedirects(
      safeInitialUrl.toString(),
      {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml,video/mp4,application/vnd.apple.mpegurl,application/dash+xml,*/*;q=0.8',
          Range: 'bytes=0-524287',
        },
      },
      security,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Host unreachable.'
    return {
      id,
      inputUrl,
      finalUrl: safeInitialUrl.toString(),
      host: safeInitialUrl.hostname,
      status: 'Failed',
      deliveryFormat: 'Unknown',
      title: fallbackTitle,
      downloadable: false,
      suggestedFileName: sanitizeFileName(fallbackTitle),
      explanation: message,
      error: message,
      signals: {
        hasDrmSignals: false,
        hasAntiBotOrChallenge: false,
        hasAuthGate: false,
        hasHlsManifest: false,
        hasDashManifest: false,
        explicitDownloadLinkFound: false,
      },
      candidates: [],
      analyzedAt,
    }
  }

  const { response, finalUrl } = initialFetch
  const finalHost = new URL(finalUrl).hostname
  const contentType = response.headers.get('content-type') || undefined
  const lowerCt = (contentType || '').toLowerCase()
  const totalLength = parseTotalLengthFromHeaders(response.headers, response.status)

  if (response.status === 401 || response.status === 403 || response.status === 429) {
    await response.body?.cancel().catch(() => {})
    return {
      id,
      inputUrl,
      finalUrl,
      host: finalHost,
      status: 'Protected or restricted source',
      deliveryFormat: detectFormatFromUrlAndType(finalUrl, contentType),
      title: fallbackTitle,
      httpStatus: response.status,
      contentType,
      downloadable: false,
      suggestedFileName: sanitizeFileName(fallbackTitle),
      explanation: `The target host returned HTTP ${response.status}. The resource is access-restricted, rate-limited, or requires authorization.`,
      error: `HTTP ${response.status}`,
      signals: {
        hasDrmSignals: false,
        hasAntiBotOrChallenge: response.status === 403 || response.status === 429,
        hasAuthGate: response.status === 401,
        hasHlsManifest: false,
        hasDashManifest: false,
        explicitDownloadLinkFound: false,
      },
      candidates: [],
      analyzedAt,
    }
  }

  if (response.status >= 400) {
    await response.body?.cancel().catch(() => {})
    return {
      id,
      inputUrl,
      finalUrl,
      host: finalHost,
      status: 'Failed',
      deliveryFormat: 'Unknown',
      title: fallbackTitle,
      httpStatus: response.status,
      contentType,
      downloadable: false,
      suggestedFileName: sanitizeFileName(fallbackTitle),
      explanation: `The host responded with HTTP ${response.status}.`,
      error: `HTTP ${response.status}`,
      signals: {
        hasDrmSignals: false,
        hasAntiBotOrChallenge: false,
        hasAuthGate: false,
        hasHlsManifest: false,
        hasDashManifest: false,
        explicitDownloadLinkFound: false,
      },
      candidates: [],
      analyzedAt,
    }
  }

  const directFormat = detectFormatFromUrlAndType(finalUrl, contentType)
  if (
    directFormat === 'Direct MP4' ||
    lowerCt.startsWith('video/') ||
    lowerCt.includes('application/octet-stream')
  ) {
    const headBuf = await readUpToBytes(response.body, 2048)
    const mp4Check = validateMp4HeaderBuffer(headBuf)
    if (mp4Check.valid) {
      return {
        id,
        inputUrl,
        finalUrl,
        host: finalHost,
        status: 'Direct MP4 found',
        deliveryFormat: 'Direct MP4',
        title: fallbackTitle,
        httpStatus: response.status,
        contentType: contentType || 'video/mp4',
        contentLength: totalLength,
        downloadable: true,
        permittedSourceUrl: finalUrl,
        suggestedFileName: sanitizeFileName(fallbackTitle),
        explanation: `Verified publicly accessible, unprotected MP4 source (${mp4Check.majorBrand || 'ftyp'}). Ready to download.`,
        signals: {
          hasDrmSignals: false,
          hasAntiBotOrChallenge: false,
          hasAuthGate: false,
          hasHlsManifest: false,
          hasDashManifest: false,
          explicitDownloadLinkFound: true,
        },
        candidates: [
          {
            url: finalUrl,
            format: 'Direct MP4',
            sourceKind: 'direct-endpoint',
            contentType: contentType || 'video/mp4',
            contentLength: totalLength,
            verifiedMp4: true,
            permitted: true,
            reason: `Verified MP4 (${mp4Check.majorBrand || 'ftyp'}).`,
          },
        ],
        analyzedAt,
      }
    }

    return {
      id,
      inputUrl,
      finalUrl,
      host: finalHost,
      status: directFormat === 'Other supported format' ? 'Streaming-only source' : 'Unsupported URL',
      deliveryFormat: directFormat,
      title: fallbackTitle,
      httpStatus: response.status,
      contentType,
      downloadable: false,
      suggestedFileName: sanitizeFileName(fallbackTitle),
      explanation: mp4Check.reason || 'The endpoint did not return a valid MP4 container.',
      signals: {
        hasDrmSignals: false,
        hasAntiBotOrChallenge: false,
        hasAuthGate: false,
        hasHlsManifest: false,
        hasDashManifest: false,
        explicitDownloadLinkFound: false,
      },
      candidates: [],
      analyzedAt,
    }
  }

  if (directFormat === 'HLS' || directFormat === 'DASH') {
    await response.body?.cancel().catch(() => {})
    return {
      id,
      inputUrl,
      finalUrl,
      host: finalHost,
      status: 'Streaming-only source',
      deliveryFormat: directFormat,
      title: fallbackTitle,
      httpStatus: response.status,
      contentType,
      downloadable: false,
      suggestedFileName: sanitizeFileName(fallbackTitle),
      explanation: `This URL points directly to a ${directFormat} streaming manifest, not a downloadable MP4 file.`,
      alternativeSuggestion:
        'Look for an official download button or a direct .mp4 source from the media host.',
      signals: {
        hasDrmSignals: false,
        hasAntiBotOrChallenge: false,
        hasAuthGate: false,
        hasHlsManifest: directFormat === 'HLS',
        hasDashManifest: directFormat === 'DASH',
        explicitDownloadLinkFound: false,
      },
      candidates: [],
      analyzedAt,
    }
  }

  const htmlBuffer = await readUpToBytes(response.body, 512 * 1024)
  const html = htmlBuffer.toString('utf8')
  const report = inspectHtmlDocument(html, finalUrl, response.headers)
  const pageTitle = report.title || fallbackTitle

  const verifiedCandidates: SmartCandidateSource[] = []
  const mp4OrUnknown = report.candidates
    .filter((c) => c.format === 'Direct MP4' || c.format === 'Unknown')
    .slice(0, 3)

  for (const cand of mp4OrUnknown) {
    const verified = await verifyMp4Candidate(cand.url, security, cand.explicitlyDisallowed)
    verified.sourceKind = 'direct-endpoint'
    verifiedCandidates.push(verified)
  }

  for (const cand of report.candidates) {
    if (cand.format === 'HLS' || cand.format === 'DASH' || cand.format === 'Other supported format') {
      verifiedCandidates.push({
        url: cand.url,
        format: cand.format,
        sourceKind: 'direct-endpoint',
        contentType: cand.contentTypeHint,
        verifiedMp4: false,
        permitted: false,
        reason: `${cand.format} is a streaming-only or non-MP4 format.`,
      })
    }
  }

  const permittedMatch = verifiedCandidates.find((c) => c.verifiedMp4 && c.permitted)
  if (permittedMatch) {
    return {
      id,
      inputUrl,
      finalUrl,
      host: finalHost,
      status: 'Direct MP4 found',
      deliveryFormat: 'Direct MP4',
      title: pageTitle,
      httpStatus: response.status,
      contentType: permittedMatch.contentType || 'video/mp4',
      contentLength: permittedMatch.contentLength,
      downloadable: true,
      permittedSourceUrl: permittedMatch.url,
      suggestedFileName: sanitizeFileName(pageTitle),
      explanation:
        'A direct, publicly accessible, unprotected MP4 video source was verified and is ready to download.',
      signals: {
        hasDrmSignals: report.hasDrmSignals,
        hasAntiBotOrChallenge: report.hasAntiBotOrChallenge,
        hasAuthGate: report.hasAuthGate,
        hasHlsManifest: report.hasHlsManifest,
        hasDashManifest: report.hasDashManifest,
        explicitDownloadLinkFound: report.explicitDownloadLinkFound,
      },
      candidates: verifiedCandidates,
      analyzedAt,
    }
  }

  if (report.hasDrmSignals || report.hasAntiBotOrChallenge || report.hasAuthGate || verifiedCandidates.some((c) => c.verifiedMp4 && !c.permitted)) {
    return {
      id,
      inputUrl,
      finalUrl,
      host: finalHost,
      status: 'Protected or restricted source',
      deliveryFormat: report.hasHlsManifest ? 'HLS' : report.hasDashManifest ? 'DASH' : 'Unknown',
      title: pageTitle,
      httpStatus: response.status,
      contentType,
      downloadable: false,
      suggestedFileName: sanitizeFileName(pageTitle),
      explanation: report.hasDrmSignals
        ? 'This embed signals DRM / Encrypted Media Extensions (EME) protection and cannot be downloaded.'
        : report.hasAntiBotOrChallenge
          ? 'This embed is gated behind an anti-bot or CAPTCHA verification page.'
          : report.hasAuthGate
            ? 'This embed requires account sign-in or subscription authorization.'
            : 'The video source restricts direct downloading (nodownload or access denied).',
      alternativeSuggestion: 'Watch in the embedded player inside Lumen.',
      signals: {
        hasDrmSignals: report.hasDrmSignals,
        hasAntiBotOrChallenge: report.hasAntiBotOrChallenge,
        hasAuthGate: report.hasAuthGate,
        hasHlsManifest: report.hasHlsManifest,
        hasDashManifest: report.hasDashManifest,
        explicitDownloadLinkFound: report.explicitDownloadLinkFound,
      },
      candidates: verifiedCandidates,
      analyzedAt,
    }
  }

  if (report.hasHlsManifest || report.hasDashManifest) {
    const streamFmt: SmartDeliveryFormat = report.hasHlsManifest ? 'HLS' : 'DASH'
    return {
      id,
      inputUrl,
      finalUrl,
      host: finalHost,
      status: 'Streaming-only source',
      deliveryFormat: streamFmt,
      title: pageTitle,
      httpStatus: response.status,
      contentType,
      downloadable: false,
      suggestedFileName: sanitizeFileName(pageTitle),
      explanation: `This embed delivers video via ${streamFmt} adaptive streaming without a direct, unprotected MP4 download file.`,
      alternativeSuggestion: 'Use the 02Downloader tab or watch directly inside Lumen.',
      signals: {
        hasDrmSignals: report.hasDrmSignals,
        hasAntiBotOrChallenge: report.hasAntiBotOrChallenge,
        hasAuthGate: report.hasAuthGate,
        hasHlsManifest: report.hasHlsManifest,
        hasDashManifest: report.hasDashManifest,
        explicitDownloadLinkFound: report.explicitDownloadLinkFound,
      },
      candidates: verifiedCandidates,
      analyzedAt,
    }
  }

  return {
    id,
    inputUrl,
    finalUrl,
    host: finalHost,
    status: 'Streaming-only source',
    deliveryFormat: 'Unknown',
    title: pageTitle,
    httpStatus: response.status,
    contentType,
    downloadable: false,
    suggestedFileName: sanitizeFileName(pageTitle),
    explanation: NO_PERMITTED_MP4_MESSAGE,
    alternativeSuggestion: 'Try 02Downloader or stream the video inside Lumen.',
    signals: {
      hasDrmSignals: report.hasDrmSignals,
      hasAntiBotOrChallenge: report.hasAntiBotOrChallenge,
      hasAuthGate: report.hasAuthGate,
      hasHlsManifest: report.hasHlsManifest,
      hasDashManifest: report.hasDashManifest,
      explicitDownloadLinkFound: report.explicitDownloadLinkFound,
    },
    candidates: verifiedCandidates,
    analyzedAt,
  }
}

export async function openSmartMp4Stream(
  sourceUrl: string,
  security?: SmartUrlSecurityOptions,
): Promise<{
  ok: boolean
  status: number
  error?: string
  contentType: string
  contentLength?: string
  response?: Response
}> {
  // First verify with Range header that it is a real, unprotected MP4
  const check = await verifyMp4Candidate(sourceUrl, security)
  if (!check.verifiedMp4 || !check.permitted) {
    return {
      ok: false,
      status: 422,
      error: check.reason || NO_PERMITTED_MP4_MESSAGE,
      contentType: 'application/json',
    }
  }

  const { response } = await safeFetchWithRedirects(
    check.url,
    {
      method: 'GET',
      headers: {
        Accept: 'video/mp4,application/octet-stream;q=0.9,*/*;q=0.5',
      },
    },
    { ...security, timeoutMs: security?.timeoutMs ?? 60_000 },
  )

  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => {})
    return {
      ok: false,
      status: response.status || 502,
      error: `Upstream download failed with HTTP ${response.status}.`,
      contentType: 'application/json',
    }
  }

  return {
    ok: true,
    status: 200,
    contentType: response.headers.get('content-type') || 'video/mp4',
    contentLength: response.headers.get('content-length') || undefined,
    response,
  }
}
