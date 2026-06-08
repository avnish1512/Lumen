import {
  isSuperEmbedRedirectUrl,
  resolveSuperEmbedPlayerUrl,
  superEmbedOptionsFromParams,
} from './superembed-core.js'

type QueryValue = string | string[] | undefined

type ApiRequest = {
  method?: string
  query: Record<string, QueryValue>
}

type ApiResponse = {
  send: (body: string) => void
  setHeader: (name: string, value: string) => void
  status: (code: number) => ApiResponse
}

function appendQueryValue(params: URLSearchParams, key: string, value: QueryValue) {
  if (Array.isArray(value)) {
    value.forEach((item) => params.append(key, item))
    return
  }

  if (value) {
    params.set(key, value)
  }
}

function paramsFromQuery(query: Record<string, QueryValue>) {
  const params = new URLSearchParams()

  Object.entries(query).forEach(([key, value]) => {
    appendQueryValue(params, key, value)
  })

  return params
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).send('Method not allowed.')
    return
  }

  const options = superEmbedOptionsFromParams(paramsFromQuery(req.query))

  if (!options) {
    res.status(400).send('Missing video_id')
    return
  }

  try {
    const playerUrl = await resolveSuperEmbedPlayerUrl(options)

    if (!isSuperEmbedRedirectUrl(playerUrl)) {
      res.status(502).send(playerUrl || "Request server didn't respond")
      return
    }

    res.setHeader('Location', playerUrl)
    res.status(302).send('Redirecting to player.')
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Request server didn't respond"

    res.status(502).send(message)
  }
}
