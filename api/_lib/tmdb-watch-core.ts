const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w92'
const TMDB_PROFILE_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w185'
const WIKIPEDIA_SUMMARY_BASE_URL =
  'https://en.wikipedia.org/api/rest_v1/page/summary/'
const WATCHMODE_BASE_URL = 'https://api.watchmode.com/v1'

type TmdbMediaType = 'movie' | 'tv'
type TmdbWatchType = 'flatrate' | 'free' | 'ads' | 'rent' | 'buy'

type TmdbFindResult = {
  id: number
  title?: string
  name?: string
}

type TmdbFindResponse = {
  movie_results?: TmdbFindResult[]
  tv_results?: TmdbFindResult[]
  status_code?: number
  status_message?: string
}

type TmdbProvider = {
  display_priority?: number
  logo_path?: string
  provider_id: number
  provider_name: string
}

type TmdbWatchRegion = {
  ads?: TmdbProvider[]
  buy?: TmdbProvider[]
  flatrate?: TmdbProvider[]
  free?: TmdbProvider[]
  link?: string
  rent?: TmdbProvider[]
}

type TmdbWatchResponse = {
  results?: Record<string, TmdbWatchRegion>
  status_code?: number
  status_message?: string
}

type TmdbCreditPerson = {
  character?: string
  id: number
  job?: string
  name?: string
  order?: number
  profile_path?: string
}

type TmdbCreditsResponse = {
  cast?: TmdbCreditPerson[]
  crew?: TmdbCreditPerson[]
  status_code?: number
  status_message?: string
}

type WikipediaSummaryResponse = {
  originalimage?: {
    source?: string
  }
  thumbnail?: {
    source?: string
  }
  type?: string
}

type WatchmodeTitleDetails = {
  id?: number
  sources?: WatchmodeTitleSource[]
  title?: string
  type?: string
}

type WatchmodeTitleSource = {
  android_url?: string
  format?: string
  ios_url?: string
  name: string
  price?: number | string
  region: string
  source_id: number
  type: string
  web_url?: string
}

type WatchmodeRawCastCrewMember = {
  episode_count?: number
  full_name?: string
  headshot_url?: string | null
  order?: number | null
  person_id: number
  role?: string
  type?: 'Cast' | 'Crew'
}

type WatchmodeCatalogSource = {
  id: number
  logo_100px?: string
  name: string
}

export type TmdbAuth = {
  apiKey?: string
  name: string
  readAccessToken?: string
}

export type WatchmodeConfig = {
  apiKeys: string[]
  baseUrl: string
}

export type WatchmodeCastCrewMember = {
  id: string
  imageUrl: string
  name: string
  role: string
  type: 'Cast' | 'Crew'
}

export type TmdbWatchProvider = {
  displayPriority: number
  id: string
  link?: string
  logoPath: string
  logoUrl: string
  name: string
  type: TmdbWatchType
}

export type TmdbWatchAvailability = {
  link: string
  providers: TmdbWatchProvider[]
  region: string
  source?: 'TMDB' | 'Watchmode'
}

let preferredWatchmodeKeyIndex = 0
let watchmodeCatalogCache:
  | {
      expiresAt: number
      sources: Map<number, WatchmodeCatalogSource>
    }
  | null = null
const wikipediaPortraitCache = new Map<
  string,
  {
    expiresAt: number
    imageUrl: string
  }
>()

const fallbackTmdbMatches: Record<
  string,
  { tmdbId: number; mediaType: TmdbMediaType; title: string }
