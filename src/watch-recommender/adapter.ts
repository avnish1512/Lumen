import type { Movie } from '../omdb'
import type { AniListAnime } from '../anilist'
import { fetchAnimeByOptions } from '../anilist'
import { fetchKoreanChineseDramas, fetchTmdbHomeRails } from '../tmdb'
import type { Category } from './types'
import {
  buildCandidatePool,
  categoryToSource,
  type CategorySource,
  type PoolInputs,
} from './logic'

/**
 * Watch Recommender — fetch adapter.
 *
 * This module is the single I/O boundary of the feature. It maps a `Category`
 * to the existing client data helpers, normalizes their results into the pure
 * `PoolInputs` shape consumed by `buildCandidatePool`, and — crucially —
 * distinguishes a genuine transport failure (which must surface as a rejection
 * so the hook can enter the `error` state) from a successful-but-empty result
 * (which flows through as empty `PoolInputs` so the hook can enter the `empty`
 * state).
 *
 * Why the distinction needs care: the underlying helpers
 * (`fetchTmdbHomeRails`, `fetchKoreanChineseDramas`, `fetchAnimeByOptions`) all
 * swallow network errors internally and return empty defaults, so on their own
 * they make a failed load look identical to a legitimately empty one. To
 * recover the distinction (Requirements 8.1, 8.2) the adapter runs a guarded
 * connectivity probe **only when** the normalized result is empty: if the
 * probe's underlying network call fails, the failure surfaces as a rejection
 * (→ `error`); if the source is reachable but simply had nothing, the empty
 * result is returned unchanged (→ `empty`). The happy path (non-empty result)
 * never triggers a second request.
 *
 * _Requirements: 3.1, 3.2, 8.1, 8.2_
 */

/**
 * Error raised when the underlying network call for a data source genuinely
 * fails (as opposed to succeeding with no results). The hook maps this to the
 * `error` state (Requirement 8.1).
 */
