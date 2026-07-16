# Implementation Plan: Watch Recommender

## Overview

This plan implements the Watch Recommender as a thin, client-side feature composed from existing data helpers and the shared `Movie` type. Work starts with the pure logic and types (the deterministic core suited to property-based testing), then the state hook and fetch adapter, then the skin-aware presentational components, and finishes by wiring the entry control into `App.tsx`. Property-based tests validate the six correctness properties from the design; example, component, snapshot, and integration tests cover UI, skin styling, and state-driven flows. Each task builds on prior tasks so there is no orphaned code.

## Tasks

- [x] 1. Set up feature structure and shared types
  - Create the `src/watch-recommender/` directory
  - Create `types.ts` defining `Category` (`'movie' | 'tv' | 'anime' | 'drama'`), `RecommenderStatus`, and `RecommenderState`
  - Confirm the shared `Movie` type import path from `src/omdb.ts` and the `TmdbHomeRails` type from `src/tmdb.ts`
  - Verify the existing Vitest + fast-check + React Testing Library setup is available; if fast-check is not installed, add it as a dev dependency
  - _Requirements: 2.1, 2.3_

- [x] 2. Implement pure logic module (`logic.ts`)
  - [x] 2.1 Implement `categoryToSource` and `buildCandidatePool`
    - Write `categoryToSource(category)` mapping each `Category` to its `CategorySource` (`'tmdb-rails' | 'tmdb-drama' | 'anilist'`)
    - Define the `PoolInputs` interface (`homeRails?`, `dramaList?`, `animeList?`)
    - Implement `buildCandidatePool(category, inputs)`: movie draws from `homeRails.movieCollection.top`, `homeRails.trendingNow` (movie entries), and `homeRails.featuredMovies`; tv from `homeRails.tvShowCollection.top` and `homeRails.featuredTvShows`; drama from `dramaList`; anime from `animeList`
    - Deduplicate by `Movie.id` and drop entries with a missing/empty `id`; always return `Movie[]`
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.2 Write property test for candidate pool sourcing
    - **Property 1: Candidate pool sourcing is category-correct**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 2.3 Write property test for pool validity and uniqueness
    - **Property 2: Candidate pool contains only valid, unique Movie objects**
    - **Validates: Requirements 3.3**

  - [x] 2.4 Implement `selectRecommendation` and `shuffleRecommendation`
    - Define the injectable `Rng` type (defaulting to `Math.random`)
    - Implement `selectRecommendation(pool, rng?)`: return `null` for an empty pool, otherwise `pool[floor(rng() * pool.length)]`
    - Implement `shuffleRecommendation(pool, current, rng?)`: `null` for an empty pool, the sole title for a single-title pool, and a member different from `current` for pools with two or more distinct titles
    - Keep both functions total (never throw)
    - _Requirements: 3.4, 3.5, 6.2, 6.3_

  - [x] 2.5 Write property test for selection
    - **Property 3: Selection returns exactly one pool member**
    - **Validates: Requirements 3.4, 3.5**

  - [x] 2.6 Write property test for shuffle
    - **Property 4: Shuffle stays in the pool and avoids repetition when possible**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 2.7 Implement `resolvePoster` and `POSTER_PLACEHOLDER`
    - Export `POSTER_PLACEHOLDER` constant
    - Implement `resolvePoster(movie)`: return the movie's `poster` when present/non-empty, otherwise `POSTER_PLACEHOLDER`; always return a non-empty string
    - _Requirements: 4.1, 4.4_

  - [x] 2.8 Write property test for poster resolution
    - **Property 5: Poster resolution always yields a usable image**
    - **Validates: Requirements 4.1, 4.4**

- [x] 3. Checkpoint - Ensure all logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement the reducer and state hook (`useWatchRecommender.ts`)
  - [x] 4.1 Implement the pure reducer and action types
    - Define actions for `selectCategory`, `shuffle`, `retry`, `reset`, plus internal fetch-resolution actions (`resolved`, `empty`, `failed`)
    - Implement transitions per the state machine: `idle → loading → ready/empty/error`, `ready → ready` (shuffle), `retry`/`selectCategory` from terminal states
    - Enforce invariants: `idle` iff `category === null` and `recommendation === null`; `ready` implies `recommendation !== null` and `pool.length >= 1`; `empty` implies `pool.length === 0`; `shuffle`/`retry` never change `category`
    - _Requirements: 2.2, 2.3, 6.4, 7.1, 8.2_

  - [x] 4.2 Write property test for reducer invariants
    - **Property 6: Reducer state invariants hold across all actions**
    - **Validates: Requirements 2.3, 6.4**

  - [x] 4.3 Implement the fetch adapter
    - Map each `Category` to its existing helper call(s): `movie`/`tv` → `fetchTmdbHomeRails()`; `drama` → `fetchKoreanChineseDramas()` (`.list`); `anime` → `fetchAnimeByOptions({ sort: ['TRENDING_DESC','POPULARITY_DESC'], perPage: 25 })` then map with `mapAniListToMovieStandalone`
    - Normalize each result into `PoolInputs`
    - Distinguish transport failure (→ `error`) from a successful-but-empty result (→ `empty`); wrap the underlying network call so genuine failures surface as rejections
    - _Requirements: 3.1, 3.2, 8.1, 8.2_

  - [x] 4.4 Implement the `useWatchRecommender` hook
    - Expose `state`, `selectCategory`, `shuffle`, `retry`, `reset`
    - On `selectCategory`: transition to `loading`, call the adapter, build the pool, select a recommendation, and transition to `ready`/`empty`/`error`
    - `shuffle` re-selects from the current pool without re-fetching and retains the category; `retry` re-runs the fetch for the retained category
    - Guard against stale async responses so a newer category selection supersedes an in-flight one
    - _Requirements: 2.2, 6.2, 6.4, 7.1, 7.2, 8.1, 8.3_

  - [x] 4.5 Write integration test for hook flows
    - With mocked data helpers, exercise `idle → loading → ready → shuffle` and `loading → error → retry`
    - Confirm the adapter distinguishes failure from empty results and that shuffle does not re-fetch
    - _Requirements: 2.2, 6.2, 7.1, 7.2, 8.1, 8.2, 8.3_

