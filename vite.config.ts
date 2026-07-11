import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import {
  fetchMovieGluTrailerClips,
  movieGluConfigFromEnv,
  type MovieGluConfig,
} from './api/_lib/movieglu-core'
import {
  fetchTmdbHomeRails,
  streamingAvailabilityConfigFromEnv,
  type StreamingAvailabilityConfig,
} from './api/_lib/tmdb-home-core'
import {
  createTmdbTrailerAuthChain,
  fallbackTrailerSearchClips,
  fetchTmdbTrailerClips,
  fetchTmdbTrailerYoutubeId,
  type TmdbAuth as TmdbTrailerAuth,
} from './api/_lib/tmdb-trailer-core'
import {
  bestCastCrewMembers,
  createTmdbWatchAuthChain,
  enrichCastCrewPortraits,
  fetchTmdbCastCrew,
  fetchWatchmodeCastCrew,
  fetchTmdbWatchProviders,
  normalizeWatchRegion,
  type TmdbAuth as TmdbWatchAuth,
  type WatchmodeConfig,
  watchmodeConfigFromEnv,
} from './api/_lib/tmdb-watch-core'
import {
  isSuperEmbedRedirectUrl,
  resolveSuperEmbedPlayerUrl,
  superEmbedOptionsFromParams,
} from './api/_lib/superembed-core'
import { fetchAnikotoRecent, fetchAnikotoSeries } from './api/_lib/anikoto-core'
import { fetchDramaRails, fetchKoreanChineseDramas } from './api/_lib/tmdb-drama-core'
import { fetchKinocheckTrailer } from './api/_lib/kinocheck-core'
import { fetchTmdbSeasonEpisodes } from './api/_lib/tmdb-episodes-core'
import {
  fetchAccountProfiles,
  saveAccountProfiles,
  supabaseConfigFromEnv,
  type StoredProfile,
} from './api/_lib/supabase-core'
import { fetchPosterImage, posterKeysFromEnv } from './api/_lib/poster-core'

const OMDB_BASE_URL = 'https://www.omdbapi.com/'
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

let preferredOmdbKeyIndex = 0

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function sendText(res: ServerResponse, statusCode: number, body: string) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'text/plain')
  res.end(body)
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

function isOmdbLimitError(status: number, body: OmdbApiBody) {
  const message = body.Error?.toLowerCase() ?? ''

  return (
    status === 429 ||
    message.includes('limit') ||
    message.includes('quota') ||
    message.includes('too many')
  )
}

function orderedOmdbApiKeys(keys: OmdbApiKey[]) {
  const startIndex = Math.min(preferredOmdbKeyIndex, keys.length - 1)
  return keys.slice(startIndex).concat(keys.slice(0, startIndex))
}

async function requestOmdb(apiKey: OmdbApiKey, params: Record<string, string>) {
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

async function fetchOmdbRaw(apiKeys: OmdbApiKey[], params: Record<string, string>) {
  if (apiKeys.length === 0) {
    return {
      status: 500,
      body: {
        Response: 'False',
        Error:
          'OMDB_API_KEY, OMDB_SECONDARY_API_KEY, or OMDB_API_KEYS is missing in .env.local.',
      },
    }
  }

  for (const apiKey of orderedOmdbApiKeys(apiKeys)) {
    const result = await requestOmdb(apiKey, params)

    if (isOmdbLimitError(result.status, result.body) && apiKeys.length > 1) {
      const currentIndex = apiKeys.findIndex((key) => key.name === apiKey.name)
      preferredOmdbKeyIndex = (currentIndex + 1) % apiKeys.length

      continue
    }

    return result
  }

  return requestOmdb(apiKeys[apiKeys.length - 1], params)
}

type CachedOmdb = {
  status: number
  body: OmdbApiBody
  expiresAt: number
}

const omdbCache: Record<string, CachedOmdb> = {}
const OMDB_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

async function fetchOmdb(apiKeys: OmdbApiKey[], params: Record<string, string>) {
  const cacheKey = JSON.stringify(params)
  const now = Date.now()

  if (omdbCache[cacheKey] && omdbCache[cacheKey].expiresAt > now) {
    return omdbCache[cacheKey]
  }

  const result = await fetchOmdbRaw(apiKeys, params)

  if (result.status === 200 && result.body.Response !== 'False') {
    omdbCache[cacheKey] = {
      status: result.status,
      body: result.body,
      expiresAt: Date.now() + OMDB_CACHE_TTL,
    }
  }

  return result
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
    body,
    status: response.ok ? 200 : response.status,
  }
}

