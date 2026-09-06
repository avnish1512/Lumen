import { describe, it, expect } from 'vitest'
import { isSafeProxyUrl, filterSafeHeaders } from '../api/_lib/stream-proxy-core'
import { ANILIST_CLIENTS } from './anilist'

describe('Security: Stream Proxy SSRF Protection', () => {
  it('allows safe public HTTP and HTTPS stream URLs', () => {
    const safeUrls = [
      'https://video.bunnycdn.com/stream/chunk_01.ts',
      'https://cdn.example.org/hls/master.m3u8',
      'http://stream.video-service.net/segment.mp4?token=abc123',
    ]

    for (const url of safeUrls) {
      const result = isSafeProxyUrl(url)
      expect(result.safe).toBe(true)
      expect(result.error).toBeUndefined()
    }
  })

  it('blocks non-http/https protocols', () => {
    const dangerousUrls = [
      'ftp://files.example.com/video.mp4',
      'file:///etc/passwd',
      'file:///C:/Windows/System32/drivers/etc/hosts',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'gopher://evil.com/',
    ]

    for (const url of dangerousUrls) {
      const result = isSafeProxyUrl(url)
      expect(result.safe).toBe(false)
      expect(result.error).toBeDefined()
    }
  })

  it('blocks loopback and localhost addresses', () => {
    const loopbackUrls = [
      'http://localhost:3000/api',
      'http://127.0.0.1:8080/secret',
      'http://127.0.0.2/admin',
      'http://127.255.255.254/internal',
      'http://0.0.0.0:8080/',
      'http://[::1]:3000/',
      'http://app.localhost/',
    ]

    for (const url of loopbackUrls) {
      const result = isSafeProxyUrl(url)
      expect(result.safe).toBe(false)
      expect(result.error).toMatch(/loopback|internal|forbidden/i)
    }
  })

  it('blocks cloud metadata endpoints (AWS, GCP, etc.)', () => {
    const metadataUrls = [
      'http://169.254.169.254/latest/meta-data/',
      'http://169.254.169.254/latest/dynamic/instance-identity/document',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://instance-data/latest/meta-data/',
    ]

    for (const url of metadataUrls) {
      const result = isSafeProxyUrl(url)
      expect(result.safe).toBe(false)
      expect(result.error).toMatch(/cloud metadata|link-local|internal/i)
    }
  })

  it('blocks RFC 1918 private network addresses', () => {
    const privateUrls = [
      'http://10.0.0.1/admin',
      'http://10.254.1.1/dashboard',
      'http://172.16.0.1:8080/internal',
      'http://172.31.255.255/api',
      'http://192.168.1.1/setup',
      'http://192.168.0.254/gateway',
    ]

    for (const url of privateUrls) {
      const result = isSafeProxyUrl(url)
      expect(result.safe).toBe(false)
      expect(result.error).toMatch(/private network/i)
    }
  })

  it('blocks obfuscated IP representations', () => {
    const obfuscatedUrls = [
      'http://2130706433/admin', // 127.0.0.1 in decimal
      'http://0x7f000001/status', // 127.0.0.1 in hex
    ]

    for (const url of obfuscatedUrls) {
      const result = isSafeProxyUrl(url)
      expect(result.safe).toBe(false)
      expect(result.error).toMatch(/loopback|hexadecimal|integer|forbidden/i)
    }
  })
})

describe('Security: Stream Proxy Header Sanitization', () => {
  it('allows safe media playback headers (referer, origin, user-agent, range)', () => {
    const headers = {
      Referer: 'https://getsuperembed.link/',
      Origin: 'https://example.com',
      'User-Agent': 'CustomUA/1.0',
      Range: 'bytes=0-1048576',
    }

    const sanitized = filterSafeHeaders(headers)
    expect(sanitized.Referer).toBe('https://getsuperembed.link/')
    expect(sanitized.Origin).toBe('https://example.com')
    expect(sanitized['User-Agent']).toBe('CustomUA/1.0')
    expect(sanitized.Range).toBe('bytes=0-1048576')
  })

  it('strips dangerous authentication, cookie, and host headers', () => {
    const dangerousHeaders = {
      Authorization: 'Bearer secret_token_123',
      Cookie: 'session=sensitive_data',
      'Set-Cookie': 'malicious=true',
      Host: 'internal-vault.local',
      'X-Admin-Key': 'secret_admin_pw',
      'X-Forwarded-For': '127.0.0.1',
      Referer: 'https://valid-upstream.com/',
    }

    const sanitized = filterSafeHeaders(dangerousHeaders)
    expect(sanitized.Referer).toBe('https://valid-upstream.com/')
    expect(sanitized.Authorization).toBeUndefined()
    expect(sanitized.Cookie).toBeUndefined()
    expect(sanitized['Set-Cookie']).toBeUndefined()
    expect(sanitized.Host).toBeUndefined()
    expect(sanitized['X-Admin-Key']).toBeUndefined()
    expect(sanitized['X-Forwarded-For']).toBeUndefined()
  })

  it('sanitizes CRLF line breaks to prevent HTTP header injection / splitting', () => {
    const injectionHeaders = {
      Referer: 'https://example.com/\r\nX-Injected: attack',
    }

    const sanitized = filterSafeHeaders(injectionHeaders)
    expect(sanitized.Referer).toBe('https://example.com/X-Injected: attack')
    expect(sanitized.Referer).not.toContain('\r')
    expect(sanitized.Referer).not.toContain('\n')
  })
})

describe('Security: Credential Hardening', () => {
  it('does not contain hardcoded AniList client secrets in source', () => {
    for (const client of ANILIST_CLIENTS) {
      // Secret must not be hardcoded default string
      expect(client.secret).not.toBe('sx912uXkCtWuA3wLZPP3T9IAyEfYfkC8qjxxWvHn')
      expect(client.secret).not.toBe('fjVuedrK0l2Jg6DrNE3vbKPlXp2QyQ0DANHXIorF')
    }
  })
})
