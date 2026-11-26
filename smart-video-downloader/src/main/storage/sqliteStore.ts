import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import type { AppSettings, AppStatus, DeliveryFormat, HistoryItem } from '../../shared/types'

let sqlJsPromise: Promise<SqlJsStatic> | null = null

function locateSqlWasm(fileName: string): string {
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', fileName),
    path.join(__dirname, '..', '..', '..', 'node_modules', 'sql.js', 'dist', fileName),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', fileName),
  ]
  for (const candidate of candidates) {
    if (candidate && fsSync.existsSync(candidate)) {
      return candidate
    }
  }
  return fileName
}

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: locateSqlWasm,
    })
  }
  return sqlJsPromise
}

export interface CreateHistoryInput {
  inputUrl: string
  resolvedUrl?: string | null
  title: string
  fileName?: string | null
  savePath?: string | null
  deliveryFormat: DeliveryFormat
  status: AppStatus
  fileSizeBytes?: number | null
  errorMessage?: string | null
}

export function getDefaultSettings(defaultDir?: string): AppSettings {
  const downloadsDir = defaultDir || path.join(os.homedir(), 'Downloads', 'SmartVideoDownloader')
  return {
    defaultDownloadDir: downloadsDir,
    requestTimeoutMs: 15_000,
    enableAuthorizedBrowserInspection: true,
    maxDownloadSizeMb: 4096,
  }
}

export class SqliteStore {
  private db: Database | null = null
  private readonly dbPath: string
  private readonly fallbackDefaultDir?: string

  constructor(dbPath: string, fallbackDefaultDir?: string) {
    this.dbPath = path.resolve(dbPath)
    this.fallbackDefaultDir = fallbackDefaultDir
  }

