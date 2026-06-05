import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  AlertCircle,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Home,
  Library,
  LoaderCircle,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Share,
  ShoppingBag,
  Tv,
  X,
} from 'lucide-react'
import {
  fetchFeaturedMovies,
  fetchMovieById,
  searchMovies,
  type Movie,
} from './omdb'
import './App.css'

type Screen = 'home' | 'browse' | 'detail' | 'watch' | 'search' | 'library'
type SavedMovies = Record<string, Movie>

const savedMoviesKey = 'omdb.apple-tv-style.saved-movies'
const fallbackPosterImages = [
  '/media/arrival-poster.jpg',
  '/media/northpoint-poster.jpg',
  '/media/sundown-poster.jpg',
  '/media/glass-poster.jpg',
  '/media/afterimage-poster.jpg',
  '/media/golden-poster.jpg',
]

function getInitialScreen(): Screen {
  const hash = window.location.hash.replace('#', '')

  if (
    hash === 'browse' ||
    hash === 'detail' ||
    hash === 'watch' ||
    hash === 'search' ||
    hash === 'library'
  ) {
    return hash
  }

  return 'home'
}

function readSavedMovies(): SavedMovies {
  try {
    const saved = window.localStorage.getItem(savedMoviesKey)
    return saved ? (JSON.parse(saved) as SavedMovies) : {}
  } catch {
    return {}
  }
}

function compactRuntime(runtime: string) {
  const minutesMatch = runtime.match(/(\d+)\s*min/i)

  if (minutesMatch) {
    const totalMinutes = Number(minutesMatch[1])
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
    }

    return `${minutes}m`
  }

  return runtime.replace(' hr ', 'h ').replace(' min', 'm')
}

function imdbUrl(movie: Movie) {
  return `https://www.imdb.com/title/${movie.id}/`
}

function fallbackPosterForRank(rank: number) {
  return fallbackPosterImages[(rank - 1) % fallbackPosterImages.length]
}

