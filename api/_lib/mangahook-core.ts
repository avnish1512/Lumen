// Server-side manga source — powered entirely by MangaDex (https://api.mangadex.org).
//
// Using one source for both browsing and reading means the catalog only ever
// shows titles you can actually open: we ask MangaDex for manga that have
// available English chapters, so browse/search/detail/pages all line up. (The
// old design browsed MyAnimeList and then tried to match each title back to a
// MangaDex entry, which broke for licensed titles like One Piece.)
//
// Auth is optional but recommended: an OAuth bearer token (see the MANGADEX_*
// env vars) lifts the per-IP rate limits and steadies access to the chapter
// feed and at-home image servers. MangaDex covers and page images both allow
// hotlinking, so the browser loads those URLs directly.

const MDEX = 'https://api.mangadex.org'
const MDEX_COVERS = 'https://uploads.mangadex.org/covers'
const MDEX_AUTH =
  'https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token'
// Non-explicit content ratings only (never erotica / pornographic).
const MDEX_SAFE = 'contentRating[]=safe&contentRating[]=suggestive'
const PAGE_SIZE = 30

const requestTimeoutMs = 12000
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const LIST_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const DETAIL_CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const CHAPTER_CACHE_TTL = 60 * 60 * 1000 // 1 hour

type CachedEntry = { body: unknown; expiresAt: number }
const cache = new Map<string, CachedEntry>()

function readCache(key: string) {
  const entry = cache.get(key)
  if (entry && entry.expiresAt > Date.now()) return entry.body
  if (entry) cache.delete(key)
  return null
}

function writeCache(key: string, body: unknown, ttl: number) {
  cache.set(key, { body, expiresAt: Date.now() + ttl })
}

async function requestJson(url: string, extraHeaders?: Record<string, string>): Promise<any> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA, ...extraHeaders },
      signal: controller.signal,
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`${new URL(url).hostname} returned ${response.status}.`)
    }
    try {
      return JSON.parse(text)
    } catch {
      throw new Error(`${new URL(url).hostname} returned a non-JSON response.`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

// ---- MangaDex OAuth --------------------------------------------------------
// Authenticated requests get much higher rate limits and steadier access to the
// chapter feed / at-home image servers. Auth is optional: when credentials are
// missing we fall back to anonymous calls (which still work, just rate-limited).

type MdexCreds = {
  username: string
  password: string
  clientId: string
  clientSecret: string
}

let credsOverride: MdexCreds | null = null

// In Vercel prod, credentials live in process.env. In Vite dev, env is loaded
// from .env.local and passed in via this seeder so it reaches the module.
export function configureMangadexAuth(env: Record<string, string | undefined>) {
  const creds = readCredsFrom(env)
  if (creds) credsOverride = creds
}

function readCredsFrom(env: Record<string, string | undefined>): MdexCreds | null {
  const username = env.MANGADEX_USERNAME
  const password = env.MANGADEX_PASSWORD
  const clientId = env.MANGADEX_CLIENT_ID
  const clientSecret = env.MANGADEX_CLIENT_SECRET
  if (username && password && clientId && clientSecret) {
    return { username, password, clientId, clientSecret }
  }
  return null
}

function readCreds(): MdexCreds | null {
  return credsOverride ?? readCredsFrom(process.env as Record<string, string | undefined>)
}

let tokenCache: { accessToken: string; refreshToken: string; expiresAt: number } | null = null
let tokenInFlight: Promise<string | null> | null = null

async function postTokenForm(body: URLSearchParams): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
  try {
    const response = await fetch(MDEX_AUTH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    })
    if (!response.ok) return null
    const data = (await response.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
    }
    if (!data.access_token) return null
    tokenCache = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokenCache?.refreshToken ?? '',
      // Refresh a minute before the real expiry (default 15 min).
      expiresAt: Date.now() + (Number(data.expires_in) || 900) * 1000 - 60_000,
    }
    return data.access_token
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function getMangadexToken(): Promise<string | null> {
  const creds = readCreds()
  if (!creds) return null

  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken
  }
  if (tokenInFlight) return tokenInFlight

  tokenInFlight = (async () => {
    // Try a refresh first (cheaper, avoids re-sending the password).
    if (tokenCache?.refreshToken) {
      const refreshed = await postTokenForm(
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokenCache.refreshToken,
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
        }),
      )
      if (refreshed) return refreshed
    }
    // Fall back to the password grant.
    return postTokenForm(
      new URLSearchParams({
        grant_type: 'password',
        username: creds.username,
        password: creds.password,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    )
  })()

  try {
    return await tokenInFlight
  } finally {
    tokenInFlight = null
  }
}

