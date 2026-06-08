import {
  fetchMovieGluTrailerClips,
  movieGluConfigFromEnv,
} from './movieglu-core.js'
import {
  createTmdbTrailerAuthChain,
  fallbackTrailerSearchClips,
  fetchTmdbTrailerClips,
} from './tmdb-trailer-core.js'

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
  const title = getQueryValue(req.query.title)

  if (!imdbId || !title) {
    res.status(400).json({
      Response: 'False',
      Error: 'Provide imdbId and title.',
    })
    return
  }

  try {
    const movie = {
      imdbId,
      title,
    }
    let trailers = []

    try {
      trailers = await fetchMovieGluTrailerClips(
        movieGluConfigFromEnv(process.env),
        movie,
      )
    } catch {
      trailers = []
    }

    if (trailers.length === 0) {
      try {
        trailers = await fetchTmdbTrailerClips(
          createTmdbTrailerAuthChain(process.env),
          movie,
        )
      } catch {
        trailers = fallbackTrailerSearchClips(movie)
      }
    }

    if (trailers.length === 0) {
      trailers = fallbackTrailerSearchClips(movie)
    }

    res.status(200).json({
      Response: 'True',
      trailers,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not reach MovieGlu.'

    res.status(502).json({
      Response: 'False',
      Error: message,
    })
  }
}
