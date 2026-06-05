const OMDB_BASE_URL = 'https://www.omdbapi.com/'

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

async function fetchOmdb(params: Record<string, string>) {
  const apiKey = process.env.OMDB_API_KEY

  if (!apiKey) {
    return {
      status: 500,
      body: {
        Response: 'False',
        Error: 'OMDB_API_KEY is not configured on the server.',
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')

  if (req.method && req.method !== 'GET') {
    res.status(405).json({ Response: 'False', Error: 'Method not allowed.' })
    return
  }

  const id = getQueryValue(req.query.id)
  const ids = getQueryValue(req.query.ids)
  const query = getQueryValue(req.query.q) ?? getQueryValue(req.query.query)
  const page = getQueryValue(req.query.page) ?? '1'

  try {
    if (ids) {
      const requestedIds = ids
        .split(',')
        .map((movieId) => movieId.trim())
        .filter(Boolean)
        .slice(0, 12)

      const results = await Promise.all(
        requestedIds.map(async (movieId) => {
          const result = await fetchOmdb({
            i: movieId,
            plot: 'full',
          })
          return result
        }),
      )

      const serverError = results.find((result) => result.status >= 500)

      if (serverError) {
        res.status(serverError.status).json(serverError.body)
        return
      }

      res.status(200).json({
        Response: 'True',
        results: results.map((result) => result.body),
      })
      return
    }

    if (id) {
      const result = await fetchOmdb({
        i: id,
        plot: 'full',
      })
      res.status(result.status).json(result.body)
      return
    }

    if (query) {
      const result = await fetchOmdb({
        s: query,
        type: 'movie',
        page,
      })
      res.status(result.status).json(result.body)
      return
    }

    res.status(400).json({
      Response: 'False',
      Error: 'Provide id, ids, or q.',
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not reach OMDb.'

    res.status(502).json({
      Response: 'False',
      Error: message,
    })
  }
}
