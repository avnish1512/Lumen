import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const OMDB_BASE_URL = 'https://www.omdbapi.com/'
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function fetchOmdb(apiKey: string | undefined, params: Record<string, string>) {
  if (!apiKey) {
    return {
      status: 500,
      body: {
        Response: 'False',
        Error: 'OMDB_API_KEY is missing in .env.local.',
      },
    }
  }

  const url = new URL(OMDB_BASE_URL)
  url.searchParams.set('apikey', apiKey)

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })

  const response = await fetch(url)
  const body = await response.json()

  return {
    status: response.ok ? 200 : response.status,
    body,
  }
}

type TmdbFindResult = {
  id: number
  title?: string
  name?: string
}

type TmdbFindResponse = {
  movie_results?: TmdbFindResult[]
  tv_results?: TmdbFindResult[]
}

type TmdbAuth = {
  apiKey?: string
  readAccessToken?: string
}

const fallbackTmdbMatches: Record<
  string,
  { tmdbId: number; mediaType: 'movie' | 'tv'; title: string }
> = {
  tt1375666: { tmdbId: 27205, mediaType: 'movie', title: 'Inception' },
  tt0816692: { tmdbId: 157336, mediaType: 'movie', title: 'Interstellar' },
  tt0111161: {
    tmdbId: 278,
    mediaType: 'movie',
    title: 'The Shawshank Redemption',
  },
  tt0468569: { tmdbId: 155, mediaType: 'movie', title: 'The Dark Knight' },
  tt0133093: { tmdbId: 603, mediaType: 'movie', title: 'The Matrix' },
  tt0109830: { tmdbId: 13, mediaType: 'movie', title: 'Forrest Gump' },
  tt0110912: { tmdbId: 680, mediaType: 'movie', title: 'Pulp Fiction' },
  tt4154796: {
    tmdbId: 299534,
    mediaType: 'movie',
    title: 'Avengers: Endgame',
  },
  tt1745960: { tmdbId: 361743, mediaType: 'movie', title: 'Top Gun: Maverick' },
  tt0068646: { tmdbId: 238, mediaType: 'movie', title: 'The Godfather' },
}

function hasTmdbAuth(auth: TmdbAuth) {
  return Boolean(auth.apiKey || auth.readAccessToken)
}

function applyTmdbAuth(url: URL, auth: TmdbAuth) {
  if (auth.readAccessToken) {
    return {
      headers: {
        Authorization: `Bearer ${auth.readAccessToken}`,
      },
    }
  }

  if (auth.apiKey) {
    url.searchParams.set('api_key', auth.apiKey)
  }

  return undefined
}

async function fetchTmdbByImdbId(
  auth: TmdbAuth,
  imdbId: string,
) {
  const fallbackMatch = fallbackTmdbMatches[imdbId]

  if (fallbackMatch) {
    return {
      status: 200,
      body: {
        Response: 'True',
        ...fallbackMatch,
      },
    }
  }

  if (!hasTmdbAuth(auth)) {
    return {
      status: 500,
      body: {
        Response: 'False',
        Error:
          'TMDB_API_READ_ACCESS_TOKEN or TMDB_API_KEY is missing in .env.local.',
      },
    }
  }

  const url = new URL(`${TMDB_BASE_URL}/find/${encodeURIComponent(imdbId)}`)
  url.searchParams.set('external_source', 'imdb_id')

  const response = await fetch(url, applyTmdbAuth(url, auth))
  const body = (await response.json()) as TmdbFindResponse
  const movie = body.movie_results?.[0]
  const tv = body.tv_results?.[0]

  if (!response.ok) {
    return {
      status: response.status,
      body,
    }
  }

  if (movie) {
    return {
      status: 200,
      body: {
        Response: 'True',
        tmdbId: movie.id,
        mediaType: 'movie',
        title: movie.title,
      },
    }
  }

  if (tv) {
    return {
      status: 200,
      body: {
        Response: 'True',
        tmdbId: tv.id,
        mediaType: 'tv',
        title: tv.name,
      },
    }
  }

  return {
    status: 404,
    body: {
      Response: 'False',
      Error: 'No TMDB match found for this IMDb id.',
    },
  }
}

function omdbDevProxy(apiKey: string | undefined): Plugin {
  return {
    name: 'omdb-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/omdb', async (req: IncomingMessage, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { Response: 'False', Error: 'Method not allowed.' })
          return
        }

        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const id = requestUrl.searchParams.get('id')
        const ids = requestUrl.searchParams.get('ids')
        const query =
          requestUrl.searchParams.get('q') ?? requestUrl.searchParams.get('query')
        const page = requestUrl.searchParams.get('page') ?? '1'

        try {
          if (ids) {
            const requestedIds = ids
              .split(',')
              .map((movieId) => movieId.trim())
              .filter(Boolean)
              .slice(0, 12)

            const results = await Promise.all(
              requestedIds.map(async (movieId) => {
                const result = await fetchOmdb(apiKey, {
                  i: movieId,
                  plot: 'full',
                })
                return result
              }),
            )

            const serverError = results.find((result) => result.status >= 500)

            if (serverError) {
              sendJson(res, serverError.status, serverError.body)
              return
            }

            sendJson(res, 200, {
              Response: 'True',
              results: results.map((result) => result.body),
            })
            return
          }

          if (id) {
            const result = await fetchOmdb(apiKey, {
              i: id,
              plot: 'full',
            })
            sendJson(res, result.status, result.body)
            return
          }

          if (query) {
            const result = await fetchOmdb(apiKey, {
              s: query,
              type: 'movie',
              page,
            })
            sendJson(res, result.status, result.body)
            return
          }

          sendJson(res, 400, {
            Response: 'False',
            Error: 'Provide id, ids, or q.',
          })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Could not reach OMDb.'

          sendJson(res, 502, {
            Response: 'False',
            Error: message,
          })
        }
      })
    },
  }
}

function tmdbDevProxy(auth: TmdbAuth): Plugin {
  return {
    name: 'tmdb-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/tmdb', async (req: IncomingMessage, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { Response: 'False', Error: 'Method not allowed.' })
          return
        }

        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const imdbId = requestUrl.searchParams.get('imdbId')

        if (!imdbId) {
          sendJson(res, 400, {
            Response: 'False',
            Error: 'Provide imdbId.',
          })
          return
        }

        try {
          const result = await fetchTmdbByImdbId(auth, imdbId)
          sendJson(res, result.status, result.body)
        } catch (error) {
          const fallbackMatch = fallbackTmdbMatches[imdbId]

          if (fallbackMatch) {
            sendJson(res, 200, {
              Response: 'True',
              ...fallbackMatch,
            })
            return
          }

          const message =
            error instanceof Error ? error.message : 'Could not reach TMDB.'

          sendJson(res, 502, {
            Response: 'False',
            Error: message,
          })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      omdbDevProxy(env.OMDB_API_KEY),
      tmdbDevProxy({
        apiKey: env.TMDB_API_KEY,
        readAccessToken: env.TMDB_API_READ_ACCESS_TOKEN,
      }),
    ],
  }
})
