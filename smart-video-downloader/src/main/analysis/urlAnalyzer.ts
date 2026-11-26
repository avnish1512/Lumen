import crypto from 'node:crypto'
import {
  assertSafeRemoteUrl,
  safeFetchWithRedirects,
  UrlSecurityError,
  type UrlSecurityOptions,
} from '../security/urlGuard'
import { deriveTitleFromUrl, sanitizeFileName } from '../security/pathGuard'
import {
  detectFormatFromUrlAndType,
  inspectHtmlDocument,
  type ExtractedCandidate,
} from './htmlInspector'
import { validateMp4HeaderBuffer } from './mp4Signature'
import type {
  AnalysisResult,
  AppStatus,
  CandidateMediaSource,
  DeliveryFormat,
} from '../../shared/types'

export const NO_PERMITTED_MP4_MESSAGE =
  'No permitted direct MP4 download source was found. This embed may be streaming-only or restricted.'

export interface BrowserSessionInspection {
  finalUrl: string
  title?: string
  mediaUrls: Array<{
    url: string
    contentType?: string
    sourceKind: 'browser-metadata' | 'video-tag' | 'source-tag' | 'download-link'
    explicitlyDisallowed?: boolean
    explicitlyPermitted?: boolean
  }>
  hasDrmSignals?: boolean
  hasAntiBotOrChallenge?: boolean
}

export interface AnalyzeUrlOptions {
  security?: UrlSecurityOptions
  inspectWithBrowserSession?: (url: string, timeoutMs: number) => Promise<BrowserSessionInspection | null>
  onStatus?: (status: AppStatus, message: string) => void
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
  security?: UrlSecurityOptions,
  explicitlyDisallowed = false,
): Promise<CandidateMediaSource> {
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
      lowerCt.includes('x-mpegurl') ||
      lowerCt.includes('dash+xml')
    ) {
      const detectedFormat = detectFormatFromUrlAndType(finalUrl, contentType)
      return {
        url: finalUrl,
        format: detectedFormat,
        sourceKind: 'direct-endpoint',
        contentType,
        contentLength: totalLength,
        verifiedMp4: false,
        permitted: false,
        reason: `Expected binary MP4, but endpoint returned "${contentType}".`,
      }
    }

    const sig = validateMp4HeaderBuffer(headBuf)
    if (!sig.valid) {
      return {
        url: finalUrl,
        format: detectFormatFromUrlAndType(finalUrl, contentType),
        sourceKind: 'direct-endpoint',
        contentType,
        contentLength: totalLength,
        verifiedMp4: false,
        permitted: false,
        reason: sig.reason || 'Content header is not a valid MP4 container.',
      }
    }

    if (explicitlyDisallowed) {
      return {
        url: finalUrl,
        format: 'Direct MP4',
        sourceKind: 'video-tag',
        contentType: contentType || 'video/mp4',
        contentLength: totalLength,
        verifiedMp4: true,
        permitted: false,
        reason: 'Source explicitly prohibits downloading via controlsList="nodownload".',
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
      reason: `Verified unprotected MP4 container (brand: ${sig.majorBrand || 'isom'}).`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification failed'
    return {
      url: candidateUrl,
      format: 'Unknown',
      sourceKind: 'direct-endpoint',
      verifiedMp4: false,
      permitted: false,
      reason: msg,
    }
  }
}

