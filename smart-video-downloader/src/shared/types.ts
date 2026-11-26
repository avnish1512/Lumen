export type AppStatus =
  | 'Idle'
  | 'Analyzing URL'
  | 'Direct MP4 found'
  | 'Streaming-only source'
  | 'Protected or restricted source'
  | 'Unsupported URL'
  | 'Ready to download'
  | 'Downloading'
  | 'Completed'
  | 'Failed'

export type DeliveryFormat =
  | 'Direct MP4'
  | 'HLS'
  | 'DASH'
  | 'Other supported format'
  | 'Unknown'

export interface CandidateMediaSource {
  url: string
  format: DeliveryFormat
  sourceKind: 'direct-endpoint' | 'video-tag' | 'source-tag' | 'meta-tag' | 'download-link' | 'json-ld' | 'browser-metadata'
  contentType?: string
  contentLength?: number
  verifiedMp4: boolean
  permitted: boolean
  reason?: string
}

export interface AnalysisResult {
  id: string
  inputUrl: string
  finalUrl: string
  host: string
  status: AppStatus
  deliveryFormat: DeliveryFormat
  title: string
  httpStatus?: number
  contentType?: string
  contentLength?: number
  downloadable: boolean
  permittedSourceUrl?: string
  suggestedFileName: string
  explanation: string
  alternativeSuggestion?: string
  error?: string
  signals: {
    hasDrmSignals: boolean
    hasAntiBotOrChallenge: boolean
    hasAuthGate: boolean
    hasHlsManifest: boolean
    hasDashManifest: boolean
    explicitDownloadLinkFound: boolean
    usedBrowserSession: boolean
  }
  candidates: CandidateMediaSource[]
  analyzedAt: string
}

export interface DownloadRequest {
  sourceUrl: string
  verifiedMp4Url: string
  savePath: string
  title?: string
  deliveryFormat?: DeliveryFormat
}

export interface DownloadProgressEvent {
  downloadId: string
  sourceUrl: string
  verifiedMp4Url: string
  savePath: string
  title: string
  status: Extract<AppStatus, 'Ready to download' | 'Downloading' | 'Completed' | 'Failed'>
  bytesReceived: number
  totalBytes: number | null
  percent: number | null
  speedBytesPerSec: number
  etaSeconds: number | null
  error?: string
}

export interface HistoryItem {
  id: number
  inputUrl: string
  resolvedUrl: string | null
  title: string
  fileName: string | null
  savePath: string | null
  deliveryFormat: DeliveryFormat
  status: AppStatus
  fileSizeBytes: number | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  defaultDownloadDir: string
  requestTimeoutMs: number
  enableAuthorizedBrowserInspection: boolean
  maxDownloadSizeMb: number
}

export interface ElectronApi {
  analyzeUrl: (url: string) => Promise<AnalysisResult>
  chooseSavePath: (suggestedFileName: string) => Promise<string | null>
  chooseDefaultDirectory: () => Promise<string | null>
  startDownload: (request: DownloadRequest) => Promise<DownloadProgressEvent>
  cancelDownload: (downloadId: string) => Promise<{ cancelled: boolean }>
  getHistory: () => Promise<HistoryItem[]>
  deleteHistoryItem: (id: number) => Promise<void>
  clearHistory: () => Promise<void>
  getSettings: () => Promise<AppSettings>
  saveSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  openFileInFolder: (filePath: string) => Promise<{ ok: boolean; error?: string }>
  onAnalysisStatus: (cb: (status: { status: AppStatus; message: string }) => void) => () => void
  onDownloadProgress: (cb: (progress: DownloadProgressEvent) => void) => () => void
}
