import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  AppSettings,
  AppStatus,
  DownloadProgressEvent,
  DownloadRequest,
  ElectronApi,
} from '../src/shared/types'

const api: ElectronApi = {
  analyzeUrl: (url: string) => ipcRenderer.invoke('svd:analyze-url', url),
  chooseSavePath: (suggestedFileName: string) =>
    ipcRenderer.invoke('svd:choose-save-path', suggestedFileName),
  chooseDefaultDirectory: () => ipcRenderer.invoke('svd:choose-default-dir'),
  startDownload: (request: DownloadRequest) => ipcRenderer.invoke('svd:start-download', request),
  cancelDownload: (downloadId: string) => ipcRenderer.invoke('svd:cancel-download', downloadId),
  getHistory: () => ipcRenderer.invoke('svd:get-history'),
  deleteHistoryItem: (id: number) => ipcRenderer.invoke('svd:delete-history-item', id),
  clearHistory: () => ipcRenderer.invoke('svd:clear-history'),
  getSettings: () => ipcRenderer.invoke('svd:get-settings'),
  saveSettings: (partial: Partial<AppSettings>) => ipcRenderer.invoke('svd:save-settings', partial),
  openFileInFolder: (filePath: string) => ipcRenderer.invoke('svd:open-in-folder', filePath),

  onAnalysisStatus: (cb: (payload: { status: AppStatus; message: string }) => void) => {
    const listener = (_event: IpcRendererEvent, payload: { status: AppStatus; message: string }) =>
      cb(payload)
    ipcRenderer.on('svd:analysis-status', listener)
    return () => ipcRenderer.removeListener('svd:analysis-status', listener)
  },

  onDownloadProgress: (cb: (progress: DownloadProgressEvent) => void) => {
    const listener = (_event: IpcRendererEvent, progress: DownloadProgressEvent) => cb(progress)
    ipcRenderer.on('svd:download-progress', listener)
    return () => ipcRenderer.removeListener('svd:download-progress', listener)
  },
}

contextBridge.exposeInMainWorld('smartDownloader', api)
