import http from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  analyzeSmartVideoUrl,
  openSmartMp4Stream,
  validateMp4HeaderBuffer,
} from '../api/_lib/smart-download-core'
import { DownloadEmbedModal } from './DownloadEmbedModal'
import { DownloadsScreen } from './DownloadsScreen'
import { closeInSiteDownload, openInSiteDownload } from './downloads'

const MP4_SAMPLE = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x14]),
  Buffer.from('ftypisom'),
  Buffer.from([0x00, 0x00, 0x02, 0x00]),
  Buffer.from('isommp41'),
  Buffer.alloc(2048, 0x01),
])

function startMockServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse, baseUrl: string) => void,
): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const addr = server.address() as { port: number }
      handler(req, res, `http://127.0.0.1:${addr.port}`)
    })
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` })
    })
  })
}

describe('Smart Video Downloader integration in Lumen website', () => {
  const servers: http.Server[] = []

  beforeEach(() => {
    window.localStorage.clear()
    closeInSiteDownload()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    closeInSiteDownload()
    while (servers.length > 0) {
      const srv = servers.pop()!
      await new Promise<void>((resolve) => srv.close(() => resolve()))
    }
  })

  it('blocks SSRF/private URLs and invalid schemes', async () => {
    const invalidScheme = await analyzeSmartVideoUrl('ftp://example.com/video.mp4')
    expect(invalidScheme.status).toBe('Unsupported URL')
    expect(invalidScheme.downloadable).toBe(false)

    const ssrfBlocked = await analyzeSmartVideoUrl('http://127.0.0.1:8080/secret.mp4')
    expect(ssrfBlocked.status).toBe('Protected or restricted source')
    expect(ssrfBlocked.downloadable).toBe(false)
  })

  it('validates MP4 ftyp signatures and rejects HTML error pages', () => {
    expect(validateMp4HeaderBuffer(MP4_SAMPLE).valid).toBe(true)
    const htmlCheck = validateMp4HeaderBuffer(Buffer.from('<!doctype html><html>Error</html>'))
    expect(htmlCheck.valid).toBe(false)
    expect(htmlCheck.looksLikeHtmlOrText).toBe(true)
  })

  it('analyzes an embed HTML page with a real MP4 source and streams verified MP4 bytes', async () => {
    const { server, baseUrl } = await startMockServer((req, res, origin) => {
      if (req.url === '/embed/movie/1084242') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(
          `<html><head><title>Sample Movie</title></head><body><video src="${origin}/media/sample.mp4"></video></body></html>`,
        )
        return
      }
      if (req.url === '/media/sample.mp4') {
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': String(MP4_SAMPLE.length),
        })
        res.end(MP4_SAMPLE)
        return
      }
      if (req.url === '/embed/hls-only') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(
          `<html><head><title>HLS Stream</title></head><body><video src="${origin}/live/master.m3u8"></video></body></html>`,
        )
        return
      }
      res.writeHead(404)
      res.end('Not found')
    })
    servers.push(server)

    const mp4Analysis = await analyzeSmartVideoUrl(`${baseUrl}/embed/movie/1084242`, {
      allowLoopbackForTests: true,
    })
    expect(mp4Analysis.status).toBe('Direct MP4 found')
    expect(mp4Analysis.deliveryFormat).toBe('Direct MP4')
    expect(mp4Analysis.downloadable).toBe(true)
    expect(mp4Analysis.permittedSourceUrl).toBe(`${baseUrl}/media/sample.mp4`)

    const streamRes = await openSmartMp4Stream(`${baseUrl}/media/sample.mp4`, {
      allowLoopbackForTests: true,
    })
    expect(streamRes.ok).toBe(true)
    expect(streamRes.contentType).toContain('video/mp4')
    await streamRes.response?.body?.cancel().catch(() => {})

    const hlsAnalysis = await analyzeSmartVideoUrl(`${baseUrl}/embed/hls-only`, {
      allowLoopbackForTests: true,
    })
    expect(hlsAnalysis.status).toBe('Streaming-only source')
    expect(hlsAnalysis.deliveryFormat).toBe('HLS')
    expect(hlsAnalysis.downloadable).toBe(false)
  })

  it('switches into Smart Downloader inside DownloadEmbedModal and runs embed analysis', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          id: 'res-1',
          inputUrl: 'https://cinesrc.st/embed/movie/1084242',
          finalUrl: 'https://cinesrc.st/embed/movie/1084242',
          host: 'cinesrc.st',
          status: 'Streaming-only source',
          deliveryFormat: 'HLS',
          title: 'Test Movie',
          downloadable: false,
          suggestedFileName: 'Test Movie.mp4',
          explanation: 'This embed delivers video via HLS adaptive streaming without a direct MP4.',
          signals: {
            hasDrmSignals: false,
            hasAntiBotOrChallenge: false,
            hasAuthGate: false,
            hasHlsManifest: true,
            hasDashManifest: false,
            explicitDownloadLinkFound: false,
          },
          candidates: [],
          analyzedAt: new Date().toISOString(),
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <>
        <DownloadsScreen onBack={vi.fn()} onExplore={vi.fn()} />
        <DownloadEmbedModal />
      </>,
    )

    // Launch Smart Downloader directly from DownloadsScreen header button
    fireEvent.click(screen.getByRole('button', { name: /Smart Downloader/i }))

    const urlInput = await screen.findByLabelText('Embed URL')
    expect(urlInput).toBeInTheDocument()

    fireEvent.change(urlInput, {
      target: { value: 'https://cinesrc.st/embed/movie/1084242' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Analyze/i }))

    await waitFor(() => {
      expect(screen.getByText('Streaming-only source')).toBeInTheDocument()
      expect(screen.getByText('HLS')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Unavailable/i })).toBeDisabled()
    })

    // Also verify switching from 02Downloader pre-fills embedUrl and scans all serverUrls
    const multiServerFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body || '{}')) as { url?: string }
      const isMp4Server = payload.url?.includes('vidrift')
      return {
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            id: isMp4Server ? 'res-mp4' : 'res-hls',
            inputUrl: payload.url || '',
            finalUrl: payload.url || '',
            host: isMp4Server ? 'vidrift.example' : 'cinesrc.st',
            status: isMp4Server ? 'Direct MP4 found' : 'Streaming-only source',
            deliveryFormat: isMp4Server ? 'Direct MP4' : 'HLS',
            title: 'Test Movie',
            downloadable: Boolean(isMp4Server),
            permittedSourceUrl: isMp4Server ? 'https://cdn.vidrift.example/movie.mp4' : undefined,
            suggestedFileName: 'Test Movie.mp4',
            explanation: isMp4Server ? 'Direct MP4 verified.' : 'HLS only.',
            signals: {
              hasDrmSignals: false,
              hasAntiBotOrChallenge: false,
              hasAuthGate: false,
              hasHlsManifest: !isMp4Server,
              hasDashManifest: false,
              explicitDownloadLinkFound: Boolean(isMp4Server),
            },
            candidates: [],
            analyzedAt: new Date().toISOString(),
          },
        }),
      }
    })
    vi.stubGlobal('fetch', multiServerFetch)

    act(() => {
      openInSiteDownload({
        url: 'https://02moviedownloader.site/api/download/movie/1084242',
        embedUrl: 'https://cinesrc.st/embed/movie/1084242',
        serverUrls: [
          { id: 'cinesrc', name: 'CineSrc', url: 'https://cinesrc.st/embed/movie/1084242' },
          { id: 'vidrift', name: 'Vidrift', url: 'https://vidrift.example/embed/1084242' },
        ],
        title: 'Test Movie',
        subtitle: 'Movie Download',
      })
    })
    fireEvent.click(screen.getByRole('tab', { name: /Smart Downloader/i }))

    await waitFor(() => {
      expect(screen.getByText(/Server Scan \(2\/2\)/i)).toBeInTheDocument()
      expect(screen.getByText(/1 downloadable MP4 found/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Download MP4/i })).toBeEnabled()
    })
  })
})