async function fetchTmdbByImdbId(
  authChain: TmdbAuth[],
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

  if (authChain.length === 0) {
    return {
      status: 500,
      body: {
        Response: 'False',
        Error:
          'TMDB_API_READ_ACCESS_TOKEN or TMDB_API_KEY is missing in .env.local.',
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

function omdbDevProxy(apiKeys: OmdbApiKey[]): Plugin {
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
                const result = await fetchOmdb(apiKeys, {
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
            const result = await fetchOmdb(apiKeys, {
              i: id,
              plot: 'full',
            })
            sendJson(res, result.status, result.body)
            return
          }

          if (query) {
            const result = await fetchOmdb(apiKeys, {
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

function tmdbDevProxy(authChain: TmdbAuth[]): Plugin {
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
          const result = await fetchTmdbByImdbId(authChain, imdbId)
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

function movieGluDevProxy(
  config: MovieGluConfig,
  tmdbAuthChain: TmdbTrailerAuth[],
): Plugin {
  return {
    name: 'movieglu-dev-proxy',
    configureServer(server) {
      server.middlewares.use(
        '/api/movieglu-trailers',
        async (req: IncomingMessage, res) => {
          if (req.method !== 'GET') {
            sendJson(res, 405, {
              Response: 'False',
              Error: 'Method not allowed.',
            })
            return
          }

          const requestUrl = new URL(req.url ?? '/', 'http://localhost')
          const imdbId = requestUrl.searchParams.get('imdbId')
          const title = requestUrl.searchParams.get('title')

          if (!imdbId || !title) {
            sendJson(res, 400, {
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
              trailers = await fetchMovieGluTrailerClips(config, movie)
            } catch {
              trailers = []
            }

            if (trailers.length === 0) {
              try {
                trailers = await fetchTmdbTrailerClips(tmdbAuthChain, movie)
              } catch {
                trailers = fallbackTrailerSearchClips(movie)
              }
            }

            if (trailers.length === 0) {
              trailers = fallbackTrailerSearchClips(movie)
            }

            sendJson(res, 200, {
              Response: 'True',
              trailers,
            })
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : 'Could not reach MovieGlu.'

            sendJson(res, 502, {
              Response: 'False',
              Error: message,
            })
          }
        },
      )
    },
  }
}

function tmdbWatchProvidersDevProxy(
  authChain: TmdbWatchAuth[],
  defaultRegion: string,
  watchmode: WatchmodeConfig | null,
): Plugin {
  return {
    name: 'tmdb-watch-providers-dev-proxy',
    configureServer(server) {
      server.middlewares.use(
        '/api/tmdb-watch-providers',
        async (req: IncomingMessage, res) => {
          if (req.method !== 'GET') {
            sendJson(res, 405, {
              Response: 'False',
              Error: 'Method not allowed.',
            })
            return
          }

          const requestUrl = new URL(req.url ?? '/', 'http://localhost')
          const imdbId = requestUrl.searchParams.get('imdbId') ?? undefined
          const tmdbId = Number(requestUrl.searchParams.get('tmdbId') ?? 0)
          const mediaType =
            requestUrl.searchParams.get('mediaType') ?? undefined
          const region = normalizeWatchRegion(
            requestUrl.searchParams.get('region') ?? defaultRegion,
          )

          if (
            !imdbId &&
            (!tmdbId || (mediaType !== 'movie' && mediaType !== 'tv'))
          ) {
            sendJson(res, 400, {
              Response: 'False',
              Error: 'Provide imdbId or tmdbId with mediaType.',
            })
            return
          }

          try {
            const availability = await fetchTmdbWatchProviders(authChain, {
              imdbId,
              mediaType:
                mediaType === 'movie' || mediaType === 'tv'
                  ? mediaType
                  : undefined,
              region,
              tmdbId: tmdbId || undefined,
              watchmode,
            })

            sendJson(res, 200, {
              Response: 'True',
              ...availability,
            })
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Could not reach TMDB.'

            sendJson(res, 502, {
              Response: 'False',
              Error: message,
              link: '',
              providers: [],
              region,
            })
          }
        },
      )
    },
  }
}

function watchmodeCastCrewDevProxy(
  watchmode: WatchmodeConfig | null,
  authChain: TmdbWatchAuth[],
): Plugin {
  return {
    name: 'watchmode-cast-crew-dev-proxy',
    configureServer(server) {
      server.middlewares.use(
        '/api/watchmode-cast-crew',
        async (req: IncomingMessage, res) => {
          if (req.method !== 'GET') {
            sendJson(res, 405, {
              Response: 'False',
              Error: 'Method not allowed.',
              members: [],
            })
            return
          }

          const requestUrl = new URL(req.url ?? '/', 'http://localhost')
          const imdbId = requestUrl.searchParams.get('imdbId') ?? undefined
          const tmdbId = Number(requestUrl.searchParams.get('tmdbId') ?? 0)
          const mediaType =
            requestUrl.searchParams.get('mediaType') ?? undefined

          if (
            !imdbId &&
            (!tmdbId || (mediaType !== 'movie' && mediaType !== 'tv'))
          ) {
            sendJson(res, 400, {
              Response: 'False',
              Error: 'Provide imdbId or tmdbId with mediaType.',
              members: [],
            })
            return
          }

          try {
            const resolvedMediaType: 'movie' | 'tv' | undefined =
              mediaType === 'movie' || mediaType === 'tv'
                ? mediaType
                : undefined
            const options = {
              imdbId,
              mediaType: resolvedMediaType,
              tmdbId: tmdbId || undefined,
            }
            const [watchmodeMembers, tmdbMembers] = await Promise.all([
              watchmode
                ? fetchWatchmodeCastCrew(watchmode, options).catch(() => [])
                : Promise.resolve([]),
              fetchTmdbCastCrew(authChain, options).catch(() => []),
            ])
            const members = await enrichCastCrewPortraits(
              bestCastCrewMembers(watchmodeMembers, tmdbMembers),
            )

            sendJson(res, 200, {
              Response: 'True',
              members,
            })
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : 'Could not load cast and crew.'

            sendJson(res, 502, {
              Response: 'False',
              Error: message,
              members: [],
            })
          }
        },
      )
    },
  }
}

function tmdbHomeRailsDevProxy(
  authChain: TmdbWatchAuth[],
  defaultRegion: string,
  streamingAvailability: StreamingAvailabilityConfig | null,
): Plugin {
  return {
    name: 'tmdb-home-rails-dev-proxy',
    configureServer(server) {
      server.middlewares.use(
        '/api/tmdb-home-rails',
        async (req: IncomingMessage, res) => {
          if (req.method !== 'GET') {
            sendJson(res, 405, {
              Response: 'False',
              Error: 'Method not allowed.',
            })
            return
          }

          const requestUrl = new URL(req.url ?? '/', 'http://localhost')
          const region = normalizeWatchRegion(
            requestUrl.searchParams.get('region') ?? defaultRegion,
          )

          try {
            const rails = await fetchTmdbHomeRails(authChain, {
              region,
              streamingAvailability,
            })

            sendJson(res, 200, {
              Response: 'True',
              region,
              ...rails,
            })
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Could not reach TMDB.'

            sendJson(res, 502, {
              Response: 'False',
              Error: message,
              newReleases: [],
              region,
              trendingNow: [],
            })
          }
        },
      )
    },
  }
}

function superEmbedPlayerDevProxy(): Plugin {
  return {
    name: 'superembed-player-dev-proxy',
    configureServer(server) {
      server.middlewares.use(
        '/se_player.php',
        async (req: IncomingMessage, res) => {
          if (req.method !== 'GET') {
            sendText(res, 405, 'Method not allowed.')
            return
          }

          const requestUrl = new URL(req.url ?? '/', 'http://localhost')
          const options = superEmbedOptionsFromParams(requestUrl.searchParams)

          if (!options) {
            sendText(res, 400, 'Missing video_id')
            return
          }

          try {
            const playerUrl = await resolveSuperEmbedPlayerUrl(options)

            if (!isSuperEmbedRedirectUrl(playerUrl)) {
              sendText(res, 502, playerUrl || "Request server didn't respond")
              return
            }

            res.statusCode = 302
            res.setHeader('Location', playerUrl)
            res.setHeader('Content-Type', 'text/plain')
            res.end('Redirecting to player.')
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Request server didn't respond"

            sendText(res, 502, message)
          }
        },
      )
    },
  }
}

function tmdbEpisodesDevProxy(authChain: TmdbWatchAuth[]): Plugin {
  return {
    name: 'tmdb-episodes-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/tmdb-episodes', async (req: IncomingMessage, res) => {
        if (req.method && req.method !== 'GET') {
          sendJson(res, 405, { Response: 'False', Error: 'Method not allowed.', episodes: [] })
          return
        }

        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const tmdbId = Number(requestUrl.searchParams.get('tmdbId') ?? 0)
        const season = Number(requestUrl.searchParams.get('season') ?? 1)

        if (!tmdbId) {
          sendJson(res, 400, { Response: 'False', Error: 'Provide tmdbId.', episodes: [] })
          return
        }

        try {
          const episodes = await fetchTmdbSeasonEpisodes(authChain, tmdbId, season || 1)
          sendJson(res, 200, { Response: 'True', episodes })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Could not reach TMDB.'
          sendJson(res, 502, { Response: 'False', Error: message, episodes: [] })
        }
      })
    },
  }
}

function tmdbDramaDevProxy(authChain: TmdbWatchAuth[]): Plugin {
  return {
    name: 'tmdb-drama-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/tmdb-drama', async (req: IncomingMessage, res) => {
        if (req.method && req.method !== 'GET') {
          sendJson(res, 405, { Response: 'False', Error: 'Method not allowed.', results: [] })
          return
        }

        try {
          const [results, rails] = await Promise.all([
            fetchKoreanChineseDramas(authChain),
            fetchDramaRails(authChain),
          ])
          sendJson(res, 200, { Response: 'True', results, rails })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Could not reach TMDB.'
          sendJson(res, 502, { Response: 'False', Error: message, results: [] })
        }
      })
    },
  }
}

function kinocheckDevProxy(apiKey?: string): Plugin {
  return {
    name: 'kinocheck-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/kinocheck', async (req: IncomingMessage, res) => {
        if (req.method && req.method !== 'GET') {
          sendJson(res, 405, { youtubeId: null, error: 'Method not allowed.' })
          return
        }

        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const type = requestUrl.searchParams.get('type') === 'tv' ? 'tv' : 'movie'

        try {
          const trailer = await fetchKinocheckTrailer(
            {
              tmdbId: requestUrl.searchParams.get('tmdbId') ?? undefined,
              imdbId: requestUrl.searchParams.get('imdbId') ?? undefined,
              type,
            },
            apiKey,
          )
          sendJson(res, 200, trailer ?? { youtubeId: null })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Could not reach KinoCheck.'
          sendJson(res, 502, { youtubeId: null, error: message })
        }
      })
    },
  }
}

function tmdbTrailerDevProxy(authChain: TmdbTrailerAuth[]): Plugin {
  return {
    name: 'tmdb-trailer-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/tmdb-trailer', async (req: IncomingMessage, res) => {
        if (req.method && req.method !== 'GET') {
          sendJson(res, 405, { youtubeId: null, error: 'Method not allowed.' })
          return
        }

        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const tmdbIdRaw = requestUrl.searchParams.get('tmdbId')
        const imdbId = requestUrl.searchParams.get('imdbId')
        const type = requestUrl.searchParams.get('type') === 'tv' ? 'tv' : 'movie'

        try {
          const youtubeId = await fetchTmdbTrailerYoutubeId(authChain, {
            tmdbId: tmdbIdRaw ? Number(tmdbIdRaw) : undefined,
            imdbId: imdbId ?? undefined,
            type,
          })
          sendJson(res, 200, { youtubeId })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Could not reach TMDB.'
          sendJson(res, 502, { youtubeId: null, error: message })
        }
      })
    },
  }
}

function posterDevProxy(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'poster-dev-proxy',
    configureServer(server) {
      const keys = posterKeysFromEnv(env)
      server.middlewares.use('/api/poster', async (req: IncomingMessage, res) => {
        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const kind = requestUrl.searchParams.get('kind') === 'thumbnail' ? 'thumbnail' : 'poster'

        const image = await fetchPosterImage(keys, {
          imdbId: requestUrl.searchParams.get('imdb') ?? undefined,
          tmdbId: requestUrl.searchParams.get('tmdb') ?? undefined,
          kind,
        })

        if (!image) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Poster unavailable.' }))
          return
        }

        res.statusCode = 200
        res.setHeader('Content-Type', image.contentType)
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        res.end(Buffer.from(image.body))
      })
    },
  }
}

function profilesDevProxy(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'profiles-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/profiles', async (req: IncomingMessage, res) => {
        const config = supabaseConfigFromEnv(env)

        if (!config) {
          sendJson(res, 200, { ok: false, configured: false, profiles: null })
          return
        }

        try {
          if (req.method === 'GET') {
            const requestUrl = new URL(req.url ?? '/', 'http://localhost')
            const email = (requestUrl.searchParams.get('email') ?? '').trim().toLowerCase()
            if (!email) {
              sendJson(res, 400, { ok: false, error: 'email is required.', profiles: null })
              return
            }
            const profiles = await fetchAccountProfiles(config, email)
            sendJson(res, 200, { ok: true, configured: true, profiles })
            return
          }

          if (req.method === 'POST' || req.method === 'PUT') {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk as Buffer)
            }
            const raw = Buffer.concat(chunks).toString('utf8')
            const body = raw ? (JSON.parse(raw) as { email?: string; profiles?: StoredProfile[] }) : {}
            const email = String(body.email ?? '').trim().toLowerCase()
            const profiles = body.profiles

            if (!email || !Array.isArray(profiles)) {
              sendJson(res, 400, { ok: false, error: 'email and profiles[] are required.' })
              return
            }

            await saveAccountProfiles(config, email, profiles)
            sendJson(res, 200, { ok: true, configured: true })
            return
          }

          sendJson(res, 405, { ok: false, error: 'Method not allowed.' })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Supabase request failed.'
          sendJson(res, 502, { ok: false, error: message })
        }
      })
    },
  }
}