function App() {
  const [screen, setScreenState] = useState<Screen>(getInitialScreen)
  const [movies, setMovies] = useState<Movie[]>([])
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [savedMovies, setSavedMovies] = useState<SavedMovies>(readSavedMovies)
  const [homeLoading, setHomeLoading] = useState(true)
  const [homeError, setHomeError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [searchQuery, setSearchQuery] = useState('Batman')
  const [searchResults, setSearchResults] = useState<Movie[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  const featuredMovie = selectedMovie ?? movies[0] ?? null
  const savedList = useMemo(() => Object.values(savedMovies), [savedMovies])
  const editorialMovies = useMemo(() => movies.slice(4, 10), [movies])
  const needsMovieBootstrap =
    screen === 'home' ||
    screen === 'browse' ||
    screen === 'detail' ||
    screen === 'watch'

  const setScreen = (nextScreen: Screen) => {
    setScreenState(nextScreen)
    window.history.replaceState(
      null,
      '',
      nextScreen === 'home' ? window.location.pathname : `#${nextScreen}`,
    )
  }

  useEffect(() => {
    let isMounted = true

    async function loadMovies() {
      setHomeLoading(true)
      setHomeError('')

      try {
        const nextMovies = await fetchFeaturedMovies()

        if (!isMounted) {
          return
        }

        setMovies(nextMovies)
        setSelectedMovie((current) => current ?? nextMovies[0] ?? null)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'Could not load movies.'
        setHomeError(message)
      } finally {
        if (isMounted) {
          setHomeLoading(false)
        }
      }
    }

    void loadMovies()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(savedMoviesKey, JSON.stringify(savedMovies))
  }, [savedMovies])

  const upsertMovie = (movie: Movie) => {
    setMovies((current) =>
      current.map((item) =>
        item.id === movie.id ? { ...movie, rank: item.rank } : item,
      ),
    )
    setSearchResults((current) =>
      current.map((item) =>
        item.id === movie.id ? { ...movie, rank: item.rank } : item,
      ),
    )
  }

  const hydrateMovie = async (movie: Movie) => {
    if (movie.isFull) {
      return movie
    }

    setDetailLoading(true)
    setDetailError('')

    try {
      const fullMovie = await fetchMovieById(movie.id, movie.rank)
      setSelectedMovie(fullMovie)
      upsertMovie(fullMovie)
      return fullMovie
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not load full movie details.'
      setDetailError(message)
      return movie
    } finally {
      setDetailLoading(false)
    }
  }

  const openDetail = (movie: Movie) => {
    setSelectedMovie(movie)
    setScreen('detail')
    void hydrateMovie(movie)
  }

  const openWatch = (movie: Movie) => {
    setSelectedMovie(movie)
    setScreen('watch')
    void hydrateMovie(movie)
  }

  const toggleSaved = (movie: Movie) => {
    setSavedMovies((current) => {
      const next = { ...current }

      if (next[movie.id]) {
        delete next[movie.id]
      } else {
        next[movie.id] = movie
      }

      return next
    })
  }

  const performSearch = useCallback(async (query: string) => {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      return
    }

    setSearchQuery(trimmedQuery)
    setSearchLoading(true)
    setSearchError('')

    try {
      const results = await searchMovies(trimmedQuery)
      setSearchResults(results)

      if (results.length === 0) {
        setSearchError('No movies found. Try another title.')
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not search OMDb.'
      setSearchError(message)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    if (
      screen !== 'search' ||
      searchResults.length > 0 ||
      searchLoading ||
      searchError
    ) {
      return
    }

    const timeout = window.setTimeout(() => {
      void performSearch(searchQuery)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [
    performSearch,
    screen,
    searchError,
    searchLoading,
    searchQuery,
    searchResults.length,
  ])

  const retryHome = () => {
    window.location.reload()
  }

  const shareSelectedMovie = async () => {
    if (!selectedMovie) {
      return
    }

    const url = imdbUrl(selectedMovie)

    try {
      if (navigator.share) {
        await navigator.share({
          title: selectedMovie.title,
          text: `View ${selectedMovie.title} on IMDb`,
          url,
        })
        return
      }

      await navigator.clipboard.writeText(url)
    } catch {
      // Native share can be cancelled by the user.
    }
  }

  const openSelectedPoster = () => {
    if (selectedMovie) {
      window.open(selectedMovie.poster, '_blank', 'noopener,noreferrer')
    }
  }

  if (homeLoading && movies.length === 0 && needsMovieBootstrap) {
    return (
      <main className="app-shell">
        <LoadingScreen />
      </main>
    )
  }

  if (homeError && movies.length === 0 && needsMovieBootstrap) {
    return (
      <main className="app-shell">
        <ErrorScreen error={homeError} onRetry={retryHome} />
      </main>
    )
  }

  return (
    <main className="app-shell">
      {screen === 'home' && featuredMovie && (
        <HomeScreen
          featuredMovie={featuredMovie}
          movies={movies.slice(0, 10)}
          editorialMovies={editorialMovies}
          savedMovies={savedMovies}
          onOpenDetail={openDetail}
          onPlay={openWatch}
          onSave={toggleSaved}
          onSearch={() => setScreen('search')}
        />
      )}

      {screen === 'browse' && (
        <BrowseScreen
          movies={movies}
          onOpenDetail={openDetail}
          onSearch={() => setScreen('search')}
        />
      )}

      {screen === 'detail' && selectedMovie && (
        <DetailScreen
          movie={selectedMovie}
          relatedMovies={movies}
          isSaved={Boolean(savedMovies[selectedMovie.id])}
          isLoading={detailLoading}
          error={detailError}
          onBack={() => setScreen('home')}
          onOpenDetail={openDetail}
          onPlay={() => openWatch(selectedMovie)}
          onSave={() => toggleSaved(selectedMovie)}
          onShare={shareSelectedMovie}
          onOpenPoster={openSelectedPoster}
        />
      )}

      {screen === 'watch' && selectedMovie && (
        <WatchScreen
          movie={selectedMovie}
          isSaved={Boolean(savedMovies[selectedMovie.id])}
          onBack={() => setScreen('detail')}
          onSave={() => toggleSaved(selectedMovie)}
        />
      )}

      {screen === 'search' && (
        <SearchScreen
          query={searchQuery}
          results={searchResults}
          loading={searchLoading}
          error={searchError}
          onQueryChange={setSearchQuery}
          onSearch={performSearch}
          onOpenDetail={openDetail}
          onClose={() => setScreen('home')}
        />
      )}

      {screen === 'library' && (
        <LibraryScreen
          savedMovies={savedList}
          onOpenDetail={openDetail}
          onSearch={() => setScreen('search')}
        />
      )}

      <BottomNav
        active={
          screen === 'home'
            ? 'Home'
            : screen === 'browse'
              ? 'Movies'
              : screen === 'library'
                ? 'Library'
                : screen === 'search'
                  ? 'Discover'
                  : 'Movies'
        }
        onHome={() => setScreen('home')}
        onBrowse={() => setScreen('browse')}
        onDiscover={() => setScreen('search')}
        onLibrary={() => setScreen('library')}
      />
      <DesktopNav
        active={
          screen === 'home'
            ? 'Home'
            : screen === 'browse'
              ? 'Movies'
              : screen === 'library'
                ? 'Library'
                : screen === 'search'
                  ? 'Discover'
                  : 'Movies'
        }
        onHome={() => setScreen('home')}
        onBrowse={() => setScreen('browse')}
        onDiscover={() => setScreen('search')}
        onLibrary={() => setScreen('library')}
      />
    </main>
  )
}

type HomeScreenProps = {
  featuredMovie: Movie
  movies: Movie[]
  editorialMovies: Movie[]
  savedMovies: SavedMovies
  onOpenDetail: (movie: Movie) => void
  onPlay: (movie: Movie) => void
  onSave: (movie: Movie) => void
  onSearch: () => void
}

function HomeScreen({
  featuredMovie,
  movies,
  editorialMovies,
  savedMovies,
  onOpenDetail,
  onPlay,
  onSave,
  onSearch,
}: HomeScreenProps) {
  return (
    <section className="screen home-screen">
      <div
        className="home-hero"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.06) 30%, rgba(0,0,0,.78) 78%, #000 100%), url(${featuredMovie.hero})`,
        }}
      >
        <header className="home-header">
          <h1>Home</h1>
          <button className="avatar-button" type="button" title="Profile">
            AS
          </button>
        </header>

        <div className="hero-copy">
          <span className="floating-label">{featuredMovie.label}</span>
          <pre className="logo-title">{featuredMovie.logoTitle}</pre>
          <p className="meta-line">
            <span className="provider-badge hero-provider">db</span>
            <span>{featuredMovie.type}</span>
            <span>{featuredMovie.genres[0]}</span>
            <span>{featuredMovie.genres[1] ?? featuredMovie.year}</span>
            <span className="rating-chip">{featuredMovie.maturity}</span>
          </p>
          <p className="hero-description">{featuredMovie.synopsis}</p>

          <div className="hero-actions">
            <button
              className="primary-play"
              type="button"
              onClick={() => onPlay(featuredMovie)}
            >
              <Play fill="currentColor" strokeWidth={0} />
              <span>Play</span>
            </button>
            <button
              className="circle-action"
              type="button"
              onClick={() => onSave(featuredMovie)}
              title={
                savedMovies[featuredMovie.id]
                  ? 'Remove from library'
                  : 'Add to library'
              }
            >
              {savedMovies[featuredMovie.id] ? <Check /> : <Plus />}
            </button>
          </div>

          <button className="hero-search" type="button" onClick={onSearch}>
            <Search />
            <span>Search OMDb movies</span>
          </button>
        </div>

        <div className="carousel-dots" aria-hidden="true">
          <span />
          <span className="active" />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <MovieRail title="Top Movies" movies={movies} onOpenDetail={onOpenDetail} />

      <MovieRail
        title="Fresh Picks"
        movies={editorialMovies}
        onOpenDetail={onOpenDetail}
        compact
      />
    </section>
  )
}

type BrowseScreenProps = {
  movies: Movie[]
  onOpenDetail: (movie: Movie) => void
  onSearch: () => void
}

function BrowseScreen({ movies, onOpenDetail, onSearch }: BrowseScreenProps) {
  return (
    <section className="screen browse-screen">
      <ScreenHeader title="Movies" actionLabel="Search" onAction={onSearch} />
      <section className="browse-panel">
        <span className="floating-label">OMDb Powered</span>
        <h2>Find real movie information</h2>
        <p>
          Browse curated picks or search OMDb for plots, cast, ratings, release
          dates, box office, and IMDb links.
        </p>
      </section>
      <MovieRail title="Curated Movies" movies={movies} onOpenDetail={onOpenDetail} />
      <MovieRail
        title="Award Winners"
        movies={movies.slice(1, 8)}
        onOpenDetail={onOpenDetail}
        compact
      />
    </section>
  )
}

type DetailScreenProps = {
  movie: Movie
  relatedMovies: Movie[]
  isSaved: boolean
  isLoading: boolean
  error: string
  onBack: () => void
  onOpenDetail: (movie: Movie) => void
  onPlay: () => void
  onSave: () => void
  onShare: () => void
  onOpenPoster: () => void
}

function DetailScreen({
  movie,
  relatedMovies,
  isSaved,
  isLoading,
  error,
  onBack,
  onOpenDetail,
  onPlay,
  onSave,
  onShare,
  onOpenPoster,
}: DetailScreenProps) {
  return (
    <section className="screen detail-screen">
      <div
        className="detail-hero"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.14), rgba(0,0,0,.26) 30%, rgba(0,0,0,.84) 78%, #000 100%), url(${movie.hero})`,
        }}
      >
        <DetailTopBar
          onBack={onBack}
          onShare={onShare}
          onOpenPoster={onOpenPoster}
        />

        <div className="detail-copy">
          <span className="floating-label dark">
            {isLoading ? 'Loading OMDb' : movie.label}
          </span>
          <pre className="logo-title detail-title">{movie.logoTitle}</pre>
          <p className="detail-meta">
            {movie.type} / {movie.genres.join(' / ')}
          </p>

          <div className="detail-actions">
            <button className="primary-play detail-play" type="button" onClick={onPlay}>
              <Play fill="currentColor" strokeWidth={0} />
              <span className="progress-track">
                <span style={{ width: `${movie.progress}%` }} />
              </span>
              <strong>{compactRuntime(movie.runtime)}</strong>
            </button>
            <button
              className="circle-action"
              type="button"
              onClick={onSave}
              title={isSaved ? 'Saved' : 'Add to library'}
            >
              {isSaved ? <Check /> : <Plus />}
            </button>
          </div>

          {error && <InlineAlert message={error} />}

          <p className="synopsis">
            <strong>{movie.title}:</strong> {movie.synopsis}
          </p>
          <Metadata movie={movie} />
        </div>
      </div>

      <section className="content-section">
        <button className="section-title selectable" type="button">
          <span>Cast</span>
          <ChevronDown />
        </button>
        <div className="cast-row">
          {movie.cast.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      </section>

      <MovieFacts movie={movie} />

      <MovieRail
        title="More Like This"
        movies={relatedMovies.filter((related) => related.id !== movie.id)}
        onOpenDetail={onOpenDetail}
        compact
      />
    </section>
  )
}

type WatchScreenProps = {
  movie: Movie
  isSaved: boolean
  onBack: () => void
  onSave: () => void
}

function WatchScreen({ movie, isSaved, onBack, onSave }: WatchScreenProps) {
  return (
    <section className="screen watch-screen">
      <DetailTopBar
        onBack={onBack}
        onShare={() => window.open(imdbUrl(movie), '_blank', 'noopener,noreferrer')}
        onOpenPoster={() =>
          window.open(movie.poster, '_blank', 'noopener,noreferrer')
        }
        dark
      />

      <img className="watch-still" src={movie.still} alt="" />

      <section className="watch-copy">
        <p className="watch-kicker">{movie.title}</p>
        <h2>{movie.genres[0] ?? 'Movie'}</h2>
        <p className="watch-provider">
          {movie.genres.slice(1).join(' / ') || movie.year}
          <span className="provider-badge">db</span>
          <ChevronRight />
        </p>

        <button className="watch-play" type="button">
          <Play fill="currentColor" strokeWidth={0} />
          <span className="progress-track">
            <span style={{ width: `${movie.progress}%` }} />
          </span>
          <strong>{compactRuntime(movie.runtime)}</strong>
        </button>

        <p className="watch-synopsis">
          <strong>{movie.year}:</strong> {movie.synopsis}
        </p>
        <Metadata movie={movie} />
      </section>

      <section className="content-section watch-card-section">
        <h2>How to Watch</h2>
        <a
          className="subscription-card"
          href={imdbUrl(movie)}
          target="_blank"
          rel="noreferrer"
        >
          <span className="provider-logo">IMDb</span>
          <span>
            <strong>{isSaved ? 'Open Saved Movie' : 'Open on IMDb'}</strong>
            <small>Real movie page</small>
          </span>
          <button
            className="mini-save"
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onSave()
            }}
            title={isSaved ? 'Saved' : 'Add to library'}
          >
            {isSaved ? <Check /> : <Plus />}
          </button>
        </a>
      </section>
    </section>
  )
}

