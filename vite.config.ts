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
import { fetchDramaRails, fetchKoreanChineseDramas, fetchMatureCollection, searchTmdbTitles } from './api/_lib/tmdb-drama-core'
import { fetchKinocheckTrailer } from './api/_lib/kinocheck-core'
import { fetchTmdbSeasonEpisodes, fetchTmdbTvSeasons } from './api/_lib/tmdb-episodes-core'
import {
  fetchAccountProfiles,
  saveAccountProfiles,
  fetchWatchHistory,
  saveWatchHistory,
  updateMovieProgress,
  supabaseConfigFromEnv,
  type StoredProfile,
} from './api/_lib/supabase-core'
import { fetchPosterImage, posterKeysFromEnv } from './api/_lib/poster-core'
import {
  fetchMangaChapter,
  fetchMangaDetail,
  fetchMangaList,
  searchMangaList,
  configureMangadexAuth,
} from './api/_lib/mangahook-core'
import {
  fetchLiveImage,
  fetchLiveMatches,
  fetchLiveSports,
  fetchLiveStreams,
} from './api/_lib/livetv-core'

import {
  createInvite,
  getParty,
  incomingInvites,
  listAccountEmails,
  updateParty,
} from './api/_lib/watch-party-core'
import {
  adminEmailFromEnv,
  deleteAccount,
  listAccounts,
  resolveAdminPassword,
  revealPassword,
  saveAccount,
  setAdminPassword,
  verifyAccount,
} from './api/_lib/accounts-core'
import {
  fetchDevices,
  registerDevice,
  removeDevice,
  removeOtherDevices,
  type DeviceRecord,
} from './api/_lib/devices-core'

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
        const action = requestUrl.searchParams.get('action')

        if (!tmdbId) {
          sendJson(res, 400, { Response: 'False', Error: 'Provide tmdbId.', episodes: [] })
          return
        }

        try {
          if (action === 'seasons') {
            const seasons = await fetchTmdbTvSeasons(authChain, tmdbId)
            sendJson(res, 200, { Response: 'True', seasons })
            return
          }

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

        const requestUrl = new URL(req.url ?? '/', 'http://localhost')

        if (requestUrl.searchParams.get('action') === 'search') {
          const query = requestUrl.searchParams.get('query') ?? ''
          try {
            const results = await searchTmdbTitles(authChain, query)
            sendJson(res, 200, { Response: 'True', results })
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Could not reach TMDB.'
            sendJson(res, 502, { Response: 'False', Error: message, results: [] })
          }
          return
        }

        if (requestUrl.searchParams.get('action') === 'mature') {
          try {
            const { results, rails } = await fetchMatureCollection(authChain)
            sendJson(res, 200, { Response: 'True', results, rails })
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Could not reach TMDB.'
            sendJson(res, 502, { Response: 'False', Error: message, results: [], rails: [] })
          }
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

// Dev-server equivalent of the production admin gate: privileged actions require
// the admin credential (ADMIN_PASSWORD, or a separate ADMIN_SECRET if set),
// presented via the `x-admin-key` header or an `adminKey` body field. Denied
// entirely when neither is configured.
async function devAdminAuthorized(
  env: Record<string, string | undefined>,
  req: IncomingMessage,
  body?: Record<string, unknown>,
): Promise<boolean> {
  const header = req.headers['x-admin-key']
  const headerKey = Array.isArray(header) ? header[0] : header
  const provided = String(headerKey ?? body?.adminKey ?? '')
  if (!provided) return false
  const adminPassword = await resolveAdminPassword(env, supabaseConfigFromEnv(env))
  const candidates = [adminPassword, env.ADMIN_SECRET].filter(Boolean) as string[]
  return candidates.some((candidate) => {
    if (provided.length !== candidate.length) return false
    let mismatch = 0
    for (let i = 0; i < provided.length; i++) {
      mismatch |= provided.charCodeAt(i) ^ candidate.charCodeAt(i)
    }
    return mismatch === 0
  })
}

function accountsDevProxy(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'accounts-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/accounts', async (req: IncomingMessage, res) => {
        const config = supabaseConfigFromEnv(env)
        if (!config) {
          sendJson(res, 200, { ok: false, configured: false })
          return
        }
        const adminEmail = adminEmailFromEnv(env)
        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const action = requestUrl.searchParams.get('action') ?? ''

        try {
          if (req.method === 'GET' && action === 'list') {
            if (!(await devAdminAuthorized(env, req))) {
              sendJson(res, 403, { ok: false, error: 'Not authorized.' })
              return
            }
            const accounts = (await listAccounts(config)).filter(
              (account) => account.email.toLowerCase() !== adminEmail,
            )
            sendJson(res, 200, { ok: true, configured: true, accounts })
            return
          }

          if (req.method === 'GET' && action === 'reveal') {
            if (!(await devAdminAuthorized(env, req))) {
              sendJson(res, 403, { ok: false, error: 'Not authorized.' })
              return
            }
            const email = (requestUrl.searchParams.get('email') ?? '').trim().toLowerCase()
            if (!email || email === adminEmail) {
              sendJson(res, 400, { ok: false, error: 'Invalid account.' })
              return
            }
            sendJson(res, 200, { ok: true, password: await revealPassword(config, email) })
            return
          }

          if (req.method === 'POST') {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk as Buffer)
            }
            const raw = Buffer.concat(chunks).toString('utf8')
            const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}

            if (action === 'verify') {
              const email = String(body.email ?? '').toLowerCase()
              const password = String(body.password ?? '')
              const adminPassword = await resolveAdminPassword(env, config)
              if (email === adminEmail && adminPassword && password === adminPassword) {
                sendJson(res, 200, { ok: true })
                return
              }
              sendJson(res, 200, { ok: await verifyAccount(config, email, password) })
              return
            }
            if (action === 'set-admin-password') {
              if (!(await devAdminAuthorized(env, req, body))) {
                sendJson(res, 403, { ok: false, error: 'Not authorized.' })
                return
              }
              const newPassword = String(body.newPassword ?? '')
              if (newPassword.length < 6) {
                sendJson(res, 400, { ok: false, error: 'Admin password must be at least 6 characters.' })
                return
              }
              await setAdminPassword(config, newPassword)
              sendJson(res, 200, { ok: true })
              return
            }
            if (action === 'save') {
              if (!(await devAdminAuthorized(env, req, body))) {
                sendJson(res, 403, { ok: false, error: 'Not authorized.' })
                return
              }
              const email = String(body.email ?? '').trim().toLowerCase()
              const password = String(body.password ?? '')
              if (!email || !email.includes('@') || password.length < 4) {
                sendJson(res, 400, { ok: false, error: 'Valid email and password (4+ chars) required.' })
                return
              }
              if (email === adminEmail) {
                sendJson(res, 400, { ok: false, error: 'Use "Change admin password" for the main account.' })
                return
              }
              await saveAccount(config, email, password, String(body.previousEmail ?? '').toLowerCase() || undefined)
              sendJson(res, 200, { ok: true })
              return
            }
            if (action === 'delete') {
              if (!(await devAdminAuthorized(env, req, body))) {
                sendJson(res, 403, { ok: false, error: 'Not authorized.' })
                return
              }
              const email = String(body.email ?? '').toLowerCase()
              if (email === adminEmail) {
                sendJson(res, 400, { ok: false, error: 'The main account cannot be removed.' })
                return
              }
              await deleteAccount(config, email)
              sendJson(res, 200, { ok: true })
              return
            }
          }

          sendJson(res, 400, { ok: false, error: 'Unknown action.' })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Accounts request failed.'
          sendJson(res, 502, { ok: false, error: message })
        }
      })
    },
  }
}

