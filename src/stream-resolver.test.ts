import { describe, it, expect } from 'vitest'
import {
  isDirectBinaryUrl,
  buildProxiedStreamUrl,
  resolveStreamSources,
} from '../api/_lib/stream-resolver-core'

describe('Stream Resolver and Proxy', () => {
  describe('isDirectBinaryUrl', () => {
    it('detects direct mp4 URLs', () => {
      expect(isDirectBinaryUrl('https://example.com/video.mp4')).toBe(true)
      expect(isDirectBinaryUrl('https://example.com/video.mp4?token=abc')).toBe(true)
    })

    it('detects direct m3u8 HLS URLs', () => {
      expect(isDirectBinaryUrl('https://cdn.example.com/stream/index.m3u8')).toBe(true)
      expect(isDirectBinaryUrl('https://cdn.example.com/stream/master.m3u8?auth=123')).toBe(true)
    })

    it('detects webm and blob URLs', () => {
      expect(isDirectBinaryUrl('https://example.com/media.webm')).toBe(true)
      expect(isDirectBinaryUrl('blob:http://localhost:5173/abcd-1234')).toBe(true)
    })

    it('rejects non-binary/embed URLs', () => {
      expect(isDirectBinaryUrl('https://vidsrc.to/embed/movie/1234')).toBe(false)
      expect(isDirectBinaryUrl('https://superembed.stream/video.php?id=tt123')).toBe(false)
      expect(isDirectBinaryUrl('')).toBe(false)
      expect(isDirectBinaryUrl(undefined)).toBe(false)
    })
  })

  describe('buildProxiedStreamUrl', () => {
    it('generates stream proxy URL with encoded target', () => {
      const target = 'https://media.source.com/video.mp4?sig=xyz'
      const proxied = buildProxiedStreamUrl(target)
      expect(proxied).toContain('/api/stream-proxy?url=')
      expect(proxied).toContain(encodeURIComponent(target))
    })

    it('appends custom headers to proxy URL if provided', () => {
      const target = 'https://media.source.com/video.mp4'
      const headers = { Referer: 'https://origin.site/', 'User-Agent': 'CustomUA' }
      const proxied = buildProxiedStreamUrl(target, headers)
      expect(proxied).toContain('headers=')
      expect(decodeURIComponent(proxied)).toContain('Referer')
    })
  })

  describe('resolveStreamSources', () => {
    it('immediately resolves if caller already provides direct binary stream', async () => {
      const direct = 'https://cdn.example.org/files/movie1080p.mp4'
      const result = await resolveStreamSources({
        title: 'Test Movie',
        directUrl: direct,
      })

      expect(result.ok).toBe(true)
      expect(result.streamUrl).toBe(direct)
      expect(result.format).toBe('mp4')
      expect(result.proxiedUrl).toContain('/api/stream-proxy?url=')
    })

    it('returns structured fallback error when no streams are resolvable', async () => {
      const result = await resolveStreamSources({
        title: 'NonExistentUnknownTitleXYZ999',
        mediaType: 'movie',
      })

      expect(result.ok).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
