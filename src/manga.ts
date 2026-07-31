// Manga browsing + reading client. Goes through our `/api/mangahook` proxy,
// which serves a Jikan (MyAnimeList) catalog for browse/search/detail and
// MangaDex for chapters + page images. Cover art (MyAnimeList CDN) and page
// images (MangaDex) both allow hotlinking, so they're used as direct URLs.

const PROXY = '/api/mangahook'

export type MangaSummary = {
  id: string
  title: string
  coverUrl: string
  description: string
  status: string
  year?: number
}

export type MangaChapter = {
  id: string
  chapter: string
  title: string
  pages: number
}

type ListItem = {
  id?: string
  image?: string
  title?: string
  description?: string
}

type ListResponse = {
  mangaList?: ListItem[]
  metaData?: {
    totalPages?: number | string
  }
}

export type MangaListPage = {
  items: MangaSummary[]
  page: number
  totalPages: number
  hasMore: boolean
}

type ChapterListItem = {
  id?: string
  path?: string
  name?: string
  view?: string
  createdAt?: string
}

type DetailResponse = {
  imageUrl?: string
  name?: string
  status?: string
  chapterList?: ChapterListItem[]
}

type ChapterPagesResponse = {
  title?: string
  currentChapter?: string
  images?: Array<{ title?: string; image?: string }>
}

async function requestJson<T>(params: URLSearchParams): Promise<T | null> {
  try {
    const response = await fetch(`${PROXY}?${params}`)
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

function listToSummary(item: ListItem): MangaSummary {
  return {
    id: item.id ?? '',
    title: item.title?.trim() || 'Untitled',
    coverUrl: item.image ?? '',
    description: item.description?.trim() ?? '',
    status: '',
    year: undefined,
  }
}

function chapterToModel(item: ChapterListItem): MangaChapter {
  const name = (item.name ?? '').trim()
  // Names look like "Chapter 139" or "Vol.2 Chapter 5"; pull out the number.
  const num =
    name.match(/chapter\s*([\d.]+)/i)?.[1] ??
    name.match(/([\d.]+)\s*$/)?.[1] ??
    ''
  return {
    id: item.id ?? '',
    chapter: num,
    // Avoid duplicating "Chapter X" (the reader renders the number itself).
    title: num ? '' : name,
    pages: 0,
  }
}

function toListPage(
  body: ListResponse | null,
  page: number,
  requireCover: boolean,
): MangaListPage {
  const rawCount = body?.mangaList?.length ?? 0
  const items = (body?.mangaList ?? [])
    .map(listToSummary)
    .filter((m) => (requireCover ? m.id && m.coverUrl : Boolean(m.id)))
  const totalPages = Number(body?.metaData?.totalPages) || 0
  // Prefer the API's page count; otherwise assume there's more as long as the
  // page came back with entries.
  const hasMore = totalPages > 0 ? page < totalPages : rawCount > 0
  return { items, page, totalPages, hasMore }
}

export async function fetchPopularManga(page = 1): Promise<MangaListPage> {
  const body = await requestJson<ListResponse>(
    new URLSearchParams({ action: 'list', page: String(page) }),
  )
  return toListPage(body, page, true)
}

export async function searchManga(query: string, page = 1): Promise<MangaListPage> {
  const trimmed = query.trim()
  if (!trimmed) return fetchPopularManga(page)
  const body = await requestJson<ListResponse>(
    new URLSearchParams({ action: 'search', query: trimmed, page: String(page) }),
  )
  return toListPage(body, page, false)
}

export async function fetchChapters(mangaId: string): Promise<MangaChapter[]> {
  const body = await requestJson<DetailResponse>(
    new URLSearchParams({ action: 'detail', id: mangaId }),
  )
  const chapters = (body?.chapterList ?? []).map(chapterToModel).filter((c) => c.id)
  // mangakakalot lists chapters newest-first; reverse so index 0 is chapter 1
  // and "Start reading" opens from the beginning.
  chapters.reverse()
  return chapters
}

export async function fetchChapterPages(
  mangaId: string,
  chapterId: string,
): Promise<string[]> {
  const body = await requestJson<ChapterPagesResponse>(
    new URLSearchParams({ action: 'chapter', id: mangaId, ch: chapterId }),
  )
  return (body?.images ?? [])
    .map((page) => page.image ?? '')
    .filter(Boolean)
}
