// Resolves a YouTube trailer id for a title, used for the hero preview.
// Anime carry their AniList trailer id directly; movies/shows are looked up
// through our /api/kinocheck proxy (KinoCheck by TMDB/IMDb id).

import type { Movie } from './omdb'

const cache = new Map<string, string | null>()

export async function fetchTrailerYoutubeId(movie: Movie): Promise<string | null> {
  // AniList already gives us the trailer id for anime.
  if (movie.trailerYoutubeId) {
    return movie.trailerYoutubeId
  }

  const params = new URLSearchParams()
  if (movie.id && /^tt\d+/.test(movie.id)) {
    params.set('imdbId', movie.id)
  } else if (movie.tmdbId) {
    params.set('tmdbId', String(movie.tmdbId))
  } else {
    return null
  }
  params.set('type', movie.tmdbType === 'tv' ? 'tv' : 'movie')

  const cacheKey = params.toString()
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null
  }

  try {
    const response = await fetch(`/api/kinocheck?${params}`)
    const body = (await response.json()) as { youtubeId?: string | null }
    const youtubeId = body?.youtubeId ?? null
    cache.set(cacheKey, youtubeId)
    return youtubeId
  } catch {
    return null
  }
}
