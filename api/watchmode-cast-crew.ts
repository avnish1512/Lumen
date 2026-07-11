import {
  bestCastCrewMembers,
  createTmdbWatchAuthChain,
  enrichCastCrewPortraits,
  fetchTmdbCastCrew,
  fetchWatchmodeCastCrew,
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

  if (!imdbId && (!tmdbId || (mediaType !== 'movie' && mediaType !== 'tv'))) {
    res.status(400).json({
      Response: 'False',
      Error: 'Provide imdbId or tmdbId with mediaType.',
      members: [],
    })
    return
  }

  const resolvedMediaType: 'movie' | 'tv' | undefined =
    mediaType === 'movie' || mediaType === 'tv' ? mediaType : undefined
  const options = {
    imdbId,
    mediaType: resolvedMediaType,
    tmdbId: tmdbId || undefined,
  }
  const watchmode = watchmodeConfigFromEnv(process.env)
  const tmdbAuthChain = createTmdbWatchAuthChain(process.env)

  try {
    const [watchmodeMembers, tmdbMembers] = await Promise.all([
      watchmode
        ? fetchWatchmodeCastCrew(watchmode, options).catch(() => [])
        : Promise.resolve([]),
      fetchTmdbCastCrew(tmdbAuthChain, options).catch(() => []),
    ])
    const members = await enrichCastCrewPortraits(
      bestCastCrewMembers(watchmodeMembers, tmdbMembers),
    )

    res.status(200).json({
      Response: 'True',
      members,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not load cast and crew.'

    res.status(502).json({
      Response: 'False',
      Error: message,
      members: [],
    })
  }
}