function anikotoDevProxy(): Plugin {
  return {
    name: 'anikoto-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/anikoto', async (req: IncomingMessage, res) => {
        if (req.method && req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'Method not allowed.' })
          return
        }

        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const action = requestUrl.searchParams.get('action') ?? 'recent'

        try {
          if (action === 'series') {
            const id = requestUrl.searchParams.get('id')

            if (!id) {
              sendJson(res, 400, { ok: false, error: 'Provide id for a series lookup.' })
              return
            }

            const body = await fetchAnikotoSeries(id)
            sendJson(res, 200, body)
            return
          }

          const body = await fetchAnikotoRecent(
            requestUrl.searchParams.get('page') ?? undefined,
            requestUrl.searchParams.get('per_page') ?? undefined,
          )
          sendJson(res, 200, body)
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Could not reach Anikoto.'
          sendJson(res, 502, { ok: false, error: message })
        }
      })
    },
  }
}

function createTmdbAuthChain(env: Record<string, string>) {
  const auths: TmdbAuth[] = [
    {
      name: 'primary',
      apiKey: env.TMDB_API_KEY,
      readAccessToken: env.TMDB_API_READ_ACCESS_TOKEN,
    },
    {
      name: 'secondary',
      apiKey: env.TMDB_SECONDARY_API_KEY,
      readAccessToken: env.TMDB_SECONDARY_API_READ_ACCESS_TOKEN,
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

function parseOmdbApiKeyList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
}

function createOmdbApiKeys(env: Record<string, string>) {
  const apiKeys: OmdbApiKey[] = [
    { name: 'primary', value: env.OMDB_API_KEY },
    { name: 'secondary', value: env.OMDB_SECONDARY_API_KEY },
    ...parseOmdbApiKeyList(env.OMDB_API_KEYS).map((value, index) => ({
      name: `list-${index + 1}`,
      value,
    })),
  ]
  const seen = new Set<string>()

  return apiKeys.filter((apiKey) => {
    if (!apiKey.value) {
      return false
    }

    if (seen.has(apiKey.value)) {
      return false
    }

    seen.add(apiKey.value)
    return true
  })
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      omdbDevProxy(createOmdbApiKeys(env)),
      tmdbDevProxy(createTmdbAuthChain(env)),
      tmdbWatchProvidersDevProxy(
        createTmdbWatchAuthChain(env),
        env.TMDB_WATCH_REGION,
        watchmodeConfigFromEnv(env),
      ),
      watchmodeCastCrewDevProxy(
        watchmodeConfigFromEnv(env),
        createTmdbWatchAuthChain(env),
      ),
      tmdbHomeRailsDevProxy(
        createTmdbWatchAuthChain(env),
        env.TMDB_WATCH_REGION,
        streamingAvailabilityConfigFromEnv(env),
      ),
      superEmbedPlayerDevProxy(),
      anikotoDevProxy(),
      kinocheckDevProxy(env.KINOCHECK_API_KEY),
      tmdbTrailerDevProxy(createTmdbTrailerAuthChain(env)),
      profilesDevProxy(env),
      posterDevProxy(env),
      tmdbDramaDevProxy(createTmdbWatchAuthChain(env)),
      tmdbEpisodesDevProxy(createTmdbWatchAuthChain(env)),
      movieGluDevProxy(
        movieGluConfigFromEnv(env),
        createTmdbTrailerAuthChain(env),
      ),
    ],
  }
})
