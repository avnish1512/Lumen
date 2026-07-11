// Client for the admin accounts panel (backed by Supabase via /api/accounts).
// Only the main account can list/add/edit/remove; `verifyCredentials` is used
// by the login screen to accept accounts added through the panel.

export const MAIN_ACCOUNT_EMAIL = 'avnishpc00@gmail.com'

export type Account = { email: string; password: string }

export function isMainAccount(email: string | undefined | null): boolean {
  return (email ?? '').toLowerCase() === MAIN_ACCOUNT_EMAIL
}

export async function listAccounts(adminEmail: string): Promise<Account[]> {
  try {
    const response = await fetch(`/api/accounts?action=list&admin=${encodeURIComponent(adminEmail)}`)
    const data = await response.json()
    return response.ok && data?.ok ? (data.accounts ?? []) : []
  } catch {
    return []
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin: adminEmail, email, password, previousEmail }),
    })
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin: adminEmail, email }),
    })
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
