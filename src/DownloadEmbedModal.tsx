import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileVideo,
  Globe,
  HardDriveDownload,
  History,
  Link2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Square,
  X,
} from 'lucide-react'
import {
  analyzeSmartEmbedUrl,
  buildSmartDownloadStreamUrl,
  closeInSiteDownload,
  fetchVidsrcDownloads,
  formatBytes,
  saveSmartMp4ToOfflineLibrary,
  subscribeDownloadModal,
  type InSiteDownloadRequest,
  type SmartAnalysisResult,
  type SmartAppStatus,
  type VidsrcDownloadResponse,
} from './downloads'

type DownloadTabMode = 'direct' | '02downloader' | 'smart'

interface SmartHistoryEntry {
  id: string
  url: string
  title: string
  format: string
  status: SmartAppStatus
  sizeBytes?: number
  timestamp: string
}

const SMART_HISTORY_KEY = 'lumen_smart_dl_history_v1'

function readSmartHistory(): SmartHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(SMART_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, 12) : []
  } catch {
    return []
  }
}

function saveSmartHistory(entries: SmartHistoryEntry[]): void {
  try {
    window.localStorage.setItem(SMART_HISTORY_KEY, JSON.stringify(entries.slice(0, 12)))
  } catch {
    // ignore storage quota errors
  }
}

