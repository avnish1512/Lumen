import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Stream Proxy Core
 * Proxies media streams (MP4/HLS chunks) with open CORS headers and forwards upstream
 * Referer/User-Agent headers so the browser's download manager can ingest video blobs
 * into IndexedDB without CORS errors.
 */

export async function handleStreamProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  targetUrl: string,
  customHeaders?: Record<string, string>,
): Promise<void> {
  // Add permissive CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Authorization')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Valid http/https target URL is required.' }))
    return
  }

  try {
    const upstreamHeaders: Record<string, string> = {
      'User-Agent':
        (req.headers['user-agent'] as string) ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: '*/*',
      ...(customHeaders || {}),
    }

    if (req.headers.range) {
      upstreamHeaders.Range = req.headers.range as string
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers: upstreamHeaders,
    })

    res.statusCode = upstreamResponse.status

    // Forward relevant headers
    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
    ]

    for (const header of headersToForward) {
      const val = upstreamResponse.headers.get(header)
      if (val) {
        res.setHeader(header, val)
      }
    }

    if (!upstreamResponse.body) {
      res.end()
      return
    }

    // Stream the body chunks directly to the response
    const reader = upstreamResponse.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        res.write(Buffer.from(value))
      }
    }
    res.end()
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to proxy stream chunk.',
        }),
      )
    } else {
      res.end()
    }
  }
}
