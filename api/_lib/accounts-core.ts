// Accounts admin store (Supabase). Admin actions are gated by the admin
// credential in the handler. A `verify` path lets the login screen check a
// single credential.
//
// Passwords are stored **encrypted** (AES-256-GCM) with a key derived from the
// server-only Supabase service key. This keeps them protected at rest (a DB
// leak yields only ciphertext) while still allowing the admin panel to decrypt
// and reveal them. Rows written earlier as plain text or scrypt hashes still
// verify; plain-text/valid logins are transparently re-encrypted.
//
// Table (run once in the Supabase SQL editor):
//
//   create table if not exists accounts (
//     email      text primary key,
//     password   text not null,   -- stores "enc$<iv>$<tag>$<ciphertext>"
//     created_at timestamptz not null default now()
//   );
//   alter table accounts enable row level security;

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import type { SupabaseConfig } from './supabase-core.js'
import { fetchAccountProfiles, saveAccountProfiles } from './supabase-core.js'

export function adminEmailFromEnv(env: Record<string, string | undefined>): string {
  return (env.ADMIN_EMAIL ?? 'avnishpc00@gmail.com').toLowerCase()
}

// ---- reversible password encryption -------------------------------------

function encKey(config: SupabaseConfig): Buffer {
  // Stable 256-bit key derived from the server-only service key.
  return scryptSync(config.serviceKey, 'lumen-account-enc-v1', 32)
}

export function encryptSecret(config: SupabaseConfig, plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encKey(config), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc$${iv.toString('hex')}$${tag.toString('hex')}$${ciphertext.toString('hex')}`
}

function decryptSecret(config: SupabaseConfig, stored: string): string | null {
  if (!stored.startsWith('enc$')) return null
  const parts = stored.split('$') // enc, iv, tag, ciphertext
  if (parts.length !== 4) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', encKey(config), Buffer.from(parts[1], 'hex'))
    decipher.setAuthTag(Buffer.from(parts[2], 'hex'))
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], 'hex')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return null
  }
}

function constEq(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

// Verify a password against a stored value; `legacy` means the stored form
// isn't current encryption, so the caller should re-save (re-encrypt) it.
function verifyStored(
  config: SupabaseConfig,
  password: string,
  stored: string,
): { ok: boolean; legacy: boolean } {
  if (stored.startsWith('enc$')) {
    const plain = decryptSecret(config, stored)
    return { ok: plain !== null && constEq(password, plain), legacy: false }
  }
  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$')
    if (parts.length !== 3) return { ok: false, legacy: false }
    const derived = scryptSync(password, parts[1], 64)
    const hashBuf = Buffer.from(parts[2], 'hex')
    const ok = hashBuf.length === derived.length && timingSafeEqual(hashBuf, derived)
    return { ok, legacy: true }
  }
  return { ok: constEq(password, stored), legacy: true }
}

function headers(config: SupabaseConfig, extra: Record<string, string> = {}) {
  return {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

const REST = (config: SupabaseConfig) => `${config.url}/rest/v1/accounts`

// Passwords are never returned by the list (revealed one at a time on demand).
export type Account = { email: string }

export async function listAccounts(config: SupabaseConfig): Promise<Account[]> {
  const response = await fetch(`${REST(config)}?select=email&order=created_at.asc`, {
    headers: headers(config),
  })
  if (!response.ok) {
    return []
  }
  return (await response.json()) as Account[]
}

export async function saveAccount(
  config: SupabaseConfig,
  email: string,
  password: string,
  previousEmail?: string,
): Promise<void> {
  // Renaming the primary key (email) = delete the old row then upsert the new.
  if (previousEmail && previousEmail !== email) {
    await deleteAccount(config, previousEmail)
  }

  const response = await fetch(`${REST(config)}?on_conflict=email`, {
    method: 'POST',
    headers: headers(config, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify([{ email, password: encryptSecret(config, password) }]),
  })
  if (!response.ok) {
    // Don't surface the upstream error body to the client (info leak).
    throw new Error(`Account save failed (${response.status}).`)
  }
}

export async function deleteAccount(config: SupabaseConfig, email: string): Promise<void> {
  const response = await fetch(`${REST(config)}?email=eq.${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: headers(config, { Prefer: 'return=minimal' }),
  })
  if (!response.ok) {
    throw new Error(`Account delete failed (${response.status}).`)
  }
}

export async function verifyAccount(
  config: SupabaseConfig,
  email: string,
  password: string,
): Promise<boolean> {
  const url =
    `${REST(config)}?select=email,password&email=eq.${encodeURIComponent(email)}&limit=1`
  const response = await fetch(url, { headers: headers(config) })
  if (!response.ok) {
    return false
  }
  const rows = (await response.json()) as Array<{ email: string; password?: string }>
  if (rows.length === 0) {
    return false
  }
  const { ok, legacy } = verifyStored(config, password, rows[0].password ?? '')
  // Transparently migrate legacy rows to current encryption on valid login.
  if (ok && legacy) {
    try {
      await saveAccount(config, email, password)
    } catch {
      // Non-fatal: login still succeeds even if the re-encrypt write fails.
    }
  }
  return ok
}

// Reveal a single account's password for the admin panel. Returns null when it
// can't be recovered (legacy scrypt-hashed rows).
export async function revealPassword(
  config: SupabaseConfig,
  email: string,
): Promise<string | null> {
  const url =
    `${REST(config)}?select=password&email=eq.${encodeURIComponent(email)}&limit=1`
  const response = await fetch(url, { headers: headers(config) })
  if (!response.ok) {
    return null
  }
  const rows = (await response.json()) as Array<{ password?: string }>
  const stored = rows[0]?.password ?? ''
  if (!stored) return null
  if (stored.startsWith('enc$')) return decryptSecret(config, stored)
  if (stored.startsWith('scrypt$')) return null // one-way, not recoverable
  return stored // legacy plain text
}

// ---- changeable admin password (stored encrypted in account_profiles) ----

const ADMIN_PW_KEY = 'admin_password'
let adminPwCache: { value: string | null; expiresAt: number } | null = null

// Current admin password: the value set via the panel (encrypted in Supabase)
// if present, otherwise the ADMIN_PASSWORD env var. Cached briefly.
export async function resolveAdminPassword(
  env: Record<string, string | undefined>,
  config: SupabaseConfig | null,
): Promise<string> {
  const envPassword = env.ADMIN_PASSWORD ?? ''
  if (!config) return envPassword

  const now = Date.now()
  if (adminPwCache && adminPwCache.expiresAt > now) {
    return adminPwCache.value ?? envPassword
  }

  let stored: string | null = null
  try {
    const rows = await fetchAccountProfiles(config, ADMIN_PW_KEY)
    if (rows && rows.length > 0 && rows[0].name) {
      stored = decryptSecret(config, rows[0].name)
    }
  } catch {
    stored = null
  }
  adminPwCache = { value: stored, expiresAt: now + 30_000 }
  return stored ?? envPassword
}

export async function setAdminPassword(
  config: SupabaseConfig,
  newPassword: string,
): Promise<void> {
  await saveAccountProfiles(config, ADMIN_PW_KEY, [
    { name: encryptSecret(config, newPassword), avatarColor: 'admin' },
  ])
  adminPwCache = { value: newPassword, expiresAt: Date.now() + 30_000 }
}
