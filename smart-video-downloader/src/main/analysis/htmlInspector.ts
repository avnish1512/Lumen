import * as cheerio from 'cheerio'
import type { DeliveryFormat } from '../../shared/types'

export interface ExtractedCandidate {
  url: string
  format: DeliveryFormat
  sourceKind:
    | 'video-tag'
    | 'source-tag'
    | 'meta-tag'
    | 'download-link'
    | 'json-ld'
    | 'browser-metadata'
  contentTypeHint?: string
  explicitlyDisallowed?: boolean
  explicitlyPermitted?: boolean
  reason?: string
}

export interface HtmlInspectionReport {
  title?: string
  hasDrmSignals: boolean
  hasAntiBotOrChallenge: boolean
  hasAuthGate: boolean
  hasHlsManifest: boolean
  hasDashManifest: boolean
  hasIframeEmbeds: boolean
  explicitDownloadLinkFound: boolean
  candidates: ExtractedCandidate[]
  restrictionNotes: string[]
}

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

export function detectFormatFromUrlAndType(rawUrl: string, contentType?: string): DeliveryFormat {
  const ct = (contentType || '').toLowerCase()
  let pathname = rawUrl.toLowerCase()
  try {
    pathname = new URL(rawUrl).pathname.toLowerCase()
  } catch {
    // keep raw lowercase
  }

  if (ct.includes('video/mp4') || pathname.endsWith('.mp4') || pathname.endsWith('.m4v')) {
    return 'Direct MP4'
  }
  if (
    ct.includes('application/vnd.apple.mpegurl') ||
    ct.includes('application/x-mpegurl') ||
    pathname.endsWith('.m3u8')
  ) {
    return 'HLS'
  }
  if (ct.includes('application/dash+xml') || pathname.endsWith('.mpd')) {
    return 'DASH'
  }
  if (ct.includes('video/webm') || ct.includes('video/ogg') || pathname.endsWith('.webm')) {
    return 'Other supported format'
  }
  return 'Unknown'
}

function resolveSafeHttpCandidate(rawHref: string | undefined, baseUrl: string): string | null {
  if (!rawHref) return null
  const trimmed = rawHref.trim()
  if (
    !trimmed ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('#')
  ) {
    return null
  }
  try {
    const resolved = new URL(trimmed, baseUrl)
    if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
      return resolved.toString()
    }
    return null
  } catch {
    return null
  }
}