function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—'
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.ceil(seconds % 60)
  return `${mins}m ${secs}s`
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || !Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '0 KB/s'
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`
  return `${Math.round(bytesPerSec / 1024)} KB/s`
}

function statusToneClass(status: SmartAppStatus): string {
  if (status === 'Direct MP4 found' || status === 'Ready to download' || status === 'Completed') {
    return 'is-success'
  }
  if (status === 'Streaming-only source') return 'is-warning'
  if (
    status === 'Protected or restricted source' ||
    status === 'Unsupported URL' ||
    status === 'Failed'
  ) {
    return 'is-danger'
  }
  if (status === 'Analyzing URL' || status === 'Downloading') return 'is-active'
  return 'is-neutral'
}

/**
 * In-site download modal combining 02moviedownloader and Lumen's built-in
 * Smart Video Downloader (Embed URL Analyzer & Verified MP4 Downloader).
 */
export function DownloadEmbedModal() {
  const [request, setRequest] = useState<InSiteDownloadRequest | null>(null)
  const [mode, setMode] = useState<DownloadTabMode>('02downloader')
  const [isFrameLoading, setIsFrameLoading] = useState(true)
  const [reloadNonce, setReloadNonce] = useState(0)

  // Smart Video Downloader state
  const [urlInput, setUrlInput] = useState('')
  const [smartStatus, setSmartStatus] = useState<SmartAppStatus>('Idle')
  const [analysis, setAnalysis] = useState<SmartAnalysisResult | null>(null)
  const [analyzeError, setAnalyzeError] = useState('')
  const [dlProgress, setDlProgress] = useState<{
    percent: number | null
    received: number
    total: number | null
    speed: number
    eta: number | null
  }>({ percent: null, received: 0, total: null, speed: 0, eta: null })
  const [dlNotice, setDlNotice] = useState('')
  const [serverChecks, setServerChecks] = useState<
    Array<{
      id: string
      name: string
      url: string
      state: 'pending' | 'checking' | 'done' | 'error'
      result?: SmartAnalysisResult
      error?: string
    }>
  >([])
  const [isScanningServers, setIsScanningServers] = useState(false)
  const [history, setHistory] = useState<SmartHistoryEntry[]>(() =>
    typeof window !== 'undefined' ? readSmartHistory() : [],
  )

  // Direct Links (dl.vidsrc.party) state
  const [directData, setDirectData] = useState<VidsrcDownloadResponse | null>(null)
  const [directLoading, setDirectLoading] = useState(false)
  const [directError, setDirectError] = useState('')
  const [directFormat, setDirectFormat] = useState<'mp4' | 'mkv'>('mp4')
  const [directSubLang, setDirectSubLang] = useState('')
  const [directAudio, setDirectAudio] = useState('')
  const [seasonData, setSeasonData] = useState<VidsrcDownloadResponse | null>(null)
  const [seasonLoading, setSeasonLoading] = useState(false)

  const analyzeAbortRef = useRef<AbortController | null>(null)
  const downloadAbortRef = useRef<AbortController | null>(null)
  const directAbortRef = useRef<AbortController | null>(null)
  const autoScannedRequestRef = useRef<InSiteDownloadRequest | null>(null)

  useEffect(() => {
    return subscribeDownloadModal((next) => {
      analyzeAbortRef.current?.abort()
      downloadAbortRef.current?.abort()
      directAbortRef.current?.abort()
      autoScannedRequestRef.current = null
      setRequest(next)
      if (next) {
        const hasIframeUrl = Boolean(next.url && next.url.trim())
        const hasDirectId = Boolean(next.tmdbId || next.imdbId)
        const nextMode: DownloadTabMode =
          next.initialMode === 'smart'
            ? 'smart'
            : next.initialMode === '02downloader' && hasIframeUrl
              ? '02downloader'
              : hasDirectId
                ? 'direct'
                : hasIframeUrl
                  ? '02downloader'
                  : 'smart'
        setMode(nextMode)
        setIsFrameLoading(hasIframeUrl)
        setReloadNonce((prev) => prev + 1)
        setUrlInput(next.embedUrl || next.serverUrls?.[0]?.url || '')
        setAnalysis(null)
        setAnalyzeError('')
        setSmartStatus('Idle')
        setDlNotice('')
        setDlProgress({ percent: null, received: 0, total: null, speed: 0, eta: null })
        setIsScanningServers(false)
        setServerChecks(
          (next.serverUrls || []).map((srv) => ({
            id: srv.id,
            name: srv.name,
            url: srv.url,
            state: 'pending',
          })),
        )
        setDirectData(null)
        setDirectError('')
        setDirectLoading(false)
        setDirectFormat('mp4')
        setDirectSubLang('')
        setDirectAudio('')
        setSeasonData(null)
        setSeasonLoading(false)
      }
    })
  }, [])

  useEffect(() => {
    if (!request || typeof window === 'undefined') return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeInSiteDownload()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [request])

  const pushHistory = (entry: SmartHistoryEntry) => {
    setHistory((prev) => {
      const next = [entry, ...prev.filter((item) => item.url !== entry.url)].slice(0, 12)
      saveSmartHistory(next)
      return next
    })
  }

  const handleAnalyzeAllServers = async () => {
    const targets = request?.serverUrls || []
    if (targets.length === 0) return

    analyzeAbortRef.current?.abort()
    const controller = new AbortController()
    analyzeAbortRef.current = controller

    setIsScanningServers(true)
    setSmartStatus('Analyzing URL')
    setAnalyzeError('')
    setAnalysis(null)
    setDlNotice('')
    setServerChecks(
      targets.map((srv) => ({
        id: srv.id,
        name: srv.name,
        url: srv.url,
        state: 'checking',
      })),
    )

    let firstDownloadable: SmartAnalysisResult | null = null
    let firstResult: SmartAnalysisResult | null = null
    let cursor = 0
    const workerCount = Math.min(3, targets.length)

    const worker = async () => {
      while (cursor < targets.length && !controller.signal.aborted) {
        const idx = cursor
        cursor += 1
        const srv = targets[idx]
        try {
          const result = await analyzeSmartEmbedUrl(srv.url, controller.signal)
          if (controller.signal.aborted) return
          if (!firstResult) firstResult = result
          if (!firstDownloadable && result.downloadable && result.permittedSourceUrl) {
            firstDownloadable = result
            setAnalysis(result)
            setUrlInput(srv.url)
            setSmartStatus(result.status)
          }
          setServerChecks((prev) =>
            prev.map((item) =>
              item.id === srv.id ? { ...item, state: 'done', result } : item,
            ),
          )
        } catch (err) {
          if (controller.signal.aborted) return
          const msg = err instanceof Error ? err.message : 'Check failed'
          setServerChecks((prev) =>
            prev.map((item) =>
              item.id === srv.id ? { ...item, state: 'error', error: msg } : item,
            ),
          )
        }
      }
    }

    await Promise.all(Array.from({ length: workerCount }, () => worker()))
    if (controller.signal.aborted) return

    setIsScanningServers(false)
    if (firstDownloadable) {
      const winner: SmartAnalysisResult = firstDownloadable
      setAnalysis(winner)
      setSmartStatus(winner.status)
      pushHistory({
        id: winner.id,
        url: winner.inputUrl,
        title: winner.title || request?.title || 'Analyzed Video',
        format: winner.deliveryFormat,
        status: winner.status,
        sizeBytes: winner.contentLength,
        timestamp: winner.analyzedAt,
      })
    } else if (firstResult) {
      const fallbackResult: SmartAnalysisResult = firstResult
      setAnalysis(fallbackResult)
      setSmartStatus(fallbackResult.status)
    } else {
      setSmartStatus('Failed')
      setAnalyzeError('Could not analyze any configured servers.')
    }
  }

  useEffect(() => {
    if (
      mode === 'smart' &&
      request?.serverUrls &&
      request.serverUrls.length > 0 &&
      autoScannedRequestRef.current !== request
    ) {
      autoScannedRequestRef.current = request
      void handleAnalyzeAllServers()
    }
  }, [mode, request])

  const handleAnalyze = async (overrideUrl?: string) => {
    const target = (overrideUrl ?? urlInput).trim()
    if (!target) {
      setSmartStatus('Unsupported URL')
      setAnalyzeError('Please paste an embed URL (e.g. https://cinesrc.st/embed/movie/1084242).')
      return
    }

    analyzeAbortRef.current?.abort()
    const controller = new AbortController()
    analyzeAbortRef.current = controller

    setSmartStatus('Analyzing URL')
    setAnalyzeError('')
    setAnalysis(null)
    setDlNotice('')

    try {
      const result = await analyzeSmartEmbedUrl(target, controller.signal)
      setAnalysis(result)
      setSmartStatus(result.status)
      pushHistory({
        id: result.id,
        url: result.inputUrl,
        title: result.title || request?.title || 'Analyzed Video',
        format: result.deliveryFormat,
        status: result.status,
        sizeBytes: result.contentLength,
        timestamp: result.analyzedAt,
      })
    } catch (err) {
      if (controller.signal.aborted) return
      const msg = err instanceof Error ? err.message : 'Failed to analyze URL.'
      setSmartStatus('Failed')
      setAnalyzeError(msg)
    }
  }

  const handleStartSmartDownload = async () => {
    if (!analysis?.downloadable || !analysis.permittedSourceUrl) return

    downloadAbortRef.current?.abort()
    const controller = new AbortController()
    downloadAbortRef.current = controller

    setSmartStatus('Downloading')
    setAnalyzeError('')
    setDlNotice('')
    setDlProgress({
      percent: 0,
      received: 0,
      total: analysis.contentLength ?? null,
      speed: 0,
      eta: null,
    })

    const fileName = analysis.suggestedFileName || 'lumen-video.mp4'
    const streamEndpoint = buildSmartDownloadStreamUrl(analysis.permittedSourceUrl, fileName)

    try {
      const response = await fetch(streamEndpoint, { signal: controller.signal })
      if (!response.ok || !response.body) {
        let serverError = `Download failed with HTTP ${response.status}.`
        try {
          const json = (await response.json()) as { error?: string }
          if (json?.error) serverError = json.error
        } catch {
          // ignore non-json error body
        }
        throw new Error(serverError)
      }

      const headerLen = Number(response.headers.get('content-length') || 0)
      const totalBytes =
        Number.isFinite(headerLen) && headerLen > 0
          ? headerLen
          : (analysis.contentLength ?? null)

      const reader = response.body.getReader()
      const chunks: BlobPart[] = []
      let bytesReceived = 0
      const startedAt = Date.now()
      let lastUpdate = startedAt

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          bytesReceived += value.byteLength
          const now = Date.now()
          if (now - lastUpdate >= 120) {
            const elapsedSec = Math.max(0.1, (now - startedAt) / 1000)
            const speed = bytesReceived / elapsedSec
            const percent =
              totalBytes && totalBytes > 0
                ? Math.min(99, Math.round((bytesReceived / totalBytes) * 100))
                : null
            const eta =
              totalBytes && speed > 0 ? Math.max(0, (totalBytes - bytesReceived) / speed) : null
            setDlProgress({
              percent,
              received: bytesReceived,
              total: totalBytes,
              speed,
              eta,
            })
            lastUpdate = now
          }
        }
      }

      if (bytesReceived < 1024) {
        throw new Error('Downloaded file was empty or too small to be a valid MP4 video.')
      }

      const blob = new Blob(chunks, { type: 'video/mp4' })
      setDlProgress({
        percent: 100,
        received: blob.size,
        total: blob.size,
        speed: blob.size / Math.max(0.1, (Date.now() - startedAt) / 1000),
        eta: 0,
      })

      // Trigger browser file save
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 15_000)

      // Also store in Lumen Offline Library when size fits cleanly in IndexedDB (< 450 MB)
      let savedOffline = false
      if (blob.size <= 450 * 1024 * 1024) {
        try {
          await saveSmartMp4ToOfflineLibrary({
            title: analysis.title || request?.title || fileName.replace(/\.mp4$/i, ''),
            subtitle: request?.subtitle || analysis.host,
            poster: request?.poster,
            sourceUrl: analysis.permittedSourceUrl,
            blob,
          })
          savedOffline = true
        } catch {
          // Non-fatal if IndexedDB quota is tight
        }
      }

      setSmartStatus('Completed')
      setDlNotice(
        savedOffline
          ? `Downloaded ${fileName} (${formatBytes(blob.size)}) and saved to Offline Downloads.`
          : `Downloaded ${fileName} (${formatBytes(blob.size)}) to your device.`,
      )
      pushHistory({
        id: analysis.id,
        url: analysis.inputUrl,
        title: analysis.title,
        format: analysis.deliveryFormat,
        status: 'Completed',
        sizeBytes: blob.size,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      if (controller.signal.aborted) {
        setSmartStatus('Direct MP4 found')
        setDlNotice('Download cancelled.')
        return
      }
      setSmartStatus('Failed')
      setAnalyzeError(err instanceof Error ? err.message : 'Download failed.')
    }
  }

  const handleCancelDownload = () => {
    downloadAbortRef.current?.abort()
  }

  useEffect(() => {
    const targetId = request?.imdbId || request?.tmdbId
    if (mode !== 'direct' || !targetId) return

    directAbortRef.current?.abort()
    const controller = new AbortController()
    directAbortRef.current = controller
    setDirectLoading(true)
    setDirectError('')

    void fetchVidsrcDownloads(
      {
        id: targetId,
        mediaType: request.mediaType || 'movie',
        season: request.season,
        episode: request.episode,
        sub: directSubLang || undefined,
        audio: directAudio || undefined,
      },
      controller.signal,
    )
      .then((res) => {
        if (!controller.signal.aborted) {
          setDirectData(res)
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setDirectError(err instanceof Error ? err.message : 'Failed to load direct links.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDirectLoading(false)
      })

    return () => controller.abort()
  }, [mode, request, directSubLang, directAudio])

  const handleLoadWholeSeason = async () => {
    const targetId = request?.imdbId || request?.tmdbId
    if (!targetId || request?.season === undefined) return
    setSeasonLoading(true)
    try {
      const res = await fetchVidsrcDownloads({
        id: targetId,
        mediaType: request.mediaType || 'tv',
        season: request.season,
        sub: directSubLang || undefined,
        audio: directAudio || undefined,
      })
      setSeasonData(res)
    } catch (err) {
      setDirectError(err instanceof Error ? err.message : 'Could not load season episodes.')
    } finally {
      setSeasonLoading(false)
    }
  }

  const appendDirectParams = (rawUrl?: string): string => {
    if (!rawUrl) return ''
    try {
      const parsed = new URL(rawUrl)
      if (directSubLang) parsed.searchParams.set('sub', directSubLang)
      if (directAudio) parsed.searchParams.set('audio', directAudio)
      return parsed.toString()
    } catch {
      return rawUrl
    }
  }

  if (!request) return null

  const has02Downloader = Boolean(request.url && request.url.trim())
  const hasDirectLinks = Boolean(request.tmdbId || request.imdbId)

  return (
    <div
      className="download-embed-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={request.title ? `Download ${request.title}` : 'Download Video'}
    >
      <div
        className="download-embed-backdrop"
        onClick={closeInSiteDownload}
        aria-hidden="true"
      />

      <div className="download-embed-card">
        <header className="download-embed-header">
          <div className="download-embed-title-group">
            {request.poster ? (
              <img
                src={request.poster}
                alt={request.title || 'Media poster'}
                className="download-embed-poster"
              />
            ) : (
              <div className="download-embed-icon-bubble" aria-hidden="true">
                <Download size={18} />
              </div>
            )}
            <div className="download-embed-meta">
              <h3>{request.title || 'Download Media'}</h3>
              <p>{request.subtitle || 'Download directly inside Lumen'}</p>
            </div>
          </div>

          <div className="download-embed-mode-tabs" role="tablist" aria-label="Download engine">
            {hasDirectLinks && (
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'direct'}
                className={`download-mode-tab${mode === 'direct' ? ' is-active' : ''}`}
                onClick={() => setMode('direct')}
              >
                <HardDriveDownload size={14} />
                <span>Direct Links</span>
              </button>
            )}
            {has02Downloader && (
              <button
                type="button"
                role="tab"
                aria-selected={mode === '02downloader'}
                className={`download-mode-tab${mode === '02downloader' ? ' is-active' : ''}`}
                onClick={() => setMode('02downloader')}
              >
                <Globe size={14} />
                <span>02Downloader</span>
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'smart'}
              className={`download-mode-tab${mode === 'smart' ? ' is-active' : ''}`}
              onClick={() => setMode('smart')}
            >
              <Sparkles size={14} />
              <span>Smart Downloader</span>
            </button>
          </div>

          <div className="download-embed-header-actions">
            {mode === '02downloader' && has02Downloader && (
              <button
                type="button"
                className="download-embed-icon-btn"
                title="Reload download panel"
                aria-label="Reload download panel"
                onClick={() => {
                  setIsFrameLoading(true)
                  setReloadNonce((prev) => prev + 1)
                }}
              >
                <RefreshCw size={16} className={isFrameLoading ? 'spin' : undefined} />
              </button>
            )}
            <button
              type="button"
              className="download-embed-icon-btn close-btn"
              title="Close download"
              aria-label="Close download"
              onClick={closeInSiteDownload}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {mode === 'direct' && hasDirectLinks ? (
          <div className="smart-dl-panel vidsrc-dl-panel">
            <div className="vidsrc-dl-toolbar">
              <div className="vidsrc-dl-control-group">
                <span className="vidsrc-dl-label">Format:</span>
                {(['mp4', 'mkv'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    className={`vidsrc-dl-chip${directFormat === fmt ? ' is-active' : ''}`}
                    onClick={() => setDirectFormat(fmt)}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>

              {request.mediaType === 'anime' && (
                <div className="vidsrc-dl-control-group">
                  <span className="vidsrc-dl-label">Audio:</span>
                  <button
                    type="button"
                    className={`vidsrc-dl-chip${directAudio === '' ? ' is-active' : ''}`}
                    onClick={() => setDirectAudio('')}
                  >
                    Default
                  </button>
                  <button
                    type="button"
                    className={`vidsrc-dl-chip${directAudio === 'dub' ? ' is-active' : ''}`}
                    onClick={() => setDirectAudio('dub')}
                  >
                    English Dub
                  </button>
                </div>
              )}

              {directData?.subtitles && directData.subtitles.length > 0 && (
                <div className="vidsrc-dl-control-group">
                  <label htmlFor="vidsrc-sub-select" className="vidsrc-dl-label">
                    Burn Subtitles:
                  </label>
                  <select
                    id="vidsrc-sub-select"
                    className="vidsrc-dl-select"
                    value={directSubLang}
                    onChange={(e) => setDirectSubLang(e.target.value)}
                  >
                    <option value="">None</option>
                    {directData.subtitles.slice(0, 12).map((sub) => (
                      <option key={`${sub.lang}-${sub.label}`} value={sub.lang}>
                        {sub.label || sub.lang.toUpperCase()} ({sub.lang})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(request.mediaType === 'tv' || request.mediaType === 'anime') &&
                request.season !== undefined && (
                  <button
                    type="button"
                    className="vidsrc-dl-season-btn"
                    onClick={() => void handleLoadWholeSeason()}
                    disabled={seasonLoading}
                  >
                    {seasonLoading ? 'Loading Season…' : `Load Whole Season ${request.season}`}
                  </button>
                )}
            </div>

            {directLoading ? (
              <div className="vidsrc-dl-loading" aria-live="polite">
                <RefreshCw size={24} className="spin" />
                <span>Fetching qualities & direct MP4/MKV links…</span>
              </div>
            ) : directError ? (
              <div className="smart-dl-alert is-danger" role="alert">
                <ShieldAlert size={18} />
                <span>{directError}</span>
              </div>
            ) : directData?.downloads && directData.downloads.length > 0 ? (
              <div className="vidsrc-dl-qualities">
                {directData.downloads.map((opt) => {
                  const rawHref = directFormat === 'mkv' ? opt.mkv || opt.mp4 : opt.mp4 || opt.mkv
                  const href = appendDirectParams(rawHref)
                  return (
                    <div key={`${opt.quality}-${directFormat}`} className="vidsrc-dl-quality-card">
                      <div className="vidsrc-dl-quality-meta">
                        <span className="vidsrc-dl-quality-badge">{opt.quality}</span>
                        <span className="vidsrc-dl-quality-size">
                          {opt.sizeLabel || (opt.size ? formatBytes(opt.size) : directFormat.toUpperCase())}
                        </span>
                        {opt.videoCodec && (
                          <span className="vidsrc-dl-quality-codec">{opt.videoCodec}</span>
                        )}
                      </div>
                      <a
                        href={href}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="vidsrc-dl-download-link"
                      >
                        <Download size={15} />
                        <span>Download {directFormat.toUpperCase()}</span>
                      </a>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="smart-dl-alert is-danger">
                <AlertTriangle size={18} />
                <span>No direct download qualities returned for this title. Try 02Downloader or Smart Downloader.</span>
              </div>
            )}

            {directData?.subtitles && directData.subtitles.length > 0 && (
              <div className="vidsrc-dl-subs-box">
                <span className="vidsrc-dl-label">Subtitles ({directData.subtitles.length}):</span>
                <div className="vidsrc-dl-subs-list">
                  {directData.subtitles.slice(0, 10).map((sub) => (
                    <a
                      key={`sub-${sub.lang}-${sub.label}`}
                      href={sub.srt || sub.vtt}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vidsrc-dl-sub-pill"
                    >
                      {sub.label || sub.lang.toUpperCase()}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {seasonData?.episodes && seasonData.episodes.length > 0 && (
              <div className="vidsrc-dl-season-list">
                <h4>Season {request.season} Episodes ({seasonData.episodes.length})</h4>
                <div className="vidsrc-dl-season-grid">
                  {seasonData.episodes.map((ep) => {
                    const epUrl = appendDirectParams(
                      directFormat === 'mkv'
                        ? ep.mkv || ep.downloads?.[0]?.mkv || ep.mp4
                        : ep.mp4 || ep.downloads?.[0]?.mp4 || ep.mkv,
                    )
                    return (
                      <div key={`ep-${ep.episode}`} className="vidsrc-dl-season-row">
                        <span>
                          Ep {ep.episode}
                          {ep.title ? ` · ${ep.title}` : ''}
                        </span>
                        {epUrl && (
                          <a
                            href={epUrl}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="vidsrc-dl-ep-link"
                          >
                            <Download size={13} />
                            <span>{directFormat.toUpperCase()}</span>
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : mode === '02downloader' && has02Downloader ? (
          <div className="download-embed-frame-wrap">
            {isFrameLoading && (
              <div className="download-embed-loading" aria-live="polite">
                <RefreshCw size={26} className="spin" />
                <span>Preparing download inside Lumen...</span>
              </div>
            )}
            <iframe
              key={`${request.url}-${reloadNonce}`}
              src={request.url}
              title={request.title ? `Download ${request.title}` : 'Lumen Download'}
              className="download-embed-iframe"
              allow="autoplay; fullscreen; encrypted-media; clipboard-write"
              allowFullScreen
              onLoad={() => setIsFrameLoading(false)}
            />
          </div>
        ) : (
          <div className="smart-dl-panel">
            <form
              className="smart-dl-url-form"
              onSubmit={(e) => {
                e.preventDefault()
                void handleAnalyze()
              }}
            >
              <div className="smart-dl-input-wrap">
                <Link2 size={16} className="smart-dl-input-icon" />
                <input
                  type="url"
                  className="smart-dl-input"
                  placeholder="Paste video embed URL (e.g. https://cinesrc.st/embed/movie/1084242)…"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  aria-label="Embed URL"
                />
              </div>
              <button
                type="submit"
                className="smart-dl-analyze-btn"
                disabled={smartStatus === 'Analyzing URL' || smartStatus === 'Downloading'}
              >
                {smartStatus === 'Analyzing URL' && !isScanningServers ? (
                  <>
                    <RefreshCw size={15} className="spin" />
                    <span>Analyzing…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Analyze</span>
                  </>
                )}
              </button>
              {request.serverUrls && request.serverUrls.length > 1 && (
                <button
                  type="button"
                  className="smart-dl-scan-all-btn"
                  disabled={isScanningServers || smartStatus === 'Downloading'}
                  onClick={() => void handleAnalyzeAllServers()}
                >
                  {isScanningServers ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      <span>Checking…</span>
                    </>
                  ) : (
                    <span>Check All Servers ({request.serverUrls.length})</span>
                  )}
                </button>
              )}
            </form>

            {serverChecks.length > 0 && (
              <div className="smart-dl-servers-box">
                <div className="smart-dl-servers-head">
                  <span>
                    Server Scan ({serverChecks.filter((s) => s.state === 'done' || s.state === 'error').length}/
                    {serverChecks.length})
                  </span>
                  <span>
                    {serverChecks.filter((s) => s.result?.downloadable).length} downloadable MP4 found
                  </span>
                </div>
                <div className="smart-dl-servers-grid">
                  {serverChecks.map((srv) => {
                    const isDownloadable = Boolean(srv.result?.downloadable && srv.result.permittedSourceUrl)
                    const isSelected = Boolean(srv.result && analysis?.id === srv.result.id)
                    const labelText =
                      srv.state === 'checking'
                        ? 'Checking…'
                        : srv.state === 'error'
                          ? 'Unreachable'
                          : srv.result
                            ? srv.result.downloadable
                              ? 'Direct MP4 found'
                              : srv.result.deliveryFormat !== 'Unknown'
                                ? srv.result.deliveryFormat
                                : srv.result.status
                            : 'Pending'

                    return (
                      <button
                        key={srv.id}
                        type="button"
                        className={`smart-dl-server-pill${isDownloadable ? ' is-mp4' : ''}${isSelected ? ' is-selected' : ''}`}
                        onClick={() => {
                          setUrlInput(srv.url)
                          if (srv.result) {
                            setAnalysis(srv.result)
                            setSmartStatus(srv.result.status)
                          } else {
                            void handleAnalyze(srv.url)
                          }
                        }}
                        title={srv.url}
                      >
                        <span className="smart-dl-server-name">{srv.name}</span>
                        <span
                          className={`smart-dl-server-status${
                            isDownloadable
                              ? ' is-success'
                              : srv.state === 'checking'
                                ? ' is-active'
                                : ' is-muted'
                          }`}
                        >
                          {labelText}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="smart-dl-status-row">
              <span className={`smart-dl-status-badge ${statusToneClass(smartStatus)}`}>
                {smartStatus}
              </span>
              {analysis?.deliveryFormat && (
                <span className="smart-dl-meta-pill">
                  <FileVideo size={13} />
                  <span>{analysis.deliveryFormat}</span>
                </span>
              )}
              {analysis?.host && analysis.host !== 'invalid' && (
                <span className="smart-dl-meta-pill">
                  <Globe size={13} />
                  <span>{analysis.host}</span>
                </span>
              )}
              {analysis?.contentLength ? (
                <span className="smart-dl-meta-pill">
                  <HardDriveDownload size={13} />
                  <span>{formatBytes(analysis.contentLength)}</span>
                </span>
              ) : null}
            </div>

            {analyzeError && (
              <div className="smart-dl-alert is-danger" role="alert">
                <ShieldAlert size={18} />
                <span>{analyzeError}</span>
              </div>
            )}

            {dlNotice && (
              <div className="smart-dl-alert is-success" role="status">
                <CheckCircle2 size={18} />
                <span>{dlNotice}</span>
              </div>
            )}

            {analysis && (
              <div className="smart-dl-info-card">
                <div className="smart-dl-info-head">
                  <div>
                    <h4>{analysis.title}</h4>
                    <p className="smart-dl-final-url">{analysis.finalUrl}</p>
                  </div>
                  {analysis.downloadable && analysis.permittedSourceUrl ? (
                    smartStatus === 'Downloading' ? (
                      <button
                        type="button"
                        className="smart-dl-cancel-btn"
                        onClick={handleCancelDownload}
                      >
                        <Square size={14} />
                        <span>Cancel</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="smart-dl-download-btn"
                        onClick={() => void handleStartSmartDownload()}
                      >
                        <Download size={16} />
                        <span>Download MP4</span>
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      className="smart-dl-download-btn"
                      disabled
                      title="No permitted unprotected MP4 source found"
                    >
                      <Download size={16} />
                      <span>Unavailable</span>
                    </button>
                  )}
                </div>

                <p className="smart-dl-explanation">
                  {!analysis.downloadable && (
                    <AlertTriangle size={15} className="smart-dl-inline-warn" />
                  )}
                  <span>{analysis.explanation}</span>
                </p>

                {analysis.alternativeSuggestion && (
                  <p className="smart-dl-suggestion">{analysis.alternativeSuggestion}</p>
                )}

                {analysis.permittedSourceUrl && (
                  <div className="smart-dl-verified-source">
                    <span>Verified MP4:</span>
                    <code>{analysis.permittedSourceUrl}</code>
                    <a
                      href={analysis.permittedSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open direct MP4"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                )}

                {smartStatus === 'Downloading' && (
                  <div className="smart-dl-progress-box">
                    <div className="smart-dl-progress-track">
                      <div
                        className="smart-dl-progress-fill"
                        style={{ width: `${dlProgress.percent ?? 25}%` }}
                      />
                    </div>
                    <div className="smart-dl-progress-stats">
                      <span>
                        {dlProgress.percent !== null ? `${dlProgress.percent}%` : 'Streaming…'} (
                        {formatBytes(dlProgress.received)}
                        {dlProgress.total ? ` / ${formatBytes(dlProgress.total)}` : ''})
                      </span>
                      <span>
                        {formatSpeed(dlProgress.speed)} · ETA {formatEta(dlProgress.eta)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {history.length > 0 && (
              <div className="smart-dl-history">
                <div className="smart-dl-history-header">
                  <History size={14} />
                  <span>Recent Analyzes</span>
                </div>
                <ul className="smart-dl-history-list">
                  {history.slice(0, 5).map((item) => (
                    <li key={`${item.id}-${item.url}`}>
                      <button
                        type="button"
                        className="smart-dl-history-item"
                        onClick={() => {
                          setUrlInput(item.url)
                          void handleAnalyze(item.url)
                        }}
                      >
                        <span className="smart-dl-history-title">{item.title}</span>
                        <span className="smart-dl-history-meta">
                          {item.format} · {item.status}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
