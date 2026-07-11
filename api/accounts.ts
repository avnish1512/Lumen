import { supabaseConfigFromEnv } from './_lib/supabase-core.js'
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
}

function qv(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store')

  const env = process.env as Record<string, string | undefined>
  const config = supabaseConfigFromEnv(env)
  if (!config) {
    res.status(200).json({ ok: false, configured: false })
    return
  }

  const adminEmail = adminEmailFromEnv(env)
  const action = qv(req.query.action) ?? ''
  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}) as Record<string, unknown>
  const isAdmin = (value: unknown) => String(value ?? '').toLowerCase() === adminEmail

  try {
    // Public: login credential check (does not expose other accounts).
    if (req.method === 'POST' && action === 'verify') {
      const ok = await verifyAccount(
        config,
        String(body.email ?? '').toLowerCase(),
        String(body.password ?? ''),
      )
      res.status(200).json({ ok })
      return
    }

    // Everything below is admin-only.
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
    const message = error instanceof Error ? error.message : 'Accounts request failed.'
    res.status(502).json({ ok: false, error: message })
  }
}
