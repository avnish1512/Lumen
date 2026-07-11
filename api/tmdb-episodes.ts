import { fetchTmdbSeasonEpisodes } from './tmdb-episodes-core.js'
import { createTmdbWatchAuthChain } from './tmdb-watch-core.js'

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
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ Response: 'False', Error: 'Method not allowed.', episodes: [] })
    return
  }

  res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=604800')

  const tmdbId = Number(getQueryValue(req.query.tmdbId) ?? 0)
  const season = Number(getQueryValue(req.query.season) ?? 1)

  if (!tmdbId) {
    res.status(400).json({ Response: 'False', Error: 'Provide tmdbId.', episodes: [] })
    return
  }

  try {
    const authChain = createTmdbWatchAuthChain(
      process.env as Record<string, string | undefined>,
    )
    const episodes = await fetchTmdbSeasonEpisodes(authChain, tmdbId, season || 1)
    res.status(200).json({ Response: 'True', episodes })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach TMDB.'
    res.status(502).json({ Response: 'False', Error: message, episodes: [] })
  }
}
