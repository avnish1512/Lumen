import {
  fetchAccountProfiles,
  saveAccountProfiles,
  supabaseConfigFromEnv,
  type StoredProfile,
} from './_lib/supabase-core.js'

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

function getQueryValue(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store')

  const config = supabaseConfigFromEnv(process.env as Record<string, string | undefined>)

  // No backend configured yet — behave as a no-op so the client falls back to
  // its local cache instead of erroring.
  if (!config) {
    if (req.method === 'GET') {
      res.status(200).json({ ok: false, configured: false, profiles: null })
    } else {
      res.status(200).json({ ok: false, configured: false })
    }
    return
  }

  try {
    if (req.method === 'GET') {
      const email = (getQueryValue(req.query.email) ?? '').trim().toLowerCase()
      if (!email) {
        res.status(400).json({ ok: false, error: 'email is required.', profiles: null })
        return
      }
      const profiles = await fetchAccountProfiles(config, email)
      res.status(200).json({ ok: true, configured: true, profiles })
      return
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
      const email = String((body as { email?: string }).email ?? '').trim().toLowerCase()
      const profiles = (body as { profiles?: StoredProfile[] }).profiles

      if (!email || !Array.isArray(profiles)) {
        res.status(400).json({ ok: false, error: 'email and profiles[] are required.' })
        return
      }

      await saveAccountProfiles(config, email, profiles)
      res.status(200).json({ ok: true, configured: true })
      return
    }

    res.status(405).json({ ok: false, error: 'Method not allowed.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Supabase request failed.'
    res.status(502).json({ ok: false, error: message })
  }
}
