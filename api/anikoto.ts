import { fetchAnikotoRecent, fetchAnikotoSeries } from './_lib/anikoto-core.js'

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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' })
    return
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')

  const action = getQueryValue(req.query.action) ?? 'recent'

  try {
    if (action === 'series') {
      const id = getQueryValue(req.query.id)

      if (!id) {
        res.status(400).json({ ok: false, error: 'Provide id for a series lookup.' })
        return
      }

      const body = await fetchAnikotoSeries(id)
      res.status(200).json(body)
      return
    }

    const body = await fetchAnikotoRecent(
      getQueryValue(req.query.page),
      getQueryValue(req.query.per_page),
    )
    res.status(200).json(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach Anikoto.'
    res.status(502).json({ ok: false, error: message })
  }
}
