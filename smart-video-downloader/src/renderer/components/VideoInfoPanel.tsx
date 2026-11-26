import {
  CheckCircle2,
  Download,
  FileVideo,
  FolderEdit,
  Globe,
  Info,
  Lock,
  Radio,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import type { AnalysisResult, AppStatus } from '../../shared/types'
import { formatBytes, statusBadgeClasses } from '../utils/format'

interface VideoInfoPanelProps {
  analysis: AnalysisResult | null
  effectiveStatus: AppStatus
  statusMessage?: string
  savePath: string
  isDownloading: boolean
  onChooseSavePath: () => void
  onDownload: () => void
}

export function VideoInfoPanel({
  analysis,
  effectiveStatus,
  statusMessage,
  savePath,
  isDownloading,
  onChooseSavePath,
  onDownload,
}: VideoInfoPanelProps) {
  const canDownload = Boolean(
    analysis?.downloadable && analysis.permittedSourceUrl && savePath && !isDownloading,
  )

  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/75 p-5 shadow-xl shadow-black/30">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-sky-400">
            <FileVideo size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Video Information</h2>
            <p className="text-xs text-zinc-400">
              {statusMessage ||
                (analysis
                  ? `Analyzed ${analysis.host || analysis.inputUrl}`
                  : 'Enter an embed or direct MP4 URL above and click Analyze')}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClasses(effectiveStatus)}`}
        >
          {effectiveStatus === 'Direct MP4 found' ||
          effectiveStatus === 'Ready to download' ||
          effectiveStatus === 'Completed' ? (
            <CheckCircle2 size={13} />
          ) : effectiveStatus === 'Streaming-only source' ? (
            <Radio size={13} />
          ) : effectiveStatus === 'Protected or restricted source' ? (
            <Lock size={13} />
          ) : (
            <Info size={13} />
          )}
          <span>{effectiveStatus}</span>
        </span>
      </div>

      {!analysis ? (
        <div className="py-10 text-center text-sm text-zinc-500">
          No URL analyzed yet. URL inspection results, delivery protocol, permission status, and
          download controls will appear here.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/70 p-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Title
              </div>
              <div className="mt-1 truncate text-sm font-medium text-zinc-100" title={analysis.title}>
                {analysis.title || 'Untitled'}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/70 p-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Delivery Format
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">
                {analysis.deliveryFormat}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/70 p-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Host / HTTP
              </div>
              <div className="mt-1 flex items-center gap-1.5 truncate text-sm text-zinc-200">
                <Globe size={13} className="shrink-0 text-zinc-400" />
                <span className="truncate">{analysis.host || 'N/A'}</span>
                {analysis.httpStatus && (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-300">
                    {analysis.httpStatus}
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/70 p-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Content Size
              </div>
              <div className="mt-1 text-sm font-medium text-zinc-200">
                {analysis.contentLength ? formatBytes(analysis.contentLength) : 'Unknown'}
              </div>
            </div>
          </div>

          {/* Signals */}
          <div className="flex flex-wrap gap-2">
            {analysis.downloadable && (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                <ShieldCheck size={13} />
                Permitted MP4 Verified
              </span>
            )}
            {analysis.signals.hasHlsManifest && (
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                HLS (.m3u8) Detected
              </span>
            )}
            {analysis.signals.hasDashManifest && (
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                DASH (.mpd) Detected
              </span>
            )}
            {analysis.signals.hasAntiBotOrChallenge && (
              <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300">
                Anti-Bot / Challenge Protection
              </span>
            )}
            {analysis.signals.hasDrmSignals && (
              <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300">
                DRM / EME Signals
              </span>
            )}
            {analysis.signals.hasAuthGate && (
              <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300">
                Authorization / Paywall Gate
              </span>
            )}
            {analysis.signals.usedBrowserSession && (
              <span className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-300">
                Inspected via Authorized Browser Session
              </span>
            )}
          </div>

          {/* Detailed explanation box */}
          <div
            className={`rounded-xl border p-4 text-sm ${
              analysis.downloadable
                ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-100'
                : 'border-zinc-800 bg-zinc-950/80 text-zinc-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {!analysis.downloadable ? (
                <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-400" />
              ) : (
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-400" />
              )}
              <div className="space-y-1.5">
                <p className="leading-relaxed">{analysis.explanation}</p>
                {analysis.alternativeSuggestion && (
                  <p className="text-xs text-zinc-400">
                    <strong className="text-zinc-300">Alternative:</strong>{' '}
                    {analysis.alternativeSuggestion}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Save location + Download trigger (ONLY enabled for verified permitted MP4s) */}
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-800/90 bg-zinc-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Save Location (.mp4)
              </div>
              <div className="mt-0.5 truncate font-mono text-xs text-zinc-300" title={savePath}>
                {savePath || 'Choose a save location...'}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onChooseSavePath}
                disabled={!analysis.downloadable || isDownloading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <FolderEdit size={14} />
                <span>Choose Save Location</span>
              </button>

              <button
                type="button"
                onClick={onDownload}
                disabled={!canDownload}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                <Download size={16} />
                <span>{isDownloading ? 'Downloading...' : 'Download MP4'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