function watchPartyDevProxy(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'watch-party-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/watch-party', async (req: IncomingMessage, res) => {
        const config = supabaseConfigFromEnv(env)
        if (!config) {
          sendJson(res, 200, { ok: false, configured: false })
          return
        }

        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const action = requestUrl.searchParams.get('action') ?? ''

        try {
          if (req.method === 'GET') {
            if (action === 'friends') {
              const email = (requestUrl.searchParams.get('email') ?? '').toLowerCase()
              const emails = (await listAccountEmails(config)).filter(
                (candidate) => candidate.toLowerCase() !== email,
              )
              sendJson(res, 200, { ok: true, configured: true, friends: emails })
              return
            }
            if (action === 'incoming') {
              const email = (requestUrl.searchParams.get('email') ?? '').toLowerCase()
              sendJson(res, 200, { ok: true, configured: true, invites: await incomingInvites(config, email) })
              return
            }
            if (action === 'party') {
              const id = requestUrl.searchParams.get('id') ?? ''
              sendJson(res, 200, { ok: true, configured: true, party: id ? await getParty(config, id) : null })
              return
            }
            sendJson(res, 400, { ok: false, error: 'Unknown action.' })
            return
          }

          if (req.method === 'POST') {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk as Buffer)
            }
            const raw = Buffer.concat(chunks).toString('utf8')
            const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}

            if (action === 'invite') {
              const hostEmail = String(body.hostEmail ?? '').toLowerCase()
              const guestEmail = String(body.guestEmail ?? '').toLowerCase()
              if (!hostEmail || !guestEmail || !body.movie) {
                sendJson(res, 400, { ok: false, error: 'hostEmail, guestEmail, movie required.' })
                return
              }
              const party = await createInvite(config, hostEmail, guestEmail, body.movie)
              sendJson(res, 200, { ok: true, configured: true, party })
              return
            }
            if (action === 'accept') {
              await updateParty(config, String(body.id), { status: 'accepted' })
              sendJson(res, 200, { ok: true })
              return
            }
            if (action === 'state') {
              await updateParty(config, String(body.id), {
                playback: body.playback as { playing: boolean; time: number },
              })
              sendJson(res, 200, { ok: true })
              return
            }
            if (action === 'end') {
              await updateParty(config, String(body.id), { status: 'ended' })
              sendJson(res, 200, { ok: true })
              return
            }
            sendJson(res, 400, { ok: false, error: 'Unknown action.' })
            return
          }

          sendJson(res, 405, { ok: false, error: 'Method not allowed.' })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Watch-party request failed.'
          sendJson(res, 502, { ok: false, error: message })
        }
      })
    },
  }
}

