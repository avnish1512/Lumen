import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Shuffle, ArrowRight, X } from 'lucide-react'
import type { Movie } from '../omdb'
import type { Category } from './types'
import { useWatchRecommender } from './useWatchRecommender'
import { resolvePoster, POSTER_PLACEHOLDER } from './logic'
import './WatchRecommender.css'

/**
 * Watch Recommender — presentational components.
 *
 * This file is built up across tasks:
 * - Task 6.1 implemented the entry control, the modal shell, and the category
 *   picker.
 * - Task 6.2 (this task) replaces the inline state-dependent placeholders in
 *   `WatchRecommenderModal` with dedicated `RecommendationCard`, `LoadingView`,
 *   `EmptyView`, and `ErrorView` components, and reconciles the modal-shell and
 *   card markup with the class-name contract in `WatchRecommender.css`.
 * - Task 6.3 provides `WatchRecommender.css` (imported above) with the
 *   skin-aware, mobile-first styles.
 *
 * Skin awareness: every root element applies `watch-recommender ${designMode}-theme`,
 * mirroring how `App.tsx` applies `app-shell ${designMode}-theme`
 * (Requirements 1.3, 1.4, 9.3, 9.4). `designMode` is `'apple'` (Lumen skin) or
 * `'netflix'` (Anime skin), exactly as typed in `App.tsx`.
 */

// The four selectable categories, in display order, paired with their labels.
// Exactly four options — Movie, TV Show, Anime, Drama (Requirement 2.1).
const CATEGORY_OPTIONS: ReadonlyArray<{ value: Category; label: string }> = [
  { value: 'movie', label: 'Movie' },
  { value: 'tv', label: 'TV Show' },
  { value: 'anime', label: 'Anime' },
  { value: 'drama', label: 'Drama' },
]

/**
 * Human-readable display label for a category (Movie / TV Show / Anime / Drama).
 * Used both by the picker and by the recommendation card's category label
 * (Requirement 4.5).
 */
function categoryLabel(category: Category): string {
  const match = CATEGORY_OPTIONS.find((option) => option.value === category)
  return match ? match.label : category
}

// -----------------------------------------------------------------------------
// Entry control (Requirement 1)
// -----------------------------------------------------------------------------

export interface WatchRecommenderEntryProps {
  /** Active skin: `'apple'` = Lumen, `'netflix'` = Anime. */
  designMode: 'apple' | 'netflix'
  /**
   * Existing app navigation callback. The recommender hands the recommended
   * `Movie` object to this callback so playback reuses the existing flow
   * (Requirement 5.3).
   */
  onOpenDetail: (movie: Movie) => void
  /**
   * Presentation of the entry control:
   * - `'block'` (default): the full-width pill labeled "I don't know what to
   *   watch".
   * - `'icon'`: a compact, icon-only button suited to a toolbar/header (for
   *   example, between the notification bell and the profile control). It
   *   carries the sibling header-button class so it blends into the header,
   *   while still opening the same modal.
   */
  variant?: 'block' | 'icon'
}

/**
 * `WatchRecommenderEntry` — the tappable Entry_Control labeled to convey a
 * "don't know what to watch" action (Req 1.1). Activating it opens the modal
 * that hosts the category picker (Req 1.2). Rendered with the active skin's
 * visual style (Req 1.3, 1.4).
 */
