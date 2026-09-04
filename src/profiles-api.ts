// Client for cross-device profile sync (backed by Supabase via /api/profiles).
// Falls back gracefully (returns null / resolves) when the backend isn't
// configured, so the app keeps working from its localStorage cache.

export type RemoteProfile = {
  name: string
  avatarColor: string
  starredServer?: string
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

// Cross-device "Continue Watching" sync. Keyed by `${email}::${profileName}`.
// Returns the remote history map, or null when unavailable/unconfigured.
export async function fetchRemoteWatchHistory(
  key: string,
): Promise<Record<string, any> | null> {
  if (!key) {
    return null
  }

  try {
    const response = await fetch(`/api/watch-history?key=${encodeURIComponent(key)}`)
    const body = (await response.json()) as {
      ok?: boolean
      history?: Record<string, any> | null
    }

    if (!response.ok || !body.ok) {
      return null
    }

    return body.history && typeof body.history === 'object' ? body.history : null
  } catch {
    return null
  }
}

export async function saveRemoteWatchHistory(
  key: string,
  history: Record<string, any>,
): Promise<void> {
  if (!key) {
    return
  }

  try {
    await fetch('/api/watch-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, history }),
    })
  } catch {
    // Best-effort — the local cache still holds the latest history.
  }
}

export async function saveRemoteMovieProgress(
  key: string,
  movieId: string,
  movieData: Record<string, any>,
): Promise<void> {
  if (!key || !movieId || !movieData) {
    return
  }

  try {
    await fetch('/api/watch-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, movieId, movieData }),
    })
  } catch {
    // Best-effort
  }
}

// Verify a candidate Lord PIN server-side. The PIN itself is never sent to the
// client — the server only answers ok/no.
export async function verifyRemoteLordPin(pin: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/lord-pin?action=verify&pin=${encodeURIComponent(pin)}`)
    const body = (await response.json()) as { ok?: boolean }
    return Boolean(response.ok && body.ok)
  } catch {
    return false
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
    const adminKey = (() => {
      try {
        return sessionStorage.getItem('lumen_admin_key') ?? ''
      } catch {
        return ''
      }
    })()
    const response = await fetch('/api/lord-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ adminEmail, pin: newPin, adminKey }),
    })
    const body = (await response.json()) as { ok?: boolean }
    return Boolean(response.ok && body.ok)
  } catch {
    return false
  }
}

// Fetch the synchronized global PHub refresh seed across all users.
export async function fetchGlobalPhubSeed(): Promise<number | null> {
  try {
    const response = await fetch('/api/phub-refresh')
    if (!response.ok) return null
    const body = (await response.json()) as { ok?: boolean; seed?: number | string }
    if (typeof body.seed === 'number') return body.seed
    if (typeof body.seed === 'string') {
      const parsed = Number(body.seed)
      if (!Number.isNaN(parsed)) return parsed
    }
    return null
  } catch {
    return null
  }
}

// Update the global PHub refresh seed (restricted to admin avnishpc00@gmail.com).
export async function updateGlobalPhubSeed(
  adminEmail: string,
  newSeed?: number,
): Promise<{ ok: boolean; seed?: number }> {
  if (!adminEmail || adminEmail.toLowerCase() !== 'avnishpc00@gmail.com') {
    return { ok: false }
  }

  try {
    const adminKey = (() => {
      try {
        return sessionStorage.getItem('lumen_admin_key') ?? ''
      } catch {
        return ''
      }
    })()
    const targetSeed = newSeed ?? (Date.now() % 1000000) + Math.floor(Math.random() * 1000) + 1
    const response = await fetch('/api/phub-refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ adminEmail, seed: targetSeed, adminKey }),
    })
    const body = (await response.json()) as { ok?: boolean; seed?: number }
    if (response.ok && body.ok) {
      return { ok: true, seed: body.seed ?? targetSeed }
    }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