function imgDevProxy(): Plugin {
  return {
    name: 'img-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/img', async (req: IncomingMessage, res) => {
        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const target = requestUrl.searchParams.get('url') ?? ''

        let allowed = false
        try {
          const parsed = new URL(target)
          if (
            parsed.protocol === 'https:' &&
            (parsed.hostname === 's4.anilist.co' ||
              parsed.hostname.endsWith('.anilist.co'))
          ) {
            allowed = true
          }
        } catch {
          // invalid url
        }

        if (!allowed) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Unsupported image URL.' }))
          return
        }

        try {
          const upstream = await fetch(target)
          if (!upstream.ok) {
            res.statusCode = upstream.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Image unavailable.' }))
            return
          }
          const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
          const bytes = await upstream.arrayBuffer()
          res.statusCode = 200
          res.setHeader('Content-Type', contentType)
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          res.end(Buffer.from(bytes))
        } catch (error) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Image proxy error.',
            }),
          )
        }
      })
    },
  }
}

function mangahookDevProxy(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'mangahook-dev-proxy',
    configureServer(server) {
      configureMangadexAuth(env)
      server.middlewares.use('/api/mangahook', async (req: IncomingMessage, res) => {
        if (req.method && req.method !== 'GET') {
          sendJson(res, 405, { error: 'Method not allowed.' })
          return
        }

        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const action = requestUrl.searchParams.get('action') ?? 'list'
        const page = requestUrl.searchParams.get('page') ?? undefined

        try {
          if (action === 'search') {
            const query = (requestUrl.searchParams.get('query') ?? '').trim()
            if (!query) {
              sendJson(res, 400, { error: 'Provide query.' })
              return
            }
            sendJson(res, 200, await searchMangaList(query, page))
            return
          }
          if (action === 'detail') {
            const id = requestUrl.searchParams.get('id')
            if (!id) {
              sendJson(res, 400, { error: 'Provide id.' })
              return
            }
            sendJson(res, 200, await fetchMangaDetail(id))
            return
          }
          if (action === 'chapter') {
            const id = requestUrl.searchParams.get('id')
            const ch = requestUrl.searchParams.get('ch')
            if (!id || !ch) {
              sendJson(res, 400, { error: 'Provide id and ch.' })
              return
            }
            sendJson(res, 200, await fetchMangaChapter(id, ch))
            return
          }
          sendJson(res, 200, await fetchMangaList(page))
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not reach the manga source.'
          sendJson(res, 502, { error: message })
        }
      })
    },
  }
}

