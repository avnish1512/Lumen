// Client for the BFF "watch together" feature (backed by Supabase via
// /api/watch-party). All calls degrade gracefully when the backend is off.

import type { Movie } from './omdb'

export type WatchParty = {
  id: string
  host_email: string
  guest_email: string
  movie: Movie
  status: 'pending' | 'accepted' | 'ended'
  playback: { playing: boolean; time: number }
  updated_at: string
}

async function getJson(url: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

async function postJson(url: string, body: unknown) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export async function fetchFriends(email: string): Promise<string[]> {
  const data = await getJson(`/api/watch-party?action=friends&email=${encodeURIComponent(email)}`)
  return data?.friends ?? []
}

export async function sendInvite(
  hostEmail: string,
  guestEmail: string,
  movie: Movie,
): Promise<WatchParty | null> {
  const data = await postJson('/api/watch-party?action=invite', {
    hostEmail,
    guestEmail,
    movie,
  })
  return data?.party ?? null
}

export async function fetchIncomingInvites(email: string): Promise<WatchParty[]> {
  const data = await getJson(`/api/watch-party?action=incoming&email=${encodeURIComponent(email)}`)
  return data?.invites ?? []
}

export async function acceptInvite(id: string): Promise<void> {
  await postJson('/api/watch-party?action=accept', { id })
}

export async function fetchParty(id: string): Promise<WatchParty | null> {
  const data = await getJson(`/api/watch-party?action=party&id=${encodeURIComponent(id)}`)
  return data?.party ?? null
}

export async function pushPlaybackState(
  id: string,
  playback: { playing: boolean; time: number },
): Promise<void> {
  await postJson('/api/watch-party?action=state', { id, playback })
}

export async function endParty(id: string): Promise<void> {
  await postJson('/api/watch-party?action=end', { id })
}
