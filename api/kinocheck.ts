import { fetchKinocheckTrailer } from './kinocheck-core.js'

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

  try {
    const trailer = await fetchKinocheckTrailer(
      {
        tmdbId: getQueryValue(req.query.tmdbId),
        imdbId: getQueryValue(req.query.imdbId),
        type,
      },
      process.env.KINOCHECK_API_KEY,
    )

    res.status(200).json(trailer ?? { youtubeId: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach KinoCheck.'
    res.status(502).json({ youtubeId: null, error: message })
  }
}