function livetvDevProxy(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'livetv-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/livetv', async (req: IncomingMessage, res) => {
        if (req.method && req.method !== 'GET') {
          sendJson(res, 405, { error: 'Method not allowed.' })
          return
        }

        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const action = requestUrl.searchParams.get('action') ?? 'matches'

        try {
          if (action === 'image') {
            const image = await fetchLiveImage(env, requestUrl.searchParams.get('path') ?? '')
            if (!image) {
              sendJson(res, 404, { error: 'Image unavailable.' })
              return
            }
            res.statusCode = 200
            res.setHeader('Content-Type', image.contentType)
            res.setHeader('Cache-Control', 'public, max-age=86400')
            res.end(Buffer.from(image.body))
            return
          }
          if (action === 'sports') {
            sendJson(res, 200, await fetchLiveSports(env))
            return
          }
          if (action === 'streams') {
            const source = requestUrl.searchParams.get('source')
            const id = requestUrl.searchParams.get('id')
            if (!source || !id) {
              sendJson(res, 400, { error: 'Provide source and id.' })
              return
            }
            sendJson(res, 200, await fetchLiveStreams(env, source, id))
            return
          }
          sendJson(res, 200, await fetchLiveMatches(env, requestUrl.searchParams.get('scope') ?? 'live'))
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not reach the Live TV source.'
          sendJson(res, 502, { error: message })
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

const devProfilesMap = new Map<string, StoredProfile[]>()

function profilesDevProxy(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'profiles-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/profiles', async (req: IncomingMessage, res) => {
        const config = supabaseConfigFromEnv(env)

        try {
          if (req.method === 'GET') {
            const requestUrl = new URL(req.url ?? '/', 'http://localhost')
            const email = (requestUrl.searchParams.get('email') ?? '').trim().toLowerCase()
            if (!email) {
              sendJson(res, 400, { ok: false, error: 'email is required.', profiles: null })
              return
            }
            let profiles: StoredProfile[] | null = null
            if (config) {
              try {
                profiles = await fetchAccountProfiles(config, email)
              } catch {
                // ignore fetch failure
              }
            }
            if (profiles && profiles.length > 0) {
              devProfilesMap.set(email, profiles)
            } else {
              profiles = devProfilesMap.get(email) ?? null
            }
            sendJson(res, 200, { ok: true, configured: Boolean(config), profiles })
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

            devProfilesMap.set(email, profiles)
            if (config) {
              try {
                await saveAccountProfiles(config, email, profiles)
              } catch {
                // ignore save failure
              }
            }
            sendJson(res, 200, { ok: true, configured: Boolean(config) })
            return
          }

          sendJson(res, 405, { ok: false, error: 'Method not allowed.' })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Profiles request failed.'
          sendJson(res, 502, { ok: false, error: message })
        }
      })

      let devLordPin = '1408'
      server.middlewares.use('/api/lord-pin', async (req: IncomingMessage, res) => {
        const config = supabaseConfigFromEnv(env)
        try {
          if (req.method === 'GET') {
            let pin = devLordPin
            if (config) {
              try {
                const remotePin = await fetchAccountProfiles(config, 'admin_lord_pin')
                if (remotePin && remotePin.length > 0 && remotePin[0].name) {
                  pin = remotePin[0].name
                }
              } catch {
                // ignore fetch failure
              }
            }
            const requestUrl = new URL(req.url ?? '/', 'http://localhost')
            if (requestUrl.searchParams.get('action') === 'verify') {
              const provided = requestUrl.searchParams.get('pin') ?? ''
              sendJson(res, 200, { ok: provided.length === pin.length && provided === pin })
              return
            }
            // Never leak the PIN to the client.
            sendJson(res, 200, { ok: true })
            return
          }
          if (req.method === 'POST' || req.method === 'PUT') {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk as Buffer)
            }
            const raw = Buffer.concat(chunks).toString('utf8')
            const body = raw ? (JSON.parse(raw) as { adminEmail?: string; pin?: string; adminKey?: string }) : {}
            const newPin = String(body.pin ?? '').trim()
            if (!(await devAdminAuthorized(env, req, body))) {
              sendJson(res, 403, { ok: false, error: 'Not authorized.' })
              return
            }
            if (!/^\d{4}$/.test(newPin)) {
              sendJson(res, 400, { ok: false, error: 'PIN must be 4 digits.' })
              return
            }
            devLordPin = newPin
            if (config) {
              try {
                await saveAccountProfiles(config, 'admin_lord_pin', [{ name: newPin, avatarColor: 'lord' }])
              } catch {
                // ignore save failure
              }
            }
            sendJson(res, 200, { ok: true })
            return
          }
          sendJson(res, 405, { ok: false, error: 'Method not allowed.' })
        } catch {
          sendJson(res, 500, { ok: false, error: 'Error processing Lord PIN.' })
        }
      })

      let devPhubRefreshSeed = 0
      server.middlewares.use('/api/phub-refresh', async (req: IncomingMessage, res) => {
        const config = supabaseConfigFromEnv(env)
        try {
          if (req.method === 'GET') {
            let seed = devPhubRefreshSeed
            if (config) {
              try {
                const remoteSeed = await fetchAccountProfiles(config, 'global_phub_refresh')
                if (remoteSeed && remoteSeed.length > 0 && remoteSeed[0].name) {
                  const parsed = Number(remoteSeed[0].name)
                  if (!Number.isNaN(parsed)) {
                    seed = parsed
                    devPhubRefreshSeed = parsed
                  }
                }
              } catch {
                // ignore fetch failure
              }
            }
            sendJson(res, 200, { ok: true, seed, updatedAt: new Date().toISOString() })
            return
          }
          if (req.method === 'POST' || req.method === 'PUT') {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk as Buffer)
            }
            const raw = Buffer.concat(chunks).toString('utf8')
            const body = raw ? (JSON.parse(raw) as { adminEmail?: string; seed?: number; adminKey?: string }) : {}
            const bodyAdminEmail = String(body.adminEmail ?? '').trim().toLowerCase()
            const isAuthorizedEmail = bodyAdminEmail === 'avnishpc00@gmail.com' || bodyAdminEmail === adminEmailFromEnv(env)
            const isAuthorizedKey = await devAdminAuthorized(env, req, body)

            if (!isAuthorizedEmail && !isAuthorizedKey) {
              sendJson(res, 403, { ok: false, error: 'Only admin avnishpc00@gmail.com can refresh PHub videos.' })
              return
            }

            let newSeed = typeof body.seed === 'number' ? body.seed : Number(body.seed)
            if (Number.isNaN(newSeed) || !newSeed) {
              newSeed = (Date.now() % 1000000) + Math.floor(Math.random() * 1000) + 1
            }

            devPhubRefreshSeed = newSeed
            if (config) {
              try {
                await saveAccountProfiles(config, 'global_phub_refresh', [
                  { name: String(newSeed), avatarColor: String(Date.now()) },
                ])
              } catch {
                // ignore save failure
              }
            }
            sendJson(res, 200, { ok: true, seed: newSeed, updatedAt: new Date().toISOString() })
            return
          }
          sendJson(res, 405, { ok: false, error: 'Method not allowed.' })
        } catch {
          sendJson(res, 500, { ok: false, error: 'Error processing PHub refresh.' })
        }
      })
    },
  }
}

