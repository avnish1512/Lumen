import { supabaseConfigFromEnv } from './_lib/supabase-core.js'
import {
  createInvite,
  getParty,
  incomingInvites,
  listAccountEmails,
  updateParty,
} from './_lib/watch-party-core.js'

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
}

function qv(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store')

  const config = supabaseConfigFromEnv(process.env as Record<string, string | undefined>)
  if (!config) {
    res.status(200).json({ ok: false, configured: false })
    return
  }

  const action = qv(req.query.action) ?? ''
  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}) as Record<string, unknown>

  try {
    if (req.method === 'GET') {
      if (action === 'friends') {
        const email = (qv(req.query.email) ?? '').toLowerCase()
        const emails = (await listAccountEmails(config)).filter(
          (candidate) => candidate.toLowerCase() !== email,
        )
        res.status(200).json({ ok: true, configured: true, friends: emails })
        return
      }
      if (action === 'incoming') {
        const email = (qv(req.query.email) ?? '').toLowerCase()
        const invites = await incomingInvites(config, email)
        res.status(200).json({ ok: true, configured: true, invites })
        return
      }
      if (action === 'party') {
        const id = qv(req.query.id) ?? ''
        const party = id ? await getParty(config, id) : null
        res.status(200).json({ ok: true, configured: true, party })
        return
      }
      res.status(400).json({ ok: false, error: 'Unknown action.' })
      return
    }

    if (req.method === 'POST') {
      if (action === 'invite') {
        const hostEmail = String(body.hostEmail ?? '').toLowerCase()
        const guestEmail = String(body.guestEmail ?? '').toLowerCase()
        if (!hostEmail || !guestEmail || !body.movie) {
          res.status(400).json({ ok: false, error: 'hostEmail, guestEmail, movie required.' })
          return
        }
        const party = await createInvite(config, hostEmail, guestEmail, body.movie)
        res.status(200).json({ ok: true, configured: true, party })
        return
      }
      if (action === 'accept') {
        await updateParty(config, String(body.id), { status: 'accepted' })
        res.status(200).json({ ok: true })
        return
      }
      if (action === 'state') {
        await updateParty(config, String(body.id), {
          playback: body.playback as { playing: boolean; time: number },
        })
        res.status(200).json({ ok: true })
        return
      }
      if (action === 'end') {
        await updateParty(config, String(body.id), { status: 'ended' })
        res.status(200).json({ ok: true })
        return
      }
      res.status(400).json({ ok: false, error: 'Unknown action.' })
      return
    }

    res.status(405).json({ ok: false, error: 'Method not allowed.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Watch-party request failed.'
    res.status(502).json({ ok: false, error: message })
  }
}