// A MangaDex request that attaches the bearer token when auth is configured.
async function mdexRequest(url: string): Promise<any> {
  const token = await getMangadexToken().catch(() => null)
  return requestJson(url, token ? { Authorization: `Bearer ${token}` } : undefined)
}

function clampPage(page?: string) {
  const parsed = Number.parseInt(page ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.min(parsed, 100000)
}

// ---- MangaDex catalog ------------------------------------------------------

type MdexManga = {
  id: string
  attributes?: {
    title?: Record<string, string>
    description?: Record<string, string>
    year?: number | null
    status?: string
  }
  relationships?: Array<{ type: string; attributes?: { fileName?: string } }>
}

function pickLocalized(map?: Record<string, string>): string {
  if (!map) return ''
  return (map.en || map['ja-ro'] || Object.values(map)[0] || '').trim()
}

function coverUrl(entity: MdexManga): string {
  const cover = entity.relationships?.find((rel) => rel.type === 'cover_art')
  const file = cover?.attributes?.fileName
  // 512px thumbnail keeps the browse grid light.
  return file ? `${MDEX_COVERS}/${entity.id}/${file}.512.jpg` : ''
}

function mangaToItem(entity: MdexManga) {
  return {
    id: entity.id,
    image: coverUrl(entity),
    title: pickLocalized(entity.attributes?.title) || 'Untitled',
    description: pickLocalized(entity.attributes?.description),
  }
}

// MangaDex caps offset + limit at 10000, so the browsable page count is bounded.
const MAX_TOTAL = 10000
function offsetFor(page: number) {
  return Math.min((page - 1) * PAGE_SIZE, MAX_TOTAL - PAGE_SIZE)
}
function totalPagesFor(total: number) {
  return Math.min(Math.ceil(total / PAGE_SIZE), Math.floor(MAX_TOTAL / PAGE_SIZE))
}

export async function fetchMangaList(page?: string) {
  const safePage = clampPage(page)
  const cacheKey = `list:${safePage}`
  const cached = readCache(cacheKey)
  if (cached) return cached

  const url =
    `${MDEX}/manga?limit=${PAGE_SIZE}&offset=${offsetFor(safePage)}` +
    `&order[followedCount]=desc&${MDEX_SAFE}` +
    `&availableTranslatedLanguage[]=en&hasAvailableChapters=true&includes[]=cover_art`
  const body = await mdexRequest(url)
  const data: MdexManga[] = Array.isArray(body?.data) ? body.data : []
  const mangaList = data.map(mangaToItem).filter((m) => m.id && m.image)

  const result = {
    mangaList,
    metaData: { totalPages: totalPagesFor(Number(body?.total) || 0) },
  }
  writeCache(cacheKey, result, LIST_CACHE_TTL)
  return result
}

export async function searchMangaList(query: string, page?: string) {
  const safePage = clampPage(page)
  const cacheKey = `search:${query.toLowerCase()}:${safePage}`
  const cached = readCache(cacheKey)
  if (cached) return cached

  const url =
    `${MDEX}/manga?title=${encodeURIComponent(query.trim())}` +
    `&limit=${PAGE_SIZE}&offset=${offsetFor(safePage)}&${MDEX_SAFE}` +
    `&availableTranslatedLanguage[]=en&hasAvailableChapters=true&includes[]=cover_art`
  const body = await mdexRequest(url)
  const data: MdexManga[] = Array.isArray(body?.data) ? body.data : []
  const mangaList = data.map(mangaToItem).filter((m) => m.id)

  const result = {
    mangaList,
    metaData: { totalPages: totalPagesFor(Number(body?.total) || 0) },
  }
  writeCache(cacheKey, result, LIST_CACHE_TTL)
  return result
}

// ---- MangaDex detail + reading ---------------------------------------------

function normalizeTitle(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Count readable (non-external) English chapters for an entry — cheap: limit=1,
// reads the reported total. Used only to rank fallback siblings.
async function countHostedChapters(mangaId: string): Promise<number> {
  try {
    const body = await mdexRequest(
      `${MDEX}/manga/${mangaId}/feed?limit=1&translatedLanguage[]=en&${MDEX_SAFE}&includeExternalUrl=0`,
    )
    return Number(body?.total) || 0
  } catch {
    return 0
  }
}

// Some hugely popular titles (One Piece, Naruto, ...) are licensed, so their
// canonical MangaDex entry only carries external "read on the official site"
// links — nothing we can display inline. A sibling entry (e.g. "One Piece
// (Official Colored)") usually holds the full readable run. When the tapped
// entry has no hosted chapters, pick the best title-related sibling that does.
//
// "Related" = the shorter title is a prefix of the longer one, so "One Piece
// (Official Colored)" matches "One Piece" but "Berserk of Gluttony" does NOT
// match "Berserk".
async function resolveSiblingChapters(title: string, excludeId: string) {
  const url =
    `${MDEX}/manga?title=${encodeURIComponent(title)}&limit=15&${MDEX_SAFE}` +
    `&availableTranslatedLanguage[]=en&hasAvailableChapters=true`
  const body = await mdexRequest(url)
  const data: MdexManga[] = Array.isArray(body?.data) ? body.data : []

  const base = normalizeTitle(title)
  const related = data.filter((entity) => {
    if (entity.id === excludeId) return false
    const n = normalizeTitle(pickLocalized(entity.attributes?.title))
    if (n.length < 3) return false
    const [shorter, longer] = base.length <= n.length ? [base, n] : [n, base]
    return longer.startsWith(shorter)
  })

  let best: { id: string; count: number } | null = null
  for (const entity of related.slice(0, 8)) {
    const count = await countHostedChapters(entity.id)
    if (count > 0 && (!best || count > best.count)) {
      best = { id: entity.id, count }
    }
  }

  return best ? fetchMangadexChapters(best.id) : []
}

export async function fetchMangaDetail(mangaId: string) {
  const id = mangaId.trim()
  const cacheKey = `detail:${id}`
  const cached = readCache(cacheKey)
  if (cached) return cached

  const body = await mdexRequest(`${MDEX}/manga/${encodeURIComponent(id)}?includes[]=cover_art`)
  const entity: MdexManga = body?.data ?? { id }
  const title = pickLocalized(entity.attributes?.title)

  let chapterList: Array<{ id: string; name: string; path: string; view: string; createdAt: string }> = []
  try {
    chapterList = await fetchMangadexChapters(id)
    if (chapterList.length === 0 && title) {
      chapterList = await resolveSiblingChapters(title, id)
    }
  } catch {
    chapterList = []
  }

  const result = {
    imageUrl: coverUrl(entity),
    name: title || 'Untitled',
    status: entity.attributes?.status ?? '',
    chapterList,
  }
  writeCache(cacheKey, result, DETAIL_CACHE_TTL)
  return result
}

type MdexChapter = {
  id: string
  attributes?: { chapter?: string; title?: string; translatedLanguage?: string; pages?: number }
}

// Pull the full English chapter feed (paginating past MangaDex's 500-item cap),
// then de-duplicate by chapter number. Returned newest-first; the client
// reverses it so reading starts at chapter 1.
async function fetchMangadexChapters(mangaId: string) {
  const limit = 500
  const maxChapters = 2000
  const all: MdexChapter[] = []

  for (let offset = 0; offset < maxChapters; offset += limit) {
    const url =
      `${MDEX}/manga/${mangaId}/feed?limit=${limit}&offset=${offset}` +
      `&translatedLanguage[]=en&order[chapter]=desc&${MDEX_SAFE}&includeExternalUrl=0`
    const body = await mdexRequest(url)
    const data: MdexChapter[] = Array.isArray(body?.data) ? body.data : []
    all.push(...data)
    const total = Number(body?.total) || 0
    if (data.length === 0 || offset + limit >= total) break
  }

  const seen = new Set<string>()
  const chapters: Array<{ id: string; name: string; path: string; view: string; createdAt: string }> = []
  for (const item of all) {
    const attrs = item.attributes
    if (!attrs?.pages || attrs.pages < 1) continue
    const chapter = attrs.chapter ?? ''
    const key = chapter || item.id
    if (seen.has(key)) continue
    seen.add(key)
    const label = chapter ? `Chapter ${chapter}` : 'Oneshot'
    chapters.push({
      id: item.id,
      name: attrs.title ? `${label} · ${attrs.title}` : label,
      path: '',
      view: '',
      createdAt: '',
    })
  }
  return chapters
}

export async function fetchMangaChapter(_mangaId: string, chapterId: string) {
  const cacheKey = `chapter:${chapterId}`
  const cached = readCache(cacheKey)
  if (cached) return cached

  const body = await mdexRequest(`${MDEX}/at-home/server/${encodeURIComponent(chapterId.trim())}`)
  const baseUrl = body?.baseUrl
  const hash = body?.chapter?.hash
  const files: string[] = Array.isArray(body?.chapter?.data) ? body.chapter.data : []

  const images =
    baseUrl && hash
      ? files.map((file) => ({ title: '', image: `${baseUrl}/data/${hash}/${file}` }))
      : []

  const result = { images }
  writeCache(cacheKey, result, CHAPTER_CACHE_TTL)
  return result
}
