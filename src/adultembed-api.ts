import { normalizeMovie, type Movie } from './omdb'

export type AdultEmbedCategoryItem = {
  id?: number
  name: string
  slug: string
  video_count?: number
}

export type AdultEmbedPerformer = {
  id?: number
  name: string
  slug: string
}

export type AdultEmbedStudio = {
  id?: number
  name: string
  slug: string
}

export type AdultEmbedVideo = {
  id: number
  title: string
  description?: string
  duration?: string | null
  duration_seconds?: number
  orientation?: 'straight' | 'gay' | 'trans' | 'bi' | string
  content_type?: 'scene' | 'amateur' | string
  resolution?: string | null
  published_at?: string
  thumbnail: string
  poster?: string | null
  tags?: string[]
  categories?: AdultEmbedCategoryItem[]
  performers?: AdultEmbedPerformer[]
  studio?: AdultEmbedStudio | null
  stats?: {
    views?: number
    likes?: number
    dislikes?: number
  }
  embed?: {
    url?: string
    iframe?: string
    responsive_iframe?: string
  }
}

export type AdultEmbedCatalogResult = {
  results: AdultEmbedVideo[]
  total: number
  pages: number
  page: number
}

export type AdultEmbedCategoryPill = {
  name: string
  slug: string
}

export const DEFAULT_ADULTEMBED_CATEGORIES: AdultEmbedCategoryPill[] = [
  { name: 'All', slug: '' },
  { name: 'Big Tits', slug: 'big-tits' },
  { name: 'Blowjob', slug: 'blowjob' },
  { name: 'Brunette', slug: 'brunette' },
  { name: 'Big Ass', slug: 'big-ass' },
  { name: 'Anal', slug: 'anal' },
  { name: 'Amateur', slug: 'amateur' },
  { name: 'Cumshot', slug: 'cumshot' },
  { name: 'Small Tits', slug: 'small-tits' },
  { name: 'Asian', slug: 'asian' },
  { name: 'Tattooed', slug: 'tattooed' },
  { name: 'BDSM', slug: 'bdsm' },
  { name: 'Natural Tits', slug: 'natural-tits' },
  { name: 'Big Dick', slug: 'big-dick' },
]

