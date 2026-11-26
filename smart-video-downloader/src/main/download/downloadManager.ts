import crypto from 'node:crypto'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable, Transform } from 'node:stream'
import { validateMp4FileOnDisk, validateMp4HeaderBuffer } from '../analysis/mp4Signature'
import {
  ensureWritableDirectory,
  deriveTitleFromUrl,
  validateSaveFilePath,
} from '../security/pathGuard'
import { safeFetchWithRedirects, type UrlSecurityOptions } from '../security/urlGuard'
import type { SqliteStore } from '../storage/sqliteStore'
import type { DownloadProgressEvent, DownloadRequest } from '../../shared/types'

export interface DownloadManagerOptions {
  store?: SqliteStore
  security?: UrlSecurityOptions
  maxDownloadSizeMb?: number
}

function mapSystemError(err: unknown): string {
  const nodeErr = err as NodeJS.ErrnoException | undefined
  if (nodeErr?.code === 'ENOSPC') {
    return 'Insufficient disk space to complete the download.'
  }
  if (nodeErr?.code === 'EACCES' || nodeErr?.code === 'EPERM' || nodeErr?.code === 'EROFS') {
    return 'File permission error: cannot write to the selected save location.'
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return 'Download was cancelled.'
  }
  return err instanceof Error ? err.message : 'Download failed due to an unexpected error.'
}

export class DownloadManager {
  private readonly activeControllers = new Map<string, AbortController>()

  public cancelDownload(downloadId: string): boolean {
    const controller = this.activeControllers.get(downloadId)
    if (!controller) return false
    controller.abort(new Error('Cancelled by user'))
    return true
  }

  public cancelAll(): void {
    for (const controller of this.activeControllers.values()) {
      controller.abort(new Error('Application shutting down'))
    }
    this.activeControllers.clear()
  }

  public async startDownload(
    request: DownloadRequest,
    onProgress: (event: DownloadProgressEvent) => void,
    options?: DownloadManagerOptions,
  ): Promise<DownloadProgressEvent> {
    const downloadId = crypto.randomUUID()
    const controller = new AbortController()
    this.activeControllers.set(downloadId, controller)

    const title = request.title?.trim() || deriveTitleFromUrl(request.verifiedMp4Url)
    let safeSavePath: string
    let tempPartPath: string | null = null
    let historyId: number | null = null

    try {
      safeSavePath = validateSaveFilePath(request.savePath)
      await ensureWritableDirectory(path.dirname(safeSavePath))
      tempPartPath = `${safeSavePath}.${downloadId.slice(0, 8)}.part`

      if (options?.store) {
        const record = await options.store.addHistory({
          inputUrl: request.sourceUrl,
          resolvedUrl: request.verifiedMp4Url,
          title,
          fileName: path.basename(safeSavePath),
          savePath: safeSavePath,
          deliveryFormat: request.deliveryFormat || 'Direct MP4',
          status: 'Downloading',
        })
        historyId = record.id
      }

      onProgress({
        downloadId,
        sourceUrl: request.sourceUrl,
        verifiedMp4Url: request.verifiedMp4Url,
        savePath: safeSavePath,
        title,
        status: 'Downloading',
        bytesReceived: 0,
        totalBytes: null,
        percent: 0,
        speedBytesPerSec: 0,
        etaSeconds: null,
      })

      // Use generous inactivity/connection budget via timeout + AbortSignal
      const { response } = await safeFetchWithRedirects(
        request.verifiedMp4Url,
        {
          method: 'GET',
          headers: {
            Accept: 'video/mp4,application/octet-stream;q=0.9,*/*;q=0.5',
          },
          signal: controller.signal,
        },
        {
          ...options?.security,
          timeoutMs: options?.security?.timeoutMs ?? 120_000,
        },
      )

      if (response.status >= 400) {
        await response.body?.cancel().catch(() => {})
        throw new Error(`Download failed: server responded with HTTP ${response.status}.`)
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase()
      if (
        contentType.includes('text/html') ||
        contentType.includes('application/json') ||
        contentType.includes('mpegurl') ||
        contentType.includes('dash+xml')
      ) {
        await response.body?.cancel().catch(() => {})
        throw new Error(
          `Expected a direct MP4 video stream, but received "${contentType}". Download aborted.`,
        )
      }

      const hasContentEncoding = Boolean(response.headers.get('content-encoding'))
      const rawLength = response.headers.get('content-length')
      const expectedTotalBytes =
        !hasContentEncoding && rawLength && Number.isFinite(Number(rawLength)) && Number(rawLength) > 0
          ? Number(rawLength)
          : null

      const maxBytes = (options?.maxDownloadSizeMb ?? 4096) * 1024 * 1024
      if (expectedTotalBytes !== null && expectedTotalBytes > maxBytes) {
        await response.body?.cancel().catch(() => {})
        throw new Error(
          `File size (${Math.round(expectedTotalBytes / (1024 * 1024))} MB) exceeds the configured safety limit (${options?.maxDownloadSizeMb ?? 4096} MB).`,
        )
      }

      if (!response.body) {
        throw new Error('Server returned an empty response body.')
      }

      let bytesReceived = 0
      const startTime = Date.now()
      let lastEmitTime = 0
      const headChunks: Buffer[] = []
      let headVerified = false

      const meterTransform = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          if (controller.signal.aborted) {
            callback(new Error('Cancelled by user'))
            return
          }

          bytesReceived += chunk.length
          if (bytesReceived > maxBytes) {
            callback(new Error('Download exceeded maximum allowed file size limit.'))
            return
          }

          if (!headVerified) {
            headChunks.push(chunk)
            const collected = Buffer.concat(headChunks)
            if (collected.length >= 16) {
              const sig = validateMp4HeaderBuffer(collected)
              if (!sig.valid) {
                callback(new Error(sig.reason || 'Downloaded stream is not a valid MP4 container.'))
                return
              }
              headVerified = true
              headChunks.length = 0
            }
          }

          const now = Date.now()
          if (now - lastEmitTime >= 150) {
            lastEmitTime = now
            const elapsedSec = Math.max(0.05, (now - startTime) / 1000)
            const speed = bytesReceived / elapsedSec
            const percent =
              expectedTotalBytes && expectedTotalBytes > 0
                ? Math.min(99, Math.round((bytesReceived / expectedTotalBytes) * 100))
                : null
            const eta =
              expectedTotalBytes && speed > 0
                ? Math.max(0, Math.round((expectedTotalBytes - bytesReceived) / speed))
                : null

            onProgress({
              downloadId,
              sourceUrl: request.sourceUrl,
              verifiedMp4Url: request.verifiedMp4Url,
              savePath: safeSavePath,
              title,
              status: 'Downloading',
              bytesReceived,
              totalBytes: expectedTotalBytes,
              percent,
              speedBytesPerSec: speed,
              etaSeconds: eta,
            })
          }

          callback(null, chunk)
        },
      })

