import type { Movie } from '../omdb'

/**
 * The four content categories a viewer can request a recommendation for.
 * Fixed, closed set of four (Requirement 2.1).
 * Display labels: Movie, TV Show, Anime, Drama.
 */
export type Category = 'movie' | 'tv' | 'anime' | 'drama'

/**
 * Explicit status machine for the recommender.
 *
 * - `idle`:    no category selected, nothing displayed (Req 2.3)
 * - `loading`: candidate pool retrieval in progress (Req 7.1)
 * - `ready`:   a recommendation is displayed
 * - `empty`:   pool retrieved successfully but contained no titles (Req 8.2)
 * - `error`:   retrieval failed; error message + retry shown (Req 8.1, 8.3)
 */
export type RecommenderStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

/**
 * The full state held by `useWatchRecommender`.
 *
 * Invariants (enforced by the reducer):
 * - `status === 'idle'` iff `category === null` and `recommendation === null` (Req 2.3)
 * - `status === 'ready'` implies `recommendation !== null` and `pool.length >= 1`
 * - `status === 'empty'` implies `pool.length === 0`
 * - `shuffle` and `retry` never change `category` (Req 6.4)
 */
export interface RecommenderState {
  status: RecommenderStatus
  category: Category | null
  pool: Movie[]
  recommendation: Movie | null
  errorMessage: string | null
}