export const INITIAL_ADULTEMBED_VIDEOS: AdultEmbedVideo[] = [
  {
    id: 7185437,
    title: 'LoveHerFeet - Nervous Guy Needs Confident Gal',
    description: 'LoveHerFeet - Iris Leon Nervous Guy Needs Confident Gal',
    duration: '47:19',
    duration_seconds: 2839,
    orientation: 'straight',
    content_type: 'scene',
    published_at: '2026-11-06T19:18:36.454316+00:00',
    thumbnail: 'https://adultembed.com/media/thumbnails/webp/pz-7185437.webp',
    poster: 'https://cdn.theporndb.net/scene/36/16/50/412a5bbb960f44e2b54e7920cc72e9e/background/bg-love-her-feet-nervous-guy-needs-confident-gal.jpg',
    tags: ['Arches', 'Babes', 'Blowjob', 'Brown Hair', 'Cowgirl', 'Cum On Body'],
    categories: [
      { name: 'Blowjob', slug: 'blowjob' },
      { name: 'Brunette', slug: 'brunette' },
      { name: 'Small Tits', slug: 'small-tits' },
      { name: 'Tattooed', slug: 'tattooed' },
    ],
    performers: [
      { name: 'Iris Leon', slug: 'iris-leon' },
      { name: 'Jodie Johnson', slug: 'jodie-johnson' },
    ],
    studio: { name: 'Love Her Feet', slug: 'love-her-feet' },
    stats: { views: 560, likes: 0, dislikes: 0 },
    embed: { url: 'https://pornalizer.app/player/embed/7185437/' },
  },
  {
    id: 7199045,
    title: 'Stare Harder! I WANT A Public Gym Fuck!',
    description: 'Sandra Mehio and Francis X engage in a public gym workout session.',
    duration: '30:55',
    duration_seconds: 1855,
    orientation: 'straight',
    content_type: 'scene',
    published_at: '2026-11-16T02:37:49.685182+00:00',
    thumbnail: 'https://adultembed.com/media/thumbnails/webp/pz-7199045.webp',
    poster: null,
    tags: ['69', 'All Sex', 'Ass Worship', 'Big Ass', 'Big Dick', 'Big Tits'],
    categories: [
      { name: 'Big Ass', slug: 'big-ass' },
      { name: 'Big Dick', slug: 'big-dick' },
      { name: 'Big Tits', slug: 'big-tits' },
      { name: 'Blowjob', slug: 'blowjob' },
    ],
    performers: [
      { name: 'Francis X', slug: 'francis-x' },
      { name: 'Sandra Mehio', slug: 'sandra-mehio' },
    ],
    studio: { name: 'Brazzers Exxtra', slug: 'brazzers-exxtra' },
    stats: { views: 499, likes: 0, dislikes: 0 },
    embed: { url: 'https://pornalizer.app/player/embed/7199045/' },
  },
  {
    id: 7183756,
    title: '[Blockbuster] Kali Roses (Crash And Burn! - Episode 1)',
    description: '[Blockbuster] Kali Roses (Crash And Burn! - Episode 1 / 2026-11-05)',
    duration: '28:24',
    duration_seconds: 1704,
    orientation: 'straight',
    content_type: 'scene',
    published_at: '2026-11-05T21:18:41+00:00',
    thumbnail: 'https://adultembed.com/media/thumbnails/webp/pz-7183756.webp',
    poster: 'https://cdn.theporndb.net/scene/cf/78/f3/73234a27be79aaa7b8f564d36b760fd/background/bg-blockbuster-crash-and-burn-episode-1.jpg',
    tags: ['All Sex', 'Ass Worship', 'Ballerina', 'Big Dick', 'Big Tits', 'Blonde Hair'],
    categories: [
      { name: '4k available', slug: '4k-available' },
      { name: 'American', slug: 'american' },
      { name: 'Ass Worship', slug: 'ass-worship' },
    ],
    performers: [
      { name: 'Kali Roses', slug: 'kali-roses' },
      { name: 'Victor Ray', slug: 'victor-ray' },
    ],
    studio: { name: 'Blockbuster', slug: 'blockbuster' },
    stats: { views: 154, likes: 0, dislikes: 0 },
    embed: { url: 'https://pornalizer.app/player/embed/7183756/' },
  },
  {
    id: 7197519,
    title: 'Blaze and Darling',
    description: 'Dee Williams and Blaze 4559 star in a 27-minute release.',
    duration: '26:46',
    duration_seconds: 1606,
    orientation: 'straight',
    content_type: 'scene',
    published_at: '2026-11-14T00:00:00+00:00',
    thumbnail: 'https://adultembed.com/media/thumbnails/webp/pz-7197519.webp',
    poster: 'https://cdn.theporndb.net/scene/29/0a/c5/dce9bd9b23fc9393fd45d4fa9a80739/background/bg-water-bondage-blaze-and-darling.jpg',
    tags: ['BDSM', 'Big Tits', 'Blonde Hair', 'Bondage', 'Brown Hair', 'Domination'],
    categories: [
      { name: 'hd', slug: 'hd' },
      { name: 'long', slug: 'long' },
    ],
    performers: [
      { name: 'Blaze 4559', slug: 'blaze-4559' },
      { name: 'Dee Williams', slug: 'dee-williams' },
    ],
    studio: { name: 'Water Bondage', slug: 'water-bondage' },
    stats: { views: 94, likes: 0, dislikes: 0 },
    embed: { url: 'https://pornalizer.app/player/embed/7197519/' },
  },
  {
    id: 7199330,
    title: 'Blacked Vixi Rafi - Dripping Wet Cutie Needs BBC',
    description: 'Vixi works her way into the bed of a power player in Ibiza.',
    duration: '46:08',
    duration_seconds: 2768,
    orientation: 'straight',
    content_type: 'scene',
    published_at: '2026-11-16T06:26:09.738335+00:00',
    thumbnail: 'https://adultembed.com/media/thumbnails/webp/pz-7199330.webp',
    poster: 'https://cdn.theporndb.net/scene/c8/ca/bc/a38fb5c64c31165a11468f003a532c9/background/aFIhzDgVAlPCsePKbNLCcOMv4Sf7AAalqox8FxON.jpg',
    tags: ['Black Man', 'Blowjob', 'Brown Hair', 'Cum In Mouth', 'Deepthroat', 'Doggystyle'],
    categories: [
      { name: 'Blowjob', slug: 'blowjob' },
      { name: 'Brunette', slug: 'brunette' },
      { name: 'Small Tits', slug: 'small-tits' },
    ],
    performers: [
      { name: 'Jason Luv', slug: 'jason-luv' },
      { name: 'Vixi Rafi', slug: 'vixi-rafi' },
    ],
    studio: { name: 'Blacked', slug: 'blacked' },
    stats: { views: 92, likes: 0, dislikes: 0 },
    embed: { url: 'https://pornalizer.app/player/embed/7199330/' },
  },
  {
    id: 7202462,
    title: 'Rough Treatment',
    description: 'Dolly Darkley takes center stage in a 25-minute Czech production.',
    duration: '24:49',
    duration_seconds: 1489,
    orientation: 'straight',
    content_type: 'scene',
    published_at: '2026-11-16T00:00:00+00:00',
    thumbnail: 'https://adultembed.com/media/thumbnails/webp/pz-7202462.webp',
    poster: 'https://cdn.theporndb.net/scene/72/71/05/eb3b5cb0067a270aee249d8de805218/background/bg-subspaceland-rough-treatment.jpg',
    tags: ['Anal', 'BDSM', 'Blowjob', 'Brown Hair', 'Deepthroat', 'Kissing'],
    categories: [{ name: 'Anal', slug: 'anal' }],
    performers: [{ name: 'Dolly Darkley', slug: 'dolly-darkley' }],
    studio: { name: 'Subspaceland', slug: 'subspaceland' },
    stats: { views: 69, likes: 0, dislikes: 0 },
    embed: { url: 'https://pornalizer.app/player/embed/7202462/' },
  },
  {
    id: 7195318,
    title: 'BrazzersExxtra - Messy Massage, Amazing Anal',
    description: 'BrazzersExxtra - Anissa Kate And Koda Monroe Messy Massage Amazing Anal',
    duration: '36:34',
    duration_seconds: 2194,
    orientation: 'straight',
    content_type: 'scene',
    published_at: '2026-11-13T20:23:04.236286+00:00',
    thumbnail: 'https://adultembed.com/media/thumbnails/webp/pz-7195318.webp',
    poster: 'https://cdn.theporndb.net/scene/57/bd/02/a409559ae2b7be339d1f9fda916f71b/background/bg-brazzers-exxtra-messy-massage-amazing-anal.jpg',
    tags: ['4k Available', 'All Sex', 'Anal', 'Anal Creampie', 'Anal Toys', 'Ass To Mouth'],
    categories: [
      { name: 'Anal', slug: 'anal' },
      { name: 'Big Ass', slug: 'big-ass' },
      { name: 'Big Dick', slug: 'big-dick' },
      { name: 'Big Tits', slug: 'big-tits' },
    ],
    performers: [
      { name: 'Anissa Kate', slug: 'anissa-kate' },
      { name: 'Jimmy Bud', slug: 'jimmy-bud' },
      { name: 'Koda Monroe', slug: 'koda-monroe' },
    ],
    studio: { name: 'Brazzers Exxtra', slug: 'brazzers-exxtra' },
    stats: { views: 64, likes: 0, dislikes: 0 },
    embed: { url: 'https://pornalizer.app/player/embed/7195318/' },
  },
  {
    id: 7185427,
    title: 'RKPrime - You Have The Right To Remain Naked',
    description: 'RKPrime - Beca Barbie You Have The Right To Remain Naked',
    duration: '35:04',
    duration_seconds: 2104,
    orientation: 'straight',
    content_type: 'scene',
    published_at: '2026-11-06T19:18:36.454316+00:00',
    thumbnail: 'https://adultembed.com/media/thumbnails/webp/pz-7185427.webp',
    poster: 'https://cdn.theporndb.net/scene/d5/c5/f0/fe18e223242487490017ce5df29c2cf/background/bg-rk-prime-you-have-the-right-to-remain-naked.jpg',
    tags: ['All Sex', 'Amateur', 'Ass Worship', 'Ballerina', 'Big Dick', 'Black'],
    categories: [
      { name: 'Amateur', slug: 'amateur' },
      { name: 'Big Ass', slug: 'big-ass' },
      { name: 'Big Dick', slug: 'big-dick' },
      { name: 'Blowjob', slug: 'blowjob' },
    ],
    performers: [
      { name: 'Beca Barbie', slug: 'beca-barbie' },
      { name: 'Mazee The Goat', slug: 'mazee-the-goat' },
    ],
    studio: { name: 'RK Prime', slug: 'rk-prime' },
    stats: { views: 61, likes: 0, dislikes: 0 },
    embed: { url: 'https://pornalizer.app/player/embed/7185427/' },
  },
  {
    id: 7199518,
    title: 'Lia Lin - After The Last Shot',
    description: 'Lia Lin and Francis X share 36 minutes of action in this studio encounter.',
    duration: '35:36',
    duration_seconds: 2136,
    orientation: 'straight',
    content_type: 'scene',
    published_at: '2026-11-16T08:23:07.788214+00:00',
    thumbnail: 'https://adultembed.com/media/thumbnails/webp/pz-7199518.webp',
    poster: 'https://cdn.theporndb.net/scene/3c/ee/e9/8463c22ae33c818c631e6bb82d2b818/background/bg-enjoyx-after-the-last-shot.jpg',
    tags: ['Asian', 'Big Tits', 'Blowjob', 'Brown Hair', 'Cowgirl', 'Doggystyle'],
    categories: [
      { name: 'Asian', slug: 'asian' },
      { name: 'Big Tits', slug: 'big-tits' },
      { name: 'Blowjob', slug: 'blowjob' },
      { name: 'Brunette', slug: 'brunette' },
    ],
    performers: [
      { name: 'Francis X', slug: 'francis-x' },
      { name: 'Lia Lin', slug: 'lia-lin' },
    ],
    studio: { name: 'EnjoyX', slug: 'enjoyx' },
    stats: { views: 59, likes: 0, dislikes: 0 },
    embed: { url: 'https://pornalizer.app/player/embed/7199518/' },
  },
  {
    id: 7164066,
    title: 'Vrb World Cup 2026',
    description: 'World Cup 2026 – Leana Lovings, Nicole Luva, Cheerleader Kait, Ava Amira & Nicole Doshi',
    duration: '1:09:01',
    duration_seconds: 4141,
    orientation: 'straight',
    content_type: 'scene',
    published_at: '2026-10-29T00:16:46.352120+00:00',
    thumbnail: 'https://adultembed.com/media/thumbnails/webp/pz-7164066.webp',
    poster: 'https://cdn.theporndb.net/scene/38/97/45/8bdccae35d6e3cb95334027532c3b82/background/bg-vr-bangers-vrb-world-cup-2026.jpg',
    tags: ['180°', '8K Available', 'American', 'Asian', 'Babes', 'Big Ass'],
    categories: [
      { name: 'Asian', slug: 'asian' },
      { name: 'Big Ass', slug: 'big-ass' },
      { name: 'Big Tits', slug: 'big-tits' },
      { name: 'Blowjob', slug: 'blowjob' },
    ],
    performers: [
      { name: 'Ava Amira', slug: 'ava-amira' },
      { name: 'Cheerleader Kait', slug: 'cheerleader-kait' },
      { name: 'Cyber Doll', slug: 'cyber-doll' },
    ],
    studio: { name: 'Latest Videos', slug: 'latest-videos' },
    stats: { views: 59, likes: 0, dislikes: 0 },
    embed: { url: 'https://pornalizer.app/player/embed/7164066/' },
  },
  {
    id: 7190500,
    title: 'Tokyo Bondage - Alda Mcewen And Mina Salome Two Nurses In Distress Part 2',
    description: 'Alda Mcewen and Mina Salome return for another chapter of rope discipline.',
    duration: '19:38',
    duration_seconds: 1178,
    orientation: 'straight',
    content_type: 'scene',
    published_at: '2026-11-09T00:00:00+00:00',
    thumbnail: 'https://adultembed.com/media/thumbnails/webp/pz-7190500.webp',
    poster: 'https://cdn.theporndb.net/scene/8b/dd/a9/af727ae6570c89e13a7b289da4c5764/background/bg-hollyrope-alda-mcewen-and-mina-salome-two-nurses-in-distress-part-2.jpg',
    tags: ['Bondage', 'Gags', 'Ropebondage'],
    categories: [{ name: 'Japanese Bondage', slug: 'japanese-bondage-long-hd' }],
    performers: [
      { name: 'Alda Mcewen', slug: 'alda-mcewen' },
      { name: 'Mina Salome', slug: 'mina-salome' },
    ],
    studio: { name: 'HollyRope', slug: 'hollyrope' },
    stats: { views: 58, likes: 0, dislikes: 0 },
    embed: { url: 'https://pornalizer.app/player/embed/7190500/' },
  },
  {
    id: 7185434,
    title: 'MyDirtyUncle - "You Want Me To Be A Surrogate?!" (Bella Fitbadonk Debut)',
    description: 'MyDirtyUncle - Bella Fitbadonk debut scene.',
    duration: '56:55',
    duration_seconds: 3415,
    orientation: 'straight',
    content_type: 'scene',
    published_at: '2026-11-06T19:18:36.454316+00:00',
    thumbnail: 'https://adultembed.com/media/thumbnails/webp/pz-7185434.webp',
    poster: 'https://cdn.theporndb.net/scene/42/ad/57/35dbb0f13e7b1225bdff53e39cd4055/background/bg-my-dirty-uncle-you-want-me-to-be-a-surrogate-he-came-into-my-room-to-breed-me-bella-fitbadon.jpg',
    tags: ['Adorable', 'All Sex', 'American', 'Average Body', 'Bed', 'Blowjob'],
    categories: [
      { name: 'Blowjob', slug: 'blowjob' },
      { name: 'Brunette', slug: 'brunette' },
      { name: 'Cumshot', slug: 'cumshot' },
      { name: 'Natural Tits', slug: 'natural-tits' },
    ],
    performers: [{ name: 'Isabella Torres', slug: 'isabella-torres' }],
    studio: { name: 'My Dirty Uncle', slug: 'my-dirty-uncle' },
    stats: { views: 58, likes: 0, dislikes: 0 },
    embed: { url: 'https://pornalizer.app/player/embed/7185434/' },
  },
]