export function inspectHtmlDocument(
  html: string,
  baseUrl: string,
  responseHeaders?: Headers,
): HtmlInspectionReport {
  const $ = cheerio.load(html)
  const candidates: ExtractedCandidate[] = []
  const seenUrls = new Set<string>()
  const restrictionNotes: string[] = []

  const addCandidate = (candidate: ExtractedCandidate) => {
    const key = `${candidate.url}|${candidate.sourceKind}`
    if (seenUrls.has(key)) return
    seenUrls.add(key)
    candidates.push(candidate)
  }

  const rawTitle =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').first().text() ||
    ''
  const title = rawTitle.replace(/\s+/g, ' ').trim() || undefined

  let explicitDownloadLinkFound = false
  let hasHlsManifest = false
  let hasDashManifest = false
  const hasIframeEmbeds = $('iframe[src]').length > 0

  // 1. Inspect <a download href="..."> and explicit MP4 download anchors
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    const hasDownloadAttr = $(el).attr('download') !== undefined
    const resolved = resolveSafeHttpCandidate(href, baseUrl)
    if (!resolved) return

    const format = detectFormatFromUrlAndType(resolved, $(el).attr('type'))
    if (hasDownloadAttr || format === 'Direct MP4') {
      if (hasDownloadAttr) {
        explicitDownloadLinkFound = true
      }
      if (format === 'HLS') hasHlsManifest = true
      if (format === 'DASH') hasDashManifest = true
      addCandidate({
        url: resolved,
        format,
        sourceKind: 'download-link',
        contentTypeHint: $(el).attr('type'),
        explicitlyPermitted: hasDownloadAttr,
      })
    }
  })

  // 2. Inspect <video> and nested <source> tags
  $('video').each((_, videoEl) => {
    const controlsList = ($(videoEl).attr('controlslist') || $(videoEl).attr('controlsList') || '').toLowerCase()
    const nodownload = controlsList.includes('nodownload')
    if (nodownload) {
      restrictionNotes.push('The <video> element specifies controlsList="nodownload".')
    }

    const directSrc = resolveSafeHttpCandidate($(videoEl).attr('src'), baseUrl)
    if (directSrc) {
      const format = detectFormatFromUrlAndType(directSrc)
      if (format === 'HLS') hasHlsManifest = true
      if (format === 'DASH') hasDashManifest = true
      addCandidate({
        url: directSrc,
        format,
        sourceKind: 'video-tag',
        explicitlyDisallowed: nodownload,
        explicitlyPermitted: !nodownload,
        reason: nodownload ? 'Video element disables download via controlsList="nodownload".' : undefined,
      })
    }

    $(videoEl)
      .find('source[src]')
      .each((__, sourceEl) => {
        const src = resolveSafeHttpCandidate($(sourceEl).attr('src'), baseUrl)
        if (!src) return
        const typeAttr = $(sourceEl).attr('type')
        const format = detectFormatFromUrlAndType(src, typeAttr)
        if (format === 'HLS') hasHlsManifest = true
        if (format === 'DASH') hasDashManifest = true
        addCandidate({
          url: src,
          format,
          sourceKind: 'source-tag',
          contentTypeHint: typeAttr,
          explicitlyDisallowed: nodownload,
          explicitlyPermitted: !nodownload,
          reason: nodownload ? 'Video element disables download via controlsList="nodownload".' : undefined,
        })
      })
  })

  // Standalone <source> elements outside <video> if any
  $('source[src]').each((_, sourceEl) => {
    const src = resolveSafeHttpCandidate($(sourceEl).attr('src'), baseUrl)
    if (!src) return
    const typeAttr = $(sourceEl).attr('type')
    const format = detectFormatFromUrlAndType(src, typeAttr)
    if (format === 'HLS') hasHlsManifest = true
    if (format === 'DASH') hasDashManifest = true
    addCandidate({
      url: src,
      format,
      sourceKind: 'source-tag',
      contentTypeHint: typeAttr,
    })
  })

  // 3. Inspect documented OpenGraph / Twitter meta video tags
  const ogVideoType =
    $('meta[property="og:video:type"]').attr('content') ||
    $('meta[name="twitter:player:stream:content_type"]').attr('content')
  const metaVideoSelectors = [
    'meta[property="og:video"]',
    'meta[property="og:video:url"]',
    'meta[property="og:video:secure_url"]',
    'meta[name="twitter:player:stream"]',
  ]
  for (const selector of metaVideoSelectors) {
    $(selector).each((_, metaEl) => {
      const content = $(metaEl).attr('content')
      const resolved = resolveSafeHttpCandidate(content, baseUrl)
      if (!resolved) return
      const format = detectFormatFromUrlAndType(resolved, ogVideoType)
      if (format === 'HLS') hasHlsManifest = true
      if (format === 'DASH') hasDashManifest = true
      if (format !== 'Unknown') {
        addCandidate({
          url: resolved,
          format,
          sourceKind: 'meta-tag',
          contentTypeHint: ogVideoType,
        })
      }
    })
  }

  // 4. Parse structured JSON-LD VideoObject strictly with JSON.parse (no eval)
  $('script[type="application/ld+json"]').each((_, scriptEl) => {
    const rawJson = $(scriptEl).text().trim()
    if (!rawJson || rawJson.length > 100_000) return
    try {
      const parsed = JSON.parse(rawJson) as unknown
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const obj = item as Record<string, unknown>
        if (typeof obj.contentUrl === 'string') {
          const resolved = resolveSafeHttpCandidate(obj.contentUrl, baseUrl)
          if (resolved) {
            const encodingFormat = typeof obj.encodingFormat === 'string' ? obj.encodingFormat : undefined
            const format = detectFormatFromUrlAndType(resolved, encodingFormat)
            if (format === 'HLS') hasHlsManifest = true
            if (format === 'DASH') hasDashManifest = true
            addCandidate({
              url: resolved,
              format,
              sourceKind: 'json-ld',
              contentTypeHint: encodingFormat,
            })
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD safely
    }
  })

  // 5. Passive manifest/protection detection across headers + static HTML text (without bypassing/cracking)
  const serverHeader = (responseHeaders?.get('server') || '').toLowerCase()
  const cfMitigated = (responseHeaders?.get('cf-mitigated') || '').toLowerCase()
  const setCookie = (responseHeaders?.get('set-cookie') || '').toLowerCase()

  const hasAntiBotOrChallenge =
    serverHeader.includes('ddos-guard') ||
    cfMitigated.includes('challenge') ||
    setCookie.includes('__ddg') ||
    CHALLENGE_TEXT_PATTERNS.some((rx) => rx.test(html))

  if (hasAntiBotOrChallenge) {
    restrictionNotes.push('Host uses anti-bot / human verification protection.')
  }

  const hasDrmSignals = DRM_TEXT_PATTERNS.some((rx) => rx.test(html))
  if (hasDrmSignals) {
    restrictionNotes.push('Page references Encrypted Media Extensions (EME) / DRM playback.')
  }

  const hasAuthGate = AUTH_PAYWALL_PATTERNS.some((rx) => rx.test(html))
  if (hasAuthGate) {
    restrictionNotes.push('Page indicates authentication or subscription is required.')
  }

  // Detect streaming manifest references in exposed attributes/scripts as diagnostic info ONLY
  if (!hasHlsManifest && /\.m3u8(\?|"|'|\\b)/i.test(html)) {
    hasHlsManifest = true
  }
  if (!hasDashManifest && /\.mpd(\?|"|'|\\b)/i.test(html)) {
    hasDashManifest = true
  }

  return {
    title,
    hasDrmSignals,
    hasAntiBotOrChallenge,
    hasAuthGate,
    hasHlsManifest,
    hasDashManifest,
    hasIframeEmbeds,
    explicitDownloadLinkFound,
    candidates,
    restrictionNotes,
  }
}