> = {
  tt1375666: { tmdbId: 27205, mediaType: 'movie', title: 'Inception' },
  tt0816692: { tmdbId: 157336, mediaType: 'movie', title: 'Interstellar' },
  tt0111161: {
    tmdbId: 278,
    mediaType: 'movie',
    title: 'The Shawshank Redemption',
  },
  tt0468569: { tmdbId: 155, mediaType: 'movie', title: 'The Dark Knight' },
  tt0133093: { tmdbId: 603, mediaType: 'movie', title: 'The Matrix' },
  tt0109830: { tmdbId: 13, mediaType: 'movie', title: 'Forrest Gump' },
  tt0110912: { tmdbId: 680, mediaType: 'movie', title: 'Pulp Fiction' },
  tt4154796: {
    tmdbId: 299534,
    mediaType: 'movie',
    title: 'Avengers: Endgame',
  },
  tt1745960: { tmdbId: 361743, mediaType: 'movie', title: 'Top Gun: Maverick' },
  tt0068646: { tmdbId: 238, mediaType: 'movie', title: 'The Godfather' },
  tt0944947: { tmdbId: 1399, mediaType: 'tv', title: 'Game of Thrones' },
  tt0903747: { tmdbId: 1396, mediaType: 'tv', title: 'Breaking Bad' },
  tt4574334: { tmdbId: 66732, mediaType: 'tv', title: 'Stranger Things' },
  tt1475582: { tmdbId: 19885, mediaType: 'tv', title: 'Sherlock' },
  tt0108778: { tmdbId: 1668, mediaType: 'tv', title: 'Friends' },
  tt7366338: { tmdbId: 87108, mediaType: 'tv', title: 'Chernobyl' },
  tt3032476: { tmdbId: 60059, mediaType: 'tv', title: 'Better Call Saul' },
  tt1520211: { tmdbId: 1402, mediaType: 'tv', title: 'The Walking Dead' },
  tt2861424: { tmdbId: 60625, mediaType: 'tv', title: 'Rick and Morty' },
  tt0413573: { tmdbId: 1416, mediaType: 'tv', title: "Grey's Anatomy" },
}

const watchTypePriority: Record<TmdbWatchType, number> = {
  flatrate: 0,
  free: 1,
  ads: 2,
  rent: 3,
  buy: 4,
}

export function normalizeWatchRegion(region?: string) {
  return (region || 'IN').trim().toUpperCase() || 'IN'
}