const STORAGE_PREFIX = 'lumen.ae.cache.v1.'
const MEMORY_TTL_MS = 15 * 60 * 1000
const STORAGE_TTL_MS = 2 * 60 * 60 * 1000

const memoryCache = new Map<string, { result: AdultEmbedCatalogResult; timestamp: number }>()
const relatedCache = new Map<string, { videos: AdultEmbedVideo[]; timestamp: number }>()
const inFlightRequests = new Map<string, Promise<AdultEmbedCatalogResult>>()
let cachedCategories: { items: AdultEmbedCategoryPill[]; timestamp: number } | null = null

export interface AdultEmbedQuery {
  query?: string
  categories?: string
  orientation?: 'all' | 'straight' | 'gay' | 'trans' | 'bi'
  contentType?: '' | 'scene' | 'amateur'
  sort?: 'popular' | 'newest' | 'longest' | 'updated' | 'trending'
  page?: number
  perPage?: number
  signal?: AbortSignal
}

function getCacheKey(q: AdultEmbedQuery): string {
  return JSON.stringify({
    query: (q.query || '').trim().toLowerCase(),
    categories: q.categories || '',
    orientation: q.orientation || 'all',
    contentType: q.contentType || '',
    sort: q.sort || 'popular',
    page: q.page || 1,
    perPage: q.perPage || 24,
  })
}

