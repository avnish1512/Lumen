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
