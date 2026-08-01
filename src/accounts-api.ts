// Client for the admin accounts panel (backed by Supabase via /api/accounts).
// Only the main account can list/add/edit/remove; `verifyCredentials` is used
// by the login screen to accept accounts added through the panel.

export const MAIN_ACCOUNT_EMAIL = 'avnishpc00@gmail.com'

export type Account = { email: string }

export function isMainAccount(email: string | undefined | null): boolean {
  return (email ?? '').toLowerCase() === MAIN_ACCOUNT_EMAIL
}

// The admin secret is never bundled: the admin enters it once per browser
// session (matching the server's ADMIN_SECRET) and it is sent on privileged
// requests via the `x-admin-key` header. It lives only in sessionStorage.
const ADMIN_KEY_STORAGE = 'lumen_admin_key'

/** The admin key entered for this browser session (never bundled). */
export function getAdminKey(): string {
  try {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

/** Store (or clear) the admin key for this session. */
export function setAdminKey(key: string): void {
  try {
    if (key) sessionStorage.setItem(ADMIN_KEY_STORAGE, key)
    else sessionStorage.removeItem(ADMIN_KEY_STORAGE)
  } catch {
    // ignore
  }
}

/** Clear a cached admin key (e.g. after the server rejects it). */
export function clearAdminKey(): void {
  setAdminKey('')
}

function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { 'x-admin-key': getAdminKey(), ...extra }
}

export type ListAccountsResult = { ok: boolean; accounts: Account[]; error?: string }

export async function listAccounts(): Promise<ListAccountsResult> {
  if (!getAdminKey()) {
    return { ok: false, accounts: [], error: 'Enter your admin password to manage accounts.' }
  }
  try {
    const response = await fetch('/api/accounts?action=list', {
      headers: adminHeaders(),
    })
    if (response.status === 403) {
      return { ok: false, accounts: [], error: 'Not authorized. Check the admin password.' }
    }
    const data = await response.json().catch(() => ({}))
    if (response.ok && data?.ok) {
      return { ok: true, accounts: data.accounts ?? [] }
    }
    return { ok: false, accounts: [], error: data?.error ?? 'Could not load accounts.' }
  } catch {
    return { ok: false, accounts: [], error: 'Network error.' }
  }
}

export async function saveAccount(
  adminEmail: string,
  email: string,
  password: string,
  previousEmail?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/api/accounts?action=save', {
      method: 'POST',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ admin: adminEmail, email, password, previousEmail }),
    })
    if (response.status === 403) {
      return { ok: false, error: 'Not authorized. Check the admin password.' }
    }
    const data = await response.json()
    return { ok: Boolean(data?.ok), error: data?.error }
  } catch {
    return { ok: false, error: 'Network error.' }
  }
}

export async function deleteAccount(
  adminEmail: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/api/accounts?action=delete', {
      method: 'POST',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ admin: adminEmail, email }),
    })
    if (response.status === 403) {
      return { ok: false, error: 'Not authorized. Check the admin password.' }
    }
    const data = await response.json()
    return { ok: Boolean(data?.ok), error: data?.error }
  } catch {
    return { ok: false, error: 'Network error.' }
  }
}

export async function verifyCredentials(email: string, password: string): Promise<boolean> {
  try {
    const response = await fetch('/api/accounts?action=verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json()
    return Boolean(data?.ok)
  } catch {
    return false
  }
}

// Reveal a single account's stored password (admin only). Returns null when it
// can't be recovered (e.g. a legacy one-way-hashed row).
export async function revealPassword(email: string): Promise<{ ok: boolean; password?: string | null; error?: string }> {
  try {
    const response = await fetch(
      `/api/accounts?action=reveal&email=${encodeURIComponent(email)}`,
      { headers: adminHeaders() },
    )
    if (response.status === 403) {
      return { ok: false, error: 'Not authorized. Check the admin password.' }
    }
    const data = await response.json()
    return { ok: Boolean(data?.ok), password: data?.password ?? null, error: data?.error }
  } catch {
    return { ok: false, error: 'Network error.' }
  }
}

// Change the main admin account's password (admin only). On success the caller
// should update the stored session key so subsequent admin calls keep working.
export async function changeAdminPassword(
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/api/accounts?action=set-admin-password', {
      method: 'POST',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ newPassword }),
    })
    if (response.status === 403) {
      return { ok: false, error: 'Not authorized. Check the admin password.' }
    }
    const data = await response.json()
    if (data?.ok) {
      // Keep the session unlocked with the new password.
      setAdminKey(newPassword)
    }
    return { ok: Boolean(data?.ok), error: data?.error }
  } catch {
    return { ok: false, error: 'Network error.' }
  }
}