function readStorageCache(key: string): AdultEmbedCatalogResult | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { result: AdultEmbedCatalogResult; timestamp: number }
    if (
      parsed?.result?.results?.length > 0 &&
      Date.now() - parsed.timestamp < STORAGE_TTL_MS
    ) {
      return parsed.result
    }
  } catch {
    // ignore storage errors
  }
  return null
}

function writeStorageCache(key: string, result: AdultEmbedCatalogResult): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    if (result.results.length === 0) return
    window.localStorage.setItem(
      STORAGE_PREFIX + key,
      JSON.stringify({ result, timestamp: Date.now() }),
    )
  } catch {
    // quota or disabled storage
  }
}

export function getCachedAdultEmbedCatalog(query: AdultEmbedQuery): AdultEmbedCatalogResult | null {
  const key = getCacheKey(query)
  const mem = memoryCache.get(key)
  if (mem && Date.now() - mem.timestamp < MEMORY_TTL_MS && mem.result.results.length > 0) {
    return mem.result
  }

  const stored = readStorageCache(key)
  if (stored) {
    memoryCache.set(key, { result: stored, timestamp: Date.now() })
    return stored
  }

  const isDefaultPopular =
    !(query.query || '').trim() &&
    !(query.categories || '').trim() &&
    (!query.orientation || query.orientation === 'all') &&
    !(query.contentType || '').trim() &&
    (!query.sort || query.sort === 'popular') &&
    (!query.page || query.page === 1)

  if (isDefaultPopular) {
    return {
      results: INITIAL_ADULTEMBED_VIDEOS,
      total: 256482,
      pages: 10686,
      page: 1,
    }
  }

  return null
}

