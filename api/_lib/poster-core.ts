// Server-side Top-Posters image fetcher. Keeps the API keys on the server
// (they used to be shipped in the client bundle) and rotates through the pool
// until one succeeds. The handler streams the image bytes back so the key is
// never exposed to the browser.

const TOP_POSTERS_BASE = 'https://api.top-posters.com'

export function posterKeysFromEnv(env: Record<string, string | undefined>): string[] {
  return (env.TOP_POSTER_KEYS ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
}

export type PosterImage = {
  body: ArrayBuffer
  contentType: string
}

export async function fetchPosterImage(
  keys: string[],
  opts: { imdbId?: string; tmdbId?: string; kind: 'poster' | 'thumbnail' },
): Promise<PosterImage | null> {
  let path: string | null = null
  if (opts.imdbId && /^tt\d+$/.test(opts.imdbId)) {
    path = `imdb/${opts.kind}/${opts.imdbId}.jpg`
  } else if (opts.tmdbId && /^\d+$/.test(opts.tmdbId)) {
    path = `tmdb/${opts.kind}/${opts.tmdbId}.jpg`
  }

  if (!path || keys.length === 0) {
    return null
  }

  for (const key of keys) {
    try {
      const response = await fetch(`${TOP_POSTERS_BASE}/${key}/${path}`)
      if (!response.ok) {
        continue
      }
      const contentType = response.headers.get('content-type') ?? 'image/jpeg'
      if (!contentType.startsWith('image/')) {
        continue
      }
      return { body: await response.arrayBuffer(), contentType }
    } catch {
      continue
    }
  }

  return null
}
