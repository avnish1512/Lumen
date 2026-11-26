import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { createMinimalValidMp4Buffer } from '../src/main/analysis/mp4Signature'
import { DownloadManager } from '../src/main/download/downloadManager'
import { SqliteStore } from '../src/main/storage/sqliteStore'
import type { DownloadProgressEvent } from '../src/shared/types'
import { startMockServer, type MockServerHandle } from './helpers/mockServer'

describe('Download Engine & SQLite Integration', () => {
  let mock: MockServerHandle
  let tempDir: string
  let store: SqliteStore
  const validMp4 = createMinimalValidMp4Buffer(64 * 1024)

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'svd-dl-test-'))
    store = new SqliteStore(path.join(tempDir, 'history.db'), tempDir)
    await store.init()

    mock = await startMockServer((req, res) => {
      const reqUrl = req.url || '/'

      if (reqUrl === '/valid.mp4') {
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': String(validMp4.length),
        })
        // Send in two chunks so progress callbacks & stream backpressure execute cleanly
        const mid = Math.floor(validMp4.length / 2)
        res.write(validMp4.subarray(0, mid))
        setTimeout(() => {
          res.end(validMp4.subarray(mid))
        }, 20)
        return
      }

      if (reqUrl === '/slow-valid.mp4') {
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': String(validMp4.length),
        })
        res.write(validMp4.subarray(0, 1024))
        // Hold stream open briefly so cancellation can interrupt mid-transfer
        const timer = setTimeout(() => {
          if (!res.destroyed) {
            res.end(validMp4.subarray(1024))
          }
        }, 5000)
        req.on('close', () => clearTimeout(timer))
        return
      }

      if (reqUrl === '/truncated.mp4') {
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': String(validMp4.length),
        })
        res.write(validMp4.subarray(0, 2048))
        setTimeout(() => {
          res.destroy(new Error('Simulated connection reset'))
        }, 15)
        return
      }

      if (reqUrl === '/html-disguised.mp4') {
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': '59',
        })
        res.end('<!DOCTYPE html><html><body>Access Denied Error</body></html>')
        return
      }

      res.writeHead(404)
      res.end('Not Found')
    })
  })

  afterAll(async () => {
    store.close()
    await mock.close()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  })

  it('streams, validates MP4 signature, saves .mp4, and records Completed in SQLite', async () => {
    const manager = new DownloadManager()
    const savePath = path.join(tempDir, 'sample-ok.mp4')
    const progressEvents: DownloadProgressEvent[] = []

    const finalEvent = await manager.startDownload(
      {
        sourceUrl: `${mock.baseUrl}/embed`,
        verifiedMp4Url: `${mock.baseUrl}/valid.mp4`,
        savePath,
        title: 'Valid Test Sample',
      },
      (evt) => progressEvents.push(evt),
      { store, security: { allowLoopbackForTests: true } },
    )

    expect(finalEvent.status).toBe('Completed')
    expect(finalEvent.percent).toBe(100)
    expect(finalEvent.bytesReceived).toBe(validMp4.length)
    expect(progressEvents[0].status).toBe('Downloading')

    const diskBytes = await fs.readFile(savePath)
    expect(diskBytes.equals(validMp4)).toBe(true)

    const entries = await fs.readdir(tempDir)
    expect(entries.some((name) => name.endsWith('.part'))).toBe(false)

    const history = await store.getHistory()
    const entry = history.find((h) => h.savePath === savePath)
    expect(entry).toBeDefined()
    expect(entry?.status).toBe('Completed')
    expect(entry?.fileSizeBytes).toBe(validMp4.length)
  })

  it('rejects HTML error disguised as video/mp4 and cleans up temp files', async () => {
    const manager = new DownloadManager()
    const savePath = path.join(tempDir, 'disguised.mp4')

    const finalEvent = await manager.startDownload(
      {
        sourceUrl: `${mock.baseUrl}/html-disguised.mp4`,
        verifiedMp4Url: `${mock.baseUrl}/html-disguised.mp4`,
        savePath,
        title: 'Disguised HTML',
      },
      () => {},
      { store, security: { allowLoopbackForTests: true } },
    )

    expect(finalEvent.status).toBe('Failed')
    expect(finalEvent.error).toMatch(/HTML|MP4/i)

    await expect(fs.access(savePath)).rejects.toThrow()
    const entries = await fs.readdir(tempDir)
    expect(entries.some((name) => name.includes('disguised.mp4'))).toBe(false)

    const history = await store.getHistory()
    expect(history[0].status).toBe('Failed')
  })

  it('fails cleanly on premature network truncation without saving corrupt .mp4', async () => {
    const manager = new DownloadManager()
    const savePath = path.join(tempDir, 'truncated.mp4')

    const finalEvent = await manager.startDownload(
      {
        sourceUrl: `${mock.baseUrl}/truncated.mp4`,
        verifiedMp4Url: `${mock.baseUrl}/truncated.mp4`,
        savePath,
        title: 'Truncated Download',
      },
      () => {},
      { store, security: { allowLoopbackForTests: true } },
    )

    expect(finalEvent.status).toBe('Failed')
    await expect(fs.access(savePath)).rejects.toThrow()
    const entries = await fs.readdir(tempDir)
    expect(entries.some((name) => name.includes('truncated.mp4'))).toBe(false)
  })

  it('supports clean user cancellation mid-download and removes .part file', async () => {
    const manager = new DownloadManager()
    const savePath = path.join(tempDir, 'cancelled.mp4')
    let activeId = ''

    const finalEvent = await manager.startDownload(
      {
        sourceUrl: `${mock.baseUrl}/slow-valid.mp4`,
        verifiedMp4Url: `${mock.baseUrl}/slow-valid.mp4`,
        savePath,
        title: 'Cancelled Stream',
      },
      (evt) => {
        if (!activeId && evt.downloadId) {
          activeId = evt.downloadId
          setTimeout(() => {
            manager.cancelDownload(activeId)
          }, 40)
        }
      },
      { store, security: { allowLoopbackForTests: true } },
    )

    expect(finalEvent.status).toBe('Failed')
    expect(finalEvent.error).toMatch(/cancelled/i)
    await expect(fs.access(savePath)).rejects.toThrow()
  })

  it('handles HTTP 404 download URL failures gracefully', async () => {
    const manager = new DownloadManager()
    const savePath = path.join(tempDir, 'missing.mp4')

    const finalEvent = await manager.startDownload(
      {
        sourceUrl: `${mock.baseUrl}/missing.mp4`,
        verifiedMp4Url: `${mock.baseUrl}/missing.mp4`,
        savePath,
        title: 'Missing Video',
      },
      () => {},
      { store, security: { allowLoopbackForTests: true } },
    )

    expect(finalEvent.status).toBe('Failed')
    expect(finalEvent.error).toContain('404')
    await expect(fs.access(savePath)).rejects.toThrow()
  })
})
