// Consolidated API function. Vercel's Hobby plan caps a deployment at 12
// serverless functions, so the endpoints added later (trailer, poster,
// profiles, watch-party, accounts) are served from this single function and
// routed here by rewrites in vercel.json (e.g. /api/poster -> /api/hub?kind=poster).
//
// The local Vite dev server still serves each /api/* path via its own dev
// proxy, so this consolidation only affects the production (Vercel) runtime.

import {
  fetchAccountProfiles,
  saveAccountProfiles,
  fetchWatchHistory,
  saveWatchHistory,
  updateMovieProgress,
  supabaseConfigFromEnv,
  type StoredProfile,
} from './_lib/supabase-core.js'
import {
  createTmdbTrailerAuthChain,
  fetchTmdbTrailerYoutubeId,
} from './_lib/tmdb-trailer-core.js'
import { fetchPosterImage, posterKeysFromEnv } from './_lib/poster-core.js'
import {
  fetchMangaChapter,
  fetchMangaDetail,
  fetchMangaList,
  searchMangaList,
} from './_lib/mangahook-core.js'
import {
  fetchLiveImage,
  fetchLiveMatches,
  fetchLiveSports,
  fetchLiveStreams,
} from './_lib/livetv-core.js'

import {
  createInvite,
  getParty,
  incomingInvites,
  listAccountEmails,
  updateParty,
} from './_lib/watch-party-core.js'
import {
  adminEmailFromEnv,
  deleteAccount,
  listAccounts,
  resolveAdminPassword,
  revealPassword,
  saveAccount,
  setAdminPassword,
  verifyAccount,
} from './_lib/accounts-core.js'
import type { SupabaseConfig } from './_lib/supabase-core.js'
import {
  fetchDevices,
  registerDevice,
  removeDevice,
  removeOtherDevices,
  type DeviceRecord,
} from './_lib/devices-core.js'

const inMemoryProfilesMap = new Map<string, StoredProfile[]>()
let globalLordPin = '1408'
let globalPhubRefreshSeed = 0

type QueryValue = string | string[] | undefined

type ApiRequest = {
  method?: string
  query: Record<string, QueryValue>
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

// Constant-time string comparison to avoid leaking the secret via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

// In-memory sliding window rate limiter
type RateLimitBucket = { count: number; resetAt: number }
const rateLimitBuckets = new Map<string, RateLimitBucket>()

function getClientIp(req: ApiRequest): string {
  const forwarded = req.headers?.['x-forwarded-for']
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded
  if (forwardedIp) return forwardedIp.split(',')[0].trim()
  const realIp = req.headers?.['x-real-ip']
  return String(Array.isArray(realIp) ? realIp[0] : realIp || 'unknown')
}

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = rateLimitBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= limit) {
    return false
  }
  bucket.count += 1
  return true
}

// Privileged actions (viewing/editing accounts, changing the Lord PIN) require
// the admin credential, presented by the client via the `x-admin-key` header or
// an `adminKey` body field. It's matched against ADMIN_PASSWORD (the admin's
// login password) or, if configured, a separate ADMIN_SECRET. The old "trust
// the admin email" check was exploitable, so a matching credential is now
// mandatory — if neither env var is set, all privileged actions are denied.
// (This is intentionally distinct from the 4-digit Lord PIN.)
async function adminAuthorized(
  env: Record<string, string | undefined>,
  config: SupabaseConfig | null,
  req: ApiRequest,
  body: Record<string, unknown>,
): Promise<boolean> {
  const header = req.headers?.['x-admin-key']
  const headerKey = Array.isArray(header) ? header[0] : header
  const provided = String(headerKey ?? body.adminKey ?? '')
  if (!provided) return false
  const adminPassword = await resolveAdminPassword(env, config)
  const candidates = [adminPassword, env.ADMIN_SECRET].filter(Boolean) as string[]
  return candidates.some((candidate) => safeEqual(provided, candidate))
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
  end: (body?: unknown) => void
}

function qv(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value
}

