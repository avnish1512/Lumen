import { useCallback, useEffect, useState } from 'react'
import { Film, Settings, Shield } from 'lucide-react'
import type {
  AnalysisResult,
  AppSettings,
  AppStatus,
  DownloadProgressEvent,
  HistoryItem,
} from '../shared/types'
import { UrlAnalyzerBar } from './components/UrlAnalyzerBar'
import { VideoInfoPanel } from './components/VideoInfoPanel'
import { ActiveDownloadCard } from './components/ActiveDownloadCard'
import { HistoryPanel } from './components/HistoryPanel'
import { SettingsModal } from './components/SettingsModal'

function joinDirAndFile(dir: string, fileName: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  const cleanDir = dir.replace(/[\\/]+$/, '')
  return `${cleanDir}${sep}${fileName}`
}

export function App() {
  const api = window.smartDownloader

  const [urlInput, setUrlInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [liveStatus, setLiveStatus] = useState<AppStatus>('Idle')
  const [savePath, setSavePath] = useState('')
  const [activeDownload, setActiveDownload] = useState<DownloadProgressEvent | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [uiNotice, setUiNotice] = useState<string | null>(null)

  const refreshHistory = useCallback(async () => {
    if (!api) return
    const items = await api.getHistory()
    setHistory(items)
  }, [api])

  useEffect(() => {
    if (!api) return
    void api.getSettings().then(setSettings)
    void refreshHistory()

    const unsubStatus = api.onAnalysisStatus((payload) => {
      setLiveStatus(payload.status)
      setStatusMessage(payload.message)
    })

    const unsubProgress = api.onDownloadProgress((progress) => {
      setActiveDownload(progress)
      setLiveStatus(progress.status)
      if (progress.status === 'Completed' || progress.status === 'Failed') {
        void refreshHistory()
      }
    })

    return () => {
      unsubStatus()
      unsubProgress()
    }
  }, [api, refreshHistory])

  const handleAnalyze = async (overrideUrl?: string) => {
    const target = (overrideUrl ?? urlInput).trim()
    if (!target) return
    if (!api) {
      setUiNotice('Desktop IPC bridge is unavailable. Launch via Electron ("npm run dev" or "npm start").')
      return
    }

    setUiNotice(null)
    setIsAnalyzing(true)
    setLiveStatus('Analyzing URL')
    setStatusMessage('Validating URL and checking host security...')
    setAnalysis(null)
    setSavePath('')

    try {
      const res = await api.analyzeUrl(target)
      setAnalysis(res)
      if (res.downloadable && res.permittedSourceUrl) {
        const baseDir = settings?.defaultDownloadDir || ''
        setSavePath(baseDir ? joinDirAndFile(baseDir, res.suggestedFileName) : res.suggestedFileName)
        setLiveStatus('Ready to download')
        setStatusMessage('Verified direct MP4 source is ready for download.')
      } else {
        setLiveStatus(res.status)
        setStatusMessage(res.explanation)
      }
      await refreshHistory()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected analysis error'
      setLiveStatus('Failed')
      setStatusMessage(msg)
      setUiNotice(msg)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleChooseSavePath = async () => {
    if (!api || !analysis) return
    const chosen = await api.chooseSavePath(analysis.suggestedFileName)
    if (chosen) {
      setSavePath(chosen)
    }
  }

  const handleStartDownload = async () => {
    if (!api || !analysis || !analysis.downloadable || !analysis.permittedSourceUrl || !savePath) {
      return
    }
    setUiNotice(null)
    setLiveStatus('Downloading')
    try {
      const result = await api.startDownload({
        sourceUrl: analysis.inputUrl,
        verifiedMp4Url: analysis.permittedSourceUrl,
        savePath,
        title: analysis.title,
        deliveryFormat: analysis.deliveryFormat,
      })
      setActiveDownload(result)
      setLiveStatus(result.status)
      await refreshHistory()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed'
      setUiNotice(msg)
      setLiveStatus('Failed')
    }
  }

  const handleCancelDownload = async (downloadId: string) => {
    if (!api) return
    await api.cancelDownload(downloadId)
  }

  const handleOpenInFolder = async (targetPath: string) => {
    if (!api) return
    const res = await api.openFileInFolder(targetPath)
    if (!res.ok && res.error) {
      setUiNotice(res.error)
    }
  }

  const isDownloading = activeDownload?.status === 'Downloading'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-zinc-950 shadow-lg shadow-sky-500/20">
              <Film size={20} strokeWidth={2.3} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                Smart Video Downloader
              </h1>
              <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Shield size={12} className="text-emerald-400" />
                <span>Embed URL Analyzer &amp; Permitted Direct MP4 Downloader</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800"
          >
            <Settings size={15} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-5 py-6">
        {!api && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs text-amber-200">
            Running in browser preview mode without Electron IPC bridge. Start the desktop app via{' '}
            <code className="rounded bg-black/40 px-1.5 py-0.5">npm run dev</code> or{' '}
            <code className="rounded bg-black/40 px-1.5 py-0.5">npm start</code> for full URL
            analysis, SQLite storage, and streaming downloads.
          </div>
        )}

        {uiNotice && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-200">
            {uiNotice}
          </div>
        )}

        <UrlAnalyzerBar
          url={urlInput}
          isAnalyzing={isAnalyzing}
          isDownloading={isDownloading}
          onUrlChange={setUrlInput}
          onAnalyze={() => void handleAnalyze()}
          onLoadTestCase={(sampleUrl) => {
            setUrlInput(sampleUrl)
            void handleAnalyze(sampleUrl)
          }}
        />

        <VideoInfoPanel
          analysis={analysis}
          effectiveStatus={liveStatus}
          statusMessage={statusMessage}
          savePath={savePath}
          isDownloading={isDownloading}
          onChooseSavePath={() => void handleChooseSavePath()}
          onDownload={() => void handleStartDownload()}
        />

        <ActiveDownloadCard
          download={activeDownload}
          onCancel={(id) => void handleCancelDownload(id)}
          onOpenInFolder={(filePath) => void handleOpenInFolder(filePath)}
        />

        <HistoryPanel
          history={history}
          onDelete={async (id) => {
            if (!api) return
            await api.deleteHistoryItem(id)
            await refreshHistory()
          }}
          onClearAll={async () => {
            if (!api) return
            await api.clearHistory()
            await refreshHistory()
          }}
          onOpenInFolder={(filePath) => void handleOpenInFolder(filePath)}
          onSelectUrl={(selected) => setUrlInput(selected)}
        />
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onChooseDefaultDir={async () => (api ? api.chooseDefaultDirectory() : null)}
        onSave={async (partial) => {
          if (!api) return
          const updated = await api.saveSettings(partial)
          setSettings(updated)
          if (analysis?.downloadable && analysis.suggestedFileName) {
            setSavePath(joinDirAndFile(updated.defaultDownloadDir, analysis.suggestedFileName))
          }
        }}
      />
    </div>
  )
}
