import os from 'node:os'
import path from 'node:path'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  shell,
} from 'electron'
import {
  analyzeVideoUrl,
  type BrowserSessionInspection,
} from '../src/main/analysis/urlAnalyzer'
import { DownloadManager } from '../src/main/download/downloadManager'
import { validateSaveFilePath, sanitizeFileName } from '../src/main/security/pathGuard'
import { assertSafeRemoteUrl, validateUrlSyntax } from '../src/main/security/urlGuard'
import { SqliteStore } from '../src/main/storage/sqliteStore'
import type { AppSettings, DownloadRequest } from '../src/shared/types'

let mainWindow: BrowserWindow | null = null
let store: SqliteStore | null = null
const downloadManager = new DownloadManager()

function isDevMode(): boolean {
  return !app.isPackaged && Boolean(process.env.VITE_DEV_SERVER_URL || process.argv.includes('--dev'))
}

async function inspectUrlWithAuthorizedBrowser(
  targetUrl: string,
  timeoutMs: number,
): Promise<BrowserSessionInspection | null> {
  // Verify target URL before opening the isolated inspector window
  await assertSafeRemoteUrl(targetUrl, { timeoutMs })

  const partition = 'svd-ephemeral-inspector'
  const inspectorSession = session.fromPartition(partition, { cache: false })
  await inspectorSession.clearStorageData().catch(() => {})

  const observedMedia: BrowserSessionInspection['mediaUrls'] = []
  const seenUrls = new Set<string>()

  const onBeforeRequest = (
    details: Electron.OnBeforeRequestListenerDetails,
    callback: (response: Electron.CallbackResponse) => void,
  ) => {
    try {
      const parsed = validateUrlSyntax(details.url)
      assertSafeRemoteUrl(parsed.toString(), { timeoutMs: 3000 })
        .then(() => callback({ cancel: false }))
        .catch(() => callback({ cancel: true }))
    } catch {
      callback({ cancel: true })
    }
  }

  const onHeadersReceived = (
    details: Electron.OnHeadersReceivedListenerDetails,
    callback: (headersReceivedResponse: Electron.HeadersReceivedResponse) => void,
  ) => {
    const rawCt =
      details.responseHeaders?.['content-type']?.[0] ||
      details.responseHeaders?.['Content-Type']?.[0] ||
      ''
    const ct = rawCt.toLowerCase()
    if (
      ct.includes('video/mp4') ||
      ct.includes('application/vnd.apple.mpegurl') ||
      ct.includes('x-mpegurl') ||
      ct.includes('application/dash+xml')
    ) {
      if (!seenUrls.has(details.url)) {
        seenUrls.add(details.url)
        observedMedia.push({
          url: details.url,
          contentType: rawCt,
          sourceKind: 'browser-metadata',
        })
      }
    }
    callback({})
  }

  inspectorSession.webRequest.onBeforeRequest(onBeforeRequest)
  inspectorSession.webRequest.onHeadersReceived(onHeadersReceived)

  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 640,
    webPreferences: {
      session: inspectorSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  // Prevent popups from the inspected page
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Browser inspection timed out')), timeoutMs)
      win.webContents.once('did-finish-load', () => {
        clearTimeout(timer)
        resolve()
      })
      win.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
        clearTimeout(timer)
        reject(new Error(`Load failed (${errorCode}): ${errorDescription}`))
      })
      void win.loadURL(targetUrl).catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
    })

    // Allow declarative player metadata to settle briefly without running evasion scripts
    await new Promise((r) => setTimeout(r, 1200))

    // Read-only query of documented public HTML tags (no private internals / no key extraction)
    const domMeta = (await win.webContents.executeJavaScript(
      `(() => {
        const media = [];
        const videos = document.querySelectorAll('video');
        for (const v of videos) {
          const nodownload = (v.getAttribute('controlsList') || '').toLowerCase().includes('nodownload');
          if (v.currentSrc && /^https?:/i.test(v.currentSrc)) {
            media.push({ url: v.currentSrc, sourceKind: 'video-tag', explicitlyDisallowed: nodownload, explicitlyPermitted: !nodownload });
          } else if (v.src && /^https?:/i.test(v.src)) {
            media.push({ url: v.src, sourceKind: 'video-tag', explicitlyDisallowed: nodownload, explicitlyPermitted: !nodownload });
          }
          for (const s of v.querySelectorAll('source[src]')) {
            if (/^https?:/i.test(s.src)) {
              media.push({ url: s.src, contentType: s.type || undefined, sourceKind: 'source-tag', explicitlyDisallowed: nodownload, explicitlyPermitted: !nodownload });
            }
          }
        }
        for (const a of document.querySelectorAll('a[download][href]')) {
          if (/^https?:/i.test(a.href)) {
            media.push({ url: a.href, sourceKind: 'download-link', explicitlyPermitted: true });
          }
        }
        const text = (document.body && document.body.innerText ? document.body.innerText.slice(0, 4000) : '');
        const hasTurnstile = Boolean(document.querySelector('script[src*="turnstile"], iframe[src*="challenges.cloudflare.com"]'));
        return {
          finalUrl: window.location.href,
          title: document.title || '',
          media,
          hasTurnstile,
          hasEmeMentions: /widevine|fairplay|playready|encrypted/i.test(text),
        };
      })()`,
      true,
    )) as {
      finalUrl: string
      title: string
      media: BrowserSessionInspection['mediaUrls']
      hasTurnstile: boolean
      hasEmeMentions: boolean
    }

    for (const item of domMeta.media || []) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url)
        observedMedia.push(item)
      }
    }

    return {
      finalUrl: domMeta.finalUrl || targetUrl,
      title: domMeta.title || undefined,
      mediaUrls: observedMedia,
      hasAntiBotOrChallenge: Boolean(domMeta.hasTurnstile),
      hasDrmSignals: Boolean(domMeta.hasEmeMentions),
    }
  } finally {
    inspectorSession.webRequest.onBeforeRequest(null)
    inspectorSession.webRequest.onHeadersReceived(null)
    if (!win.isDestroyed()) {
      win.destroy()
    }
    await inspectorSession.clearStorageData().catch(() => {})
  }
}