      const webReadable = response.body as unknown as import('node:stream/web').ReadableStream<Uint8Array>
      const nodeReadable = Readable.fromWeb(webReadable)
      const fileWriter = fsSync.createWriteStream(tempPartPath, { flags: 'w' })

      await pipeline(nodeReadable, meterTransform, fileWriter, { signal: controller.signal })

      // Verify post-download integrity on disk (size > 0, matches expected Content-Length, valid MP4 ftyp header)
      const diskCheck = await validateMp4FileOnDisk(tempPartPath, expectedTotalBytes)
      if (!diskCheck.valid) {
        throw new Error(diskCheck.reason || 'Downloaded file failed MP4 validation.')
      }

      await fs.rename(tempPartPath, safeSavePath)
      tempPartPath = null

      if (options?.store && historyId !== null) {
        await options.store.updateHistory(historyId, {
          status: 'Completed',
          fileSizeBytes: diskCheck.sizeBytes,
          errorMessage: null,
        })
      }

      const elapsedSec = Math.max(0.05, (Date.now() - startTime) / 1000)
      const completedEvent: DownloadProgressEvent = {
        downloadId,
        sourceUrl: request.sourceUrl,
        verifiedMp4Url: request.verifiedMp4Url,
        savePath: safeSavePath,
        title,
        status: 'Completed',
        bytesReceived: diskCheck.sizeBytes,
        totalBytes: diskCheck.sizeBytes,
        percent: 100,
        speedBytesPerSec: diskCheck.sizeBytes / elapsedSec,
        etaSeconds: 0,
      }

      onProgress(completedEvent)
      return completedEvent
    } catch (err) {
      if (tempPartPath) {
        await fs.unlink(tempPartPath).catch(() => {})
      }

      const message = mapSystemError(err)
      if (options?.store && historyId !== null) {
        await options.store.updateHistory(historyId, {
          status: 'Failed',
          errorMessage: message,
        })
      }

      const failedEvent: DownloadProgressEvent = {
        downloadId,
        sourceUrl: request.sourceUrl,
        verifiedMp4Url: request.verifiedMp4Url,
        savePath: request.savePath,
        title,
        status: 'Failed',
        bytesReceived: 0,
        totalBytes: null,
        percent: null,
        speedBytesPerSec: 0,
        etaSeconds: null,
        error: message,
      }
      onProgress(failedEvent)
      return failedEvent
    } finally {
      this.activeControllers.delete(downloadId)
    }
  }
}
