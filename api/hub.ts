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
  supabaseConfigFromEnv,
  type StoredProfile,
} from './_lib/supabase-core.js'
import {
  createTmdbTrailerAuthChain,
  fetchTmdbTrailerYoutubeId,
} from './_lib/tmdb-trailer-core.js'
import { fetchPosterImage, posterKeysFromEnv } from './_lib/poster-core.js'
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
  saveAccount,
  verifyAccount,
} from './_lib/accounts-core.js'

type QueryValue = string | string[] | undefined

type ApiRequest = {
  method?: string
  query: Record<string, QueryValue>
  body?: unknown
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

  // Everything below needs Supabase.
  const config = supabaseConfigFromEnv(env)
  if (!config) {
    res.status(200).json({ ok: false, configured: false, profiles: null })
    return
  }

  const body = parseBody(req)

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
        res.status(200).json({ ok: true, configured: true, profiles: await fetchAccountProfiles(config, email) })
        return
      }
      const email = String(body.email ?? '').trim().toLowerCase()
      const profiles = body.profiles
      if (!email || !Array.isArray(profiles)) {
        res.status(400).json({ ok: false, error: 'email and profiles[] required.' })
        return
      }
      await saveAccountProfiles(config, email, profiles as StoredProfile[])
      res.status(200).json({ ok: true, configured: true })
    } catch (error) {
      res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Supabase error.' })
    }
    return
  }

  // ---- watch-party ----
  if (kind === 'watch-party') {
    res.setHeader('Cache-Control', 'no-store')
    const action = qv(req.query.action) ?? ''
    try {
      if (req.method === 'GET') {
        if (action === 'friends') {
          const email = (qv(req.query.email) ?? '').toLowerCase()
          const emails = (await listAccountEmails(config)).filter((c) => c.toLowerCase() !== email)
          res.status(200).json({ ok: true, configured: true, friends: emails })
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
        await updateParty(config, String(body.id), { playback: body.playback as { playing: boolean; time: number } })
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
    const adminEmail = adminEmailFromEnv(env)
    const action = qv(req.query.action) ?? ''
    const isAdmin = (value: unknown) => String(value ?? '').toLowerCase() === adminEmail
    try {
      if (req.method === 'POST' && action === 'verify') {
        res.status(200).json({ ok: await verifyAccount(config, String(body.email ?? '').toLowerCase(), String(body.password ?? '')) })
        return
      }
      if (req.method === 'GET' && action === 'list') {
        if (!isAdmin(qv(req.query.admin))) {
          res.status(403).json({ ok: false, error: 'Not authorized.' })
          return
        }
        res.status(200).json({ ok: true, configured: true, accounts: await listAccounts(config) })
        return
      }
      if (req.method === 'POST' && action === 'save') {
        if (!isAdmin(body.admin)) {
          res.status(403).json({ ok: false, error: 'Not authorized.' })
          return
        }
        const email = String(body.email ?? '').trim().toLowerCase()
        const password = String(body.password ?? '')
        if (!email || !email.includes('@') || password.length < 4) {
          res.status(400).json({ ok: false, error: 'Valid email and password (4+ chars) required.' })
          return
        }
        await saveAccount(config, email, password, String(body.previousEmail ?? '').toLowerCase() || undefined)
        res.status(200).json({ ok: true })
        return
      }
      if (req.method === 'POST' && action === 'delete') {
        if (!isAdmin(body.admin)) {
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

  res.status(400).json({ ok: false, error: 'Unknown kind.' })
}