type SearchScreenProps = {
  query: string
  results: Movie[]
  loading: boolean
  error: string
  onQueryChange: (query: string) => void
  onSearch: (query: string) => void
  onOpenDetail: (movie: Movie) => void
  onClose: () => void
}

function SearchScreen({
  query,
  results,
  loading,
  error,
  onQueryChange,
  onSearch,
  onOpenDetail,
  onClose,
}: SearchScreenProps) {
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearch(query)
  }

  return (
    <section className="screen search-screen">
      <div className="search-top">
        <form className="search-form" onSubmit={submitSearch}>
          <Search />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search movies"
            aria-label="Search movies"
          />
          {query && (
            <button
              className="clear-search"
              type="button"
              onClick={() => onQueryChange('')}
              title="Clear search"
            >
              <X />
            </button>
          )}
        </form>
        <button className="close-search" type="button" onClick={onClose}>
          Done
        </button>
      </div>

      <section className="search-content">
        <h1>Discover</h1>
        <div className="quick-searches">
          {['Batman', 'Avatar', 'Mission Impossible', 'Spider-Man'].map(
            (term) => (
              <button type="button" key={term} onClick={() => onSearch(term)}>
                {term}
              </button>
            ),
          )}
        </div>

        {loading && <LoadingStrip label="Searching OMDb" />}
        {error && <InlineAlert message={error} />}

        {results.length > 0 && (
          <div className="result-grid">
            {results.map((movie) => (
              <PosterCard
                key={movie.id}
                movie={movie}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
        )}

        {!loading && !error && results.length === 0 && (
          <div className="empty-state">
            <Film />
            <h2>Search the movie database</h2>
            <p>Try a title and open any result for full OMDb details.</p>
          </div>
        )}
      </section>
    </section>
  )
}

type LibraryScreenProps = {
  savedMovies: Movie[]
  onOpenDetail: (movie: Movie) => void
  onSearch: () => void
}

function LibraryScreen({
  savedMovies,
  onOpenDetail,
  onSearch,
}: LibraryScreenProps) {
  return (
    <section className="screen library-screen">
      <ScreenHeader title="Library" actionLabel="Search" onAction={onSearch} />

      {savedMovies.length > 0 ? (
        <section className="search-content">
          <h1>Saved Movies</h1>
          <div className="result-grid">
            {savedMovies.map((movie) => (
              <PosterCard
                key={movie.id}
                movie={movie}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="empty-state library-empty">
          <Bookmark />
          <h2>No saved movies yet</h2>
          <p>Save movies from the home or detail screens to keep them here.</p>
          <button className="primary-play small" type="button" onClick={onSearch}>
            <Search />
            <span>Find Movies</span>
          </button>
        </section>
      )}
    </section>
  )
}

type MovieRailProps = {
  title: string
  movies: Movie[]
  compact?: boolean
  onOpenDetail: (movie: Movie) => void
}

function MovieRail({ title, movies, compact, onOpenDetail }: MovieRailProps) {
  if (movies.length === 0) {
    return null
  }

  return (
    <section className="movie-rail">
      <button className="rail-heading" type="button">
        <span>{title}</span>
        <ChevronRight />
      </button>
      <div className={compact ? 'poster-row compact' : 'poster-row'}>
        {movies.map((movie) => (
          <PosterCard
            key={movie.id}
            movie={movie}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </div>
    </section>
  )
}

function PosterCard({
  movie,
  onOpenDetail,
}: {
  movie: Movie
  onOpenDetail: (movie: Movie) => void
}) {
  return (
    <button
      className="poster-card"
      type="button"
      onClick={() => onOpenDetail(movie)}
    >
      <img
        src={movie.poster}
        alt=""
        onError={(event) => {
          event.currentTarget.src = fallbackPosterForRank(movie.rank)
        }}
      />
      <span className="rank">{movie.rank}</span>
      <span className="poster-title">{movie.title}</span>
    </button>
  )
}

function ScreenHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <header className="screen-header">
      <h1>{title}</h1>
      <button type="button" onClick={onAction}>
        {actionLabel}
      </button>
    </header>
  )
}

function DetailTopBar({
  onBack,
  onShare,
  onOpenPoster,
  dark,
}: {
  onBack: () => void
  onShare: () => void
  onOpenPoster: () => void
  dark?: boolean
}) {
  return (
    <nav className={dark ? 'top-actions dark' : 'top-actions'} aria-label="Movie">
      <button className="round-nav" type="button" onClick={onBack} title="Back">
        <ChevronLeft />
      </button>
      <div className="action-pill">
        <button type="button" title="Open poster" onClick={onOpenPoster}>
          <Download />
        </button>
        <button type="button" title="Share IMDb link" onClick={onShare}>
          <Share />
        </button>
      </div>
    </nav>
  )
}

function Metadata({ movie }: { movie: Movie }) {
  return (
    <div className="metadata">
      <span>{movie.year}</span>
      <span>{movie.runtime}</span>
      <span className="outline-badge">{movie.maturity}</span>
      {movie.badges.map((badge) => (
        <span className="outline-badge" key={badge}>
          {badge}
        </span>
      ))}
    </div>
  )
}

function MovieFacts({ movie }: { movie: Movie }) {
  return (
    <section className="content-section facts-section">
      <h2>Movie Details</h2>
      <div className="facts-grid">
        <FactItem label="Director" value={movie.director} />
        <FactItem label="Box Office" value={movie.boxOffice} />
        <FactItem label="Awards" value={movie.awards} />
        <FactItem label="IMDb" value={movie.rating} />
      </div>

      {movie.ratings.length > 0 && (
        <div className="ratings-row">
          {movie.ratings.map((rating) => (
            <span key={rating.Source}>
              <strong>{rating.Value}</strong>
              {rating.Source}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

function FactItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function LoadingScreen() {
  return (
    <section className="screen loading-screen">
      <div className="center-state">
        <LoaderCircle className="spin-icon" />
        <h1>Loading Movies</h1>
        <p>Getting real OMDb data for the app.</p>
      </div>
    </section>
  )
}

function ErrorScreen({
  error,
  onRetry,
}: {
  error: string
  onRetry: () => void
}) {
  return (
    <section className="screen loading-screen">
      <div className="center-state">
        <AlertCircle />
        <h1>Movie Data Failed</h1>
        <p>{error}</p>
        <button className="primary-play small" type="button" onClick={onRetry}>
          <RefreshCcw />
          <span>Retry</span>
        </button>
      </div>
    </section>
  )
}

function InlineAlert({ message }: { message: string }) {
  return (
    <div className="inline-alert">
      <AlertCircle />
      <span>{message}</span>
    </div>
  )
}

function LoadingStrip({ label }: { label: string }) {
  return (
    <div className="loading-strip">
      <LoaderCircle />
      <span>{label}</span>
    </div>
  )
}

function BottomNav({
  active,
  onHome,
  onBrowse,
  onDiscover,
  onLibrary,
}: {
  active: 'Home' | 'Movies' | 'Discover' | 'Library'
  onHome: () => void
  onBrowse: () => void
  onDiscover: () => void
  onLibrary: () => void
}) {
  return (
    <div className="bottom-ui">
      <nav className="tab-dock" aria-label="Primary">
        <button
          className={active === 'Home' ? 'active' : ''}
          type="button"
          onClick={onHome}
        >
          <Home fill="currentColor" />
          <span>Home</span>
        </button>
        <button
          className={active === 'Movies' ? 'active' : ''}
          type="button"
          onClick={onBrowse}
        >
          <Tv />
          <span>Movies</span>
        </button>
        <button
          className={active === 'Discover' ? 'active' : ''}
          type="button"
          onClick={onDiscover}
        >
          <ShoppingBag />
          <span>Discover</span>
        </button>
        <button
          className={active === 'Library' ? 'active' : ''}
          type="button"
          onClick={onLibrary}
        >
          <Library />
          <span>Library</span>
        </button>
      </nav>
      <button className="search-float" type="button" title="Search" onClick={onDiscover}>
        <Search />
      </button>
    </div>
  )
}

function DesktopNav({
  active,
  onHome,
  onBrowse,
  onDiscover,
  onLibrary,
}: {
  active: 'Home' | 'Movies' | 'Discover' | 'Library'
  onHome: () => void
  onBrowse: () => void
  onDiscover: () => void
  onLibrary: () => void
}) {
  return (
    <header className="desktop-nav">
      <button className="desktop-brand" type="button" onClick={onHome}>
        <Tv />
        <span>Movie TV</span>
      </button>
      <nav aria-label="Website">
        <button
          className={active === 'Home' ? 'active' : ''}
          type="button"
          onClick={onHome}
        >
          Home
        </button>
        <button
          className={active === 'Movies' ? 'active' : ''}
          type="button"
          onClick={onBrowse}
        >
          Movies
        </button>
        <button
          className={active === 'Discover' ? 'active' : ''}
          type="button"
          onClick={onDiscover}
        >
          Discover
        </button>
        <button
          className={active === 'Library' ? 'active' : ''}
          type="button"
          onClick={onLibrary}
        >
          Library
        </button>
      </nav>
      <button className="desktop-search" type="button" onClick={onDiscover}>
        <Search />
        <span>Search</span>
      </button>
    </header>
  )
}

export default App
