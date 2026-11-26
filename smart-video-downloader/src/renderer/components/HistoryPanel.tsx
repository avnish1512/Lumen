import { FolderOpen, History, Trash2 } from 'lucide-react'
import type { HistoryItem } from '../../shared/types'
import { formatBytes, statusBadgeClasses } from '../utils/format'

interface HistoryPanelProps {
  history: HistoryItem[]
  onDelete: (id: number) => void
  onClearAll: () => void
  onOpenInFolder: (savePath: string) => void
  onSelectUrl: (url: string) => void
}

export function HistoryPanel({
  history,
  onDelete,
  onClearAll,
  onOpenInFolder,
  onSelectUrl,
}: HistoryPanelProps) {
  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/75 p-5 shadow-xl shadow-black/30">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <History size={18} className="text-sky-400" />
          <h2 className="text-base font-semibold text-zinc-100">
            Download &amp; Analysis History
          </h2>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
            {history.length}
          </span>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-800/70 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-200"
          >
            <Trash2 size={13} />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="py-8 text-center text-sm text-zinc-500">
          No history entries yet. Analyzed URLs and completed downloads are stored locally in SQLite.
        </div>
      ) : (
        <div className="mt-3 divide-y divide-zinc-800/80">
          {history.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2.5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectUrl(item.inputUrl)}
                    className="truncate text-left text-sm font-semibold text-zinc-100 hover:text-sky-400"
                    title="Load URL into analyzer"
                  >
                    {item.title}
                  </button>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClasses(item.status)}`}
                  >
                    {item.status}
                  </span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-400">
                    {item.deliveryFormat}
                  </span>
                  {item.fileSizeBytes !== null && item.fileSizeBytes > 0 && (
                    <span className="text-xs text-zinc-400">
                      {formatBytes(item.fileSizeBytes)}
                    </span>
                  )}
                </div>

                <p className="truncate font-mono text-xs text-zinc-500" title={item.inputUrl}>
                  {item.inputUrl}
                </p>

                {item.errorMessage && item.status !== 'Completed' && (
                  <p className="line-clamp-2 text-xs text-zinc-400">{item.errorMessage}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {item.status === 'Completed' && item.savePath && (
                  <button
                    type="button"
                    onClick={() => onOpenInFolder(item.savePath!)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700"
                    title="Show in folder"
                  >
                    <FolderOpen size={13} />
                    <span>Folder</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 transition hover:border-rose-500/40 hover:text-rose-300"
                  title="Remove history entry"
                  aria-label="Remove history entry"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
