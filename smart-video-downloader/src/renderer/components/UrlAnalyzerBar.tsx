import { Search, Loader2, ShieldAlert } from 'lucide-react'
import type { FormEvent } from 'react'

interface UrlAnalyzerBarProps {
  url: string
  isAnalyzing: boolean
  isDownloading: boolean
  onUrlChange: (val: string) => void
  onAnalyze: () => void
  onLoadTestCase: (url: string) => void
}

export function UrlAnalyzerBar({
  url,
  isAnalyzing,
  isDownloading,
  onUrlChange,
  onAnalyze,
  onLoadTestCase,
}: UrlAnalyzerBarProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!isAnalyzing && !isDownloading && url.trim()) {
      onAnalyze()
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/75 p-5 shadow-xl shadow-black/30">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-400"
            size={18}
          />
          <input
            type="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="Paste video embed or direct MP4 URL (e.g. https://cinesrc.st/embed/movie/1084242)"
            aria-label="Video or embed URL"
            disabled={isAnalyzing}
            className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/90 py-3 pr-4 pl-10 text-sm text-zinc-100 placeholder-zinc-500 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25 focus:outline-none disabled:opacity-60"
          />
        </div>

        <button
          type="submit"
          disabled={isAnalyzing || !url.trim()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {isAnalyzing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <span>Analyze</span>
          )}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-sky-400" />
          <span>
            Verifies public accessibility &amp; MP4 container headers before enabling downloads.
          </span>
        </div>

        <button
          type="button"
          onClick={() => onLoadTestCase('https://cinesrc.st/embed/movie/1084242')}
          disabled={isAnalyzing}
          className="rounded-lg border border-zinc-700/80 bg-zinc-800/70 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white disabled:opacity-50"
        >
          Load Test Case: cinesrc.st/embed/movie/1084242
        </button>
      </div>
    </section>
  )
}
