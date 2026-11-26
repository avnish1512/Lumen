import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { SqliteStore } from '../src/main/storage/sqliteStore'

describe('SQLite Persistence Store', () => {
  let tempDir: string
  let dbPath: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'svd-sql-test-'))
    dbPath = path.join(tempDir, 'app.db')
  })

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  })

  it('persists settings and download history across restarts', async () => {
    const store1 = new SqliteStore(dbPath, tempDir)
    await store1.init()

    const savedSettings = await store1.saveSettings({
      requestTimeoutMs: 22_000,
      enableAuthorizedBrowserInspection: false,
      maxDownloadSizeMb: 2048,
    })
    expect(savedSettings.requestTimeoutMs).toBe(22_000)
    expect(savedSettings.enableAuthorizedBrowserInspection).toBe(false)

    const added = await store1.addHistory({
      inputUrl: 'https://cinesrc.st/embed/movie/1084242',
      resolvedUrl: 'https://cinesrc.st/embed/movie/1084242',
      title: 'CineSrc Test Case',
      deliveryFormat: 'Unknown',
      status: 'Protected or restricted source',
      errorMessage: 'No permitted direct MP4 download source was found.',
    })
    expect(added.id).toBeGreaterThan(0)
    store1.close()

    // Reopen fresh instance from disk
    const store2 = new SqliteStore(dbPath, tempDir)
    await store2.init()

    const reloadedSettings = await store2.getSettings()
    expect(reloadedSettings.requestTimeoutMs).toBe(22_000)
    expect(reloadedSettings.enableAuthorizedBrowserInspection).toBe(false)
    expect(reloadedSettings.maxDownloadSizeMb).toBe(2048)

    const history = await store2.getHistory()
    expect(history.length).toBe(1)
    expect(history[0].inputUrl).toBe('https://cinesrc.st/embed/movie/1084242')
    expect(history[0].status).toBe('Protected or restricted source')

    await store2.deleteHistoryItem(added.id)
    expect((await store2.getHistory()).length).toBe(0)

    await store2.addHistory({
      inputUrl: 'https://example.org/video.mp4',
      title: 'Sample',
      deliveryFormat: 'Direct MP4',
      status: 'Completed',
    })
    await store2.clearHistory()
    expect((await store2.getHistory()).length).toBe(0)

    store2.close()
  })
})
