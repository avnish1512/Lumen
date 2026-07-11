import {
  createTmdbWatchAuthChain,
  fetchTmdbWatchProviders,
  normalizeWatchRegion,
  watchmodeConfigFromEnv,
} from './_lib/tmdb-watch-core.js'

type QueryValue = string | string[] | undefined

type ApiRequest = {
  method?: string
  query: Record<string, QueryValue>
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
}

function getQueryValue(value: QueryValue) {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')

  if (req.method && req.method !== 'GET') {
    res.status(405).json({ Response: 'False', Error: 'Method not allowed.' })
    return
  }

  const imdbId = getQueryValue(req.query.imdbId)
  const tmdbId = Number(getQueryValue(req.query.tmdbId) ?? 0)
  const mediaType = getQueryValue(req.query.mediaType)
  const region = normalizeWatchRegion(
    getQueryValue(req.query.region) ?? process.env.TMDB_WATCH_REGION,
  )

  if (!imdbId && (!tmdbId || (mediaType !== 'movie' && mediaType !== 'tv'))) {
    res.status(400).json({
      Response: 'False',
      Error: 'Provide imdbId or tmdbId with mediaType.',
    })
    return
  }

  try {
    const availability = await fetchTmdbWatchProviders(
      createTmdbWatchAuthChain(process.env),
      {
        imdbId,
        mediaType:
          mediaType === 'movie' || mediaType === 'tv' ? mediaType : undefined,
        region,
        tmdbId: tmdbId || undefined,
        watchmode: watchmodeConfigFromEnv(process.env),
      },
    )

    res.status(200).json({
      Response: 'True',
      ...availability,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not reach TMDB.'

    res.status(502).json({
      Response: 'False',
      Error: message,
      link: '',
      providers: [],
      region,
    })
  }
}