export function WatchRecommenderEntry({
  designMode,
  onOpenDetail,
  variant = 'block',
}: WatchRecommenderEntryProps) {
  const [open, setOpen] = useState(false)

  const isIcon = variant === 'icon'

  return (
    <div className={`watch-recommender ${designMode}-theme${isIcon ? ' wr-inline' : ''}`}>
      {isIcon ? (
        <button
          type="button"
          className="wr-entry-icon-btn"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="I don't know what to watch"
          title="I don't know what to watch"
          data-testid="wr-entry"
        >
          <Sparkles size={22} className="wr-entry-icon" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          className="wr-entry"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-testid="wr-entry"
        >
          <Sparkles size={18} className="wr-entry-icon" aria-hidden="true" />
          <span className="wr-entry-label">I don't know what to watch</span>
        </button>
      )}

      {open && (
        <WatchRecommenderModal
          designMode={designMode}
          onOpenDetail={onOpenDetail}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Modal shell (owns the hook; hosts picker + card + state views)
// -----------------------------------------------------------------------------

export interface WatchRecommenderModalProps {
  designMode: 'apple' | 'netflix'
  onOpenDetail: (movie: Movie) => void
  /** Closes the modal; also resets the recommender back to idle. */
  onClose: () => void
}

/**
 * `WatchRecommenderModal` — owns the `useWatchRecommender` hook and hosts the
 * category picker, the recommendation card, and the loading / empty / error
 * state views.
 *
 * It always renders the `CategoryPicker`, and switches the lower region on
 * `state.status`:
 * - `idle`:    nothing below the picker (no recommendation shown — Req 2.3).
 * - `loading`: `<LoadingView/>` (Req 7.1).
 * - `ready`:   `<RecommendationCard/>` (poster, title, details, controls).
 * - `empty`:   `<EmptyView/>` — "no recommendation available" message (Req 8.2).
 * - `error`:   `<ErrorView/>` — error message plus a retry control (Req 8.1, 8.3).
 */
export function WatchRecommenderModal({
  designMode,
  onOpenDetail,
  onClose,
}: WatchRecommenderModalProps) {
  const { state, selectCategory, selectGenre, shuffle, retry, reset } =
    useWatchRecommender()

  const handleClose = () => {
    reset()
    onClose()
  }

  const overlay = (
    <div
      className={`watch-recommender ${designMode}-theme wr-overlay`}
      role="dialog"
      aria-modal="true"
      aria-label="Watch recommender"
      data-testid="wr-modal"
    >
      <div className="wr-panel">
        <div className="wr-header">
          <h2>What are you in the mood for?</h2>
          <button
            type="button"
            className="wr-close"
            aria-label="Close"
            onClick={handleClose}
            data-testid="wr-close"
          >
            <X size={20} />
          </button>
        </div>

        <CategoryPicker
          selected={state.category}
          onSelect={selectCategory}
          designMode={designMode}
        />

        {/* Preference refinement: genre chips derived from the fetched pool,
            shown once a category has titles (Requirement 10). */}
        {state.availableGenres.length > 0 && (
          <GenrePicker
            genres={state.availableGenres}
            selected={state.genre}
            onSelect={selectGenre}
            designMode={designMode}
          />
        )}

        {/* State-dependent region — dedicated views selected on status. */}
        {state.status === 'loading' && <LoadingView />}

        {state.status === 'empty' && <EmptyView genre={state.genre} />}

        {state.status === 'error' && (
          <ErrorView message={state.errorMessage} onRetry={retry} />
        )}

        {state.status === 'ready' && state.recommendation && state.category && (
          <RecommendationCard
            movie={state.recommendation}
            category={state.category}
            designMode={designMode}
            onOpenDetail={onOpenDetail}
            onShuffle={shuffle}
          />
        )}
      </div>
    </div>
  )

  // Render the overlay through a portal to `document.body` so it always covers
  // the full viewport. Without this, a `position: fixed` overlay is trapped by
  // any transformed/positioned ancestor (e.g. the header cluster that hosts the
  // icon-variant entry button uses `transform`), which would clip the modal.
  return typeof document !== 'undefined'
    ? createPortal(overlay, document.body)
    : overlay
}

// -----------------------------------------------------------------------------
// Category picker (Requirement 2.1)
// -----------------------------------------------------------------------------

export interface CategoryPickerProps {
  /** Called with the chosen `Category` value when an option is activated. */
  onSelect: (category: Category) => void
  /** The currently selected category, or `null` when none is chosen yet. */
  selected: Category | null
  designMode: 'apple' | 'netflix'
}

/**
 * `CategoryPicker` — renders exactly four selectable options (Movie, TV Show,
 * Anime, Drama). Activating an option calls `onSelect` with the corresponding
 * `Category` value (`'movie' | 'tv' | 'anime' | 'drama'`) (Requirement 2.1).
 */
export function CategoryPicker({
  onSelect,
  selected,
  designMode,
}: CategoryPickerProps) {
  return (
    <div
      className={`wr-picker ${designMode}-theme`}
      role="group"
      aria-label="Category"
      data-testid="wr-picker"
    >
      {CATEGORY_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={`wr-category${selected === value ? ' is-selected' : ''}`}
          aria-pressed={selected === value}
          onClick={() => onSelect(value)}
          data-testid={`wr-category-${value}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Genre picker — preference refinement (Requirement 10)
// -----------------------------------------------------------------------------

export interface GenrePickerProps {
  /** Distinct genres available in the fetched pool (e.g. Sci-Fi, Romance). */
  genres: string[]
  /** The currently selected genre, or `null` for "Any". */
  selected: string | null
  /** Called with the chosen genre, or `null` when "Any" is picked. */
  onSelect: (genre: string | null) => void
  designMode: 'apple' | 'netflix'
}

/**
 * `GenrePicker` — optional preference refinement shown after a category has
 * titles. Renders an "Any" chip (clears the filter, Req 10.3) plus one chip per
 * available genre; selecting one restricts the recommendation to that genre
 * (Req 10.1, 10.2).
 */
export function GenrePicker({
  genres,
  selected,
  onSelect,
  designMode,
}: GenrePickerProps) {
  return (
    <div
      className={`wr-genres ${designMode}-theme`}
      role="group"
      aria-label="Genre"
      data-testid="wr-genres"
    >
      <button
        type="button"
        className={`wr-genre${selected === null ? ' is-selected' : ''}`}
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
        data-testid="wr-genre-any"
      >
        Any
      </button>
      {genres.map((genre) => (
        <button
          key={genre}
          type="button"
          className={`wr-genre${selected === genre ? ' is-selected' : ''}`}
          aria-pressed={selected === genre}
          onClick={() => onSelect(genre)}
          data-testid={`wr-genre-${genre.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {genre}
        </button>
      ))}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Recommendation card (Requirements 4, 5, 6)
// -----------------------------------------------------------------------------

export interface RecommendationCardProps {
  /** The recommended title to display. */
  movie: Movie
  /** The category this recommendation belongs to (drives the label, Req 4.5). */
  category: Category
  designMode: 'apple' | 'netflix'
  /**
   * Called with the EXACT recommended `Movie` object when the open-details
   * control is activated, so playback reuses the existing flow (Req 5.1–5.3).
   */
  onOpenDetail: (movie: Movie) => void
  /** Requests a different recommendation from the current pool (Req 6.1). */
  onShuffle: () => void
}

/**
 * `RecommendationCard` — displays the recommended title.
 *
 * Renders (Requirements 4.1–4.5):
 * - the poster via `resolvePoster(movie)`, falling back to the placeholder,
 * - the title,
 * - a category label,
 * - at least one of year / genres / rating (each rendered only when present),
 * - an open-details control wired to `onOpenDetail(movie)` — the exact
 *   recommended `Movie` object (Req 5.1–5.3),
 * - a Shuffle_Control wired to `onShuffle` (Req 6.1).
 */
export function RecommendationCard({
  movie,
  category,
  designMode,
  onOpenDetail,
  onShuffle,
}: RecommendationCardProps) {
  const poster = resolvePoster(movie)
  const hasPlaceholderPoster = poster === POSTER_PLACEHOLDER

  const year = typeof movie.year === 'string' ? movie.year.trim() : ''
  const genres = Array.isArray(movie.genres)
    ? movie.genres.filter((genre) => typeof genre === 'string' && genre.trim())
    : []
  const rating = typeof movie.rating === 'string' ? movie.rating.trim() : ''

  return (
    <div className={`wr-card ${designMode}-theme`} data-testid="wr-card">
      <img
        className="wr-card__poster"
        src={poster}
        alt={`Poster for ${movie.title}`}
        data-testid="wr-card-poster"
        data-placeholder={hasPlaceholderPoster ? 'true' : 'false'}
        loading="lazy"
      />

      <div className="wr-card__body">
        <span className="wr-card__category" data-testid="wr-card-category">
          {categoryLabel(category)}
        </span>

        <h3 className="wr-card__title" data-testid="wr-card-title">
          {movie.title}
        </h3>

        {(year || genres.length > 0 || rating) && (
          <p className="wr-card__meta" data-testid="wr-card-meta">
            {year && <span data-testid="wr-card-year">{year}</span>}
            {genres.length > 0 && (
              <span data-testid="wr-card-genres">{genres.join(', ')}</span>
            )}
            {rating && <span data-testid="wr-card-rating">{rating}</span>}
          </p>
        )}

        <div className="wr-controls">
          <button
            type="button"
            className="wr-open-details"
            onClick={() => onOpenDetail(movie)}
            data-testid="wr-open-detail"
          >
            <ArrowRight size={18} aria-hidden="true" />
            View details
          </button>
          <button
            type="button"
            className="wr-shuffle"
            onClick={onShuffle}
            data-testid="wr-shuffle"
          >
            <Shuffle size={18} aria-hidden="true" />
            Shuffle again
          </button>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// State views — loading / empty / error (Requirements 7, 8)
// -----------------------------------------------------------------------------

/**
 * `LoadingView` — shown while a candidate pool is being retrieved (Req 7.1).
 * Includes a `.wr-spinner` element for the animated loading indicator.
 */
export function LoadingView() {
  return (
    <div className="wr-loading" data-testid="wr-loading" aria-live="polite">
      <div className="wr-spinner" aria-hidden="true" />
      <p>Finding something to watch…</p>
    </div>
  )
}

export interface EmptyViewProps {
  /** When set, the empty state is due to a genre filter (Req 10.4). */
  genre?: string | null
}

/**
 * `EmptyView` — shown when retrieval succeeds but the pool contains no titles
 * (Req 8.2), or when a selected genre preference matches no titles (Req 10.4).
 */
export function EmptyView({ genre }: EmptyViewProps = {}) {
  return (
    <div className="wr-empty" data-testid="wr-empty" aria-live="polite">
      <p>
        {genre
          ? `No ${genre} titles here — try another genre.`
          : 'No recommendation available for that category.'}
      </p>
    </div>
  )
}

export interface ErrorViewProps {
  /** Human-readable error message; a default is used when none is provided. */
  message?: string | null
  /** Re-runs retrieval for the retained category (Req 8.3). */
  onRetry: () => void
}

/**
 * `ErrorView` — shown when retrieval fails at the transport level. Renders the
 * error message and a retry control that re-runs the fetch (Req 8.1, 8.3).
 */
export function ErrorView({ message, onRetry }: ErrorViewProps) {
  return (
    <div className="wr-error" data-testid="wr-error" aria-live="assertive">
      <p>{message || 'Something went wrong. Please try again.'}</p>
      <div className="wr-controls">
        <button
          type="button"
          className="wr-retry"
          onClick={onRetry}
          data-testid="wr-retry"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
