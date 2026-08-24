export type HentaiEpisode = {
  episodeNumber: number
  title: string
  slug: string
  embedUrl: string
  thumbnail?: string
}

export type HentaiOceanItem = {
  id: string
  hentaiSlug: string
  embedUrl: string
  isHentaiOcean: boolean
  isFull: boolean
  rank: number
  title: string
  logoTitle: string
  label: string
  type: string
  genres: string[]
  year: string
  runtime: string
  rating: string
  maturity: string
  progress: number
  hero: string
  poster: string
  still: string
  synopsis: string
  cast: string[]
  director: string
  awards: string
  boxOffice: string
  ratings: Array<{ Source: string; Value: string }>
  episodeCount?: number
  hentaiEpisodes?: HentaiEpisode[]
}

export type LordRail = {
  title: string
  items: HentaiOceanItem[]
}

export type LordContent = {
  results: HentaiOceanItem[]
  rails: LordRail[]
}

const FALLBACK_HENTAI: HentaiOceanItem[] = [
  {
    id: 'hentaiocean-series-onaji-zemi-no-someya-san',
    hentaiSlug: 'onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-1',
    embedUrl: 'https://hentaiocean.com/embed/onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-1?la=1',
    isHentaiOcean: true,
    isFull: true,
    rank: 1,
    title: 'Onaji Zemi no Someya-san ga Sexy Joyuu Datta Hanashi',
    logoTitle: 'Onaji Zemi no Someya-san',
    label: 'Hentai Ocean',
    type: 'Anime',
    genres: ['Hentai', 'Uncensored', 'Romance'],
    year: '2026',
    runtime: '25 min',
    rating: '9.4',
    maturity: '18+',
    progress: 0,
    hero: 'https://hentaiocean.com/thumbnail/onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-4.webp',
    poster: 'https://hentaiocean.com/thumbnail/onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-4.webp',
    still: 'https://hentaiocean.com/thumbnail/onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-4.webp',
    synopsis: 'Onaji Zemi no Someya-san ga Sexy Joyuu Datta Hanashi full series.',
    cast: [],
    director: 'Hentai Ocean',
    awards: '',
    boxOffice: '',
    ratings: [],
    episodeCount: 4,
    hentaiEpisodes: [
      {
        episodeNumber: 1,
        title: 'Episode 1',
        slug: 'onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-1',
        embedUrl: 'https://hentaiocean.com/embed/onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-1?la=1',
        thumbnail: 'https://hentaiocean.com/thumbnail/onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-1.webp',
      },
      {
        episodeNumber: 2,
        title: 'Episode 2',
        slug: 'onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-2',
        embedUrl: 'https://hentaiocean.com/embed/onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-2?la=1',
        thumbnail: 'https://hentaiocean.com/thumbnail/onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-2.webp',
      },
      {
        episodeNumber: 3,
        title: 'Episode 3',
        slug: 'onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-3',
        embedUrl: 'https://hentaiocean.com/embed/onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-3?la=1',
        thumbnail: 'https://hentaiocean.com/thumbnail/onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-3.webp',
      },
      {
        episodeNumber: 4,
        title: 'Episode 4',
        slug: 'onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-4',
        embedUrl: 'https://hentaiocean.com/embed/onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-4?la=1',
        thumbnail: 'https://hentaiocean.com/thumbnail/onaji-zemi-no-someya-san-ga-sexy-joyuu-datta-hanashi-4.webp',
      },
    ],
  },
]

type RawRssEpisode = {
  slug: string
  rawTitle: string
  cleanTitle: string
  seriesTitle: string
  episodeNum: number
  cleanDesc: string
  year: string
  thumbUrl: string
  embedUrl: string
}