export function buildAdultEmbedPlayerUrl(video: Pick<AdultEmbedVideo, 'id' | 'embed'>): string {
  return video.embed?.url || `https://adultembed.com/player/embed/${video.id}/`
}

export function adultEmbedToMovie(video: AdultEmbedVideo): Movie {
  const embedUrl = buildAdultEmbedPlayerUrl(video)
  const categoryNames = (video.categories || [])
    .map((c) => c.name)
    .filter((name) => name && name.toLowerCase() !== 'hentai')
  const genres =
    categoryNames.length > 0
      ? categoryNames.slice(0, 4)
      : (video.tags || []).filter((t) => t.toLowerCase() !== 'hentai').slice(0, 4)

  const performers = (video.performers || []).map((p) => p.name).filter(Boolean)
  const posterImg = video.poster || video.thumbnail
  const thumbImg = video.thumbnail || video.poster || ''
  const year = video.published_at ? video.published_at.slice(0, 4) : '2026'

  return normalizeMovie({
    id: `ae-${video.id}`,
    title: video.title,
    label: 'PHub 1',
    type: 'PHub 1 Video',
    genres: genres.length > 0 ? genres : ['Studio'],
    year,
    runtime: video.duration || 'Full Video',
    rating: video.resolution || 'HD',
    maturity: '18+',
    poster: thumbImg,
    still: posterImg || thumbImg,
    hero: posterImg || thumbImg,
    synopsis:
      video.description ||
      `${video.title}${video.studio?.name ? ` · Studio: ${video.studio.name}` : ''}`,
    cast: performers.length > 0 ? performers : ['Verified Creator'],
    director: video.studio?.name || 'PHub 1',
    hentaiSlug: `ae-${video.id}`,
    embedUrl,
    isHentaiOcean: false,
    isJav: false,
    badges: [
      video.content_type === 'amateur' ? 'AMATEUR' : 'SCENE',
      'HD',
      ...(video.orientation && video.orientation !== 'straight'
        ? [video.orientation.toUpperCase()]
        : []),
    ],
  })
}

