// Secure session token issuance and verification for Lumen.
// Tokens are HMAC-SHA256 signed with a secret derived from server-only secrets.
//
// The client holds this token in memory / localStorage and sends it via
// `Authorization: Bearer <token>`. The server strictly derives the authenticated
// user_id from this verified token — client-supplied user IDs are never trusted.

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SupabaseConfig } from './supabase-core.js'

export type SessionPayload = {
  userId: string
  name?: string
  iat: number
  exp: number
}

function resolveSigningSecret(config?: SupabaseConfig | null, env?: Record<string, string | undefined>): string {
  if (config?.serviceKey) {
    return config.serviceKey
  }
  if (env?.SUPABASE_SERVICE_ROLE_KEY) {
    return env.SUPABASE_SERVICE_ROLE_KEY
  }
  if (env?.ADMIN_PASSWORD) {
    return env.ADMIN_PASSWORD
  }
  return 'lumen-default-session-signing-secret-v1'
}

/**
 * Creates a signed session token for an authenticated user.
 * Expires by default in 30 days.
 */
export function createSessionToken(
  userId: string,
  config?: SupabaseConfig | null,
  env?: Record<string, string | undefined>,
  name?: string,
  expiresInMs = 30 * 24 * 60 * 60 * 1000,
): string {
  const normalizedUserId = userId.trim().toLowerCase()
  const payload: SessionPayload = {
    userId: normalizedUserId,
    name: name?.trim() || normalizedUserId.split('@')[0],
    iat: Date.now(),
    exp: Date.now() + expiresInMs,
  }

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const secret = resolveSigningSecret(config, env)
  const signature = createHmac('sha256', secret).update(payloadB64).digest('base64url')

  return `${payloadB64}.${signature}`
}

/**
 * Verifies a session token and extracts the authenticated payload.
 * Returns null if token is invalid, expired, or tampered with.
 */
export function verifySessionToken(
  token: string | null | undefined,
  config?: SupabaseConfig | null,
  env?: Record<string, string | undefined>,
): SessionPayload | null {
  if (!token || typeof token !== 'string') {
    return null
  }

  const parts = token.trim().split('.')
  if (parts.length !== 2) {
    return null
  }

  const [payloadB64, signature] = parts
  const secret = resolveSigningSecret(config, env)
  const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64url')

  const sigBuf = Buffer.from(signature, 'utf8')
  const expBuf = Buffer.from(expectedSig, 'utf8')

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null
  }

  try {
    const raw = Buffer.from(payloadB64, 'base64url').toString('utf8')
    const payload = JSON.parse(raw) as SessionPayload

    if (!payload || typeof payload.userId !== 'string') {
      return null
    }

    if (typeof payload.exp === 'number' && Date.now() > payload.exp) {
      return null // Expired
    }

    return {
      userId: payload.userId.trim().toLowerCase(),
      name: payload.name,
      iat: payload.iat,
      exp: payload.exp,
    }
  } catch {
    return null
  }
}

/**
 * Extracts the Bearer token from an Authorization header.
 */
export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader || typeof authHeader !== 'string') {
    return null
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}
