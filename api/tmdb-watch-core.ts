const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w92'

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

export type TmdbAuth = {
  apiKey?: string
  name: string
  readAccessToken?: string
}

export type TmdbWatchProvider = {
  displayPriority: number
  id: string
  logoPath: string
  logoUrl: string
  name: string
  type: TmdbWatchType
}

export type TmdbWatchAvailability = {
  link: string
  providers: TmdbWatchProvider[]
  region: string
}

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

export async function fetchTmdbWatchProviders(
  authChain: TmdbAuth[],
  options: {
    imdbId?: string
    mediaType?: TmdbMediaType
    region?: string
    tmdbId?: number
  },
): Promise<TmdbWatchAvailability> {
  const region = normalizeWatchRegion(options.region)
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

  return {
    link: regionData?.link ?? '',
    providers: normalizeProviders(regionData),
    region,
  }
}