export async function fetchAdultEmbedCatalog(
  query: AdultEmbedQuery = {},
): Promise<AdultEmbedCatalogResult> {
  const key = getCacheKey(query)
  const mem = memoryCache.get(key)
  if (mem && Date.now() - mem.timestamp < MEMORY_TTL_MS && mem.result.results.length > 0) {
    return mem.result
  }

  const pending = inFlightRequests.get(key)
  if (pending) return pending

  const fetchPromise = (async () => {
    const params = new URLSearchParams()
    const isTrending = query.sort === 'trending'
    params.set('action', isTrending ? 'trending' : 'search')
    params.set('page', String(query.page || 1))
    params.set('per_page', String(query.perPage || 24))

    if (!isTrending && query.sort) {
      params.set('sort', query.sort)
    } else if (isTrending) {
      params.set('period', 'week')
    }

    if (query.query?.trim()) {
      params.set('query', query.query.trim())
    }
    if (query.categories?.trim()) {
      params.set('categories', query.categories.trim())
    }
    if (query.orientation && query.orientation !== 'all') {
      params.set('orientation', query.orientation)
    } else {
      params.set('orientation', 'all')
    }
    if (query.contentType) {
      params.set('content_type', query.contentType)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4500)
    const onExternalAbort = () => controller.abort()
    if (query.signal) {
      if (query.signal.aborted) controller.abort()
      query.signal.addEventListener('abort', onExternalAbort, { once: true })
    }

    try {
      const response = await fetch(`/api/adultembed?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`AdultEmbed HTTP ${response.status}`)
      }

      const data = (await response.json()) as {
        results?: AdultEmbedVideo[]
        total?: number
        pages?: number
        page?: number
      }

      const result: AdultEmbedCatalogResult = {
        results: Array.isArray(data.results) ? data.results : [],
        total: typeof data.total === 'number' ? data.total : (data.results?.length ?? 0),
        pages: typeof data.pages === 'number' ? data.pages : 1,
        page: typeof data.page === 'number' ? data.page : query.page || 1,
      }

      if (result.results.length > 0) {
        memoryCache.set(key, { result, timestamp: Date.now() })
        writeStorageCache(key, result)
      }

      return result
    } catch (err) {
      const fallback = getCachedAdultEmbedCatalog(query)
      if (fallback) return fallback
      throw err
    } finally {
      clearTimeout(timeoutId)
      if (query.signal) {
        query.signal.removeEventListener('abort', onExternalAbort)
      }
      inFlightRequests.delete(key)
    }
  })()

  inFlightRequests.set(key, fetchPromise)
  return fetchPromise
}

export async function fetchAdultEmbedRelated(
  videoId: number | string,
  limit = 12,
): Promise<AdultEmbedVideo[]> {
  const cleanId = String(videoId).replace(/^ae-/, '').trim()
  if (!cleanId) return []

  const cacheKey = `${cleanId}:${limit}`
  const cached = relatedCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < MEMORY_TTL_MS) {
    return cached.videos
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3000)

  try {
    const res = await fetch(
      `/api/adultembed?action=related&id=${encodeURIComponent(cleanId)}&limit=${limit}`,
      { signal: controller.signal, headers: { Accept: 'application/json' } },
    )
    if (!res.ok) return []
    const data = (await res.json()) as { results?: AdultEmbedVideo[] }
    const videos = Array.isArray(data.results) ? data.results : []
    if (videos.length > 0) {
      relatedCache.set(cacheKey, { videos, timestamp: Date.now() })
    }
    return videos
  } catch {
    return []
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function fetchAdultEmbedCategories(): Promise<AdultEmbedCategoryPill[]> {
  if (cachedCategories && Date.now() - cachedCategories.timestamp < 30 * 60 * 1000) {
    return cachedCategories.items
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 2500)
  try {
    const res = await fetch('/api/adultembed?action=categories&sort=popular&per_page=16', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return DEFAULT_ADULTEMBED_CATEGORIES
    const data = (await res.json()) as { results?: Array<{ name: string; slug: string }> }
    if (Array.isArray(data.results) && data.results.length > 0) {
      const items: AdultEmbedCategoryPill[] = [
        { name: 'All', slug: '' },
        ...data.results
          .filter((c) => c?.slug && c?.name && c.name.toLowerCase() !== 'hentai')
          .slice(0, 15)
          .map((c) => ({ name: c.name, slug: c.slug })),
      ]
      cachedCategories = { items, timestamp: Date.now() }
      return items
    }
    return DEFAULT_ADULTEMBED_CATEGORIES
  } catch {
    return DEFAULT_ADULTEMBED_CATEGORIES
  } finally {
    clearTimeout(timeoutId)
  }
}

export function prefetchAdultEmbedCatalog(): void {
  if (typeof window === 'undefined') return
  void fetchAdultEmbedCatalog({ sort: 'popular', orientation: 'all', page: 1 }).catch(() => { })
}