function parseBody(req: ApiRequest): Record<string, unknown> {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  return (req.body as Record<string, unknown>) ?? {}
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const env = process.env as Record<string, string | undefined>
  const kind = qv(req.query.kind) ?? ''
  // Supabase config (null when env vars are missing). Used by the profiles,
  // lord-pin, accounts, watch-party and devices handlers below.
  const config = supabaseConfigFromEnv(env)

  // ---- trailer (public) ----
  if (kind === 'trailer') {
    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=604800')
    try {
      const youtubeId = await fetchTmdbTrailerYoutubeId(createTmdbTrailerAuthChain(env), {
        tmdbId: qv(req.query.tmdbId) ? Number(qv(req.query.tmdbId)) : undefined,
        imdbId: qv(req.query.imdbId) || undefined,
        type: qv(req.query.type) === 'tv' ? 'tv' : 'movie',
      })
      res.status(200).json({ youtubeId })
    } catch (error) {
      res.status(502).json({ youtubeId: null, error: error instanceof Error ? error.message : 'TMDB error.' })
    }
    return
  }

  // ---- img (public image proxy, allowlisted hosts only) ----
  // Streams AniList cover art through our own (edge-cached) origin so anime
  // posters stay fast/reachable even when the AniList CDN is slow or blocked
  // on the viewer's network.
  if (kind === 'img') {
    const target = qv(req.query.url) ?? ''
    let allowed = false
    try {
      const parsed = new URL(target)
      allowed =
        parsed.protocol === 'https:' &&
        (parsed.hostname === 's4.anilist.co' ||
          parsed.hostname.endsWith('.anilist.co'))
    } catch {
      allowed = false
    }
    if (!allowed) {
      res.status(400).json({ error: 'Unsupported image URL.' })
      return
    }
    try {
      const upstream = await fetch(target)
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: 'Image unavailable.' })
        return
      }
      const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
      if (!contentType.startsWith('image/')) {
        res.status(415).json({ error: 'Not an image.' })
        return
      }
      const bytes = await upstream.arrayBuffer()
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
      res.end(Buffer.from(bytes))
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : 'Image proxy error.' })
    }
    return
  }

  // ---- poster (public, streams image bytes) ----
  if (kind === 'poster') {
    const image = await fetchPosterImage(posterKeysFromEnv(env), {
      imdbId: qv(req.query.imdb),
      tmdbId: qv(req.query.tmdb),
      kind: qv(req.query.thumb) === '1' ? 'thumbnail' : 'poster',
    })
    if (!image) {
      res.status(404).json({ error: 'Poster unavailable.' })
      return
    }
    res.setHeader('Content-Type', image.contentType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
    res.end(Buffer.from(image.body))
    return
  }

  // ---- manga (public JSON proxy: MangaDex catalog + reading) ----
  if (kind === 'manga') {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
    const action = qv(req.query.action) ?? 'list'
    try {
      if (action === 'search') {
        const query = (qv(req.query.query) ?? '').trim()
        if (!query) {
          res.status(400).json({ error: 'Provide query.' })
          return
        }
        res.status(200).json(await searchMangaList(query, qv(req.query.page)))
        return
      }
      if (action === 'detail') {
        const id = qv(req.query.id)
        if (!id) {
          res.status(400).json({ error: 'Provide id.' })
          return
        }
        res.status(200).json(await fetchMangaDetail(id))
        return
      }
      if (action === 'chapter') {
        const id = qv(req.query.id)
        const ch = qv(req.query.ch)
        if (!id || !ch) {
          res.status(400).json({ error: 'Provide id and ch.' })
          return
        }
        res.status(200).json(await fetchMangaChapter(id, ch))
        return
      }
      res.status(200).json(await fetchMangaList(qv(req.query.page)))
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : 'Manga source error.' })
    }
    return
  }

  // ---- livetv (public JSON + image proxy for the Streamed sports API) ----
  if (kind === 'livetv') {
    const action = qv(req.query.action) ?? 'matches'
    try {
      if (action === 'image') {
        const image = await fetchLiveImage(env, qv(req.query.path) ?? '')
        if (!image) {
          res.status(404).json({ error: 'Image unavailable.' })
          return
        }
        res.setHeader('Content-Type', image.contentType)
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
        res.end(Buffer.from(image.body))
        return
      }
      if (action === 'sports') {
        res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')
        res.status(200).json(await fetchLiveSports(env))
        return
      }
      if (action === 'streams') {
        const source = qv(req.query.source)
        const id = qv(req.query.id)
        if (!source || !id) {
          res.status(400).json({ error: 'Provide source and id.' })
          return
        }
        res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60')
        res.status(200).json(await fetchLiveStreams(env, source, id))
        return
      }
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120')
      res.status(200).json(await fetchLiveMatches(env, qv(req.query.scope) ?? 'live'))
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : 'Live TV source error.' })
    }
    return
  }
  // ---- phub (Porn API proxy for 4K video catalog) ----
  if (kind === 'phub') {
    const endpoint = qv(req.query.endpoint) ?? '/movies'
    const page = qv(req.query.page) ?? '1'
    const limit = qv(req.query.limit) ?? '24'
    const categories = qv(req.query.categories)
    const search = qv(req.query.search)
    const pornstars = qv(req.query.pornstars)
    const apiKey = env.PHUB_API_KEY || '2ceb712d93165c1f69e2ff70948aa09705f7da4610ffb0caec764f224ef1b8f1'

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
          'X-API-Key': apiKey,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      })
      const data = await upstreamRes.json()
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
      res.status(upstreamRes.status).json(data)
    } catch (error) {
      res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'Could not reach Porn API.' })
    }
    return
  }
  // ---- eporner (Eporner API v2 proxy for PHub 3) ----
  if (kind === 'eporner') {
    const action = qv(req.query.action) ?? 'search'
    const query = qv(req.query.query) ?? 'all'
    const page = qv(req.query.page) ?? '1'
    const perPage = qv(req.query.per_page) ?? '24'
    const thumbsize = qv(req.query.thumbsize) ?? 'big'
    const order = qv(req.query.order) ?? 'top-weekly'
    const gay = qv(req.query.gay) ?? '0'
    const lq = qv(req.query.lq) ?? '1'
    const id = qv(req.query.id)

    let targetUrl = ''
    if (action === 'id' && id) {
      targetUrl = `https://www.eporner.com/api/v2/video/id/?id=${encodeURIComponent(id)}&thumbsize=${encodeURIComponent(thumbsize)}&format=json`
    } else {
      targetUrl = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(query)}&per_page=${encodeURIComponent(perPage)}&page=${encodeURIComponent(page)}&thumbsize=${encodeURIComponent(thumbsize)}&order=${encodeURIComponent(order)}&gay=${encodeURIComponent(gay)}&lq=${encodeURIComponent(lq)}&format=json`
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)
      const upstreamRes = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      })
      clearTimeout(timeoutId)
      const data = await upstreamRes.json()
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
      res.status(upstreamRes.status).json(data)
    } catch (error) {
      res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'Could not reach Eporner API.' })
    }
    return
  }

  const body = parseBody(req)

  // ---- admin login (server-only password) ----
  // The main account authenticates against ADMIN_PASSWORD held on the server,
  // so no admin password ships in the client bundle. Handled before the
  // Supabase gate so the admin can sign in even if Supabase is unavailable.
  if (kind === 'accounts' && qv(req.query.action) === 'verify') {
    const ip = getClientIp(req)
    if (!checkRateLimit(`login:${ip}`, 12, 60_000)) {
      res.setHeader('Cache-Control', 'no-store')
      res.status(429).json({ ok: false, error: 'Too many login attempts. Please try again later.' })
      return
    }
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const adminPassword = await resolveAdminPassword(env, config)
    if (email === adminEmailFromEnv(env) && adminPassword && safeEqual(password, adminPassword)) {
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ ok: true })
      return
    }
    // Otherwise fall through to the table-backed verify in the accounts block.
  }

  // ---- profiles ----
  if (kind === 'profiles') {
    res.setHeader('Cache-Control', 'no-store')
    try {
      if (req.method === 'GET') {
        const email = (qv(req.query.email) ?? '').trim().toLowerCase()
        if (!email) {
          res.status(400).json({ ok: false, error: 'email is required.', profiles: null })
          return
        }
        let remoteProfiles: StoredProfile[] | null = null
        if (config) {
          try {
            remoteProfiles = await fetchAccountProfiles(config, email)
          } catch {}
        }
        if (remoteProfiles && remoteProfiles.length > 0) {
          inMemoryProfilesMap.set(email, remoteProfiles)
        } else {
          remoteProfiles = inMemoryProfilesMap.get(email) ?? null
        }
        res.status(200).json({ ok: true, configured: Boolean(config), profiles: remoteProfiles })
        return
      }
      const email = String(body.email ?? '').trim().toLowerCase()
      const profiles = body.profiles
      if (!email || !Array.isArray(profiles)) {
        res.status(400).json({ ok: false, error: 'email and profiles[] required.' })
        return
      }
      inMemoryProfilesMap.set(email, profiles as StoredProfile[])
      if (config) {
        try {
          await saveAccountProfiles(config, email, profiles as StoredProfile[])
        } catch {}
      }
      res.status(200).json({ ok: true, configured: Boolean(config) })
    } catch (error) {
      res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Profiles error.' })
    }
    return
  }

  // ---- watch-history (cross-device Continue Watching) ----
  if (kind === 'watch-history') {
    res.setHeader('Cache-Control', 'no-store')
    try {
      if (req.method === 'GET') {
        const key = (qv(req.query.key) ?? '').trim()
        if (!key) {
          res.status(400).json({ ok: false, error: 'key is required.', history: null })
          return
        }
        let history: Record<string, unknown> | null = null
        if (config) {
          try {
            history = await fetchWatchHistory(config, key)
          } catch {}
        }
        res.status(200).json({ ok: true, configured: Boolean(config), history })
        return
      }
      const key = String(body.key ?? '').trim()
      const history = body.history
      const movieId = typeof body.movieId === 'string' ? body.movieId.trim() : ''
      const movieData = body.movieData
      if (!key) {
        res.status(400).json({ ok: false, error: 'key is required.' })
        return
      }
      if (movieId && movieData && typeof movieData === 'object') {
        if (config) {
          try {
            await updateMovieProgress(config, key, movieId, movieData as Record<string, unknown>)
          } catch {}
        }
        res.status(200).json({ ok: true, configured: Boolean(config) })
        return
      }
      if (!history || typeof history !== 'object') {
        res.status(400).json({ ok: false, error: 'key and history required.' })
        return
      }
      if (config) {
        try {
          await saveWatchHistory(config, key, history as Record<string, unknown>)
        } catch {}
      }
      res.status(200).json({ ok: true, configured: Boolean(config) })
    } catch (error) {
      res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Watch-history error.' })
    }
    return
  }

  // ---- lord-pin ----
  if (kind === 'lord-pin') {
    res.setHeader('Cache-Control', 'no-store')
    try {
      if (req.method === 'GET') {
        // Resolve the current PIN server-side; never send it to the client.
        let pin = globalLordPin
        if (config) {
          try {
            const remotePin = await fetchAccountProfiles(config, 'admin_lord_pin')
            if (remotePin && remotePin.length > 0 && remotePin[0].name) {
              pin = remotePin[0].name
            }
          } catch {}
        }
        // `verify` compares a candidate PIN server-side and returns only ok/no.
        if (qv(req.query.action) === 'verify') {
          const ip = getClientIp(req)
          if (!checkRateLimit(`pin:${ip}`, 8, 60_000)) {
            res.status(429).json({ ok: false, error: 'Too many PIN attempts. Please wait a moment.' })
            return
          }
          res.status(200).json({ ok: safeEqual(String(qv(req.query.pin) ?? ''), pin) })
          return
        }
        res.status(200).json({ ok: true })
        return
      }
      const newPin = String(body.pin ?? '').trim()
      if (!(await adminAuthorized(env, config, req, body))) {
        res.status(403).json({ ok: false, error: 'Not authorized.' })
        return
      }
      if (!/^\d{4}$/.test(newPin)) {
        res.status(400).json({ ok: false, error: 'PIN must be 4 digits.' })
        return
      }
      globalLordPin = newPin
      if (config) {
        try {
          await saveAccountProfiles(config, 'admin_lord_pin', [{ name: newPin, avatarColor: 'lord' }])
        } catch {}
      }
      res.status(200).json({ ok: true })
    } catch (error) {
      res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Lord PIN error.' })
    }
    return
  }

  // ---- phub-refresh ----
  if (kind === 'phub-refresh' || kind === 'phub-seed') {
    res.setHeader('Cache-Control', 'no-store')
    try {
      if (req.method === 'GET') {
        let seed = globalPhubRefreshSeed
        if (config) {
          try {
            const remoteSeed = await fetchAccountProfiles(config, 'global_phub_refresh')
            if (remoteSeed && remoteSeed.length > 0 && remoteSeed[0].name) {
              const parsed = Number(remoteSeed[0].name)
              if (!Number.isNaN(parsed)) {
                seed = parsed
                globalPhubRefreshSeed = parsed
              }
            }
          } catch {}
        }
        res.status(200).json({ ok: true, seed, updatedAt: new Date().toISOString() })
        return
      }

      if (req.method === 'POST' || req.method === 'PUT') {
        const bodyAdminEmail = String(body.adminEmail ?? '').trim().toLowerCase()
        const isAuthorizedEmail = bodyAdminEmail === 'avnishpc00@gmail.com' || bodyAdminEmail === adminEmailFromEnv(env)
        const isAuthorizedKey = await adminAuthorized(env, config, req, body)

        if (!isAuthorizedEmail && !isAuthorizedKey) {
          res.status(403).json({ ok: false, error: 'Only admin avnishpc00@gmail.com can refresh PHub videos.' })
          return
        }

        let newSeed = typeof body.seed === 'number' ? body.seed : Number(body.seed)
        if (Number.isNaN(newSeed) || !newSeed) {
          newSeed = (Date.now() % 1000000) + Math.floor(Math.random() * 1000) + 1
        }

        globalPhubRefreshSeed = newSeed
        if (config) {
          try {
            await saveAccountProfiles(config, 'global_phub_refresh', [
              { name: String(newSeed), avatarColor: String(Date.now()) },
            ])
          } catch {}
        }
        res.status(200).json({ ok: true, seed: newSeed, updatedAt: new Date().toISOString() })
        return
      }
      res.status(405).json({ ok: false, error: 'Method not allowed.' })
    } catch (error) {
      res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'PHub refresh error.' })
    }
    return
  }

  // Everything below needs Supabase.
  if (!config) {
    res.status(200).json({ ok: false, configured: false, profiles: null })
    return
  }

  // ---- watch-party ----
  if (kind === 'watch-party') {
    res.setHeader('Cache-Control', 'no-store')
    const action = qv(req.query.action) ?? ''
    try {
      if (req.method === 'GET') {
        if (action === 'friends') {
          const email = (qv(req.query.email) ?? '').trim().toLowerCase()
          if (!email || !email.includes('@')) {
            res.status(400).json({ ok: false, error: 'Valid email required.', friends: [] })
            return
          }
          const allEmails = await listAccountEmails(config)
          const isRegistered = email === adminEmailFromEnv(env) || allEmails.some((e) => e.toLowerCase() === email)
          if (!isRegistered) {
            res.status(403).json({ ok: false, error: 'Account not recognized.', friends: [] })
            return
          }
          const friends = allEmails.filter((c) => c.toLowerCase() !== email)
          res.status(200).json({ ok: true, configured: true, friends })
          return
        }
        if (action === 'incoming') {
          res.status(200).json({ ok: true, configured: true, invites: await incomingInvites(config, (qv(req.query.email) ?? '').toLowerCase()) })
          return
        }
        if (action === 'party') {
          const id = qv(req.query.id) ?? ''
          res.status(200).json({ ok: true, configured: true, party: id ? await getParty(config, id) : null })
          return
        }
        res.status(400).json({ ok: false, error: 'Unknown action.' })
        return
      }
      if (action === 'invite') {
        const hostEmail = String(body.hostEmail ?? '').toLowerCase()
        const guestEmail = String(body.guestEmail ?? '').toLowerCase()
        if (!hostEmail || !guestEmail || !body.movie) {
          res.status(400).json({ ok: false, error: 'hostEmail, guestEmail, movie required.' })
          return
        }
        res.status(200).json({ ok: true, configured: true, party: await createInvite(config, hostEmail, guestEmail, body.movie) })
        return
      }
      if (action === 'accept') {
        await updateParty(config, String(body.id), { status: 'accepted' })
        res.status(200).json({ ok: true })
        return
      }
      if (action === 'state') {
        const patch: Record<string, unknown> = {}
        if (body.playback) patch.playback = body.playback as { playing: boolean; time: number }
        if (body.screen_share) patch.screen_share = body.screen_share as { active: boolean; sharing_user?: string }
        if (body.signal) patch.signal = body.signal as Record<string, unknown>
        await updateParty(config, String(body.id), patch)
        res.status(200).json({ ok: true })
        return
      }
      if (action === 'end') {
        await updateParty(config, String(body.id), { status: 'ended' })
        res.status(200).json({ ok: true })
        return
      }
      res.status(400).json({ ok: false, error: 'Unknown action.' })
    } catch (error) {
      res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Watch-party error.' })
    }
    return
  }

  // ---- accounts ----
  if (kind === 'accounts') {
    res.setHeader('Cache-Control', 'no-store')
    const action = qv(req.query.action) ?? ''
    const adminEmail = adminEmailFromEnv(env)
    const isAdmin = () => adminAuthorized(env, config, req, body)
    try {
      if (req.method === 'POST' && action === 'verify') {
        res.status(200).json({ ok: await verifyAccount(config, String(body.email ?? '').toLowerCase(), String(body.password ?? '')) })
        return
      }
      if (req.method === 'GET' && action === 'list') {
        if (!(await isAdmin())) {
          res.status(403).json({ ok: false, error: 'Not authorized.' })
          return
        }
        // Never include the admin account in the manageable list.
        const accounts = (await listAccounts(config)).filter(
          (account) => account.email.toLowerCase() !== adminEmail,
        )
        res.status(200).json({ ok: true, configured: true, accounts })
        return
      }
      if (req.method === 'GET' && action === 'reveal') {
        if (!(await isAdmin())) {
          res.status(403).json({ ok: false, error: 'Not authorized.' })
          return
        }
        const email = (qv(req.query.email) ?? '').trim().toLowerCase()
        if (!email || email === adminEmail) {
          res.status(400).json({ ok: false, error: 'Invalid account.' })
          return
        }
        res.status(200).json({ ok: true, password: await revealPassword(config, email) })
        return
      }
      if (req.method === 'POST' && action === 'set-admin-password') {
        if (!(await isAdmin())) {
          res.status(403).json({ ok: false, error: 'Not authorized.' })
          return
        }
        const newPassword = String(body.newPassword ?? '')
        if (newPassword.length < 6) {
          res.status(400).json({ ok: false, error: 'Admin password must be at least 6 characters.' })
          return
        }
        await setAdminPassword(config, newPassword)
        res.status(200).json({ ok: true })
        return
      }
      if (req.method === 'POST' && action === 'save') {
        if (!(await isAdmin())) {
          res.status(403).json({ ok: false, error: 'Not authorized.' })
          return
        }
        const email = String(body.email ?? '').trim().toLowerCase()
        const password = String(body.password ?? '')
        if (!email || !email.includes('@') || password.length < 4) {
          res.status(400).json({ ok: false, error: 'Valid email and password (4+ chars) required.' })
          return
        }
        if (email === adminEmail) {
          res.status(400).json({ ok: false, error: 'Use "Change admin password" for the main account.' })
          return
        }
        await saveAccount(config, email, password, String(body.previousEmail ?? '').toLowerCase() || undefined)
        res.status(200).json({ ok: true })
        return
      }
      if (req.method === 'POST' && action === 'delete') {
        if (!(await isAdmin())) {
          res.status(403).json({ ok: false, error: 'Not authorized.' })
          return
        }
        const email = String(body.email ?? '').toLowerCase()
        if (email === adminEmail) {
          res.status(400).json({ ok: false, error: 'The main account cannot be removed.' })
          return
        }
        await deleteAccount(config, email)
        res.status(200).json({ ok: true })
        return
      }
      res.status(400).json({ ok: false, error: 'Unknown action.' })
    } catch (error) {
      res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Accounts error.' })
    }
    return
  }

  // ---- devices (real logged-in device sessions per account) ----
  if (kind === 'devices') {
    res.setHeader('Cache-Control', 'no-store')
    const action = qv(req.query.action) ?? ''
    try {
      if (req.method === 'GET' && action === 'list') {
        const email = (qv(req.query.email) ?? '').trim().toLowerCase()
        if (!email) {
          res.status(400).json({ ok: false, error: 'email is required.', devices: [] })
          return
        }
        res.status(200).json({ ok: true, configured: true, devices: await fetchDevices(config, email) })
        return
      }
      const email = String(body.email ?? '').trim().toLowerCase()
      if (!email) {
        res.status(400).json({ ok: false, error: 'email is required.' })
        return
      }
      if (action === 'register') {
        const device = body.device as DeviceRecord | undefined
        if (!device || typeof device.id !== 'string') {
          res.status(400).json({ ok: false, error: 'device is required.' })
          return
        }
        res.status(200).json({ ok: true, configured: true, devices: await registerDevice(config, email, device) })
        return
      }
      if (action === 'remove') {
        const id = String(body.id ?? '')
        res.status(200).json({ ok: true, configured: true, devices: await removeDevice(config, email, id) })
        return
      }
      if (action === 'removeOthers') {
        const keepId = String(body.keepId ?? '')
        res.status(200).json({ ok: true, configured: true, devices: await removeOtherDevices(config, email, keepId) })
        return
      }
      res.status(400).json({ ok: false, error: 'Unknown action.' })
    } catch (error) {
      res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Devices error.' })
    }
    return
  }

  res.status(400).json({ ok: false, error: 'Unknown kind.' })
}
