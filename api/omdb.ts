const OMDB_BASE_URL = 'https://www.omdbapi.com/'

let preferredOmdbKeyIndex = 0

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

type OmdbApiKey = {
  name: string
  value: string
}

type OmdbApiBody = {
  Response?: string
  Error?: string
  [key: string]: unknown
}

function getQueryValue(value: QueryValue) {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

function parseOmdbApiKeyList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
}

function getOmdbApiKeys(): OmdbApiKey[] {
  const apiKeys = [
    { name: 'OMDB_API_KEY', value: process.env.OMDB_API_KEY ?? '' },
    {
      name: 'OMDB_SECONDARY_API_KEY',
      value: process.env.OMDB_SECONDARY_API_KEY ?? '',
    },
    ...parseOmdbApiKeyList(process.env.OMDB_API_KEYS).map((value, index) => ({
      name: `OMDB_API_KEYS_${index + 1}`,
      value,
    })),
  ]
  const seen = new Set<string>()

  return apiKeys.filter((apiKey) => {
    if (!apiKey.value.trim() || seen.has(apiKey.value)) {
      return false
    }

    seen.add(apiKey.value)
    return true
  })
}

function isOmdbLimitError(status: number, body: OmdbApiBody) {
  const message = body.Error?.toLowerCase() ?? ''
  return (
    status === 429 ||
    message.includes('limit') ||
    message.includes('quota') ||
    message.includes('too many')
  )
}

function orderedApiKeys(keys: OmdbApiKey[]) {
  const startIndex = Math.min(preferredOmdbKeyIndex, keys.length - 1)
  return keys.slice(startIndex).concat(keys.slice(0, startIndex))
}

async function fetchOmdbWithKey(params: Record<string, string>, apiKey: OmdbApiKey) {
  const url = new URL(OMDB_BASE_URL)
  url.searchParams.set('apikey', apiKey.value)

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })

  const response = await fetch(url)
  const body = (await response.json()) as OmdbApiBody

  return {
    status: response.ok ? 200 : response.status,
    body,
  }
}

async function fetchOmdbRaw(params: Record<string, string>) {
  const apiKeys = getOmdbApiKeys()

  if (apiKeys.length === 0) {
    return {
      status: 500,
      body: {
        Response: 'False',
        Error:
          'OMDB_API_KEY, OMDB_SECONDARY_API_KEY, or OMDB_API_KEYS is not configured on the server.',
      },
    }
  }

  for (const apiKey of orderedApiKeys(apiKeys)) {
    const result = await fetchOmdbWithKey(params, apiKey)

    if (isOmdbLimitError(result.status, result.body) && apiKeys.length > 1) {
      const currentIndex = apiKeys.findIndex((key) => key.name === apiKey.name)
      preferredOmdbKeyIndex = (currentIndex + 1) % apiKeys.length

      continue
    }

    return result
  }

  return fetchOmdbWithKey(params, apiKeys[apiKeys.length - 1])
}

type CachedOmdb = {
  status: number
  body: OmdbApiBody
  expiresAt: number
}

const omdbCache: Record<string, CachedOmdb> = {}
const OMDB_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

async function fetchOmdb(params: Record<string, string>) {
  const cacheKey = JSON.stringify(params)
  const now = Date.now()

  if (omdbCache[cacheKey] && omdbCache[cacheKey].expiresAt > now) {
    return omdbCache[cacheKey]
  }

  const result = await fetchOmdbRaw(params)

  if (result.status === 200 && result.body.Response !== 'False') {
    omdbCache[cacheKey] = {
      status: result.status,
      body: result.body,
      expiresAt: Date.now() + OMDB_CACHE_TTL,
    }
  }

  return result
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