function watchHistoryDevProxy(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'watch-history-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/watch-history', async (req: IncomingMessage, res) => {
        const config = supabaseConfigFromEnv(env)
        try {
          if (req.method === 'GET') {
            const requestUrl = new URL(req.url ?? '/', 'http://localhost')
            const key = (requestUrl.searchParams.get('key') ?? '').trim()
            if (!key) {
              sendJson(res, 400, { ok: false, error: 'key is required.', history: null })
              return
            }
            let history: Record<string, unknown> | null = null
            if (config) {
              try {
                history = await fetchWatchHistory(config, key)
              } catch {
                // ignore fetch failure
              }
            }
            sendJson(res, 200, { ok: true, configured: Boolean(config), history })
            return
          }

          if (req.method === 'POST' || req.method === 'PUT') {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk as Buffer)
            }
            const raw = Buffer.concat(chunks).toString('utf8')
            const body = raw
              ? (JSON.parse(raw) as {
                  key?: string
                  history?: Record<string, unknown>
                  movieId?: string
                  movieData?: Record<string, unknown>
                })
              : {}
            const key = String(body.key ?? '').trim()
            const history = body.history
            const movieId = typeof body.movieId === 'string' ? body.movieId.trim() : ''
            const movieData = body.movieData
            if (!key) {
              sendJson(res, 400, { ok: false, error: 'key is required.' })
              return
            }
            if (movieId && movieData && typeof movieData === 'object') {
              if (config) {
                try {
                  await updateMovieProgress(config, key, movieId, movieData)
                } catch {
                  // ignore save failure
                }
              }
              sendJson(res, 200, { ok: true, configured: Boolean(config) })
              return
            }
            if (!history || typeof history !== 'object') {
              sendJson(res, 400, { ok: false, error: 'key and history are required.' })
              return
            }
            if (config) {
              try {
                await saveWatchHistory(config, key, history)
              } catch {
                // ignore save failure
              }
            }
            sendJson(res, 200, { ok: true, configured: Boolean(config) })
            return
          }

          sendJson(res, 405, { ok: false, error: 'Method not allowed.' })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Watch-history request failed.'
          sendJson(res, 502, { ok: false, error: message })
        }
      })
    },
  }
}

