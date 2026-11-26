import type { ElectronApi } from '../shared/types'

declare global {
  interface Window {
    smartDownloader?: ElectronApi
  }
}

export {}