export class PoolFetchError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'PoolFetchError'
    // Preserve the underlying cause where the runtime supports it.
    if (options?.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

/**
 * The endpoint used to probe reachability for each data source. These mirror
 * the endpoints the corresponding helpers call internally; the probe only
 * checks that the network call can be made (transport-level reachability),
 * which is what separates a failed load from an empty one.
 */
const PROBE_ENDPOINT: Record<CategorySource, string> = {
  'tmdb-rails': '/api/tmdb-home-rails',
  'tmdb-drama': '/api/tmdb-drama',
  anilist: 'https://graphql.anilist.co',
}

/**
 * Wraps a raw `fetch` so that a genuine transport failure (the request cannot
 * be completed) surfaces as a rejection. Non-2xx responses are treated as
 * "reachable" here: we only care whether the network call itself could be made,
 * because the helpers already fold non-ok responses into empty results.
 */
async function probeReachable(source: CategorySource): Promise<void> {
  try {
    await fetch(PROBE_ENDPOINT[source], { method: 'GET' })
  } catch (cause) {
    throw new PoolFetchError(
      `Could not reach the ${source} data source.`,
      { cause },
    )
  }
}

/**
 * Faithful, self-contained mapping of an AniList media entry to the shared
 * `Movie` type. The app keeps an equivalent private mapper in `App.tsx`; it is
 * replicated here (rather than imported) to avoid a circular dependency between
 * this adapter and the app root that imports the recommender feature.
 */
function mapAniListToMovie(anime: AniListAnime, rank = 1): Movie {
  const title =
    anime.title?.english ||
    anime.title?.romaji ||
    anime.title?.userPreferred ||
    'Unknown Anime'
  const year = anime.seasonYear ? String(anime.seasonYear) : 'N/A'
  const banner = anime.bannerImage || anime.coverImage?.large || ''
  const poster = anime.coverImage?.large || anime.coverImage?.medium || ''
  const animeFormat = (anime.format || '').toUpperCase()
  const isAnimeFilm = animeFormat === 'MOVIE' || animeFormat === 'MUSIC'
  // AniList reports `episodes: null` while a series is still airing; in that
  // case the already-aired count is nextAiringEpisode.episode - 1.
  const airedSoFar =
    typeof anime.nextAiringEpisode?.episode === 'number'
      ? Math.max(0, anime.nextAiringEpisode.episode - 1)
      : 0
  const episodeCount = Number(anime.episodes) || airedSoFar || 0
  const trailerYoutubeId =
    anime.trailer &&
    (anime.trailer.site === 'youtube' || anime.trailer.site === 'YouTube')
      ? anime.trailer.id
      : undefined
  const runtime = isAnimeFilm
    ? 'Movie'
    : `${episodeCount || '?'} Episode${episodeCount === 1 ? '' : 's'}`

  const animeEpisodes = Array.isArray(anime.streamingEpisodes)
    ? anime.streamingEpisodes
        .filter((entry) => entry?.thumbnail)
        .map((entry) => ({
          title: String(entry.title ?? '').trim(),
          thumbnail: String(entry.thumbnail ?? ''),
        }))
    : undefined

  const nextEpisode =
    typeof anime.nextAiringEpisode?.episode === 'number'
      ? {
          number: anime.nextAiringEpisode.episode,
          airingAt:
            typeof anime.nextAiringEpisode.airingAt === 'number'
              ? anime.nextAiringEpisode.airingAt
              : undefined,
        }
      : undefined

  return {
    id: `anilist-${anime.id}`,
    anilistId: anime.id,
    malId: anime.idMal,
    isAnime: true,
    animeFormat,
    episodeCount,
    episodeRuntimeMinutes: typeof anime.duration === 'number' ? anime.duration : undefined,
    animeEpisodes,
    nextEpisode,
    trailerYoutubeId,
    rank,
    title,
    logoTitle: title,
    label: anime.status || 'Ongoing',
    type: 'Anime',
    genres: anime.genres || [],
    year,
    runtime,
    rating: 'N/A',
    maturity: 'TV-14',
    progress: 0,
    hero: banner,
    poster,
    still: banner,
    synopsis: (anime.description || '').replace(/<[^>]*>/g, ''),
    cast: [],
    director: '',
    awards: '',
    boxOffice: '',
    ratings: [],
  }
}

/**
 * Fetches and normalizes the raw inputs needed to build a candidate pool for
 * the given category:
 *
 * - `movie` / `tv` → `fetchTmdbHomeRails()` (both categories draw from the home
 *   rails; `buildCandidatePool` picks the category-appropriate rails)
 * - `drama`        → `fetchKoreanChineseDramas()` (uses `.list`)
 * - `anime`        → `fetchAnimeByOptions({ sort, perPage })` mapped to `Movie[]`
 *
 * Resolves with `PoolInputs` on success (possibly empty). Rejects with a
 * `PoolFetchError` when the underlying data source cannot be reached, so the
 * caller can distinguish a failed load (→ `error`) from a load that succeeded
 * with no titles (→ `empty`).
 *
 * _Requirements: 3.1, 3.2, 8.1, 8.2_
 */
export async function fetchPoolInputs(category: Category): Promise<PoolInputs> {
  let inputs: PoolInputs

  switch (category) {
    case 'movie':
    case 'tv': {
      const homeRails = await fetchTmdbHomeRails()
      inputs = { homeRails }
      break
    }
    case 'drama': {
      const { list } = await fetchKoreanChineseDramas()
      inputs = { dramaList: list }
      break
    }
    case 'anime': {
      const media = await fetchAnimeByOptions({
        sort: ['TRENDING_DESC', 'POPULARITY_DESC'],
        perPage: 50,
      })
      inputs = { animeList: media.map((item, i) => mapAniListToMovie(item, i + 1)) }
      break
    }
  }

  // The helpers swallow transport errors and return empty defaults, so an empty
  // pool here is ambiguous: it could mean "loaded, but nothing to show" or "the
  // network call failed". Probe the source's reachability to resolve the
  // ambiguity — a genuine transport failure surfaces as a rejection (→ error),
  // while a reachable-but-empty source falls through as empty (→ empty).
  if (buildCandidatePool(category, inputs).length === 0) {
    await probeReachable(categoryToSource(category))
  }

  return inputs
}