- [x] 5. Checkpoint - Ensure hook and logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement presentational components (`WatchRecommender.tsx`) and styles (`WatchRecommender.css`)
  - [x] 6.1 Implement entry control, modal, and category picker
    - `WatchRecommenderEntry({ designMode, onOpenDetail })`: renders the "I don't know what to watch" Entry_Control and opens the modal
    - `WatchRecommenderModal`: owns the hook and hosts the picker, card, and state views
    - `CategoryPicker({ onSelect, selected, designMode })`: renders exactly four options — Movie, TV Show, Anime, Drama
    - Apply skin-aware class names (`watch-recommender ${designMode}-theme`)
    - _Requirements: 1.1, 1.2, 2.1, 2.3_

  - [x] 6.2 Implement recommendation card and state views
    - `RecommendationCard({ movie, category, designMode, onOpenDetail, onShuffle })`: poster via `resolvePoster`, title, at least one of year/genres/rating, category label, open-details control, and Shuffle_Control
    - Wire the open-details control to call `onOpenDetail` with the exact recommended `Movie` object
    - `LoadingView`, `EmptyView`, and `ErrorView({ onRetry })` for loading, empty, and error feedback
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 6.1, 7.1, 8.1, 8.2_

  - [x] 6.3 Implement skin-aware, mobile-first responsive styles
    - Write `WatchRecommender.css` with mobile-first layout and a desktop breakpoint
    - Provide Lumen (`apple`) and Anime (`netflix`) skin styles for the entry control, picker, card, and controls
    - _Requirements: 1.3, 1.4, 9.1, 9.2, 9.3, 9.4_

  - [x] 6.4 Write component and interaction tests
    - Entry control renders with the expected label and opens the picker; picker renders exactly the four options
    - Selecting a category with a non-empty mocked pool yields a displayed recommendation; card shows poster, title, an extra detail, and category label
    - Open-details calls `onOpenDetail` with the exact `Movie`; shuffle re-selects without re-fetching; loading/empty/error views behave correctly and retry re-fetches
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 4.1, 4.2, 4.3, 4.5, 5.1, 5.2, 5.3, 6.1, 7.1, 7.2, 8.1, 8.2, 8.3_

  - [x] 6.5 Write skin and responsive snapshot tests
    - Render entry control, picker, and card in each skin and assert the correct skin class is applied
    - Snapshot layout at mobile and desktop breakpoints
    - _Requirements: 1.3, 1.4, 9.1, 9.2, 9.3, 9.4_

- [x] 7. Wire the feature into the app
  - Render `<WatchRecommenderEntry designMode={designMode} onOpenDetail={openDetail} />` in `App.tsx` alongside the other home controls
  - Pass the existing `openDetail` callback so the recommended `Movie` object flows into the existing navigation/playback flow
  - _Requirements: 1.1, 5.2, 5.3_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; they cover unit, property, integration, component, and snapshot tests.
- Each task references specific requirements clauses for traceability.
- Property-based tests use fast-check under Vitest, run a minimum of 100 iterations each, and are tagged `// Feature: watch-recommender, Property {number}: {property_text}`.
- The six correctness properties map one-to-one to the six property-test sub-tasks (2.2, 2.3, 2.5, 2.6, 2.8, 4.2).
- Requirement 10 (Preference Refinement) is out of MVP scope and intentionally has no tasks here.
- Checkpoints ensure incremental validation before moving to the next layer.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.4", "2.7"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.5", "2.6", "2.8"] },
    { "id": 3, "tasks": ["4.1", "4.3"] },
    { "id": 4, "tasks": ["4.2", "4.4"] },
    { "id": 5, "tasks": ["4.5", "6.1", "6.2", "6.3"] },
    { "id": 6, "tasks": ["6.4", "6.5", "7"] }
  ]
}
```
