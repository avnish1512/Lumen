import path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  assertSafeRemoteUrl,
  isPrivateOrReservedIp,
  validateUrlSyntax,
  UrlSecurityError,
} from '../src/main/security/urlGuard'
import {
  sanitizeFileName,
  validateSaveFilePath,
  PathSecurityError,
} from '../src/main/security/pathGuard'
import {
  createMinimalValidMp4Buffer,
  validateMp4HeaderBuffer,
} from '../src/main/analysis/mp4Signature'

describe('Security & Path Guards', () => {
  it('blocks private, loopback, metadata, and link-local IPv4/IPv6 ranges', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true)
    expect(isPrivateOrReservedIp('10.0.0.5')).toBe(true)
    expect(isPrivateOrReservedIp('172.16.4.2')).toBe(true)
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true)
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true)
    expect(isPrivateOrReservedIp('100.64.0.1')).toBe(true)
    expect(isPrivateOrReservedIp('0.0.0.0')).toBe(true)
    expect(isPrivateOrReservedIp('::1')).toBe(true)
    expect(isPrivateOrReservedIp('fc00::1')).toBe(true)
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true)
    expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true)
    expect(isPrivateOrReservedIp('::ffff:7f00:0001')).toBe(true)

    expect(isPrivateOrReservedIp('93.184.216.34')).toBe(false)
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false)
    expect(isPrivateOrReservedIp('2606:4700:4700::1111')).toBe(false)
  })

  it('rejects non-HTTP schemes, malformed URLs, and credential smuggling', async () => {
    expect(() => validateUrlSyntax('')).toThrow(UrlSecurityError)
    expect(() => validateUrlSyntax('not-a-valid-url')).toThrow(UrlSecurityError)
    expect(() => validateUrlSyntax('file:///C:/Windows/System32/drivers/etc/hosts')).toThrow(
      UrlSecurityError,
    )
    expect(() => validateUrlSyntax('javascript:alert(1)')).toThrow(UrlSecurityError)
    expect(() => validateUrlSyntax('ftp://example.com/video.mp4')).toThrow(UrlSecurityError)
    expect(() => validateUrlSyntax('https://user:secret@example.com/video.mp4')).toThrow(
      UrlSecurityError,
    )

    await expect(assertSafeRemoteUrl('http://localhost/video.mp4')).rejects.toMatchObject({
      code: 'SSRF_BLOCKED',
    })
    await expect(assertSafeRemoteUrl('http://127.0.0.1:8080/video.mp4')).rejects.toMatchObject({
      code: 'SSRF_BLOCKED',
    })
    await expect(assertSafeRemoteUrl('http://169.254.169.254/latest/meta-data')).rejects.toMatchObject(
      { code: 'SSRF_BLOCKED' },
    )
    await expect(assertSafeRemoteUrl('http://[::1]/video.mp4')).rejects.toMatchObject({
      code: 'SSRF_BLOCKED',
    })
  })

  it('sanitizes filenames safely and forces .mp4 extension', () => {
    expect(sanitizeFileName('My <Movie>: Ep/1?*.mp4')).toBe('My Movie Ep 1.mp4')
    expect(sanitizeFileName('CON')).toBe('CON_video.mp4')
    expect(sanitizeFileName('...')).toBe('video.mp4')
    expect(validateSaveFilePath(path.join(process.cwd(), 'test-video'))).toMatch(/test-video\.mp4$/i)
    expect(() => validateSaveFilePath('')).toThrow(PathSecurityError)
  })

  it('validates real MP4 ISO BMFF headers and rejects HTML/JSON', () => {
    const validMp4 = createMinimalValidMp4Buffer(512)
    expect(validateMp4HeaderBuffer(validMp4)).toEqual({ valid: true, majorBrand: 'isom' })

    const htmlErr = Buffer.from('<!DOCTYPE html><html><body>403 Forbidden</body></html>')
    const htmlCheck = validateMp4HeaderBuffer(htmlErr)
    expect(htmlCheck.valid).toBe(false)
    expect(htmlCheck.looksLikeHtmlOrText).toBe(true)

    const jsonErr = Buffer.from('{"error":"Unauthorized"}')
    expect(validateMp4HeaderBuffer(jsonErr).valid).toBe(false)
  })
})
