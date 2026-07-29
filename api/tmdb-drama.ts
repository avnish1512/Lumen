import {
  fetchDramaRails,
  fetchKoreanChineseDramas,
  fetchMatureCollection,
  searchTmdbTitles,
} from './_lib/tmdb-drama-core.js'
import { createTmdbWatchAuthChain } from './_lib/tmdb-watch-core.js'

type QueryValue = string | string[] | undefined

type ApiRequest = {
  method?: string
  query?: Record<string, QueryValue>
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
    res.status(405).json({ Response: 'False', Error: 'Method not allowed.', results: [] })
    return
  }

  const action = getQueryValue(req.query?.action)
  const authChain = createTmdbWatchAuthChain(
    process.env as Record<string, string | undefined>,
  )

  // Full-catalog title search (used by the search box in both UIs).
  if (action === 'search') {
    const query = getQueryValue(req.query?.query) ?? ''
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    try {
      const results = await searchTmdbTitles(authChain, query)
      res.status(200).json({ Response: 'True', results })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach TMDB.'
      res.status(502).json({ Response: 'False', Error: message, results: [] })
    }
    return
  }

  // Mature collection for the PIN-locked "Lord" profile (R-rated / mature but
  // non-explicit mainstream titles).
  if (action === 'mature') {
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
    try {
      const { results, rails } = await fetchMatureCollection(authChain)
      res.status(200).json({ Response: 'True', results, rails })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach TMDB.'
      res.status(502).json({ Response: 'False', Error: message, results: [], rails: [] })
    }
    return
  }

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')

  try {
    const [results, rails] = await Promise.all([
      fetchKoreanChineseDramas(authChain),
      fetchDramaRails(authChain),
    ])
    res.status(200).json({ Response: 'True', results, rails })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach TMDB.'
    res.status(502).json({ Response: 'False', Error: message, results: [] })
  }
}
