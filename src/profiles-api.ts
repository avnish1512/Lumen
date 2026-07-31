// Client for cross-device profile sync (backed by Supabase via /api/profiles).
// Falls back gracefully (returns null / resolves) when the backend isn't
// configured, so the app keeps working from its localStorage cache.

export type RemoteProfile = {
  name: string
  avatarColor: string
}

export async function fetchAccountProfiles(
  email: string,
): Promise<RemoteProfile[] | null> {
  if (!email) {
    return null
  }

  try {
    const response = await fetch(`/api/profiles?email=${encodeURIComponent(email)}`)
    const body = (await response.json()) as {
      ok?: boolean
      configured?: boolean
      profiles?: RemoteProfile[] | null
    }

    if (!response.ok || !body.ok) {
      return null
    }

    return Array.isArray(body.profiles) ? body.profiles : null
  } catch {
    return null
  }
}

export async function saveAccountProfiles(
  email: string,
  profiles: RemoteProfile[],
): Promise<void> {
  if (!email) {
    return
  }

  try {
    await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, profiles }),
    })
  } catch {
    // Best-effort — the local cache still holds the latest profiles.
  }
}

export async function fetchRemoteLordPin(): Promise<string | null> {
  try {
    const response = await fetch('/api/lord-pin')
    const body = (await response.json()) as { ok?: boolean; pin?: string }
    if (response.ok && body.ok && body.pin && /^\d{4}$/.test(body.pin)) {
      return body.pin
    }
    return null
  } catch {
    return null
  }
}

export async function saveRemoteLordPin(
  adminEmail: string,
  newPin: string,
): Promise<boolean> {
  if (!adminEmail || adminEmail.toLowerCase() !== 'avnishpc00@gmail.com') {
    return false
  }

  try {
    const response = await fetch('/api/lord-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail, pin: newPin }),
    })
    const body = (await response.json()) as { ok?: boolean }
    return Boolean(response.ok && body.ok)
  } catch {
    return false
  }
}