function devicesDevProxy(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'devices-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/devices', async (req: IncomingMessage, res) => {
        const config = supabaseConfigFromEnv(env)
        if (!config) {
          sendJson(res, 200, { ok: false, configured: false, devices: [] })
          return
        }
        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const action = requestUrl.searchParams.get('action') ?? ''

        try {
          if (req.method === 'GET' && action === 'list') {
            const email = (requestUrl.searchParams.get('email') ?? '').trim().toLowerCase()
            if (!email) {
              sendJson(res, 400, { ok: false, error: 'email is required.', devices: [] })
              return
            }
            sendJson(res, 200, { ok: true, configured: true, devices: await fetchDevices(config, email) })
            return
          }

          if (req.method === 'POST') {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk as Buffer)
            }
            const raw = Buffer.concat(chunks).toString('utf8')
            const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
            const email = String(body.email ?? '').trim().toLowerCase()
            if (!email) {
              sendJson(res, 400, { ok: false, error: 'email is required.' })
              return
            }
            if (action === 'register') {
              const device = body.device as DeviceRecord | undefined
              if (!device || typeof device.id !== 'string') {
                sendJson(res, 400, { ok: false, error: 'device is required.' })
                return
              }
              sendJson(res, 200, { ok: true, configured: true, devices: await registerDevice(config, email, device) })
              return
            }
            if (action === 'remove') {
              sendJson(res, 200, { ok: true, configured: true, devices: await removeDevice(config, email, String(body.id ?? '')) })
              return
            }
            if (action === 'removeOthers') {
              sendJson(res, 200, { ok: true, configured: true, devices: await removeOtherDevices(config, email, String(body.keepId ?? '')) })
              return
            }
          }

          sendJson(res, 400, { ok: false, error: 'Unknown action.' })
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

function phubDevProxy(apiKey?: string): Plugin {
  return {
    name: 'phub-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/phub', async (req: IncomingMessage, res) => {
        if (req.method && req.method !== 'GET') {
          sendJson(res, 405, { success: false, error: 'Method not allowed.' })
          return
        }

        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const endpoint = requestUrl.searchParams.get('endpoint') || '/movies'
        const page = requestUrl.searchParams.get('page') || '1'
        const limit = requestUrl.searchParams.get('limit') || '24'
        const categories = requestUrl.searchParams.get('categories') || ''
        const search = requestUrl.searchParams.get('search') || ''
        const pornstars = requestUrl.searchParams.get('pornstars') || ''

        let targetUrl = `https://porn-api.com/api/v1/public${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
        const params = new URLSearchParams()
        if (page) params.set('page', page)
        if (limit) params.set('limit', limit)
        if (categories) params.set('categories', categories)
        if (search) params.set('search', search)
        if (pornstars) params.set('pornstars', pornstars)

        if (params.toString() && !targetUrl.includes('?')) {
          targetUrl += `?${params.toString()}`
        }

        try {
          const upstreamRes = await fetch(targetUrl, {
            headers: {
              'X-API-Key': apiKey || '2ceb712d93165c1f69e2ff70948aa09705f7da4610ffb0caec764f224ef1b8f1',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            },
          })
          const data = await upstreamRes.json()
          sendJson(res, upstreamRes.status, data)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not reach Porn API.'
          sendJson(res, 502, { success: false, error: message })
        }
      })
    },
  }
}

function epornerDevProxy(): Plugin {
  return {
    name: 'eporner-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/eporner', async (req: IncomingMessage, res) => {
        if (req.method && req.method !== 'GET') {
          sendJson(res, 405, { success: false, error: 'Method not allowed.' })
          return
        }

        const requestUrl = new URL(req.url ?? '/', 'http://localhost')
        const action = requestUrl.searchParams.get('action') || 'search'
        const query = requestUrl.searchParams.get('query') || 'all'
        const page = requestUrl.searchParams.get('page') || '1'
        const perPage = requestUrl.searchParams.get('per_page') || '24'
        const thumbsize = requestUrl.searchParams.get('thumbsize') || 'big'
        const order = requestUrl.searchParams.get('order') || 'top-weekly'
        const gay = requestUrl.searchParams.get('gay') || '0'
        const lq = requestUrl.searchParams.get('lq') || '1'
        const id = requestUrl.searchParams.get('id')

        let targetUrl = ''
        if (action === 'id' && id) {
          targetUrl = `https://www.eporner.com/api/v2/video/id/?id=${encodeURIComponent(id)}&thumbsize=${encodeURIComponent(thumbsize)}&format=json`
        } else {
          targetUrl = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(query)}&per_page=${encodeURIComponent(perPage)}&page=${encodeURIComponent(page)}&thumbsize=${encodeURIComponent(thumbsize)}&order=${encodeURIComponent(order)}&gay=${encodeURIComponent(gay)}&lq=${encodeURIComponent(lq)}&format=json`
        }

        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 2500)
          const upstreamRes = await fetch(targetUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            },
          })
          clearTimeout(timeoutId)
          const data = await upstreamRes.json()
          sendJson(res, upstreamRes.status, data)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not reach Eporner API.'
          sendJson(res, 502, { success: false, error: message })
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
      phubDevProxy(env.PHUB_API_KEY),
      epornerDevProxy(),
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
      watchHistoryDevProxy(env),
      imgDevProxy(),
      mangahookDevProxy(env),
      livetvDevProxy(env),
      posterDevProxy(env),
      watchPartyDevProxy(env),
      accountsDevProxy(env),
      devicesDevProxy(env),
      tmdbDramaDevProxy(createTmdbWatchAuthChain(env)),
      tmdbEpisodesDevProxy(createTmdbWatchAuthChain(env)),
      movieGluDevProxy(
        movieGluConfigFromEnv(env),
        createTmdbTrailerAuthChain(env),
      ),
    ],
  }
})
