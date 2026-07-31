// Server-side manga source. Two backends, each doing what it's good at:
//
//   - Jikan (https://jikan.moe, the unofficial MyAnimeList API) powers the
//     catalog: top/popular list, search, and title details + covers. It's
//     reliable and has great metadata, but it does NOT host readable pages.
//
//   - MangaDex (https://api.mangadex.org) powers actual reading: chapter lists
//     and page images. We match a MyAnimeList title to its MangaDex entry via
//     the MAL id MangaDex stores on each manga (attributes.links.mal), so the
//     match is exact rather than fuzzy.
//
// Both APIs are CORS-friendly and their images allow hotlinking, so the browser
// could call them directly — but we go through this proxy for edge caching and
// to keep Jikan's per-IP rate limit off the client.

const JIKAN = 'https://api.jikan.moe/v4'
const MDEX = 'https://api.mangadex.org'
// Non-explicit content ratings only (never erotica / pornographic).
const MDEX_SAFE = 'contentRating[]=safe&contentRating[]=suggestive'

const requestTimeoutMs = 12000
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const LIST_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const DETAIL_CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const CHAPTER_CACHE_TTL = 60 * 60 * 1000 // 1 hour

// Comic types we keep from Jikan (drop prose: novels / light novels).
const READABLE_TYPES = new Set(['Manga', 'Manhwa', 'Manhua', 'One-shot', 'Doujinshi', ''])

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

async function requestJson(url: string): Promise<any> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA },
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

function clampPage(page?: string) {
  const parsed = Number.parseInt(page ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.min(parsed, 100000)
}

// ---- Jikan (catalog) -------------------------------------------------------

type JikanManga = {
  mal_id: number
  title?: string
  title_english?: string | null
  type?: string
  synopsis?: string | null
  status?: string
  images?: { jpg?: { image_url?: string; large_image_url?: string } }
}

function jikanToItem(entry: JikanManga) {
  return {
    id: String(entry.mal_id),
    image: entry.images?.jpg?.large_image_url || entry.images?.jpg?.image_url || '',
    title: (entry.title_english || entry.title || 'Untitled').trim(),
    description: (entry.synopsis ?? '').trim(),
  }
}

export async function fetchMangaList(page?: string) {
  const safePage = clampPage(page)
  const cacheKey = `list:${safePage}`
  const cached = readCache(cacheKey)
  if (cached) return cached

  const body = await requestJson(`${JIKAN}/top/manga?page=${safePage}`)
  const data: JikanManga[] = Array.isArray(body?.data) ? body.data : []
  const mangaList = data
    .filter((entry) => READABLE_TYPES.has(entry.type ?? ''))
    .map(jikanToItem)
    .filter((m) => m.id && m.image)

  const result = {
    mangaList,
    metaData: { totalPages: Number(body?.pagination?.last_visible_page) || 0 },
  }
  writeCache(cacheKey, result, LIST_CACHE_TTL)
  return result
}

export async function searchMangaList(query: string, page?: string) {
  const safePage = clampPage(page)
  const cacheKey = `search:${query.toLowerCase()}:${safePage}`
  const cached = readCache(cacheKey)
  if (cached) return cached

  const body = await requestJson(
    `${JIKAN}/manga?q=${encodeURIComponent(query.trim())}&page=${safePage}&order_by=popularity&sfw=true`,
  )
  const data: JikanManga[] = Array.isArray(body?.data) ? body.data : []
  const mangaList = data
    .filter((entry) => READABLE_TYPES.has(entry.type ?? ''))
    .map(jikanToItem)
    .filter((m) => m.id)

  const result = {
    mangaList,
    metaData: { totalPages: Number(body?.pagination?.last_visible_page) || 0 },
  }
  writeCache(cacheKey, result, LIST_CACHE_TTL)
  return result
}

// ---- MangaDex (reading) ----------------------------------------------------

type MdexEntity = {
  id: string
  attributes?: { title?: Record<string, string>; links?: { mal?: string } }
}

// Find the MangaDex manga id for a MyAnimeList title. Prefers an exact MAL-id
// match; falls back to the first title-search hit.
async function resolveMangadexId(title: string, malId: string): Promise<string | null> {
  const url =
    `${MDEX}/manga?title=${encodeURIComponent(title)}&limit=10&${MDEX_SAFE}` +
    `&availableTranslatedLanguage[]=en`
  const body = await requestJson(url)
  const data: MdexEntity[] = Array.isArray(body?.data) ? body.data : []
  if (data.length === 0) return null

  const exact = data.find((entity) => String(entity.attributes?.links?.mal ?? '') === malId)
  return (exact ?? data[0]).id
}

export async function fetchMangaDetail(malId: string) {
  const cacheKey = `detail:${malId}`
  const cached = readCache(cacheKey)
  if (cached) return cached

  // Jikan detail gives us the reliable title + cover to work from.
  const jikanBody = await requestJson(`${JIKAN}/manga/${encodeURIComponent(malId.trim())}`)
  const info: JikanManga = jikanBody?.data ?? {}
  const title = (info.title || info.title_english || '').trim()

  let chapterList: Array<{ id: string; name: string; path: string; view: string; createdAt: string }> = []

  if (title) {
    try {
      const mdexId = await resolveMangadexId(title, String(info.mal_id ?? malId))
      if (mdexId) {
        chapterList = await fetchMangadexChapters(mdexId)
      }
    } catch {
      chapterList = []
    }
  }

  const result = {
    imageUrl: info.images?.jpg?.large_image_url || info.images?.jpg?.image_url || '',
    name: title || 'Untitled',
    status: info.status ?? '',
    chapterList,
  }
  writeCache(cacheKey, result, DETAIL_CACHE_TTL)
  return result
}

type MdexChapter = {
  id: string
  attributes?: { chapter?: string; title?: string; translatedLanguage?: string; pages?: number }
}

async function fetchMangadexChapters(mdexId: string) {
  const url =
    `${MDEX}/manga/${mdexId}/feed?limit=500&translatedLanguage[]=en` +
    `&order[chapter]=desc&${MDEX_SAFE}&includeExternalUrl=0`
  const body = await requestJson(url)
  const data: MdexChapter[] = Array.isArray(body?.data) ? body.data : []

  const seen = new Set<string>()
  const chapters: Array<{ id: string; name: string; path: string; view: string; createdAt: string }> = []
  for (const item of data) {
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
  // Already newest-first (order desc); the client reverses to read oldest-first.
  return chapters
}

export async function fetchMangaChapter(_malId: string, chapterId: string) {
  const cacheKey = `chapter:${chapterId}`
  const cached = readCache(cacheKey)
  if (cached) return cached

  const body = await requestJson(`${MDEX}/at-home/server/${encodeURIComponent(chapterId.trim())}`)
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