export async function analyzeVideoUrl(
  rawUrl: string,
  options?: AnalyzeUrlOptions,
): Promise<AnalysisResult> {
  const id = crypto.randomUUID()
  const analyzedAt = new Date().toISOString()

  options?.onStatus?.('Analyzing URL', 'Validating URL and checking host security...')

  let validatedUrl: URL
  try {
    validatedUrl = await assertSafeRemoteUrl(rawUrl, options?.security)
  } catch (err) {
    const isSecurity = err instanceof UrlSecurityError
    const isUnreachable = isSecurity && err.code === 'UNREACHABLE'
    const message = err instanceof Error ? err.message : 'Invalid or blocked URL.'
    const status: AppStatus = isUnreachable ? 'Failed' : 'Unsupported URL'

    return {
      id,
      inputUrl: rawUrl,
      finalUrl: rawUrl,
      host: (() => {
        try {
          return new URL(rawUrl).hostname
        } catch {
          return ''
        }
      })(),
      status,
      deliveryFormat: 'Unknown',
      title: 'Unsupported URL',
      downloadable: false,
      suggestedFileName: 'video.mp4',
      explanation: message,
      error: message,
      signals: {
        hasDrmSignals: false,
        hasAntiBotOrChallenge: false,
        hasAuthGate: false,
        hasHlsManifest: false,
        hasDashManifest: false,
        explicitDownloadLinkFound: false,
        usedBrowserSession: false,
      },
      candidates: [],
      analyzedAt,
    }
  }

  options?.onStatus?.('Analyzing URL', `Connecting safely to ${validatedUrl.hostname}...`)

  let fetchRes
  try {
    fetchRes = await safeFetchWithRedirects(
      validatedUrl.toString(),
      {
        method: 'GET',
        headers: {
          Accept:
            'text/html,application/xhtml+xml,video/mp4,application/vnd.apple.mpegurl,application/dash+xml,*/*;q=0.8',
          Range: 'bytes=0-524287',
        },
      },
      options?.security,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to connect to remote host.'
    const status: AppStatus =
      err instanceof UrlSecurityError && err.code === 'SSRF_BLOCKED'
        ? 'Unsupported URL'
        : 'Failed'

    return {
      id,
      inputUrl: rawUrl,
      finalUrl: validatedUrl.toString(),
      host: validatedUrl.hostname,
      status,
      deliveryFormat: 'Unknown',
      title: deriveTitleFromUrl(validatedUrl.toString()),
      downloadable: false,
      suggestedFileName: sanitizeFileName(deriveTitleFromUrl(validatedUrl.toString())),
      explanation: message,
      error: message,
      signals: {
        hasDrmSignals: false,
        hasAntiBotOrChallenge: false,
        hasAuthGate: false,
        hasHlsManifest: false,
        hasDashManifest: false,
        explicitDownloadLinkFound: false,
        usedBrowserSession: false,
      },
      candidates: [],
      analyzedAt,
    }
  }

  const { response, finalUrl } = fetchRes
  const parsedFinal = new URL(finalUrl)
  const contentType = response.headers.get('content-type') || undefined
  const lowerCt = (contentType || '').toLowerCase()
  const totalLength = parseTotalLengthFromHeaders(response.headers, response.status)
  const fallbackTitle = deriveTitleFromUrl(finalUrl)

  // Handle HTTP error codes explicitly
  if (response.status === 401 || response.status === 403 || response.status === 429) {
    await response.body?.cancel().catch(() => {})
    const reason = `${NO_PERMITTED_MP4_MESSAGE} Server responded with HTTP ${response.status} (authentication required, rate-limited, or access restricted).`
    return {
      id,
      inputUrl: rawUrl,
      finalUrl,
      host: parsedFinal.hostname,
      status: 'Protected or restricted source',
      deliveryFormat: detectFormatFromUrlAndType(finalUrl, contentType),
      title: fallbackTitle,
      httpStatus: response.status,
      contentType,
      contentLength: totalLength,
      downloadable: false,
      suggestedFileName: sanitizeFileName(fallbackTitle),
      explanation: reason,
      alternativeSuggestion:
        'Sign in through the provider’s official website or check whether they offer an official download feature.',
      error: `HTTP ${response.status} Restricted`,
      signals: {
        hasDrmSignals: false,
        hasAntiBotOrChallenge: response.status === 429,
        hasAuthGate: response.status === 401 || response.status === 403,
        hasHlsManifest: false,
        hasDashManifest: false,
        explicitDownloadLinkFound: false,
        usedBrowserSession: false,
      },
      candidates: [],
      analyzedAt,
    }
  }

  if (response.status >= 400) {
    await response.body?.cancel().catch(() => {})
    const reason = `The link appears broken or expired (HTTP ${response.status}).`
    return {
      id,
      inputUrl: rawUrl,
      finalUrl,
      host: parsedFinal.hostname,
      status: 'Failed',
      deliveryFormat: 'Unknown',
      title: fallbackTitle,
      httpStatus: response.status,
      contentType,
      downloadable: false,
      suggestedFileName: sanitizeFileName(fallbackTitle),
      explanation: reason,
      error: reason,
      signals: {
        hasDrmSignals: false,
        hasAntiBotOrChallenge: false,
        hasAuthGate: false,
        hasHlsManifest: false,
        hasDashManifest: false,
        explicitDownloadLinkFound: false,
        usedBrowserSession: false,
      },
      candidates: [],
      analyzedAt,
    }
  }

  // Direct streaming manifest response (.m3u8 / .mpd)
  const urlFormatHint = detectFormatFromUrlAndType(finalUrl, contentType)
  if (urlFormatHint === 'HLS' || urlFormatHint === 'DASH') {
    await response.body?.cancel().catch(() => {})
    return {
      id,
      inputUrl: rawUrl,
      finalUrl,
      host: parsedFinal.hostname,
      status: 'Streaming-only source',
      deliveryFormat: urlFormatHint,
      title: fallbackTitle,
      httpStatus: response.status,
      contentType,
      downloadable: false,
      suggestedFileName: sanitizeFileName(fallbackTitle),
      explanation: `${NO_PERMITTED_MP4_MESSAGE} This URL serves an ${urlFormatHint} segmented stream manifest rather than a standalone MP4 file.`,
      alternativeSuggestion:
        'Play the stream in an authorized player or obtain an official direct MP4 release from the content provider.',
      signals: {
        hasDrmSignals: false,
        hasAntiBotOrChallenge: false,
        hasAuthGate: false,
        hasHlsManifest: urlFormatHint === 'HLS',
        hasDashManifest: urlFormatHint === 'DASH',
        explicitDownloadLinkFound: false,
        usedBrowserSession: false,
      },
      candidates: [
        {
          url: finalUrl,
          format: urlFormatHint,
          sourceKind: 'direct-endpoint',
          contentType,
          verifiedMp4: false,
          permitted: false,
          reason: `${urlFormatHint} manifests cannot be downloaded as a direct MP4.`,
        },
      ],
      analyzedAt,
    }
  }

  // Case A: Non-HTML binary response (candidate direct MP4 endpoint)
  const isHtmlResponse =
    lowerCt.includes('text/html') || lowerCt.includes('application/xhtml+xml')

  if (!isHtmlResponse) {
    const headBytes = await readUpToBytes(response.body, 2048)

    if (lowerCt.includes('application/json') || lowerCt.includes('text/plain')) {
      return {
        id,
        inputUrl: rawUrl,
        finalUrl,
        host: parsedFinal.hostname,
        status: 'Unsupported URL',
        deliveryFormat: 'Unknown',
        title: fallbackTitle,
        httpStatus: response.status,
        contentType,
        downloadable: false,
        suggestedFileName: sanitizeFileName(fallbackTitle),
        explanation: `Endpoint returned "${contentType}" instead of an embed page or valid video file.`,
        error: `Unsupported content type: ${contentType}`,
        signals: {
          hasDrmSignals: false,
          hasAntiBotOrChallenge: false,
          hasAuthGate: false,
          hasHlsManifest: false,
          hasDashManifest: false,
          explicitDownloadLinkFound: false,
          usedBrowserSession: false,
        },
        candidates: [],
        analyzedAt,
      }
    }

    const sig = validateMp4HeaderBuffer(headBytes)
    if (sig.valid) {
      options?.onStatus?.('Direct MP4 found', 'Verified publicly accessible direct MP4 source.')
      return {
        id,
        inputUrl: rawUrl,
        finalUrl,
        host: parsedFinal.hostname,
        status: 'Direct MP4 found',
        deliveryFormat: 'Direct MP4',
        title: fallbackTitle,
        httpStatus: response.status,
        contentType: contentType || 'video/mp4',
        contentLength: totalLength,
        downloadable: true,
        permittedSourceUrl: finalUrl,
        suggestedFileName: sanitizeFileName(fallbackTitle),
        explanation: `Verified publicly accessible, unprotected MP4 source (ISO BMFF brand: ${sig.majorBrand || 'isom'}). Ready to download.`,
        signals: {
          hasDrmSignals: false,
          hasAntiBotOrChallenge: false,
          hasAuthGate: false,
          hasHlsManifest: false,
          hasDashManifest: false,
          explicitDownloadLinkFound: true,
          usedBrowserSession: false,
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
            reason: 'Direct HTTP endpoint confirmed valid MP4 container.',
          },
        ],
        analyzedAt,
      }
    }

    const detectedOther: DeliveryFormat =
      urlFormatHint === 'Other supported format' ? 'Other supported format' : 'Unknown'
    return {
      id,
      inputUrl: rawUrl,
      finalUrl,
      host: parsedFinal.hostname,
      status: 'Unsupported URL',
      deliveryFormat: detectedOther,
      title: fallbackTitle,
      httpStatus: response.status,
      contentType,
      contentLength: totalLength,
      downloadable: false,
      suggestedFileName: sanitizeFileName(fallbackTitle),
      explanation: `${NO_PERMITTED_MP4_MESSAGE} ${sig.reason || `Content type "${contentType || 'unknown'}" is not a verified MP4 stream.`}`,
      error: sig.reason,
      signals: {
        hasDrmSignals: false,
        hasAntiBotOrChallenge: false,
        hasAuthGate: false,
        hasHlsManifest: false,
        hasDashManifest: false,
        explicitDownloadLinkFound: false,
        usedBrowserSession: false,
      },
      candidates: [],
      analyzedAt,
    }
  }

  // Case B: HTML Embed Page Inspection
  const htmlBuffer = await readUpToBytes(response.body, 512 * 1024)
  const html = htmlBuffer.toString('utf8')
  const report = inspectHtmlDocument(html, finalUrl, response.headers)

  const pageTitle = report.title || fallbackTitle
  let usedBrowserSession = false
  let combinedCandidates: ExtractedCandidate[] = [...report.candidates]
  let hasDrmSignals = report.hasDrmSignals
  let hasAntiBotOrChallenge = report.hasAntiBotOrChallenge
  let hasHlsManifest = report.hasHlsManifest
  let hasDashManifest = report.hasDashManifest
  let explicitDownloadLinkFound = report.explicitDownloadLinkFound

  // Optional normal authorized browser session inspection ONLY when static HTML exposed no candidates
  // and no anti-bot/DRM/auth gate was signaled.
  if (
    combinedCandidates.length === 0 &&
    !hasAntiBotOrChallenge &&
    !report.hasAuthGate &&
    !hasDrmSignals &&
    options?.inspectWithBrowserSession
  ) {
    options?.onStatus?.(
      'Analyzing URL',
      'Inspecting embed page metadata in isolated browser session...',
    )
    const browserData = await options
      .inspectWithBrowserSession(finalUrl, options.security?.timeoutMs ?? 8000)
      .catch(() => null)
    if (browserData) {
      usedBrowserSession = true
      if (browserData.hasDrmSignals) hasDrmSignals = true
      if (browserData.hasAntiBotOrChallenge) hasAntiBotOrChallenge = true
      for (const item of browserData.mediaUrls) {
        const format = detectFormatFromUrlAndType(item.url, item.contentType)
        if (format === 'HLS') hasHlsManifest = true
        if (format === 'DASH') hasDashManifest = true
        if (item.explicitlyPermitted) explicitDownloadLinkFound = true
        combinedCandidates.push({
          url: item.url,
          format,
          sourceKind: item.sourceKind,
          contentTypeHint: item.contentType,
          explicitlyDisallowed: item.explicitlyDisallowed,
          explicitlyPermitted: item.explicitlyPermitted,
        })
      }
    }
  }

  const verifiedCandidates: CandidateMediaSource[] = []

  // Verify up to 3 promising non-streaming candidates via HTTP range check
  const mp4OrUnknownCandidates = combinedCandidates
    .filter((c) => c.format === 'Direct MP4' || c.format === 'Unknown')
    .slice(0, 3)

  for (const cand of mp4OrUnknownCandidates) {
    const verified = await verifyMp4Candidate(
      cand.url,
      options?.security,
      cand.explicitlyDisallowed,
    )
    verified.sourceKind = cand.sourceKind
    if (verified.format === 'HLS') hasHlsManifest = true
    if (verified.format === 'DASH') hasDashManifest = true
    verifiedCandidates.push(verified)
  }

  // Record any explicit HLS / DASH / WebM candidates without downloading them
  for (const cand of combinedCandidates) {
    if (cand.format === 'HLS' || cand.format === 'DASH' || cand.format === 'Other supported format') {
      verifiedCandidates.push({
        url: cand.url,
        format: cand.format,
        sourceKind: cand.sourceKind,
        contentType: cand.contentTypeHint,
        verifiedMp4: false,
        permitted: false,
        reason:
          cand.format === 'Other supported format'
            ? 'Detected non-MP4 format; this tool requires a verified direct MP4 file.'
            : `${cand.format} is a streaming-only manifest format.`,
      })
    }
  }

  const permittedMatch = verifiedCandidates.find((c) => c.verifiedMp4 && c.permitted)

  if (permittedMatch && !hasDrmSignals && !hasAntiBotOrChallenge && !report.hasAuthGate) {
    options?.onStatus?.('Direct MP4 found', 'Verified publicly accessible direct MP4 source.')
    return {
      id,
      inputUrl: rawUrl,
      finalUrl,
      host: parsedFinal.hostname,
      status: 'Direct MP4 found',
      deliveryFormat: 'Direct MP4',
      title: pageTitle,
      httpStatus: response.status,
      contentType: permittedMatch.contentType || 'video/mp4',
      contentLength: permittedMatch.contentLength,
      downloadable: true,
      permittedSourceUrl: permittedMatch.url,
      suggestedFileName: sanitizeFileName(pageTitle),
      explanation: `Found a publicly exposed, permitted direct MP4 source (${permittedMatch.sourceKind}) and verified its MP4 container signature.`,
      signals: {
        hasDrmSignals,
        hasAntiBotOrChallenge,
        hasAuthGate: report.hasAuthGate,
        hasHlsManifest,
        hasDashManifest,
        explicitDownloadLinkFound: explicitDownloadLinkFound || permittedMatch.sourceKind === 'download-link',
        usedBrowserSession,
      },
      candidates: verifiedCandidates,
      analyzedAt,
    }
  }

  // Build accurate explanation when no permitted MP4 download exists
  const deliveryFormat: DeliveryFormat = hasHlsManifest
    ? 'HLS'
    : hasDashManifest
      ? 'DASH'
      : verifiedCandidates.some((c) => c.format === 'Direct MP4')
        ? 'Direct MP4'
        : verifiedCandidates.some((c) => c.format === 'Other supported format')
          ? 'Other supported format'
          : 'Unknown'

  const restrictedCandidate = verifiedCandidates.find((c) => c.verifiedMp4 && !c.permitted)
  const accessRestrictedCandidate = verifiedCandidates.find(
    (c) => c.reason && c.reason.includes('access restricted'),
  )

  const isRestricted = Boolean(
    hasDrmSignals ||
      hasAntiBotOrChallenge ||
      report.hasAuthGate ||
      restrictedCandidate ||
      accessRestrictedCandidate,
  )

  const reasons: string[] = [NO_PERMITTED_MP4_MESSAGE]
  if (hasAntiBotOrChallenge) {
    reasons.push('The host enforces anti-bot / human verification checks which this tool will not bypass.')
  }
  if (hasDrmSignals) {
    reasons.push('The page indicates DRM / Encrypted Media playback protections.')
  }
  if (report.hasAuthGate || accessRestrictedCandidate) {
    reasons.push('Access to media resources requires authorization or returned restricted HTTP permissions.')
  }
  if (restrictedCandidate?.reason) {
    reasons.push(restrictedCandidate.reason)
  }
  if (hasHlsManifest || hasDashManifest) {
    reasons.push(
      `Exposed playback relies on segmented ${hasHlsManifest ? 'HLS (.m3u8)' : 'DASH (.mpd)'} streaming rather than a downloadable MP4 file.`,
    )
  } else if (report.hasIframeEmbeds && verifiedCandidates.length === 0) {
    reasons.push('The page contains an embedded iframe player without exposing a direct downloadable MP4 URL.')
  } else if (verifiedCandidates.length === 0) {
    reasons.push('No public <video>, <source type="video/mp4">, or permitted download link was exposed.')
  }

  const finalStatus: AppStatus = isRestricted ? 'Protected or restricted source' : 'Streaming-only source'

  return {
    id,
    inputUrl: rawUrl,
    finalUrl,
    host: parsedFinal.hostname,
    status: finalStatus,
    deliveryFormat,
    title: pageTitle,
    httpStatus: response.status,
    contentType,
    downloadable: false,
    suggestedFileName: sanitizeFileName(pageTitle),
    explanation: reasons.join(' '),
    alternativeSuggestion:
      'Watch directly on the provider website in your browser, or use the official platform download option if available.',
    signals: {
      hasDrmSignals,
      hasAntiBotOrChallenge,
      hasAuthGate: report.hasAuthGate,
      hasHlsManifest,
      hasDashManifest,
      explicitDownloadLinkFound,
      usedBrowserSession,
    },
    candidates: verifiedCandidates,
    analyzedAt,
  }
}
