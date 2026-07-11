const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

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

type TmdbFindResult = {
  id: number
  title?: string
  name?: string
}

type TmdbFindResponse = {
  movie_results?: TmdbFindResult[]
  tv_results?: TmdbFindResult[]
  status_code?: number
  status_message?: string
  Error?: string
}

type TmdbAuth = {
  apiKey?: string
  name: string
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
  tt0944947: { tmdbId: 1399, mediaType: 'tv', title: 'Game of Thrones' },
  tt0903747: { tmdbId: 1396, mediaType: 'tv', title: 'Breaking Bad' },
  tt4574334: { tmdbId: 66732, mediaType: 'tv', title: 'Stranger Things' },
  tt1475582: { tmdbId: 19885, mediaType: 'tv', title: 'Sherlock' },
  tt0108778: { tmdbId: 1668, mediaType: 'tv', title: 'Friends' },
  tt7366338: { tmdbId: 87108, mediaType: 'tv', title: 'Chernobyl' },
  tt3032476: { tmdbId: 60059, mediaType: 'tv', title: 'Better Call Saul' },
  tt1520211: { tmdbId: 1402, mediaType: 'tv', title: 'The Walking Dead' },
  tt2861424: { tmdbId: 60625, mediaType: 'tv', title: 'Rick and Morty' },
  tt0413573: { tmdbId: 1416, mediaType: 'tv', title: "Grey's Anatomy" },
}

