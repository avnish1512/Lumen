import { useState, useEffect } from 'react'
import { FolderOpen, Settings, X } from 'lucide-react'
import type { AppSettings } from '../../shared/types'

interface SettingsModalProps {
  isOpen: boolean
  settings: AppSettings | null
  onClose: () => void
  onChooseDefaultDir: () => Promise<string | null>
  onSave: (partial: Partial<AppSettings>) => Promise<void>
}

export function SettingsModal({
  isOpen,
  settings,
  onClose,
  onChooseDefaultDir,
  onSave,
}: SettingsModalProps) {
  const [defaultDownloadDir, setDefaultDownloadDir] = useState('')
  const [requestTimeoutMs, setRequestTimeoutMs] = useState(15000)
  const [enableBrowser, setEnableBrowser] = useState(true)
  const [maxDownloadSizeMb, setMaxDownloadSizeMb] = useState(4096)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings) {
      setDefaultDownloadDir(settings.defaultDownloadDir)
      setRequestTimeoutMs(settings.requestTimeoutMs)
      setEnableBrowser(settings.enableAuthorizedBrowserInspection)
      setMaxDownloadSizeMb(settings.maxDownloadSizeMb)
    }
  }, [settings, isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        defaultDownloadDir,
        requestTimeoutMs,
        enableAuthorizedBrowserInspection: enableBrowser,
        maxDownloadSizeMb,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Settings size={18} className="text-sky-400" />
            <h2 className="text-base font-semibold text-zinc-100">Application Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-zinc-400">
              Default Download Folder
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                value={defaultDownloadDir}
                onChange={(e) => setDefaultDownloadDir(e.target.value)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 focus:border-sky-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={async () => {
                  const chosen = await onChooseDefaultDir()
                  if (chosen) setDefaultDownloadDir(chosen)
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
              >
                <FolderOpen size={14} />
                <span>Browse</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400">
                Network Timeout (ms)
              </label>
              <input
                type="number"
                min={3000}
                max={60000}
                step={1000}
                value={requestTimeoutMs}
                onChange={(e) => setRequestTimeoutMs(Number(e.target.value) || 15000)}
                className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400">
                Max File Size Limit (MB)
              </label>
              <input
                type="number"
                min={10}
                max={20480}
                value={maxDownloadSizeMb}
                onChange={(e) => setMaxDownloadSizeMb(Number(e.target.value) || 4096)}
                className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
            <input
              type="checkbox"
              checked={enableBrowser}
              onChange={(e) => setEnableBrowser(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-sky-500"
            />
            <div>
              <div className="text-xs font-semibold text-zinc-200">
                Authorized Browser Session Metadata Inspection
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                Loads client-rendered embed pages in an ephemeral sandboxed session when static HTML
                shows no media tags. Respects anti-bot, CAPTCHA, and DRM restrictions.
              </p>
            </div>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2.5 border-t border-zinc-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-sky-400 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
