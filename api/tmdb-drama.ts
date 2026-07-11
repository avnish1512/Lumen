import { fetchKoreanChineseDramas } from './tmdb-drama-core.js'
import { createTmdbWatchAuthChain } from './tmdb-watch-core.js'

type ApiRequest = {
  method?: string
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ Response: 'False', Error: 'Method not allowed.', results: [] })
    return
  }

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')

  try {
    const authChain = createTmdbWatchAuthChain(
      process.env as Record<string, string | undefined>,
    )
    const results = await fetchKoreanChineseDramas(authChain)
    res.status(200).json({ Response: 'True', results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach TMDB.'
    res.status(502).json({ Response: 'False', Error: message, results: [] })
  }
}
