// Top-Posters image API integration.
//
// Posters are served through our own `/api/poster` proxy, which holds the
// API keys server-side and rotates through them. The browser only ever sees a
// keyless URL like `/api/poster?imdb=tt0111161`, so the keys are never exposed
// in the client bundle. When the proxy has no poster, the caller falls back to
// the original artwork so a poster never breaks.

import type { Movie } from './omdb'

function imdbIdOf(movie: Movie): string | null {
  if (movie.id && /^tt\d+/.test(movie.id)) {
    return movie.id
  }
  return null
}

/** Whether a Top-Posters image can be requested for this title. */
export function hasTopPoster(movie: Movie): boolean {
  return Boolean(imdbIdOf(movie) || movie.tmdbId)
}

/**
 * Builds the keyless proxy URL for the given title. Prefers the IMDb id, falls
 * back to the TMDB id. Returns an empty string when neither id is available.
 */
export function topPosterUrl(movie: Movie): string {
  const imdbId = imdbIdOf(movie)
  if (imdbId) {
    return `/api/poster?imdb=${encodeURIComponent(imdbId)}`
  }

  if (movie.tmdbId) {
    return `/api/poster?tmdb=${encodeURIComponent(String(movie.tmdbId))}`
  }

  return ''
}

/**
 * Routes an AniList cover-art URL through our own image proxy (edge-cached),
 * so anime posters stay fast/reachable even when the AniList CDN is slow or
 * blocked on the viewer's network. Non-AniList URLs are returned unchanged.
 */
export function proxiedAnimeImage(url: string): string {
  if (!url) {
    return ''
  }
  try {
    const host = new URL(url).hostname
    if (host === 's4.anilist.co' || host.endsWith('.anilist.co')) {
      return `/api/img?url=${encodeURIComponent(url)}`
    }
  } catch {
    return url
  }
  return url
}

// ============================================================================
// Anime Alternative Posters & TMDB English Artwork Resolver
// ============================================================================

const CUSTOM_POSTER_STORAGE_KEY = 'lumen.custom-anime-posters'
const TMDB_ANIME_STORAGE_KEY = 'lumen.anime-tmdb-cache'

export type AnimeArtwork = {
  poster: string
  backdrop: string
  tmdbId?: number
  title?: string
}

const animeTmdbMemoryCache = new Map<string, AnimeArtwork>()

export function getCustomAnimePoster(movieId: string): string | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(CUSTOM_POSTER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed[movieId] || null
  } catch {
    return null
  }
}

export function setCustomAnimePoster(movieId: string, posterUrl: string | null): void {
  try {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(CUSTOM_POSTER_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    if (posterUrl) {
      parsed[movieId] = posterUrl
    } else {
      delete parsed[movieId]
    }
    window.localStorage.setItem(CUSTOM_POSTER_STORAGE_KEY, JSON.stringify(parsed))
    window.dispatchEvent(
      new CustomEvent('lumen:poster-change', { detail: { movieId, posterUrl } }),
    )
  } catch {
    // ignore
  }
}

function cleanAnimeSearchQuery(raw: string): string {
  return raw
    .replace(/:\s*Season\s*\d+/gi, '')
    .replace(/\s+Season\s*\d+/gi, '')
    .replace(/\s+\d+(st|nd|rd|th)\s+Season/gi, '')
    .replace(/\s+Part\s*\d+/gi, '')
    .replace(/\s*\(TV\)/gi, '')
    .trim()
}

/**
 * Searches TMDB for an anime title to find official localized English posters
 * (with English title logos) and high-res 16:9 backdrops. Edge-cached in
 * memory and localStorage.
 */
export async function fetchTmdbAnimeArtwork(
  title: string,
): Promise<AnimeArtwork | null> {
  const cleanTitle = (title || '').trim()
  if (!cleanTitle) return null

  const cacheKey = cleanTitle.toLowerCase()
  if (animeTmdbMemoryCache.has(cacheKey)) {
    return animeTmdbMemoryCache.get(cacheKey)!
  }

  // Check localStorage cache
  try {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(TMDB_ANIME_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed[cacheKey]) {
          animeTmdbMemoryCache.set(cacheKey, parsed[cacheKey])
          return parsed[cacheKey]
        }
      }
    }
  } catch {
    // ignore
  }

  const queries = [cleanTitle]
  const stripped = cleanAnimeSearchQuery(cleanTitle)
  if (stripped && stripped.toLowerCase() !== cleanTitle.toLowerCase()) {
    queries.push(stripped)
  }

  for (const q of queries) {
    try {
      const res = await fetch(`/api/tmdb-drama?action=search&query=${encodeURIComponent(q)}`)
      if (!res.ok) continue
      const data = await res.json()
      const match = data.results?.[0]
      if (match && (match.poster || match.hero || match.still)) {
        const art: AnimeArtwork = {
          poster: match.poster || '',
          backdrop: match.hero || match.still || '',
          tmdbId: match.tmdbId,
          title: match.title,
        }
        animeTmdbMemoryCache.set(cacheKey, art)
        try {
          if (typeof window !== 'undefined') {
            const stored = window.localStorage.getItem(TMDB_ANIME_STORAGE_KEY)
            const parsed = stored ? JSON.parse(stored) : {}
            parsed[cacheKey] = art
            window.localStorage.setItem(TMDB_ANIME_STORAGE_KEY, JSON.stringify(parsed))
          }
        } catch {
          // ignore
        }
        return art
      }
    } catch {
      // ignore
    }
  }

  return null
}

