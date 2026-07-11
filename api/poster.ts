import { fetchPosterImage, posterKeysFromEnv } from './_lib/poster-core.js'

type QueryValue = string | string[] | undefined

type ApiRequest = {
  method?: string
  query: Record<string, QueryValue>
}

// Loose response type so we can stream binary image bytes.
type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => ApiResponse
  send: (body: unknown) => void
  end: (body?: unknown) => void
  json: (body: unknown) => void
}

function getQueryValue(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed.' })
    return
  }

  const keys = posterKeysFromEnv(process.env as Record<string, string | undefined>)
  const kind = getQueryValue(req.query.kind) === 'thumbnail' ? 'thumbnail' : 'poster'

  const image = await fetchPosterImage(keys, {
    imdbId: getQueryValue(req.query.imdb),
    tmdbId: getQueryValue(req.query.tmdb),
    kind,
  })

  if (!image) {
    // Let the client fall back to its own artwork.
    res.status(404).json({ error: 'Poster unavailable.' })
    return
  }

  // Cache hard at the CDN/browser so we only pay for the fetch once.
  res.setHeader('Content-Type', image.contentType)
  res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
  res.end(Buffer.from(image.body))
}
