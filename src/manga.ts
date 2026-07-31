// Manga reader client, backed by the free MangaDex API (https://api.mangadex.org).
//
// Content safety: every request is hard-limited to the "safe" and "suggestive"
// content ratings. Erotica / pornographic manga are never requested, so the
// reader only surfaces non-explicit titles.

const API = 'https://api.mangadex.org'
const COVERS = 'https://uploads.mangadex.org/covers'

// Only non-explicit ratings — do not add 'erotica' or 'pornographic'.
const SAFE_RATINGS = 'contentRating[]=safe&contentRating[]=suggestive'

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

type MangaEntity = {
  id: string
  attributes?: {
    title?: Record<string, string>
    altTitles?: Array<Record<string, string>>
    description?: Record<string, string>
    status?: string
    year?: number
  }
  relationships?: Array<{
    type: string
    attributes?: { fileName?: string }
  }>
}

function pickTitle(attrs: MangaEntity['attributes']): string {
  if (!attrs) return 'Untitled'
  return (
    attrs.title?.en ||
    (attrs.title ? Object.values(attrs.title)[0] : undefined) ||
    attrs.altTitles?.map((t) => t.en).find(Boolean) ||
    'Untitled'
  )
}

function pickDescription(attrs: MangaEntity['attributes']): string {
  if (!attrs?.description) return ''
  return attrs.description.en || Object.values(attrs.description)[0] || ''
}

function toSummary(entity: MangaEntity): MangaSummary {
  const cover = entity.relationships?.find((rel) => rel.type === 'cover_art')
  const fileName = cover?.attributes?.fileName
  return {
    id: entity.id,
    title: pickTitle(entity.attributes),
    coverUrl: fileName ? `${COVERS}/${entity.id}/${fileName}.256.jpg` : '',
    description: pickDescription(entity.attributes),
    status: entity.attributes?.status ?? '',
    year: entity.attributes?.year,
  }
}

async function requestMangaList(params: string): Promise<MangaSummary[]> {
  try {
    const response = await fetch(
      `${API}/manga?${params}&${SAFE_RATINGS}&includes[]=cover_art&hasAvailableChapters=true`,
    )
    if (!response.ok) return []
    const body = (await response.json()) as { data?: MangaEntity[] }
    return (body.data ?? []).map(toSummary).filter((m) => m.coverUrl)
  } catch {
    return []
  }
}

export function fetchPopularManga(): Promise<MangaSummary[]> {
  return requestMangaList('limit=30&order[followedCount]=desc')
}

export function searchManga(query: string): Promise<MangaSummary[]> {
  const trimmed = query.trim()
  if (!trimmed) return fetchPopularManga()
  return requestMangaList(`limit=30&title=${encodeURIComponent(trimmed)}`)
}

export async function fetchChapters(mangaId: string): Promise<MangaChapter[]> {
  try {
    const response = await fetch(
      `${API}/manga/${mangaId}/feed?limit=200&translatedLanguage[]=en` +
        `&order[chapter]=asc&${SAFE_RATINGS}&includes[]=scanlation_group`,
    )
    if (!response.ok) return []
    const body = (await response.json()) as {
      data?: Array<{
        id: string
        attributes?: { chapter?: string; title?: string; pages?: number }
      }>
    }
    // De-duplicate by chapter number (multiple groups may translate the same one).
    const seen = new Set<string>()
    const chapters: MangaChapter[] = []
    for (const item of body.data ?? []) {
      const chapter = item.attributes?.chapter ?? ''
      const key = chapter || item.id
      if (seen.has(key)) continue
      seen.add(key)
      chapters.push({
        id: item.id,
        chapter,
        title: item.attributes?.title ?? '',
        pages: item.attributes?.pages ?? 0,
      })
    }
    return chapters
  } catch {
    return []
  }
}

export async function fetchChapterPages(chapterId: string): Promise<string[]> {
  try {
    const response = await fetch(`${API}/at-home/server/${chapterId}`)
    if (!response.ok) return []
    const body = (await response.json()) as {
      baseUrl?: string
      chapter?: { hash?: string; data?: string[] }
    }
    const baseUrl = body.baseUrl
    const hash = body.chapter?.hash
    const data = body.chapter?.data ?? []
    if (!baseUrl || !hash) return []
    return data.map((file) => `${baseUrl}/data/${hash}/${file}`)
  } catch {
    return []
  }
}
