import {
  createTmdbTrailerAuthChain,
  fetchTmdbTrailerYoutubeId,
} from './_lib/tmdb-trailer-core.js'

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
    res.status(405).json({ youtubeId: null, error: 'Method not allowed.' })
    return
  }

  res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=604800')

  const type = getQueryValue(req.query.type) === 'tv' ? 'tv' : 'movie'
  const tmdbIdRaw = getQueryValue(req.query.tmdbId)
  const imdbId = getQueryValue(req.query.imdbId)

  try {
    const authChain = createTmdbTrailerAuthChain(
      process.env as Record<string, string | undefined>,
    )
    const youtubeId = await fetchTmdbTrailerYoutubeId(authChain, {
      tmdbId: tmdbIdRaw ? Number(tmdbIdRaw) : undefined,
      imdbId: imdbId || undefined,
      type,
    })
    res.status(200).json({ youtubeId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach TMDB.'
    res.status(502).json({ youtubeId: null, error: message })
  }
}
