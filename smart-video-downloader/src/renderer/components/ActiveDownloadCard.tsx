import { CheckCircle2, FolderOpen, XCircle, Loader2, OctagonX } from 'lucide-react'
import type { DownloadProgressEvent } from '../../shared/types'
import { formatBytes, formatEta, formatSpeed, statusBadgeClasses } from '../utils/format'

interface ActiveDownloadCardProps {
  download: DownloadProgressEvent | null
  onCancel: (downloadId: string) => void
  onOpenInFolder: (filePath: string) => void
}

export function ActiveDownloadCard({
  download,
  onCancel,
  onOpenInFolder,
}: ActiveDownloadCardProps) {
  if (!download) return null

  const pct =
    download.status === 'Completed'
      ? 100
      : download.percent !== null
        ? download.percent
        : null

  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/75 p-5 shadow-xl shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            {download.status === 'Downloading' ? (
              <Loader2 size={17} className="animate-spin text-sky-400" />
            ) : download.status === 'Completed' ? (
              <CheckCircle2 size={17} className="text-emerald-400" />
            ) : (
              <XCircle size={17} className="text-rose-400" />
            )}
            <h3 className="truncate text-sm font-semibold text-zinc-100">{download.title}</h3>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-zinc-400" title={download.savePath}>
            {download.savePath}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClasses(download.status)}`}
          >
            {download.status}
          </span>

          {download.status === 'Downloading' && (
            <button
              type="button"
              onClick={() => onCancel(download.downloadId)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25"
            >
              <OctagonX size={14} />
              <span>Cancel</span>
            </button>
          )}

          {download.status === 'Completed' && (
            <button
              type="button"
              onClick={() => onOpenInFolder(download.savePath)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
            >
              <FolderOpen size={14} />
              <span>Show in Folder</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
        {pct !== null ? (
          <div
            className={`h-full rounded-full transition-all duration-150 ${
              download.status === 'Completed'
                ? 'bg-emerald-500'
                : download.status === 'Failed'
                  ? 'bg-rose-500'
                  : 'bg-sky-500'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        ) : (
          <div className="h-full w-1/2 animate-pulse rounded-full bg-sky-500/80" />
        )}
      </div>

      {/* Speed, ETA, Size metrics */}
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div className="rounded-lg bg-zinc-950/70 px-3 py-2">
          <span className="text-zinc-500">Progress: </span>
          <strong className="text-zinc-200">
            {pct !== null ? `${pct}%` : 'Streaming'}
          </strong>
        </div>
        <div className="rounded-lg bg-zinc-950/70 px-3 py-2">
          <span className="text-zinc-500">Transferred: </span>
          <strong className="text-zinc-200">
            {formatBytes(download.bytesReceived)}
            {download.totalBytes ? ` / ${formatBytes(download.totalBytes)}` : ''}
          </strong>
        </div>
        <div className="rounded-lg bg-zinc-950/70 px-3 py-2">
          <span className="text-zinc-500">Speed: </span>
          <strong className="text-zinc-200">{formatSpeed(download.speedBytesPerSec)}</strong>
        </div>
        <div className="rounded-lg bg-zinc-950/70 px-3 py-2">
          <span className="text-zinc-500">Remaining Time: </span>
          <strong className="text-zinc-200">{formatEta(download.etaSeconds)}</strong>
        </div>
      </div>

      {download.error && (
        <div className="mt-3 rounded-xl border border-rose-500/35 bg-rose-950/30 px-3.5 py-2.5 text-xs text-rose-200">
          {download.error}
        </div>
      )}
    </section>
  )
}