function getQueryValue(value: QueryValue) {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

function hasTmdbAuth(auth: TmdbAuth) {
  return Boolean(auth.apiKey || auth.readAccessToken)
}

function buildTmdbFindUrl(imdbId: string) {
  const url = new URL(`${TMDB_BASE_URL}/find/${encodeURIComponent(imdbId)}`)
  url.searchParams.set('external_source', 'imdb_id')
  return url
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

function getTmdbAuthChain() {
  const auths: TmdbAuth[] = [
    {
      name: 'primary',
      apiKey: process.env.TMDB_API_KEY,
      readAccessToken: process.env.TMDB_API_READ_ACCESS_TOKEN,
    },
    {
      name: 'secondary',
      apiKey: process.env.TMDB_SECONDARY_API_KEY,
      readAccessToken: process.env.TMDB_SECONDARY_API_READ_ACCESS_TOKEN,
    },
  ]

  const seen = new Set<string>()

  return auths.filter((auth) => {
    if (!hasTmdbAuth(auth)) {
      return false
    }

    const key = `${auth.readAccessToken ?? ''}:${auth.apiKey ?? ''}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function isTmdbRateLimited(status: number, body: TmdbFindResponse) {
  const message = `${body.status_message ?? ''} ${body.Error ?? ''}`.toLowerCase()

  return (
    status === 429 ||
    body.status_code === 25 ||
    message.includes('request limit') ||
    message.includes('rate limit')
  )
}

async function requestTmdbFind(auth: TmdbAuth, imdbId: string) {
  const url = buildTmdbFindUrl(imdbId)
  const response = await fetch(url, applyTmdbAuth(url, auth))
  const body = (await response.json()) as TmdbFindResponse

  return {
    authName: auth.name,
    body,
    status: response.ok ? 200 : response.status,
  }
}

async function fetchTmdbByImdbId(imdbId: string) {
  const authChain = getTmdbAuthChain()
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

  if (authChain.length === 0) {
    return {
      status: 500,
      body: {
        Response: 'False',
        Error:
          'TMDB_API_READ_ACCESS_TOKEN or TMDB_API_KEY is not configured on the server.',
      },
    }
  }

  let result = await requestTmdbFind(authChain[0], imdbId)

  if (
    authChain[1] &&
    authChain[0].name === 'primary' &&
    isTmdbRateLimited(result.status, result.body)
  ) {
    result = await requestTmdbFind(authChain[1], imdbId)
  }

  const movie = result.body.movie_results?.[0]
  const tv = result.body.tv_results?.[0]

  if (result.status !== 200) {
    return {
      status: result.status,
      body: result.body,
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

async function fetchTmdbByTitle(title: string, preferredType?: 'movie' | 'tv') {
  const authChain = getTmdbAuthChain()

  if (authChain.length === 0) {
    return {
      status: 500,
      body: {
        Response: 'False',
        Error: 'TMDB_API_READ_ACCESS_TOKEN or TMDB_API_KEY is not configured on the server.',
      },
    }
  }

  const searchTv = async () => {
    const url = new URL(`${TMDB_BASE_URL}/search/tv`)
    url.searchParams.set('query', title)
    const response = await fetch(url, applyTmdbAuth(url, authChain[0]))
    const body = (await response.json()) as any
    const tv = body.results?.[0]

    return tv
      ? { Response: 'True', tmdbId: tv.id, mediaType: 'tv', title: tv.name }
      : null
  }

  const searchMovie = async () => {
    const url = new URL(`${TMDB_BASE_URL}/search/movie`)
    url.searchParams.set('query', title)
    const response = await fetch(url, applyTmdbAuth(url, authChain[0]))
    const body = (await response.json()) as any
    const movie = body.results?.[0]

    return movie
      ? { Response: 'True', tmdbId: movie.id, mediaType: 'movie', title: movie.title }
      : null
  }

  // Search the preferred media type first (e.g. anime films -> movie search)
  // so we do not mis-match an anime movie to a similarly named TV series.
  const order = preferredType === 'movie' ? [searchMovie, searchTv] : [searchTv, searchMovie]

  try {
    for (const search of order) {
      const match = await search()

      if (match) {
        return { status: 200, body: match }
      }
    }

    return {
      status: 404,
      body: {
        Response: 'False',
        Error: 'No TMDB match found for this title.',
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not query TMDB by title.'
    return {
      status: 502,
      body: {
        Response: 'False',
        Error: message,
      },
    }
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ Response: 'False', Error: 'Method not allowed.' })
    return
  }

  const action = getQueryValue(req.query.action)

  if (action === 'dramovnime') {
    let id = getQueryValue(req.query.id)
    const title = getQueryValue(req.query.title)
    const se = getQueryValue(req.query.se)
    const ep = getQueryValue(req.query.ep)
    const quality = getQueryValue(req.query.quality)
    const lang = getQueryValue(req.query.lang)

    const apiKey = process.env.RAPIDAPI_KEY
    if (!apiKey) {
      res.status(500).json({ error: 'RAPIDAPI_KEY not configured' })
      return
    }

    let detailPath = ''

    // Resolve the internal Dramovnime subject ID by searching via Filmbox
    if (title) {
      try {
        const searchResponse = await fetch(
          'https://multilang-movie-drama-database-api.p.rapidapi.com/filmbox/search',
          {
            method: 'POST',
            headers: {
              'x-rapidapi-key': apiKey,
              'x-rapidapi-host': 'multilang-movie-drama-database-api.p.rapidapi.com',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              keyword: title,
              page: '1',
              perPage: '5',
              subjectType: '2',
            }),
          },
        )

        if (searchResponse.ok) {
          const searchData = await searchResponse.json()
          const firstResult = searchData?.data?.[0]
          if (firstResult) {
            id = firstResult.id || firstResult.subjectId || id
            detailPath = firstResult.detailPath || ''
          }
        }
      } catch (err) {
        console.error('Filmbox search failed, using fallback:', err)
      }
    }

    const params = new URLSearchParams()
    if (id) params.set('id', id)
    if (se) params.set('se', se)
    if (ep) params.set('ep', ep)
    params.set('quality', quality || '1080')
    params.set('lang', lang || 'en')
    if (detailPath) params.set('detailPath', detailPath)

    try {
      const response = await fetch(
        `https://multilang-movie-drama-database-api.p.rapidapi.com/dramovnime/getplay?${params}`,
        {
          method: 'GET',
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'multilang-movie-drama-database-api.p.rapidapi.com',
            'Content-Type': 'application/json',
          },
        },
      )
      const data = await response.json()
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
      res.status(response.status).json(data)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch from Dramovnime API'
      res.status(502).json({ error: message })
    }
    return
  }

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')

  const imdbId = getQueryValue(req.query.imdbId)
  const title = getQueryValue(req.query.title)

  if (!imdbId && !title) {
    res.status(400).json({
      Response: 'False',
      Error: 'Provide imdbId or title.',
    })
    return
  }

  if (title) {
    const typeHint = getQueryValue(req.query.type)
    const preferredType =
      typeHint === 'movie' || typeHint === 'tv' ? typeHint : undefined
    const result = await fetchTmdbByTitle(title, preferredType)
    res.status(result.status).json(result.body)
    return
  }

  try {
    const result = await fetchTmdbByImdbId(imdbId!)
    res.status(result.status).json(result.body)
  } catch (error) {
    const fallbackMatch = fallbackTmdbMatches[imdbId!]

    if (fallbackMatch) {
      res.status(200).json({
        Response: 'True',
        ...fallbackMatch,
      })
      return
    }

    const message =
      error instanceof Error ? error.message : 'Could not reach TMDB.'

    res.status(502).json({
      Response: 'False',
      Error: message,
    })
  }
}