  public async init(): Promise<void> {
    if (this.db) return
    const SQL = await getSqlJs()
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true })

    let fileBytes: Uint8Array | undefined
    try {
      const buf = await fs.readFile(this.dbPath)
      if (buf.length > 0) {
        fileBytes = new Uint8Array(buf)
      }
    } catch {
      // Fresh DB file
    }

    this.db = fileBytes ? new SQL.Database(fileBytes) : new SQL.Database()

    this.db.run(`
      CREATE TABLE IF NOT EXISTS downloads_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        input_url TEXT NOT NULL,
        resolved_url TEXT,
        title TEXT NOT NULL,
        file_name TEXT,
        save_path TEXT,
        delivery_format TEXT NOT NULL,
        status TEXT NOT NULL,
        file_size_bytes INTEGER,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)

    await this.flushToDisk()
  }

  private assertDb(): Database {
    if (!this.db) {
      throw new Error('SqliteStore must be initialized before use.')
    }
    return this.db
  }

  private async flushToDisk(): Promise<void> {
    const db = this.assertDb()
    const exported = Buffer.from(db.export())
    const tempPath = `${this.dbPath}.tmp`
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true })
    await fs.writeFile(tempPath, exported)
    await fs.rename(tempPath, this.dbPath)
  }

  public async addHistory(entry: CreateHistoryInput): Promise<HistoryItem> {
    const db = this.assertDb()
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO downloads_history (
        input_url, resolved_url, title, file_name, save_path,
        delivery_format, status, file_size_bytes, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.inputUrl,
        entry.resolvedUrl ?? null,
        entry.title,
        entry.fileName ?? null,
        entry.savePath ?? null,
        entry.deliveryFormat,
        entry.status,
        entry.fileSizeBytes ?? null,
        entry.errorMessage ?? null,
        now,
        now,
      ],
    )

    const idRes = db.exec('SELECT last_insert_rowid() AS id')
    const insertedId = Number(idRes[0]?.values[0]?.[0] ?? 0)
    await this.flushToDisk()

    return {
      id: insertedId,
      inputUrl: entry.inputUrl,
      resolvedUrl: entry.resolvedUrl ?? null,
      title: entry.title,
      fileName: entry.fileName ?? null,
      savePath: entry.savePath ?? null,
      deliveryFormat: entry.deliveryFormat,
      status: entry.status,
      fileSizeBytes: entry.fileSizeBytes ?? null,
      errorMessage: entry.errorMessage ?? null,
      createdAt: now,
      updatedAt: now,
    }
  }

  public async updateHistory(
    id: number,
    patch: Partial<Pick<CreateHistoryInput, 'status' | 'fileSizeBytes' | 'errorMessage' | 'savePath' | 'fileName'>>,
  ): Promise<void> {
    const db = this.assertDb()
    const now = new Date().toISOString()
    const sets: string[] = ['updated_at = ?']
    const values: Array<string | number | null> = [now]

    if (patch.status !== undefined) {
      sets.push('status = ?')
      values.push(patch.status)
    }
    if (patch.fileSizeBytes !== undefined) {
      sets.push('file_size_bytes = ?')
      values.push(patch.fileSizeBytes)
    }
    if (patch.errorMessage !== undefined) {
      sets.push('error_message = ?')
      values.push(patch.errorMessage)
    }
    if (patch.savePath !== undefined) {
      sets.push('save_path = ?')
      values.push(patch.savePath)
    }
    if (patch.fileName !== undefined) {
      sets.push('file_name = ?')
      values.push(patch.fileName)
    }

    values.push(id)
    db.run(`UPDATE downloads_history SET ${sets.join(', ')} WHERE id = ?`, values)
    await this.flushToDisk()
  }

  public async getHistory(limit = 100): Promise<HistoryItem[]> {
    const db = this.assertDb()
    const stmt = db.prepare(
      `SELECT id, input_url, resolved_url, title, file_name, save_path,
              delivery_format, status, file_size_bytes, error_message, created_at, updated_at
       FROM downloads_history
       ORDER BY id DESC
       LIMIT ?`,
    )
    stmt.bind([limit])
    const rows: HistoryItem[] = []
    while (stmt.step()) {
      const r = stmt.getAsObject() as Record<string, unknown>
      rows.push({
        id: Number(r.id),
        inputUrl: String(r.input_url),
        resolvedUrl: r.resolved_url ? String(r.resolved_url) : null,
        title: String(r.title),
        fileName: r.file_name ? String(r.file_name) : null,
        savePath: r.save_path ? String(r.save_path) : null,
        deliveryFormat: String(r.delivery_format) as DeliveryFormat,
        status: String(r.status) as AppStatus,
        fileSizeBytes: r.file_size_bytes !== null && r.file_size_bytes !== undefined ? Number(r.file_size_bytes) : null,
        errorMessage: r.error_message ? String(r.error_message) : null,
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      })
    }
    stmt.free()
    return rows
  }

  public async deleteHistoryItem(id: number): Promise<void> {
    const db = this.assertDb()
    db.run('DELETE FROM downloads_history WHERE id = ?', [id])
    await this.flushToDisk()
  }

  public async clearHistory(): Promise<void> {
    const db = this.assertDb()
    db.run('DELETE FROM downloads_history')
    await this.flushToDisk()
  }

  public async getSettings(): Promise<AppSettings> {
    const db = this.assertDb()
    const defaults = getDefaultSettings(this.fallbackDefaultDir)
    const stmt = db.prepare('SELECT key, value FROM settings')
    const map = new Map<string, string>()
    while (stmt.step()) {
      const r = stmt.getAsObject() as { key: string; value: string }
      map.set(r.key, r.value)
    }
    stmt.free()

    return {
      defaultDownloadDir: map.get('defaultDownloadDir') || defaults.defaultDownloadDir,
      requestTimeoutMs: Number(map.get('requestTimeoutMs')) || defaults.requestTimeoutMs,
      enableAuthorizedBrowserInspection:
        map.has('enableAuthorizedBrowserInspection')
          ? map.get('enableAuthorizedBrowserInspection') === 'true'
          : defaults.enableAuthorizedBrowserInspection,
      maxDownloadSizeMb: Number(map.get('maxDownloadSizeMb')) || defaults.maxDownloadSizeMb,
    }
  }

  public async saveSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const db = this.assertDb()
    const current = await this.getSettings()
    const merged: AppSettings = {
      defaultDownloadDir:
        typeof partial.defaultDownloadDir === 'string' && partial.defaultDownloadDir.trim()
          ? path.resolve(partial.defaultDownloadDir.trim())
          : current.defaultDownloadDir,
      requestTimeoutMs:
        typeof partial.requestTimeoutMs === 'number' && partial.requestTimeoutMs >= 3000
          ? Math.min(60_000, Math.round(partial.requestTimeoutMs))
          : current.requestTimeoutMs,
      enableAuthorizedBrowserInspection:
        typeof partial.enableAuthorizedBrowserInspection === 'boolean'
          ? partial.enableAuthorizedBrowserInspection
          : current.enableAuthorizedBrowserInspection,
      maxDownloadSizeMb:
        typeof partial.maxDownloadSizeMb === 'number' && partial.maxDownloadSizeMb >= 10
          ? Math.min(20_480, Math.round(partial.maxDownloadSizeMb))
          : current.maxDownloadSizeMb,
    }

    const entries: Array<[string, string]> = [
      ['defaultDownloadDir', merged.defaultDownloadDir],
      ['requestTimeoutMs', String(merged.requestTimeoutMs)],
      ['enableAuthorizedBrowserInspection', String(merged.enableAuthorizedBrowserInspection)],
      ['maxDownloadSizeMb', String(merged.maxDownloadSizeMb)],
    ]

    for (const [k, v] of entries) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [k, v])
    }

    await this.flushToDisk()
    return merged
  }

  public close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}
