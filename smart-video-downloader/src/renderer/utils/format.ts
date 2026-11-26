import type { AppStatus } from '../../shared/types'

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
    return 'Unknown'
  }
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, i)
  return `${value >= 100 || i === 0 ? value.toFixed(0) : value.toFixed(2)} ${units[i]}`
}

export function formatSpeed(bytesPerSec: number | null | undefined): string {
  if (!bytesPerSec || !Number.isFinite(bytesPerSec) || bytesPerSec <= 0) {
    return '0 B/s'
  }
  return `${formatBytes(bytesPerSec)}/s`
}

export function formatEta(etaSeconds: number | null | undefined): string {
  if (etaSeconds === null || etaSeconds === undefined || !Number.isFinite(etaSeconds) || etaSeconds < 0) {
    return '--'
  }
  if (etaSeconds === 0) return '0s'
  const hrs = Math.floor(etaSeconds / 3600)
  const mins = Math.floor((etaSeconds % 3600) / 60)
  const secs = Math.floor(etaSeconds % 60)
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

export function statusBadgeClasses(status: AppStatus): string {
  switch (status) {
    case 'Direct MP4 found':
    case 'Ready to download':
    case 'Completed':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
    case 'Analyzing URL':
    case 'Downloading':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/35'
    case 'Streaming-only source':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/35'
    case 'Protected or restricted source':
    case 'Unsupported URL':
    case 'Failed':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/35'
    default:
      return 'bg-zinc-800 text-zinc-300 border-zinc-700'
  }
}
