import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { createMinimalValidMp4Buffer } from '../src/main/analysis/mp4Signature'
import {
  analyzeVideoUrl,
  NO_PERMITTED_MP4_MESSAGE,
} from '../src/main/analysis/urlAnalyzer'
import { startMockServer, type MockServerHandle } from './helpers/mockServer'

describe('URL Analysis Engine', () => {
  let mock: MockServerHandle
  const sampleMp4 = createMinimalValidMp4Buffer(8192)

  beforeAll(async () => {
    mock = await startMockServer((req, res) => {
      const reqUrl = req.url || '/'

      if (reqUrl === '/direct-video.mp4') {
        const range = req.headers.range
        if (range) {
          res.writeHead(206, {
            'Content-Type': 'video/mp4',
            'Content-Length': String(Math.min(2048, sampleMp4.length)),
            'Content-Range': `bytes 0-${Math.min(2047, sampleMp4.length - 1)}/${sampleMp4.length}`,
          })
          res.end(sampleMp4.subarray(0, 2048))
          return
        }
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': String(sampleMp4.length),
        })
        res.end(sampleMp4)
        return
      }

      if (reqUrl === '/embed-permitted') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Permitted Sample Clip</title></head>
            <body>
              <video controls src="/direct-video.mp4"></video>
              <a href="/direct-video.mp4" download>Download MP4</a>
            </body>
          </html>
        `)
        return
      }

      if (reqUrl === '/embed-no-source') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Iframe Only Embed</title></head>
            <body>
              <iframe src="https://example.org/player-frame"></iframe>
              <div id="app">Player hydrating...</div>
            </body>
          </html>
        `)
        return
      }

      if (reqUrl === '/embed-hls') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>HLS Live Stream</title></head>
            <body>
              <video controls>
                <source src="/stream/master.m3u8" type="application/vnd.apple.mpegurl" />
              </video>
            </body>
          </html>
        `)
        return
      }

      if (reqUrl === '/stream/master.m3u8') {
        res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' })
        res.end('#EXTM3U\n#EXT-X-VERSION:3\n')
        return
      }

      if (reqUrl === '/embed-protected-nodownload') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Protected Embed</title></head>
            <body>
              <video controls controlsList="nodownload" src="/direct-video.mp4"></video>
            </body>
          </html>
        `)
        return
      }

      if (reqUrl === '/embed-drm') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>DRM Movie Stream</title></head>
            <body>
              <script>
                // Metadata mentions EME / Widevine DRM protection
                const drmSystem = 'com.widevine.alpha';
              </script>
              <video controls src="/direct-video.mp4"></video>
            </body>
          </html>
        `)
        return
      }

      if (reqUrl === '/embed-cinesrc-sim') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          Server: 'ddos-guard',
          'Set-Cookie': '__ddg1_=mocktoken; Path=/',
        })
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>CineSrc - Free Video Streaming API</title></head>
            <body><script src="/_next/static/chunks/app.js"></script></body>
          </html>
        `)
        return
      }

      if (reqUrl === '/protected-403') {
        res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<html><body>Forbidden: Valid session required</body></html>')
        return
      }

      if (reqUrl === '/fake-mp4-html.mp4') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<!DOCTYPE html><html><body>Error: expired token</body></html>')
        return
      }

      if (reqUrl === '/expired-404') {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found')
        return
      }

      if (reqUrl === '/ssrf-redirect') {
        res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' })
        res.end()
        return
      }

      res.writeHead(500)
      res.end('Server error')
    })
  })

  afterAll(async () => {
    await mock.close()
  })

  it('detects and verifies a direct MP4 URL permitted to download', async () => {
    const res = await analyzeVideoUrl(`${mock.baseUrl}/direct-video.mp4`, {
      security: { allowLoopbackForTests: true },
    })

    expect(res.status).toBe('Direct MP4 found')
    expect(res.deliveryFormat).toBe('Direct MP4')
    expect(res.downloadable).toBe(true)
    expect(res.permittedSourceUrl).toBe(`${mock.baseUrl}/direct-video.mp4`)
    expect(res.contentLength).toBe(sampleMp4.length)
  })

  it('extracts and verifies a permitted MP4 from an HTML embed page', async () => {
    const res = await analyzeVideoUrl(`${mock.baseUrl}/embed-permitted`, {
      security: { allowLoopbackForTests: true },
    })

    expect(res.status).toBe('Direct MP4 found')
    expect(res.deliveryFormat).toBe('Direct MP4')
    expect(res.title).toBe('Permitted Sample Clip')
    expect(res.downloadable).toBe(true)
    expect(res.permittedSourceUrl).toBe(`${mock.baseUrl}/direct-video.mp4`)
    expect(res.signals.explicitDownloadLinkFound).toBe(true)
  })

  it('rejects an embed URL with no downloadable source without guessing iframe URLs', async () => {
    const res = await analyzeVideoUrl(`${mock.baseUrl}/embed-no-source`, {
      security: { allowLoopbackForTests: true },
    })

    expect(res.downloadable).toBe(false)
    expect(res.permittedSourceUrl).toBeUndefined()
    expect(res.deliveryFormat).toBe('Unknown')
    expect(res.status).toBe('Streaming-only source')
    expect(res.explanation).toContain(NO_PERMITTED_MP4_MESSAGE)
  })

  it('identifies HLS streaming-only sources and disables downloading', async () => {
    const resHtml = await analyzeVideoUrl(`${mock.baseUrl}/embed-hls`, {
      security: { allowLoopbackForTests: true },
    })
    expect(resHtml.downloadable).toBe(false)
    expect(resHtml.status).toBe('Streaming-only source')
    expect(resHtml.deliveryFormat).toBe('HLS')
    expect(resHtml.signals.hasHlsManifest).toBe(true)
    expect(resHtml.explanation).toContain(NO_PERMITTED_MP4_MESSAGE)

    const resManifest = await analyzeVideoUrl(`${mock.baseUrl}/stream/master.m3u8`, {
      security: { allowLoopbackForTests: true },
    })
    expect(resManifest.downloadable).toBe(false)
    expect(resManifest.status).toBe('Streaming-only source')
    expect(resManifest.deliveryFormat).toBe('HLS')
  })

  it('identifies protected sources (403, controlsList=nodownload, DRM, ddos-guard CineSrc pattern)', async () => {
    const res403 = await analyzeVideoUrl(`${mock.baseUrl}/protected-403`, {
      security: { allowLoopbackForTests: true },
    })
    expect(res403.downloadable).toBe(false)
    expect(res403.status).toBe('Protected or restricted source')
    expect(res403.explanation).toContain(NO_PERMITTED_MP4_MESSAGE)

    const resNoDownload = await analyzeVideoUrl(`${mock.baseUrl}/embed-protected-nodownload`, {
      security: { allowLoopbackForTests: true },
    })
    expect(resNoDownload.downloadable).toBe(false)
    expect(resNoDownload.status).toBe('Protected or restricted source')
    expect(resNoDownload.explanation).toContain(NO_PERMITTED_MP4_MESSAGE)

    const resDrm = await analyzeVideoUrl(`${mock.baseUrl}/embed-drm`, {
      security: { allowLoopbackForTests: true },
    })
    expect(resDrm.downloadable).toBe(false)
    expect(resDrm.status).toBe('Protected or restricted source')
    expect(resDrm.signals.hasDrmSignals).toBe(true)

    const resCineSrc = await analyzeVideoUrl(`${mock.baseUrl}/embed-cinesrc-sim`, {
      security: { allowLoopbackForTests: true },
    })
    expect(resCineSrc.downloadable).toBe(false)
    expect(resCineSrc.status).toBe('Protected or restricted source')
    expect(resCineSrc.signals.hasAntiBotOrChallenge).toBe(true)
    expect(resCineSrc.explanation).toContain(NO_PERMITTED_MP4_MESSAGE)
  })

  it('rejects invalid URLs and blocks SSRF redirect targets', async () => {
    const resInvalid = await analyzeVideoUrl('ftp://example.com/movie.mp4')
    expect(resInvalid.downloadable).toBe(false)
    expect(resInvalid.status).toBe('Unsupported URL')

    const resPrivate = await analyzeVideoUrl('http://192.168.1.50/embed')
    expect(resPrivate.downloadable).toBe(false)
    expect(resPrivate.status).toBe('Unsupported URL')

    const resRedirectSsrf = await analyzeVideoUrl(`${mock.baseUrl}/ssrf-redirect`, {
      security: { allowLoopbackForTests: true },
    })
    expect(resRedirectSsrf.downloadable).toBe(false)
    expect(resRedirectSsrf.status).toBe('Unsupported URL')
    expect(resRedirectSsrf.error).toMatch(/blocked/i)
  })

  it('handles broken, expired, unreachable, and fake-HTML MP4 URLs cleanly', async () => {
    const res404 = await analyzeVideoUrl(`${mock.baseUrl}/expired-404`, {
      security: { allowLoopbackForTests: true },
    })
    expect(res404.downloadable).toBe(false)
    expect(res404.status).toBe('Failed')

    const resFakeHtml = await analyzeVideoUrl(`${mock.baseUrl}/fake-mp4-html.mp4`, {
      security: { allowLoopbackForTests: true },
    })
    expect(resFakeHtml.downloadable).toBe(false)
    expect(resFakeHtml.permittedSourceUrl).toBeUndefined()

    const resUnreachable = await analyzeVideoUrl('http://127.0.0.1:1/video.mp4', {
      security: { allowLoopbackForTests: true, timeoutMs: 1500 },
    })
    expect(resUnreachable.downloadable).toBe(false)
    expect(resUnreachable.status).toBe('Failed')
  })
})
