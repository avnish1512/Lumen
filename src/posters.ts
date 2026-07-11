// Top-Posters image API integration.
//
// Posters/thumbnails are served by https://api.top-posters.com using either an
// IMDb id (`/imdb/poster/{ttId}.jpg`) or a TMDB id (`/tmdb/poster/{tmdbId}.jpg`).
// We keep a pool of API keys and rotate to the next one whenever a request
// fails (rate limited / expired). When every key is exhausted the caller falls
// back to the original artwork so a poster never breaks.

import type { Movie } from './omdb'

const TOP_POSTERS_BASE = 'https://api.top-posters.com'

export const TOP_POSTER_KEYS = [
  'TP-TSzkK49g9LKREGIFFUE15dzRFpwHwiEz',
  'TP-A8CvaVK0Xp3EPCZzgLPsh4CdxvMx0xix',
  'TP-pUWsRt0dS1ClxAxYsjduSThk0OAZJpWT',
  'TP-b4kQfjt4FOseNfODA89seoLt5K5qLh06',
  'TP-YJ0PucPKEzxGd2dhLbzQFZDq3lXPVMNp',
  'TP-0Q4GCknvcIs4RyiR2tturoc69hscmkzw',
  'TP-euQjvmZ3gzPXP6OH4BdCOL0gb5Ue4PPM',
  'TP-MDEWotM5NuXDKY1WKgCQxiZlSQTwIOK8',
  'TP-0YI4gyyifzpRr52YINU7MZicO0hJVA4r',
  'TP-ZSyJDk6qou7TY2c34R0NtNv7am70Vh9J',
  'TP-pM3F5LLn57jetKpH4pmDK8o397BU1Lqx',
  'TP-elxZyWYCjvMxirAFnv9zpjne6hCXKbqs',
  'TP-gKutxRL21xfwAqH66pjDWi9FGMyVryXp',
  'TP-CPEjbr08cpLGyD9OCOJtOo28z3xdXuKf',
  'TP-3c11P35hsZ2LLzUCjYEjIyJffjLkXyhs',
  'TP-nnhzW917tVf60FhndR11IffUgr2LML7I',
  'TP-TQQq3ZvYI2qHj4hmUsMpPr1NySJsr0su',
  'TP-DYlHZpuVOBTSp0ghuuuxnaWQDlewPCpM',
  'TP-kr4MBHidgnLYiF9w3TbL30ALfadfSvOf',
  'TP-zKnuykZhTjHvWE6Juejmx9FfsVY0qYHK',
] as const

function imdbIdOf(movie: Movie): string | null {
  if (movie.id && /^tt\d+/.test(movie.id)) {
    return movie.id
  }
  return null
}

/** Whether a Top-Posters image can be built for this title. */
export function hasTopPoster(movie: Movie): boolean {
  return Boolean(imdbIdOf(movie) || movie.tmdbId)
}

/**
 * Builds the Top-Posters poster URL for the given title using the key at
 * `keyIndex`. Prefers the IMDb id, falls back to the TMDB id. Returns an empty
 * string when neither an id nor a valid key is available.
 */
export function topPosterUrl(movie: Movie, keyIndex: number): string {
  const key = TOP_POSTER_KEYS[keyIndex]
  if (!key) {
    return ''
  }

  const imdbId = imdbIdOf(movie)
  if (imdbId) {
    return `${TOP_POSTERS_BASE}/${key}/imdb/poster/${imdbId}.jpg`
  }

  if (movie.tmdbId) {
    return `${TOP_POSTERS_BASE}/${key}/tmdb/poster/${movie.tmdbId}.jpg`
  }

  return ''
}