function extractSeriesInfo(rawTitle: string) {
  if (!rawTitle || typeof rawTitle !== 'string') {
    return { seriesTitle: '', episodeNum: 1 }
  }
  // Matches "Title Episode 2", "Title Ep 2", "Title 2", "Title Vol 2", "Title Part 2"
  const match = rawTitle.match(/^(.*?)(?:\s+(?:Episode|Ep\.?|Vol\.?|Part|S\d+E?)\s*|\s+)(\d+)$/i)
  if (match) {
    const seriesTitle = match[1].trim()
    const episodeNum = parseInt(match[2], 10)
    if (seriesTitle && !isNaN(episodeNum)) {
      return { seriesTitle, episodeNum }
    }
  }
  return { seriesTitle: rawTitle.trim(), episodeNum: 1 }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseRssXml(xml: string): HentaiOceanItem[] {
  const rawEpisodes: RawRssEpisode[] = []
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || []

  itemMatches.forEach((itemXml) => {
    const guidMatch = itemXml.match(/<guid[^>]*>(.*?)<\/guid>/)
    const titleMatch = itemXml.match(/<title[^>]*>(.*?)<\/title>/)
    const descMatch = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/)
    const pubDateMatch = itemXml.match(/<pubDate[^>]*>(.*?)<\/pubDate>/)
    const embedMatch = itemXml.match(/<embedUrl[^>]*>(.*?)<\/embedUrl>/)
    const thumbMatch = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/)

    const slug = guidMatch ? guidMatch[1].trim() : ''
    if (!slug) return

    const rawTitle = titleMatch ? titleMatch[1].trim() : slug
    const cleanTitle = rawTitle
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")

    const { seriesTitle, episodeNum } = extractSeriesInfo(cleanTitle)

    const rawDesc = descMatch ? descMatch[1].trim() : ''
    const cleanDesc = rawDesc
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'") || `Watch ${cleanTitle} on Hentai Ocean.`

    const pubDate = pubDateMatch ? pubDateMatch[1] : ''
    const yearMatch = pubDate ? pubDate.match(/\d{4}/) : null
    const year = yearMatch ? yearMatch[0] : '2026'

    const thumbUrl = thumbMatch ? thumbMatch[1] : `https://hentaiocean.com/thumbnail/${slug}.webp`
    const embedUrl = embedMatch
      ? `${embedMatch[1].trim()}?la=1`
      : `https://hentaiocean.com/embed/${slug}?la=1`

    rawEpisodes.push({
      slug,
      rawTitle,
      cleanTitle,
      seriesTitle,
      episodeNum,
      cleanDesc,
      year,
      thumbUrl,
      embedUrl,
    })
  })

  // Group episodes by series title
  const grouped = new Map<string, RawRssEpisode[]>()
  rawEpisodes.forEach((ep) => {
    const key = ep.seriesTitle.toLowerCase()
    const existing = grouped.get(key) || []
    existing.push(ep)
    grouped.set(key, existing)
  })

  const seriesList: HentaiOceanItem[] = []
  let index = 1

  grouped.forEach((episodes, _key) => {
    // Sort episodes in ascending order (1, 2, 3...)
    episodes.sort((a, b) => a.episodeNum - b.episodeNum)

    const first = episodes[0]
    const latest = episodes[episodes.length - 1]
    const seriesTitle = first.seriesTitle

    const hentaiEpisodes: HentaiEpisode[] = episodes.map((ep) => ({
      episodeNumber: ep.episodeNum,
      title: `Episode ${ep.episodeNum}`,
      slug: ep.slug,
      embedUrl: ep.embedUrl,
      thumbnail: ep.thumbUrl,
    }))

    const seriesSlug = slugify(seriesTitle) || first.slug

    seriesList.push({
      id: `hentaiocean-series-${seriesSlug}`,
      hentaiSlug: first.slug,
      embedUrl: first.embedUrl,
      isHentaiOcean: true,
      isFull: true,
      rank: index++,
      title: seriesTitle,
      logoTitle: seriesTitle,
      label: 'Hentai Ocean',
      type: episodes.length > 1 ? 'Series' : 'Anime',
      genres: ['Hentai', 'Animation', 'Adult'],
      year: latest.year || first.year,
      runtime: '24 min',
      rating: '9.3',
      maturity: '18+',
      progress: 0,
      hero: latest.thumbUrl || first.thumbUrl,
      poster: latest.thumbUrl || first.thumbUrl,
      still: latest.thumbUrl || first.thumbUrl,
      synopsis: latest.cleanDesc || first.cleanDesc,
      cast: [],
      director: 'Hentai Ocean',
      awards: '',
      boxOffice: '',
      ratings: [],
      episodeCount: episodes.length,
      hentaiEpisodes,
    })
  })

  return seriesList
}

export async function fetchHentaiOceanCollection(): Promise<LordContent> {
  try {
    const response = await fetch('https://hentaiocean.com/rss.xml', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`RSS feed error: ${response.status}`)
    }

    const xml = await response.text()
    const parsed = parseRssXml(xml)

    if (parsed.length === 0) {
      return buildLordContent(FALLBACK_HENTAI)
    }

    return buildLordContent(parsed)
  } catch {
    return buildLordContent(FALLBACK_HENTAI)
  }
}

function buildLordContent(items: HentaiOceanItem[]): LordContent {
  const results = items.map((item, index) => ({ ...item, rank: index + 1 }))

  const latestReleases = results.slice(0, 18)
  const trending = results.slice(18, 36)
  const popular = results.slice(36, 54)
  const fullCatalog = results.slice(54)

  const rails: LordRail[] = [
    { title: 'Latest Series', items: latestReleases },
    { title: 'Trending Hentai', items: trending.length > 0 ? trending : latestReleases },
    { title: 'Popular Series', items: popular.length > 0 ? popular : latestReleases },
    { title: 'Full Catalog', items: fullCatalog.length > 0 ? fullCatalog : results },
  ].filter((rail) => rail.items.length > 0)

  return { results, rails }
}
