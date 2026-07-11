// Resolves a YouTube trailer id for a title, used for the hero preview.
// Anime carry their AniList trailer id directly; movies/shows are looked up
// through our /api/tmdb-trailer proxy (TMDB videos by TMDB/IMDb id).

import type { Movie } from './omdb'

const cache = new Map<string, string | null>()

export async function fetchTrailerYoutubeId(movie: Movie): Promise<string | null> {
  // AniList already gives us the trailer id for anime.
  if (movie.trailerYoutubeId) {
    return movie.trailerYoutubeId
  }

  const params = new URLSearchParams()
  if (movie.tmdbId) {
    params.set('tmdbId', String(movie.tmdbId))
  } else if (movie.id && /^tt\d+/.test(movie.id)) {
    params.set('imdbId', movie.id)
  } else {
    return null
  }
  params.set('type', movie.tmdbType === 'tv' ? 'tv' : 'movie')

  const cacheKey = params.toString()
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null
  }

  const query = params.toString()

  // TMDB is the primary trailer source. Some networks block api.themoviedb.org
  // (e.g. certain ISPs), so if TMDB returns nothing we fall back to KinoCheck.
  const youtubeId =
    (await lookupTrailer(`/api/tmdb-trailer?${query}`)) ??
    (await lookupTrailer(`/api/kinocheck?${query}`))

  cache.set(cacheKey, youtubeId)
  return youtubeId
}

async function lookupTrailer(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const body = (await response.json()) as { youtubeId?: string | null }
    return body?.youtubeId ?? null
  } catch {
    return null
  }
}