async function createMainWindow(isSmokeTest = false): Promise<void> {
  mainWindow = new BrowserWindow({
    show: !isSmokeTest,
    width: 1200,
    height: 820,
    minWidth: 920,
    minHeight: 680,
    backgroundColor: '#09090b',
    title: 'Smart Video Downloader',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  // Restrict navigation & block popups in the application shell
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5179'
    if (isDevMode() && targetUrl.startsWith(devUrl)) {
      return
    }
    if (targetUrl.startsWith('file://')) {
      return
    }
    event.preventDefault()
  })

  if (isDevMode() || process.env.VITE_DEV_SERVER_URL) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5179'
    await mainWindow.loadURL(devUrl)
  } else {
    const indexHtml = path.join(__dirname, '..', '..', 'dist-renderer', 'index.html')
    await mainWindow.loadFile(indexHtml)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerIpcHandlers(): void {
  ipcMain.handle('svd:analyze-url', async (_event, rawUrl: string) => {
    if (!store) throw new Error('Storage not initialized')
    const settings = await store.getSettings()

    const result = await analyzeVideoUrl(rawUrl, {
      security: {
        timeoutMs: settings.requestTimeoutMs,
      },
      inspectWithBrowserSession: settings.enableAuthorizedBrowserInspection
        ? inspectUrlWithAuthorizedBrowser
        : undefined,
      onStatus: (status, message) => {
        mainWindow?.webContents.send('svd:analysis-status', { status, message })
      },
    })

    // Record non-downloadable / restricted / failed analysis entries in SQLite history for auditability
    if (!result.downloadable) {
      await store.addHistory({
        inputUrl: result.inputUrl,
        resolvedUrl: result.finalUrl,
        title: result.title || 'Unknown Title',
        fileName: null,
        savePath: null,
        deliveryFormat: result.deliveryFormat,
        status: result.status,
        fileSizeBytes: null,
        errorMessage: result.error || result.explanation,
      })
    }

    return result
  })

  ipcMain.handle('svd:choose-save-path', async (_event, suggestedFileName: string) => {
    if (!store || !mainWindow) return null
    const settings = await store.getSettings()
    const cleanName = sanitizeFileName(suggestedFileName || 'video.mp4')
    const defaultPath = path.join(settings.defaultDownloadDir, cleanName)

    const dialogResult = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Video File',
      defaultPath,
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    })

    if (dialogResult.canceled || !dialogResult.filePath) {
      return null
    }
    return validateSaveFilePath(dialogResult.filePath)
  })

  ipcMain.handle('svd:choose-default-dir', async () => {
    if (!store || !mainWindow) return null
    const settings = await store.getSettings()
    const dialogResult = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Default Download Folder',
      defaultPath: settings.defaultDownloadDir,
      properties: ['openDirectory', 'createDirectory'],
    })
    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
      return null
    }
    return dialogResult.filePaths[0]
  })

  ipcMain.handle('svd:start-download', async (_event, request: DownloadRequest) => {
    if (!store) throw new Error('Storage not initialized')
    const settings = await store.getSettings()

    // Re-verify before downloading to ensure no stale/unverified/restricted URL reaches downloader
    const verified = await analyzeVideoUrl(request.verifiedMp4Url, {
      security: { timeoutMs: settings.requestTimeoutMs },
    })
    if (!verified.downloadable || !verified.permittedSourceUrl) {
      const errorMsg =
        verified.explanation ||
        'Download rejected: target URL is not a verified, permitted direct MP4 source.'
      return {
        downloadId: 'rejected',
        sourceUrl: request.sourceUrl,
        verifiedMp4Url: request.verifiedMp4Url,
        savePath: request.savePath,
        title: request.title || 'Blocked Download',
        status: 'Failed' as const,
        bytesReceived: 0,
        totalBytes: null,
        percent: null,
        speedBytesPerSec: 0,
        etaSeconds: null,
        error: errorMsg,
      }
    }

    return downloadManager.startDownload(
      {
        ...request,
        verifiedMp4Url: verified.permittedSourceUrl,
      },
      (progress) => {
        mainWindow?.webContents.send('svd:download-progress', progress)
      },
      {
        store,
        maxDownloadSizeMb: settings.maxDownloadSizeMb,
      },
    )
  })

  ipcMain.handle('svd:cancel-download', async (_event, downloadId: string) => {
    return { cancelled: downloadManager.cancelDownload(downloadId) }
  })

  ipcMain.handle('svd:get-history', async () => {
    if (!store) return []
    return store.getHistory(100)
  })

  ipcMain.handle('svd:delete-history-item', async (_event, id: number) => {
    if (!store) return
    await store.deleteHistoryItem(id)
  })

  ipcMain.handle('svd:clear-history', async () => {
    if (!store) return
    await store.clearHistory()
  })

  ipcMain.handle('svd:get-settings', async () => {
    if (!store) throw new Error('Storage not initialized')
    return store.getSettings()
  })

  ipcMain.handle('svd:save-settings', async (_event, partial: Partial<AppSettings>) => {
    if (!store) throw new Error('Storage not initialized')
    return store.saveSettings(partial)
  })

  ipcMain.handle('svd:open-in-folder', async (_event, targetPath: string) => {
    try {
      if (!targetPath || !store) {
        return { ok: false, error: 'Invalid file path.' }
      }
      const history = await store.getHistory(200)
      const resolved = path.resolve(targetPath)
      const isKnownCompletedFile = history.some(
        (h) => h.status === 'Completed' && h.savePath && path.resolve(h.savePath) === resolved,
      )
      if (!isKnownCompletedFile) {
        return { ok: false, error: 'Only completed downloads in history can be opened.' }
      }
      shell.showItemInFolder(resolved)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Unable to locate file.' }
    }
  })
}