export function createTmdbWatchAuthChain(
  env: Record<string, string | undefined>,
) {
  const auths: TmdbAuth[] = [
    {
      name: 'primary',
      apiKey: env.TMDB_API_KEY,
      readAccessToken: env.TMDB_API_READ_ACCESS_TOKEN,
    },
    {
      name: 'secondary',
      apiKey: env.TMDB_SECONDARY_API_KEY,
      readAccessToken: env.TMDB_SECONDARY_API_READ_ACCESS_TOKEN,
    },
  ]
  const seen = new Set<string>()

  return auths.filter((auth) => {
    if (!auth.apiKey && !auth.readAccessToken) {
      return false
    }

    const key = `${auth.readAccessToken ?? ''}:${auth.apiKey ?? ''}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function parseWatchmodeApiKeys(value?: string) {
  return (value ?? '')
    .split(/[\s,]+/)
    .map((key) => key.trim())
    .filter(Boolean)
}

export function watchmodeConfigFromEnv(
  env: Record<string, string | undefined>,
): WatchmodeConfig | null {
  const apiKeys = [
    env.WATCHMODE_API_KEY,
    ...parseWatchmodeApiKeys(env.WATCHMODE_API_KEYS),
  ]
  const seen = new Set<string>()
  const uniqueKeys = apiKeys
    .map((key) => key?.trim())
    .filter((key): key is string => Boolean(key))
    .filter((key) => {
      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })

  if (uniqueKeys.length === 0) {
    return null
  }

  return {
    apiKeys: uniqueKeys,
    baseUrl: env.WATCHMODE_BASE_URL?.trim() || WATCHMODE_BASE_URL,
  }
}

function orderedWatchmodeApiKeys(apiKeys: string[]) {
  const startIndex = Math.min(preferredWatchmodeKeyIndex, apiKeys.length - 1)
  return apiKeys.slice(startIndex).concat(apiKeys.slice(0, startIndex))
}

function shouldRotateWatchmodeKey(status: number, body: string) {
  const message = body.toLowerCase()

  return (
    status === 401 ||
    status === 403 ||
    status === 429 ||
    message.includes('limit') ||
    message.includes('quota') ||
    message.includes('rate') ||
    message.includes('too many')
  )
}

async function requestWatchmode<T>(
  config: WatchmodeConfig,
  path: string,
  params: Record<string, string> = {},
) {
  const baseUrl = config.baseUrl.endsWith('/')
    ? config.baseUrl
    : `${config.baseUrl}/`
  const url = new URL(path.replace(/^\/+/, ''), baseUrl)

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })

  for (const apiKey of orderedWatchmodeApiKeys(config.apiKeys)) {
    const keyIndex = config.apiKeys.indexOf(apiKey)
    url.searchParams.set('apiKey', apiKey)

    const response = await fetch(url)
    const text = await response.text()

    if (response.ok) {
      preferredWatchmodeKeyIndex = Math.max(0, keyIndex)
      return JSON.parse(text) as T
    }

    if (
      shouldRotateWatchmodeKey(response.status, text) &&
      config.apiKeys.length > 1
    ) {
      preferredWatchmodeKeyIndex = (keyIndex + 1) % config.apiKeys.length
      continue
    }

    throw new Error(`Watchmode returned ${response.status}.`)
  }

  throw new Error('Watchmode key pool is exhausted.')
}

function applyTmdbAuth(url: URL, auth: TmdbAuth) {
  if (auth.readAccessToken) {
    return {
      headers: {
        Authorization: `Bearer ${auth.readAccessToken}`,
      },
    }
  }

  if (auth.apiKey) {
    url.searchParams.set('api_key', auth.apiKey)
  }

  return undefined
}

async function requestTmdb<T>(auth: TmdbAuth, path: string) {
  const url = new URL(path, TMDB_BASE_URL)
  const response = await fetch(url, applyTmdbAuth(url, auth))
  const body = (await response.json()) as T

  return {
    body,
    status: response.ok ? 200 : response.status,
  }
}

async function resolveTmdbMatch(authChain: TmdbAuth[], imdbId: string) {
  const fallbackMatch = fallbackTmdbMatches[imdbId]

  if (fallbackMatch) {
    return fallbackMatch
  }

  if (authChain.length === 0) {
    throw new Error('TMDB watch provider API is not configured on the server.')
  }

  const path = `/find/${encodeURIComponent(imdbId)}?external_source=imdb_id`

  for (const auth of authChain) {
    const result = await requestTmdb<TmdbFindResponse>(auth, path)

    if (result.status !== 200) {
      continue
    }

    const movie = result.body.movie_results?.[0]
    const tv = result.body.tv_results?.[0]

    if (movie) {
      return {
        tmdbId: movie.id,
        mediaType: 'movie' as const,
        title: movie.title,
      }
    }

    if (tv) {
      return {
        tmdbId: tv.id,
        mediaType: 'tv' as const,
        title: tv.name,
      }
    }
  }

  throw new Error('No TMDB match found for this IMDb id.')
}

async function fetchWatchResponse(
  authChain: TmdbAuth[],
  mediaType: TmdbMediaType,
  tmdbId: number,
) {
  const path = `/${mediaType}/${tmdbId}/watch/providers`

  for (const auth of authChain) {
    const result = await requestTmdb<TmdbWatchResponse>(auth, path)

    if (result.status === 200) {
      return result.body
    }
  }

  return {}
}

function normalizeProviders(regionData: TmdbWatchRegion | undefined) {
  const providers = new Map<number, TmdbWatchProvider>()

  ;(['flatrate', 'free', 'ads', 'rent', 'buy'] as TmdbWatchType[]).forEach(
    (type) => {
      const items = regionData?.[type] ?? []

      items.forEach((provider) => {
        const existing = providers.get(provider.provider_id)

        if (
          existing &&
          watchTypePriority[existing.type] <= watchTypePriority[type]
        ) {
          return
        }

        providers.set(provider.provider_id, {
          displayPriority: provider.display_priority ?? 999,
          id: String(provider.provider_id),
          logoPath: provider.logo_path ?? '',
          logoUrl: provider.logo_path
            ? `${TMDB_IMAGE_BASE_URL}${provider.logo_path}`
            : '',
          name: provider.provider_name,
          type,
        })
      })
    },
  )

  return [...providers.values()]
    .sort((left, right) => {
      if (left.displayPriority !== right.displayPriority) {
        return left.displayPriority - right.displayPriority
      }

      return left.name.localeCompare(right.name)
    })
    .slice(0, 10)
}

async function getWatchmodeCatalog(config: WatchmodeConfig) {
  const now = Date.now()

  if (watchmodeCatalogCache && watchmodeCatalogCache.expiresAt > now) {
    return watchmodeCatalogCache.sources
  }

  const sources = await requestWatchmode<WatchmodeCatalogSource[]>(
    config,
    '/sources/',
  )
  const sourceMap = new Map<number, WatchmodeCatalogSource>()

  sources.forEach((source) => {
    sourceMap.set(source.id, source)
  })

  watchmodeCatalogCache = {
    expiresAt: now + 24 * 60 * 60 * 1000,
    sources: sourceMap,
  }

  return sourceMap
}

function watchmodeTitleId(options: {
  imdbId?: string
  mediaType?: TmdbMediaType
  tmdbId?: number
}) {
  if (options.imdbId) {
    return options.imdbId
  }

  if (options.tmdbId && options.mediaType) {
    return `${options.mediaType === 'tv' ? 'tv' : 'movie'}-${options.tmdbId}`
  }

  return ''
}

function watchmodeType(sourceType: string): TmdbWatchType {
  const type = sourceType.toLowerCase()

  if (type === 'free') {
    return 'free'
  }

  if (type === 'rent') {
    return 'rent'
  }

  if (type === 'buy') {
    return 'buy'
  }

  if (type === 'ads' || type.includes('ad')) {
    return 'ads'
  }

  return 'flatrate'
}

function watchmodeLink(source: WatchmodeTitleSource) {
  return source.web_url || source.ios_url || source.android_url || ''
}

function normalizeWatchmodeProviders(
  sources: WatchmodeTitleSource[],
  catalog: Map<number, WatchmodeCatalogSource>,
) {
  const providers = new Map<number, TmdbWatchProvider>()

  sources.forEach((source, index) => {
    const type = watchmodeType(source.type)
    const existing = providers.get(source.source_id)

    if (existing && watchTypePriority[existing.type] <= watchTypePriority[type]) {
      return
    }

    const catalogSource = catalog.get(source.source_id)
    const logoUrl = catalogSource?.logo_100px ?? ''

    providers.set(source.source_id, {
      displayPriority: watchTypePriority[type] * 1000 + index,
      id: `watchmode-${source.source_id}`,
      link: watchmodeLink(source),
      logoPath: logoUrl,
      logoUrl,
      name: source.name || catalogSource?.name || 'Streaming service',
      type,
    })
  })

  return [...providers.values()]
    .sort((left, right) => {
      if (left.displayPriority !== right.displayPriority) {
        return left.displayPriority - right.displayPriority
      }

      return left.name.localeCompare(right.name)
    })
    .slice(0, 10)
}

async function fetchWatchmodeWatchProviders(
  config: WatchmodeConfig,
  options: {
    imdbId?: string
    mediaType?: TmdbMediaType
    region?: string
    tmdbId?: number
  },
): Promise<TmdbWatchAvailability> {
  const region = normalizeWatchRegion(options.region)
  const titleId = watchmodeTitleId(options)

  if (!titleId) {
    throw new Error('Provide imdbId or tmdbId with mediaType.')
  }

  const [details, catalog] = await Promise.all([
    requestWatchmode<WatchmodeTitleDetails>(
      config,
      `/title/${encodeURIComponent(titleId)}/details/`,
      {
        append_to_response: 'sources',
      },
    ),
    getWatchmodeCatalog(config),
  ])
  const sources = (details.sources ?? []).filter(
    (source) => normalizeWatchRegion(source.region) === region,
  )
  const providers = normalizeWatchmodeProviders(sources, catalog)

  return {
    link: providers.find((provider) => provider.link)?.link ?? '',
    providers,
    region,
    source: 'Watchmode',
  }
}

export async function fetchWatchmodeCastCrew(
  config: WatchmodeConfig,
  options: {
    imdbId?: string
    mediaType?: TmdbMediaType
    tmdbId?: number
  },
) {
  const titleId = watchmodeTitleId(options)

  if (!titleId) {
    throw new Error('Provide imdbId or tmdbId with mediaType.')
  }

  const members = await requestWatchmode<WatchmodeRawCastCrewMember[]>(
    config,
    `/title/${encodeURIComponent(titleId)}/cast-crew/`,
    {
      language: 'en',
    },
  )
  const seen = new Set<number>()

  return members
    .filter((member) => {
      if (!member.full_name || seen.has(member.person_id)) {
        return false
      }

      seen.add(member.person_id)
      return true
    })
    .sort((left, right) => {
      const leftType = left.type === 'Cast' ? 0 : 1
      const rightType = right.type === 'Cast' ? 0 : 1

      if (leftType !== rightType) {
        return leftType - rightType
      }

      return (left.order ?? 9999) - (right.order ?? 9999)
    })
    .slice(0, 18)
    .map((member) => ({
      id: String(member.person_id),
      imageUrl: member.headshot_url ?? '',
      name: member.full_name ?? '',
      role: member.role || (member.type === 'Crew' ? 'Crew' : 'Cast'),
      type: member.type === 'Crew' ? 'Crew' : 'Cast',
    } satisfies WatchmodeCastCrewMember))
}

function tmdbProfileUrl(path: string | undefined) {
  return path ? `${TMDB_PROFILE_IMAGE_BASE_URL}${path}` : ''
}

function castCrewImageCount(members: WatchmodeCastCrewMember[]) {
  return members.filter((member) => member.imageUrl).length
}

function normalizeCastCrewName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}

export function bestCastCrewMembers(
  watchmodeMembers: WatchmodeCastCrewMember[],
  tmdbMembers: WatchmodeCastCrewMember[],
) {
  const tmdbByName = new Map(
    tmdbMembers.map((member) => [normalizeCastCrewName(member.name), member]),
  )
  const mergedWatchmodeMembers = watchmodeMembers.map((member) => {
    const tmdbMember = tmdbByName.get(normalizeCastCrewName(member.name))

    return {
      ...member,
      imageUrl: member.imageUrl || tmdbMember?.imageUrl || '',
    }
  })

  if (castCrewImageCount(mergedWatchmodeMembers) > 0) {
    return mergedWatchmodeMembers
  }

  if (castCrewImageCount(tmdbMembers) > 0) {
    return tmdbMembers
  }

  return watchmodeMembers.length > 0 ? watchmodeMembers : tmdbMembers
}

function wikipediaTitleForPerson(name: string) {
  return encodeURIComponent(name.trim().replace(/\s+/g, '_'))
}

async function fetchWikipediaPortrait(name: string) {
  const cacheKey = normalizeCastCrewName(name)
  const cached = wikipediaPortraitCache.get(cacheKey)
  const now = Date.now()

  if (cached && cached.expiresAt > now) {
    return cached.imageUrl
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)

  try {
    const response = await fetch(
      `${WIKIPEDIA_SUMMARY_BASE_URL}${wikipediaTitleForPerson(name)}`,
      {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      },
    )

    if (!response.ok) {
      return ''
    }

    const body = (await response.json()) as WikipediaSummaryResponse
    const imageUrl = body.thumbnail?.source || body.originalimage?.source || ''

    wikipediaPortraitCache.set(cacheKey, {
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      imageUrl,
    })

    return imageUrl
  } catch {
    return ''
  } finally {
    clearTimeout(timeout)
  }
}

export async function enrichCastCrewPortraits(
  members: WatchmodeCastCrewMember[],
) {
  const lookups = await Promise.all(
    members.map((member) =>
      member.imageUrl
        ? Promise.resolve(member.imageUrl)
        : fetchWikipediaPortrait(member.name),
    ),
  )

  return members.map((member, index) => ({
    ...member,
    imageUrl: member.imageUrl || lookups[index] || '',
  }))
}

export async function fetchTmdbCastCrew(
  authChain: TmdbAuth[],
  options: {
    imdbId?: string
    mediaType?: TmdbMediaType
    tmdbId?: number
  },
) {
  if (authChain.length === 0) {
    return []
  }

  const match =
    options.tmdbId && options.mediaType
      ? {
          mediaType: options.mediaType,
          tmdbId: options.tmdbId,
        }
      : options.imdbId
        ? await resolveTmdbMatch(authChain, options.imdbId)
        : null

  if (!match) {
    return []
  }

  const path = `/${match.mediaType}/${match.tmdbId}/credits`
  let credits: TmdbCreditsResponse | null = null

  for (const auth of authChain) {
    const result = await requestTmdb<TmdbCreditsResponse>(auth, path)

    if (result.status === 200) {
      credits = result.body
      break
    }
  }

  if (!credits) {
    return []
  }

  const seen = new Set<number>()
  const cast =
    credits.cast
      ?.filter((member) => member.name)
      .sort((left, right) => (left.order ?? 9999) - (right.order ?? 9999))
      .slice(0, 14)
      .map((member) => {
        seen.add(member.id)

        return {
          id: `tmdb-cast-${member.id}`,
          imageUrl: tmdbProfileUrl(member.profile_path),
          name: member.name ?? '',
          role: member.character || 'Cast',
          type: 'Cast' as const,
        }
      }) ?? []
  const crew =
    credits.crew
      ?.filter((member) => {
        if (!member.name || seen.has(member.id)) {
          return false
        }

        return ['Creator', 'Director', 'Executive Producer', 'Producer', 'Writer']
          .includes(member.job ?? '')
      })
      .slice(0, 4)
      .map((member) => ({
        id: `tmdb-crew-${member.id}-${member.job ?? 'crew'}`,
        imageUrl: tmdbProfileUrl(member.profile_path),
        name: member.name ?? '',
        role: member.job || 'Crew',
        type: 'Crew' as const,
      })) ?? []

  return [...cast, ...crew].slice(0, 18)
}

export async function fetchTmdbWatchProviders(
  authChain: TmdbAuth[],
  options: {
    imdbId?: string
    mediaType?: TmdbMediaType
    region?: string
    tmdbId?: number
    watchmode?: WatchmodeConfig | null
  },
): Promise<TmdbWatchAvailability> {
  const region = normalizeWatchRegion(options.region)
  let watchmodeAvailability: TmdbWatchAvailability | null = null

  if (options.watchmode) {
    try {
      watchmodeAvailability = await fetchWatchmodeWatchProviders(
        options.watchmode,
        options,
      )

      if (watchmodeAvailability.providers.length > 0) {
        return watchmodeAvailability
      }
    } catch {
      watchmodeAvailability = null
    }
  }

  const match =
    options.tmdbId && options.mediaType
      ? {
          mediaType: options.mediaType,
          tmdbId: options.tmdbId,
        }
      : options.imdbId
        ? await resolveTmdbMatch(authChain, options.imdbId)
        : null

  if (!match) {
    throw new Error('Provide imdbId or tmdbId with mediaType.')
  }

  const response = await fetchWatchResponse(
    authChain,
    match.mediaType,
    match.tmdbId,
  )
  const regionData = response.results?.[region]
  const tmdbProviders = normalizeProviders(regionData)

  if (tmdbProviders.length === 0 && watchmodeAvailability) {
    return watchmodeAvailability
  }

  return {
    link: regionData?.link ?? '',
    providers: tmdbProviders,
    region,
    source: 'TMDB',
  }
}
