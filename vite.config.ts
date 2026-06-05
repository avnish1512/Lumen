import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const OMDB_BASE_URL = 'https://www.omdbapi.com/'

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), omdbDevProxy(env.OMDB_API_KEY)],
  }
})
