import fs from 'node:fs/promises'
import path from 'node:path'

const WINDOWS_RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
])

export class PathSecurityError extends Error {
  public readonly code: 'INVALID_PATH' | 'PERMISSION_DENIED'

  constructor(message: string, code: 'INVALID_PATH' | 'PERMISSION_DENIED') {
    super(message)
    this.name = 'PathSecurityError'
    this.code = code
  }
}

export function sanitizeFileName(rawName: string, fallback = 'video'): string {
  const withoutControls = Array.from(rawName || '')
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join('')

  // Strip extension if it looks like .mp4 so we re-apply cleanly later
  let cleaned = withoutControls
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')

  if (cleaned.toLowerCase().endsWith('.mp4')) {
    cleaned = cleaned.slice(0, -4).replace(/[.\s]+$/g, '')
  }

  if (!cleaned) {
    cleaned = fallback
  }

  if (WINDOWS_RESERVED_NAMES.has(cleaned.toUpperCase())) {
    cleaned = `${cleaned}_video`
  }

  // Keep length reasonable for Windows MAX_PATH
  if (cleaned.length > 96) {
    cleaned = cleaned.slice(0, 96).trim()
  }

  return `${cleaned}.mp4`
}

export function deriveTitleFromUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1]
    if (lastSegment) {
      const decoded = decodeURIComponent(lastSegment)
      return sanitizeFileName(decoded, parsed.hostname).replace(/\.mp4$/i, '')
    }
    return sanitizeFileName(parsed.hostname, 'video').replace(/\.mp4$/i, '')
  } catch {
    return 'video'
  }
}

export function validateSaveFilePath(rawSavePath: string): string {
  if (!rawSavePath || typeof rawSavePath !== 'string' || rawSavePath.includes('\0')) {
    throw new PathSecurityError('Destination path is invalid.', 'INVALID_PATH')
  }

  const resolved = path.resolve(rawSavePath.trim())
  const baseName = path.basename(resolved)
  if (!baseName || baseName === '.' || baseName === '..') {
    throw new PathSecurityError('Destination path must include a valid file name.', 'INVALID_PATH')
  }

  const lower = resolved.toLowerCase()
  const systemRoot = (process.env.SystemRoot || 'C:\\Windows').toLowerCase()
  if (process.platform === 'win32' && (lower === systemRoot || lower.startsWith(`${systemRoot}\\`))) {
    throw new PathSecurityError('Saving files inside system directories is not allowed.', 'PERMISSION_DENIED')
  }

  if (!lower.endsWith('.mp4')) {
    return `${resolved}.mp4`
  }

  return resolved
}

export async function ensureWritableDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Cannot create destination folder'
    throw new PathSecurityError(`Destination folder cannot be created: ${msg}`, 'PERMISSION_DENIED')
  }
}

export async function resolveUniqueSavePath(directory: string, rawFileName: string): Promise<string> {
  const safeFileName = sanitizeFileName(rawFileName)
  const ext = '.mp4'
  const stem = safeFileName.slice(0, -ext.length)
  const resolvedDir = path.resolve(directory)
  await ensureWritableDirectory(resolvedDir)

  for (let i = 0; i < 1000; i++) {
    const candidateName = i === 0 ? `${stem}${ext}` : `${stem} (${i})${ext}`
    const candidatePath = path.join(resolvedDir, candidateName)
    try {
      await fs.access(candidatePath)
    } catch {
      return candidatePath
    }
  }

  return path.join(resolvedDir, `${stem}-${Date.now()}${ext}`)
}
