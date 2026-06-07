import { fetchTmdbHomeRails } from './tmdb-home-core'
import {
  createTmdbWatchAuthChain,
  normalizeWatchRegion,
} from './tmdb-watch-core'

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
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')

  if (req.method && req.method !== 'GET') {
    res.status(405).json({ Response: 'False', Error: 'Method not allowed.' })
    return
  }

  const region = normalizeWatchRegion(
    getQueryValue(req.query.region) ?? process.env.TMDB_WATCH_REGION,
  )

  try {
    const rails = await fetchTmdbHomeRails(createTmdbWatchAuthChain(process.env), {
      region,
    })

    res.status(200).json({
      Response: 'True',
      region,
      ...rails,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not reach TMDB.'

    res.status(502).json({
      Response: 'False',
      Error: message,
      newReleases: [],
      region,
      trendingNow: [],
    })
  }
}