app.whenReady().then(async () => {
  const isSmokeTest = process.argv.includes('--smoke-test')
  const userDataDir = isSmokeTest
    ? path.join(os.tmpdir(), 'smart-video-downloader-smoke')
    : app.getPath('userData')
  const defaultDownloadsDir = path.join(app.getPath('downloads'), 'SmartVideoDownloader')
  store = new SqliteStore(path.join(userDataDir, 'smart-video-downloader.db'), defaultDownloadsDir)
  await store.init()

  registerIpcHandlers()
  await createMainWindow(isSmokeTest)

  if (isSmokeTest && mainWindow) {
    try {
      await new Promise((r) => setTimeout(r, 800))
      const summary = await mainWindow.webContents.executeJavaScript(
        `({
          title: document.title,
          h1: document.querySelector('h1')?.textContent || '',
          hasPreloadApi: typeof window.smartDownloader === 'object' && typeof window.smartDownloader.analyzeUrl === 'function',
          hasProcess: typeof window.process !== 'undefined',
          hasRequire: typeof window.require !== 'undefined',
          analyzeButtonText: Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Analyze'))?.textContent?.trim() || ''
        })`,
      )
      console.log('ELECTRON_SMOKE_RESULT:', JSON.stringify(summary))
      downloadManager.cancelAll()
      store.close()
      app.exit(summary.hasPreloadApi && !summary.hasProcess && !summary.hasRequire ? 0 : 1)
    } catch (err) {
      console.error('ELECTRON_SMOKE_ERROR:', err)
      app.exit(1)
    }
    return
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  downloadManager.cancelAll()
  store?.close()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
