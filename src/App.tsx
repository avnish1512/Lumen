import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clapperboard,
  Download,
  Home,
  Library,
  LoaderCircle,
  Mic,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Share,
  Tv,
  VolumeX,
} from 'lucide-react'
import {
  fetchMovieCollection,
  fetchMovieById,
  fetchTvShowCollection,
  searchMovies,
  type MediaCollection,
  type Movie,
} from './omdb'
import {
  buildStreamUrl,
  defaultStreamProvider,
  fetchTmdbMatch,
  streamProviderOptions,
  type StreamProvider,
} from './tmdb'
import './App.css'

type Screen = 'home' | 'movies' | 'tv' | 'detail' | 'watch' | 'search' | 'library'
type PrimaryTab = 'Home' | 'Movies' | 'TV Shows' | 'Library' | 'Search'
type SavedMovies = Record<string, Movie>
type WatchHistoryEntry = {
  movie: Movie
  updatedAt: number
  progress: number
}
type WatchHistory = Record<string, WatchHistoryEntry>

const savedMoviesKey = 'omdb.apple-tv-style.saved-movies'
const watchHistoryKey = 'omdb.apple-tv-style.watch-history'
const streamProviderKey = 'omdb.apple-tv-style.stream-provider'
const heroAutoAdvanceMs = 6000
const emptyMediaCollection: MediaCollection = {
  top: [],
  thrilling: [],
  adventure: [],
  kidsFamily: [],
}
const fallbackPosterImages = [
  'https://image.tmdb.org/t/p/w780/qmDpIHrmpJINaRKAfWQfftjCdyi.jpg',
  'https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
  'https://image.tmdb.org/t/p/w780/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg',
  'https://image.tmdb.org/t/p/w780/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
  'https://image.tmdb.org/t/p/w780/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
  'https://image.tmdb.org/t/p/w780/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg',
]

const searchCategories = [
  'Apple TV',
  'Sports',
  'Movie Bundles',
  'Bollywood',
  'Regional Indian',
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Horror',
  'Kids & Family',
  'Sci-Fi',
]

function getInitialScreen(): Screen {
  const hash = window.location.hash.replace('#', '')

  if (
    hash === 'movies' ||
    hash === 'tv' ||
    hash === 'detail' ||
    hash === 'watch' ||
    hash === 'search' ||
    hash === 'library'
  ) {
    return hash
  }

  if (hash === 'browse') {
    return 'movies'
  }

  return 'home'
}

function isStreamProvider(value: string | null): value is StreamProvider {
  return value === 'rivestream' || value === 'vidsync'
}

function readStreamProvider(): StreamProvider {
  try {
    const saved = window.localStorage.getItem(streamProviderKey)
    return isStreamProvider(saved) ? saved : defaultStreamProvider
  } catch {
    return defaultStreamProvider
  }
}

function readSavedMovies(): SavedMovies {
  try {
    const saved = window.localStorage.getItem(savedMoviesKey)
    return saved ? (JSON.parse(saved) as SavedMovies) : {}
  } catch {
    return {}
  }
}

function readWatchHistory(): WatchHistory {
  try {
    const saved = window.localStorage.getItem(watchHistoryKey)
    return saved ? (JSON.parse(saved) as WatchHistory) : {}
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

const seasonEpisodeCounts: Record<string, number[]> = {
  tt0944947: [10, 10, 10, 10, 10, 10, 7, 6],
  tt0903747: [7, 13, 13, 13, 16],
  tt4574334: [8, 9, 8, 9],
  tt1475582: [3, 3, 3, 3],
  tt0108778: [24, 24, 25, 24, 24, 25, 24, 24, 23, 17],
  tt7366338: [5],
  tt3032476: [10, 10, 10, 10, 10, 13],
  tt1520211: [6, 13, 16, 16, 16, 16, 16, 16, 16, 22, 24],
  tt2861424: [11, 10, 10, 10, 10, 10, 10],
  tt0413573: [9, 27, 25, 17, 24, 24, 22, 24, 24, 24, 25, 24, 24, 24, 25, 21, 17, 20, 20],
}

const episodeTitlePool = [
  'Aftermath',
  'Departure',
  'Signals',
  'Crossing',
  'The Search',
  'Nightfall',
  'Turning Point',
  'Reckoning',
  'The Return',
  'Final Move',
]

function seasonsFor(movie: Movie) {
  const knownCounts = seasonEpisodeCounts[movie.id]
  const fallbackSeasonCount = movie.year.includes('-') ? 4 : 2
  const counts =
    knownCounts ??
    Array.from({ length: fallbackSeasonCount }, (_, index) =>
      index === 0 ? 8 : 10,
    )

  return counts.map((episodeCount, index) => ({
    season: index + 1,
    episodeCount,
  }))
}

function episodeRuntime(movie: Movie, season: number, episode: number) {
  const minutesMatch = movie.runtime.match(/(\d+)\s*min/i)

  if (minutesMatch) {
    return `${Number(minutesMatch[1])}m`
  }

  return `${42 + ((season * 7 + episode * 5 + movie.id.length) % 18)}m`
}

function episodeTitle(season: number, episode: number) {
  return episodeTitlePool[(season * 3 + episode - 1) % episodeTitlePool.length]
}

function episodeSynopsis(movie: Movie, season: number, episode: number) {
  const cleanSynopsis = movie.synopsis.replace(/\s+/g, ' ').trim()

  if (cleanSynopsis && cleanSynopsis !== 'N/A') {
    return cleanSynopsis
  }

  return `${movie.title} continues through season ${season}, episode ${episode}.`
}

function rankRail(movies: Movie[]) {
  return movies.map((movie, index) => ({
    ...movie,
    rank: index + 1,
  }))
}

function uniqueMovies(movies: Movie[]) {
  const seen = new Set<string>()

  return movies.filter((movie) => {
    if (seen.has(movie.id)) {
      return false
    }

    seen.add(movie.id)
    return true
  })
}

function buildRail(primary: Movie[], fallback: Movie[] = [], limit = 10) {
  return rankRail(uniqueMovies([...primary, ...fallback]).slice(0, limit))
}

function mergeKnownMovie(base: Movie, update: Movie) {
  return {
    ...base,
    ...update,
    rank: base.rank,
    tmdbId: update.tmdbId ?? base.tmdbId,
    tmdbType: update.tmdbType ?? base.tmdbType,
    streamSeason: update.streamSeason ?? base.streamSeason,
    streamEpisode: update.streamEpisode ?? base.streamEpisode,
  }
}

function continueProgressFor(movie: Movie) {
  return Math.min(86, Math.max(8, movie.progress || 24))
}

function continueRuntimeLabel(movie: Movie) {
  const runtime = compactRuntime(movie.runtime)

  if (isTvShow(movie)) {
    return `S${movie.streamSeason ?? 1}, E${movie.streamEpisode ?? 1} / ${runtime}`
  }

  return runtime
}

function isTvShow(movie: Movie) {
  return movie.tmdbType === 'tv' || movie.type.toLowerCase() === 'series'
}

function imdbUrl(movie: Movie) {
  return `https://www.imdb.com/title/${movie.id}/`
}

function fallbackPosterForRank(rank: number) {
  return fallbackPosterImages[(rank - 1) % fallbackPosterImages.length]
}

function heroBackgroundStyle(movie: Movie, gradient: string) {
  return {
    '--hero-art': `url(${movie.hero})`,
    '--poster-art': `url(${movie.poster})`,
    backgroundImage: `${gradient}, url(${movie.hero}), url(${movie.poster}), url(${movie.poster})`,
  } as CSSProperties
}

function App() {
  const [screen, setScreenState] = useState<Screen>(getInitialScreen)
  const [movies, setMovies] = useState<Movie[]>([])
  const [tvShows, setTvShows] = useState<Movie[]>([])
  const [movieCollection, setMovieCollection] =
    useState<MediaCollection>(emptyMediaCollection)
  const [tvShowCollection, setTvShowCollection] =
    useState<MediaCollection>(emptyMediaCollection)
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [savedMovies, setSavedMovies] = useState<SavedMovies>(readSavedMovies)
  const [watchHistory, setWatchHistory] =
    useState<WatchHistory>(readWatchHistory)
  const [homeLoading, setHomeLoading] = useState(true)
  const [homeError, setHomeError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [searchQuery, setSearchQuery] = useState('Apple TV')
  const [searchResults, setSearchResults] = useState<Movie[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [streamLoading, setStreamLoading] = useState(false)
  const [streamError, setStreamError] = useState('')
  const [streamProvider, setStreamProvider] =
    useState<StreamProvider>(readStreamProvider)

  const featuredMovie = selectedMovie && !isTvShow(selectedMovie) ? selectedMovie : movies[0] ?? null
  const featuredTvShow = selectedMovie && isTvShow(selectedMovie) ? selectedMovie : tvShows[0] ?? null
  const savedList = useMemo(() => Object.values(savedMovies), [savedMovies])
  const continueWatching = useMemo(
    () =>
      Object.values(watchHistory)
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 12)
        .map((entry, index) => ({
          ...entry.movie,
          rank: index + 1,
          progress: entry.progress,
        })),
    [watchHistory],
  )
  const relatedMedia = selectedMovie && isTvShow(selectedMovie) ? tvShows : movies
  const requiredMedia = screen === 'tv' ? tvShows : movies
  const needsMovieBootstrap =
    screen === 'home' ||
    screen === 'movies' ||
    screen === 'tv' ||
    screen === 'detail' ||
    screen === 'watch'
  const activeTab: PrimaryTab =
    screen === 'home'
      ? 'Home'
      : screen === 'library'
        ? 'Library'
        : screen === 'search'
          ? 'Search'
          : screen === 'tv'
            ? 'TV Shows'
            : 'Movies'

  const setScreen = (nextScreen: Screen) => {
    setScreenState(nextScreen)
    window.history.replaceState(
      null,
      '',
      nextScreen === 'home' ? window.location.pathname : `#${nextScreen}`,
    )
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  useEffect(() => {
    let isMounted = true

    async function loadMovies() {
      setHomeLoading(true)
      setHomeError('')

      try {
        const [nextMovieCollection, nextTvShowCollection] = await Promise.all([
          fetchMovieCollection(),
          fetchTvShowCollection(),
        ])
        const nextMovies = nextMovieCollection.top
        const nextTvShows = nextTvShowCollection.top

        if (!isMounted) {
          return
        }

        setMovies(nextMovies)
        setTvShows(nextTvShows)
        setMovieCollection(nextMovieCollection)
        setTvShowCollection(nextTvShowCollection)
        setSelectedMovie((current) => current ?? nextMovies[0] ?? null)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Could not load movies and TV shows.'
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

  useEffect(() => {
    window.localStorage.setItem(watchHistoryKey, JSON.stringify(watchHistory))
  }, [watchHistory])

  useEffect(() => {
    window.localStorage.setItem(streamProviderKey, streamProvider)
  }, [streamProvider])

  const markContinueWatching = useCallback((movie: Movie) => {
    setWatchHistory((current) => {
      const existing = current[movie.id]
      const historyMovie = existing
        ? mergeKnownMovie(existing.movie, movie)
        : movie

      return {
        ...current,
        [movie.id]: {
          movie: historyMovie,
          updatedAt: Date.now(),
          progress: Math.max(
            existing?.progress ?? 0,
            continueProgressFor(movie),
          ),
        },
      }
    })
  }, [])

  const upsertMovie = (movie: Movie) => {
    const mergeMovie = (item: Movie) =>
      item.id === movie.id ? mergeKnownMovie(item, movie) : item
    const mergeCollection = (collection: MediaCollection) => ({
      top: collection.top.map((item) => mergeMovie(item)),
      thrilling: collection.thrilling.map((item) => mergeMovie(item)),
      adventure: collection.adventure.map((item) => mergeMovie(item)),
      kidsFamily: collection.kidsFamily.map((item) => mergeMovie(item)),
    })

    setMovies((current) =>
      current.map((item) => (isTvShow(item) ? item : mergeMovie(item))),
    )
    setTvShows((current) =>
      current.map((item) => (isTvShow(item) ? mergeMovie(item) : item)),
    )
    setMovieCollection((current) => mergeCollection(current))
    setTvShowCollection((current) => mergeCollection(current))
    setSearchResults((current) =>
      current.map((item) => mergeMovie(item)),
    )
    setWatchHistory((current) => {
      const existing = current[movie.id]

      if (!existing) {
        return current
      }

      return {
        ...current,
        [movie.id]: {
          ...existing,
          movie: mergeKnownMovie(existing.movie, movie),
          progress: Math.max(existing.progress, continueProgressFor(movie)),
        },
      }
    })
  }

  const hydrateMovie = async (movie: Movie) => {
    if (movie.isFull) {
      return movie
    }

    setDetailLoading(true)
    setDetailError('')

    try {
      const fullMovie = await fetchMovieById(movie.id, movie.rank)
      setSelectedMovie((current) =>
        current?.id === fullMovie.id
          ? {
              ...fullMovie,
              tmdbId: current.tmdbId ?? movie.tmdbId,
              tmdbType: current.tmdbType ?? movie.tmdbType,
              streamSeason: current.streamSeason ?? movie.streamSeason,
              streamEpisode: current.streamEpisode ?? movie.streamEpisode,
            }
          : fullMovie,
      )
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

  const hydrateStreamingMovie = useCallback(
    async (movie: Movie) => {
      if (movie.tmdbId) {
        return movie
      }

      setStreamLoading(true)
      setStreamError('')

      try {
        const match = await fetchTmdbMatch(movie.id)
        const streamMovie: Movie = {
          ...movie,
          tmdbId: match.tmdbId,
          tmdbType: match.mediaType,
          streamSeason:
            match.mediaType === 'tv' ? movie.streamSeason ?? 1 : undefined,
          streamEpisode:
            match.mediaType === 'tv' ? movie.streamEpisode ?? 1 : undefined,
        }

        setSelectedMovie((current) =>
          current?.id === movie.id
            ? {
                ...current,
                tmdbId: streamMovie.tmdbId,
                tmdbType: streamMovie.tmdbType,
                streamSeason: streamMovie.streamSeason,
                streamEpisode: streamMovie.streamEpisode,
              }
            : current,
        )
        upsertMovie(streamMovie)
        markContinueWatching(streamMovie)
        setSavedMovies((current) => {
          if (!current[movie.id]) {
            return current
          }

          return {
            ...current,
            [movie.id]: {
              ...current[movie.id],
              tmdbId: streamMovie.tmdbId,
              tmdbType: streamMovie.tmdbType,
              streamSeason: streamMovie.streamSeason,
              streamEpisode: streamMovie.streamEpisode,
            },
          }
        })

        return streamMovie
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not prepare the stream.'
        setStreamError(message)
        return movie
      } finally {
        setStreamLoading(false)
      }
    },
    [markContinueWatching],
  )

  const openDetail = (movie: Movie) => {
    setSelectedMovie(movie)
    markContinueWatching(movie)
    setScreen('detail')
    void hydrateMovie(movie).then(markContinueWatching)
  }

  const openWatch = (movie: Movie) => {
    setSelectedMovie(movie)
    markContinueWatching(movie)
    setScreen('watch')
    setStreamError('')
    void hydrateMovie(movie).then(markContinueWatching)
    void hydrateStreamingMovie(movie)
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
      screen !== 'watch' ||
      !selectedMovie ||
      selectedMovie.tmdbId ||
      streamLoading
    ) {
      return
    }

    const timeout = window.setTimeout(() => {
      void hydrateStreamingMovie(selectedMovie)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [hydrateStreamingMovie, screen, selectedMovie, streamLoading])

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

  if (homeLoading && requiredMedia.length === 0 && needsMovieBootstrap) {
    return (
      <main className="app-shell">
        <LoadingScreen />
      </main>
    )
  }

  if (homeError && requiredMedia.length === 0 && needsMovieBootstrap) {
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
          movies={movies}
          tvShows={tvShows}
          movieCollection={movieCollection}
          tvShowCollection={tvShowCollection}
          continueMovies={continueWatching}
          savedMovies={savedMovies}
          onOpenDetail={openDetail}
          onPlay={openWatch}
          onSave={toggleSaved}
          onSearch={() => setScreen('search')}
          onSelectHero={setSelectedMovie}
        />
      )}

      {(screen === 'movies' || screen === 'tv') && (
        <BrowseScreen
          mode={screen}
          movies={screen === 'tv' ? tvShows : movies}
          collection={screen === 'tv' ? tvShowCollection : movieCollection}
          featuredMovie={screen === 'tv' ? featuredTvShow ?? tvShows[0] : featuredMovie ?? movies[0]}
          savedMovies={savedMovies}
          onOpenDetail={openDetail}
          onPlay={openWatch}
          onSave={toggleSaved}
        />
      )}

      {screen === 'detail' && selectedMovie && (
        <DetailScreen
          movie={selectedMovie}
          relatedMovies={relatedMedia}
          isSaved={Boolean(savedMovies[selectedMovie.id])}
          isLoading={detailLoading}
          error={detailError}
          onBack={() => setScreen('home')}
          onOpenDetail={openDetail}
          onPlay={(provider) => {
            if (provider) {
              setStreamProvider(provider)
            }
            openWatch(selectedMovie)
          }}
          onPlayEpisode={(season, episode) => {
            openWatch({
              ...selectedMovie,
              tmdbType: selectedMovie.tmdbType ?? 'tv',
              streamSeason: season,
              streamEpisode: episode,
            })
          }}
          onSave={() => toggleSaved(selectedMovie)}
          onShare={shareSelectedMovie}
          onOpenPoster={openSelectedPoster}
        />
      )}

      {screen === 'watch' && selectedMovie && (
        <WatchScreen
          movie={selectedMovie}
          isSaved={Boolean(savedMovies[selectedMovie.id])}
          streamLoading={streamLoading}
          streamError={streamError}
          streamProvider={streamProvider}
          onBack={() => setScreen('detail')}
          onSave={() => toggleSaved(selectedMovie)}
          onStreamProviderChange={setStreamProvider}
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
          onClear={() => {
            setSearchResults([])
            setSearchError('')
            setSearchQuery('Apple TV')
          }}
          onOpenDetail={openDetail}
          onClose={() => setScreen('home')}
        />
      )}

      {screen === 'library' && (
        <LibraryScreen
          savedMovies={savedList}
          onOpenDetail={openDetail}
        />
      )}

      {screen !== 'search' && (
        <BottomNav
          active={activeTab}
          onHome={() => setScreen('home')}
          onMovies={() => setScreen('movies')}
          onTvShows={() => setScreen('tv')}
          onSearch={() => setScreen('search')}
          onLibrary={() => setScreen('library')}
        />
      )}
      <DesktopNav
        active={activeTab}
        onHome={() => setScreen('home')}
        onMovies={() => setScreen('movies')}
        onTvShows={() => setScreen('tv')}
        onSearch={() => setScreen('search')}
        onLibrary={() => setScreen('library')}
      />
    </main>
  )
}

type HomeScreenProps = {
  featuredMovie: Movie
  movies: Movie[]
  tvShows: Movie[]
  movieCollection: MediaCollection
  tvShowCollection: MediaCollection
  continueMovies: Movie[]
  savedMovies: SavedMovies
  onOpenDetail: (movie: Movie) => void
  onPlay: (movie: Movie) => void
  onSave: (movie: Movie) => void
  onSearch: () => void
  onSelectHero: (movie: Movie) => void
}

function HomeScreen({
  featuredMovie,
  movies,
  tvShows,
  movieCollection,
  tvShowCollection,
  continueMovies,
  savedMovies,
  onOpenDetail,
  onPlay,
  onSave,
  onSearch,
  onSelectHero,
}: HomeScreenProps) {
  const heroMovies = useMemo(() => movies.slice(0, 6), [movies])
  const movieTopTenMovies = useMemo(
    () => buildRail(movieCollection.top, movies),
    [movieCollection.top, movies],
  )
  const tvTopTenMovies = useMemo(
    () => buildRail(tvShowCollection.top, tvShows),
    [tvShowCollection.top, tvShows],
  )
  const psychologicalThrillers = useMemo(
    () => buildRail(movieCollection.thrilling, movieTopTenMovies),
    [movieCollection.thrilling, movieTopTenMovies],
  )
  const upcomingMedia = useMemo(
    () =>
      buildRail(
        [...movies.slice(6, 10), ...tvShows.slice(6, 10)],
        [...movieCollection.adventure, ...tvShowCollection.adventure],
      ),
    [
      movies,
      movieCollection.adventure,
      tvShows,
      tvShowCollection.adventure,
    ],
  )
  const activeHeroIndex = Math.max(
    0,
    heroMovies.findIndex((movie) => movie.id === featuredMovie.id),
  )

  useEffect(() => {
    if (heroMovies.length < 2) {
      return
    }

    const timeout = window.setTimeout(() => {
      const nextIndex = (activeHeroIndex + 1) % heroMovies.length
      onSelectHero(heroMovies[nextIndex])
    }, heroAutoAdvanceMs)

    return () => window.clearTimeout(timeout)
  }, [activeHeroIndex, heroMovies, onSelectHero])

  return (
    <section className="screen home-screen">
      <div
        className="home-hero"
        style={heroBackgroundStyle(
          featuredMovie,
          'linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.06) 30%, rgba(0,0,0,.78) 78%, #000 100%)',
        )}
      >
        <header className="home-header">
          <h1>Home</h1>
          <div className="header-actions">
            <button className="mute-button" type="button" title="Muted">
              <VolumeX />
            </button>
            <button className="avatar-button" type="button" title="Profile">
              AB
            </button>
          </div>
        </header>

        <div className="hero-copy">
          <span className="floating-label">{featuredMovie.label}</span>
          <pre className="logo-title">{featuredMovie.logoTitle}</pre>
          <p className="meta-line">
            <span className="provider-badge hero-provider">tv</span>
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
            <span>Search Apple TV</span>
          </button>
        </div>

        <div className="carousel-dots" aria-label="Featured movies">
          {heroMovies.map((movie, index) => (
            <button
              key={movie.id}
              className={index === activeHeroIndex ? 'active' : ''}
              type="button"
              style={
                index === activeHeroIndex
                  ? {
                      '--timer-duration': `${heroAutoAdvanceMs}ms`,
                    } as CSSProperties
                  : undefined
              }
              aria-label={`Show ${movie.title}`}
              aria-current={index === activeHeroIndex ? 'true' : undefined}
              onClick={() => onSelectHero(movie)}
            />
          ))}
        </div>
      </div>

      <ContinueWatchingRail
        title="Continue Watching"
        movies={continueMovies}
        onOpenDetail={onOpenDetail}
      />

      <MovieRail
        title="Top 10 Movie"
        movies={movieTopTenMovies}
        onOpenDetail={onOpenDetail}
      />

      <MovieRail
        title="Top 10 TV Shows"
        movies={tvTopTenMovies}
        onOpenDetail={onOpenDetail}
      />

      <FeatureRail
        title="Psychological Thrillers"
        movies={psychologicalThrillers}
        onOpenDetail={onOpenDetail}
      />

      <MovieRail
        title="Upcoming Movies & Shows"
        movies={upcomingMedia}
        onOpenDetail={onOpenDetail}
      />
    </section>
  )
}

type BrowseScreenProps = {
  mode: 'movies' | 'tv'
  movies: Movie[]
  collection: MediaCollection
  featuredMovie?: Movie
  savedMovies: SavedMovies
  onOpenDetail: (movie: Movie) => void
  onPlay: (movie: Movie) => void
  onSave: (movie: Movie) => void
}

function BrowseScreen({
  mode,
  movies,
  collection,
  featuredMovie,
  savedMovies,
  onOpenDetail,
  onPlay,
  onSave,
}: BrowseScreenProps) {
  const heroMovie = featuredMovie ?? movies[0]
  const isTvMode = mode === 'tv'
  const screenTitle = isTvMode ? 'TV Shows' : 'Movies'
  const firstRailTitle = isTvMode ? 'Top 10 TV Shows' : 'Top 10 Movies'
  const thrillingRailTitle = isTvMode
    ? 'Top 10 Thrilling TV Shows'
    : 'Top 10 Thrilling Movies'
  const adventureRailTitle = isTvMode
    ? 'Top 10 Adventure TV Shows'
    : 'Top 10 Adventure'
  const kidsRailTitle = isTvMode ? 'Kids & Family TV Shows' : 'Kids & Family'
  const topItems = useMemo(
    () => buildRail(collection.top, movies),
    [collection.top, movies],
  )
  const thrillingItems = useMemo(
    () => buildRail(collection.thrilling, topItems),
    [collection.thrilling, topItems],
  )
  const adventureItems = useMemo(
    () => buildRail(collection.adventure, topItems),
    [collection.adventure, topItems],
  )
  const kidsFamilyItems = useMemo(
    () => buildRail(collection.kidsFamily, topItems),
    [collection.kidsFamily, topItems],
  )

  return (
    <section className="screen browse-screen">
      {heroMovie && (
        <div
          className="home-hero channel-hero"
          style={heroBackgroundStyle(
            heroMovie,
            'linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.08) 32%, rgba(0,0,0,.62) 70%, #000 100%)',
          )}
        >
          <header className="home-header">
            <h1>{screenTitle}</h1>
            <div className="header-actions">
              <button className="mute-button" type="button" title="Muted">
                <VolumeX />
              </button>
              <button className="avatar-button" type="button" title="Profile">
                AB
              </button>
            </div>
          </header>

          <div className="hero-copy">
            <pre className="logo-title">{heroMovie.logoTitle}</pre>
            <p className="meta-line">
              <span className="provider-badge hero-provider">tv</span>
              <span>{heroMovie.type}</span>
              <span>{heroMovie.genres[0]}</span>
              <span className="rating-chip">{heroMovie.maturity}</span>
            </p>

            <div className="hero-actions">
              <button
                className="primary-play"
                type="button"
                onClick={() => onPlay(heroMovie)}
              >
                <Play fill="currentColor" strokeWidth={0} />
                <span>Play</span>
              </button>
              <button
                className="circle-action"
                type="button"
                onClick={() => onSave(heroMovie)}
                title={
                  savedMovies[heroMovie.id]
                    ? 'Remove from library'
                    : 'Add to library'
                }
              >
                {savedMovies[heroMovie.id] ? <Check /> : <Plus />}
              </button>
            </div>
          </div>
        </div>
      )}

      <MovieRail
        title={firstRailTitle}
        movies={topItems}
        onOpenDetail={onOpenDetail}
      />
      <MovieRail
        title={thrillingRailTitle}
        movies={thrillingItems}
        onOpenDetail={onOpenDetail}
      />
      <MovieRail
        title={adventureRailTitle}
        movies={adventureItems}
        onOpenDetail={onOpenDetail}
      />
      <MovieRail
        title={kidsRailTitle}
        movies={kidsFamilyItems}
        onOpenDetail={onOpenDetail}
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
  onPlay: (provider?: StreamProvider) => void
  onPlayEpisode: (season: number, episode: number) => void
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
  onPlayEpisode,
  onSave,
  onShare,
  onOpenPoster,
}: DetailScreenProps) {
  const relatedItems = useMemo(
    () =>
      buildRail(
        relatedMovies.filter((related) => related.id !== movie.id),
        [],
        12,
      ),
    [movie.id, relatedMovies],
  )
  const trailerItems = useMemo(
    () => buildRail([movie, ...relatedItems], relatedItems, 2),
    [movie, relatedItems],
  )

  return (
    <section className="screen detail-screen">
      <div
        className="detail-hero apple-detail-hero"
        style={heroBackgroundStyle(
          movie,
          'linear-gradient(90deg, rgba(0,0,0,.58), rgba(0,0,0,.14) 42%, rgba(0,0,0,.08) 70%), linear-gradient(180deg, rgba(0,0,0,.14), rgba(0,0,0,.1) 46%, rgba(36,36,36,.94) 100%)',
        )}
      >
        <img
          className="detail-hero-art"
          src={movie.hero || movie.poster || fallbackPosterForRank(movie.rank)}
          alt=""
          onError={(event) => {
            event.currentTarget.src = fallbackPosterForRank(movie.rank)
          }}
        />
        <DetailTopBar
          onBack={onBack}
          onShare={onShare}
          onOpenPoster={onOpenPoster}
        />

        <div className="detail-copy apple-detail-copy">
          <pre className="logo-title detail-title">{movie.logoTitle}</pre>
          <p className="detail-meta apple-detail-meta">
            <span className="provider-badge hero-provider">tv</span>
            <span>{movie.type}</span>
            {movie.genres.slice(0, 3).map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </p>

          <p className="synopsis apple-detail-synopsis">
            {movie.synopsis}
            <span className="more-chip">MORE</span>
          </p>

          <div className="detail-hero-facts" aria-label="Movie facts">
            <span>{movie.year}</span>
            <span>{compactRuntime(movie.runtime)}</span>
            {movie.badges.slice(0, 5).map((badge) => (
              <span className="outline-badge" key={badge}>
                {badge}
              </span>
            ))}
          </div>

          <div className="detail-actions apple-detail-actions">
            <button
              className="primary-play detail-play"
              type="button"
              onClick={() => onPlay()}
            >
              <Play fill="currentColor" strokeWidth={0} />
              <span className="detail-play-label">Play</span>
              <span className="detail-play-progress" aria-hidden="true">
                <span style={{ width: `${continueProgressFor(movie)}%` }} />
              </span>
              <strong className="detail-play-runtime">
                {compactRuntime(movie.runtime)}
              </strong>
            </button>
            <button
              className="detail-download-button"
              type="button"
              onClick={onOpenPoster}
            >
              <Download />
              <span>Download</span>
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
          {isLoading && <LoadingStrip label="Loading full details" />}
        </div>

        <p className="detail-starring">
          Starring {movie.cast.slice(0, 3).join(', ')}
        </p>
      </div>

      <div className="detail-page-body">
        {isTvShow(movie) && (
          <SeasonEpisodeSection
            key={movie.id}
            movie={movie}
            onPlayEpisode={onPlayEpisode}
          />
        )}

        <DetailLandscapeRail
          title="Trailers"
          movies={trailerItems}
          onOpenDetail={onOpenDetail}
        />

        <DetailPosterRail
          title="Related"
          movies={relatedItems}
          onOpenDetail={onOpenDetail}
        />

        <WhereToWatch onPlay={onPlay} />
        <CastCrewRail movie={movie} />
        <MovieFacts movie={movie} />
      </div>
    </section>
  )
}

function DetailSectionHeading({
  title,
  onClick,
}: {
  title: string
  onClick?: () => void
}) {
  return (
    <button
      className="detail-section-heading"
      type="button"
      onClick={onClick}
      aria-label={`Scroll ${title}`}
    >
      <span>{title}</span>
      <ChevronRight />
    </button>
  )
}

function landscapeTitle(movie: Movie, index: number) {
  return `${movie.title} ${index === 0 ? 'Trailer' : 'Teaser Trailer'}`
}

function landscapeDuration(index: number) {
  return index === 0 ? '2m' : '1m'
}

function SeasonEpisodeSection({
  movie,
  onPlayEpisode,
}: {
  movie: Movie
  onPlayEpisode: (season: number, episode: number) => void
}) {
  const seasons = useMemo(() => seasonsFor(movie), [movie])
  const initialSeason = movie.streamSeason ?? seasons[0]?.season ?? 1
  const [selectedSeason, setSelectedSeason] = useState(() => initialSeason)

  const activeSeason =
    seasons.find((season) => season.season === selectedSeason) ?? seasons[0]

  if (!activeSeason) {
    return null
  }

  const episodes = Array.from(
    { length: activeSeason.episodeCount },
    (_, index) => index + 1,
  )

  return (
    <section className="detail-section season-section">
      <label className="season-dropdown">
        <select
          value={selectedSeason}
          aria-label="Choose season"
          onChange={(event) => setSelectedSeason(Number(event.target.value))}
        >
          {seasons.map((season) => (
            <option key={season.season} value={season.season}>
              Season {season.season}
            </option>
          ))}
        </select>
        <span>Season {selectedSeason}</span>
        <ChevronsUpDown />
      </label>

      <div className="episode-row">
        {episodes.map((episode) => (
          <button
            className="episode-card"
            type="button"
            key={`${selectedSeason}-${episode}`}
            onClick={() => onPlayEpisode(selectedSeason, episode)}
          >
            <img
              src={movie.still || movie.hero || movie.poster}
              alt=""
              onError={(event) => {
                event.currentTarget.src = fallbackPosterForRank(movie.rank)
              }}
            />
            <span className="episode-card-copy">
              <small>EPISODE {episode}</small>
              <strong>{episodeTitle(selectedSeason, episode)}</strong>
              <em>{episodeSynopsis(movie, selectedSeason, episode)}</em>
            </span>
            <span className="episode-card-footer">
              <span>
                <RefreshCcw />
                {episodeRuntime(movie, selectedSeason, episode)}
              </span>
              <MoreHorizontal />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function DetailLandscapeRail({
  title,
  movies,
  onOpenDetail,
}: {
  title: string
  movies: Movie[]
  onOpenDetail: (movie: Movie) => void
}) {
  const rowRef = useRef<HTMLDivElement | null>(null)

  if (movies.length === 0) {
    return null
  }

  const scrollRow = () => {
    rowRef.current?.scrollBy({
      left: rowRef.current.clientWidth * 0.82,
      behavior: 'smooth',
    })
  }

  return (
    <section className="detail-section detail-landscape-section">
      <DetailSectionHeading title={title} onClick={scrollRow} />
      <div ref={rowRef} className="detail-landscape-row">
        {movies.map((item, index) => (
          <button
            key={`trailer-${item.id}-${index}`}
            className="detail-landscape-card"
            type="button"
            onClick={() => onOpenDetail(item)}
          >
            <img
              src={item.poster || fallbackPosterForRank(item.rank)}
              alt=""
              onError={(event) => {
                event.currentTarget.src = fallbackPosterForRank(item.rank)
              }}
            />
            <span className="detail-card-copy">
              <strong>{landscapeTitle(item, index)}</strong>
              <small>
                <Play fill="currentColor" strokeWidth={0} />
                {landscapeDuration(index)}
              </small>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function DetailPosterRail({
  title,
  movies,
  onOpenDetail,
}: {
  title: string
  movies: Movie[]
  onOpenDetail: (movie: Movie) => void
}) {
  const rowRef = useRef<HTMLDivElement | null>(null)

  if (movies.length === 0) {
    return null
  }

  const scrollRow = () => {
    rowRef.current?.scrollBy({
      left: rowRef.current.clientWidth * 0.82,
      behavior: 'smooth',
    })
  }

  return (
    <section className="detail-section detail-related-section">
      <DetailSectionHeading title={title} onClick={scrollRow} />
      <div ref={rowRef} className="detail-poster-row">
        {movies.map((item) => (
          <button
            key={item.id}
            className="detail-related-card"
            type="button"
            onClick={() => onOpenDetail(item)}
            title={item.title}
          >
            <img
              src={item.poster || fallbackPosterForRank(item.rank)}
              alt=""
              onError={(event) => {
                event.currentTarget.src = fallbackPosterForRank(item.rank)
              }}
            />
          </button>
        ))}
      </div>
    </section>
  )
}

function WhereToWatch({
  onPlay,
}: {
  onPlay: (provider?: StreamProvider) => void
}) {
  return (
    <section className="detail-section detail-watch-options">
      <h2>Where to Watch</h2>
      <div className="watch-option-grid">
        {streamProviderOptions.map((provider) => (
          <button
            className="watch-option-card"
            type="button"
            key={provider.id}
            onClick={() => onPlay(provider.id)}
          >
            <span className="watch-option-logo gradient">{provider.logo}</span>
            <span>
              <strong>{provider.name}</strong>
              <small>{provider.description}</small>
              <em>Available on {provider.name}</em>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function CastCrewRail({ movie }: { movie: Movie }) {
  const cast = movie.cast.slice(0, 9)

  if (cast.length === 0) {
    return null
  }

  const roles = [
    'Present',
    'Lead',
    'Supporting',
    'Past',
    'Director',
    'Cast',
    'Producer',
    'Story',
    'Crew',
  ]

  return (
    <section className="detail-section detail-cast-section">
      <DetailSectionHeading title="Cast & Crew" />
      <div className="detail-cast-row">
        {cast.map((name, index) => (
          <button className="cast-person-card" key={`${name}-${index}`} type="button">
            <span
              className="cast-avatar"
              style={
                {
                  '--avatar-hue': `${(index * 41 + movie.title.length * 7) % 360}deg`,
                } as CSSProperties
              }
            >
              {initialsFor(name)}
            </span>
            <strong>{name}</strong>
            <small>{index === 0 && movie.director !== 'Director unavailable' ? movie.director : roles[index % roles.length]}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

type WatchScreenProps = {
  movie: Movie
  isSaved: boolean
  streamLoading: boolean
  streamError: string
  streamProvider: StreamProvider
  onBack: () => void
  onSave: () => void
  onStreamProviderChange: (provider: StreamProvider) => void
}

function WatchScreen({
  movie,
  isSaved,
  streamLoading,
  streamError,
  streamProvider,
  onBack,
  onSave,
  onStreamProviderChange,
}: WatchScreenProps) {
  const streamUrl = buildStreamUrl(movie, streamProvider)
  const currentProvider =
    streamProviderOptions.find((provider) => provider.id === streamProvider) ??
    streamProviderOptions[0]
  const openCurrentStream = () => {
    if (!streamUrl) {
      return
    }

    window.open(streamUrl, '_blank', 'noopener,noreferrer')
  }

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

      <section className="stream-player-section">
        {streamUrl ? (
          <iframe
            className="stream-player"
            src={streamUrl}
            title={`${movie.title} stream`}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="stream-placeholder"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.22), rgba(0,0,0,.82)), url(${movie.still})`,
            }}
          >
            {streamLoading ? (
              <>
                <LoaderCircle className="spin-icon" />
                <h2>Preparing Stream</h2>
                <p>Finding the TMDB id and loading {currentProvider.name}.</p>
              </>
            ) : (
              <>
                <AlertCircle />
                <h2>Stream Not Ready</h2>
                <p>{streamError || 'TMDB did not return a playable movie id yet.'}</p>
              </>
            )}
          </div>
        )}
      </section>

      <section className="watch-copy">
        <p className="watch-kicker">{movie.title}</p>
        <h2>{movie.genres[0] ?? 'Movie'}</h2>
        <p className="watch-provider">
          {movie.genres.slice(1).join(' / ') || movie.year}
          <span className="provider-badge">db</span>
          <ChevronRight />
        </p>

        <button
          className="watch-play"
          type="button"
          disabled={!streamUrl || streamLoading}
          onClick={openCurrentStream}
          title={
            streamUrl
              ? `Open ${currentProvider.name}`
              : 'Waiting for TMDB stream id'
          }
          aria-label={
            streamUrl
              ? `Open ${currentProvider.name} stream for ${movie.title}`
              : `Waiting for stream id for ${movie.title}`
          }
        >
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
        <h2>Streaming</h2>
        <div
          className="server-selector"
          role="radiogroup"
          aria-label="Streaming server"
        >
          {streamProviderOptions.map((provider) => {
            const isActive = provider.id === streamProvider

            return (
              <button
                key={provider.id}
                className={`server-option${isActive ? ' active' : ''}`}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => onStreamProviderChange(provider.id)}
              >
                <span className="provider-logo">{provider.logo}</span>
                <span className="server-copy">
                  <strong>{provider.name}</strong>
                  <small>{provider.description}</small>
                </span>
                {isActive ? <Check /> : <ChevronRight />}
              </button>
            )
          })}
        </div>
        <a
          className="subscription-card"
          href={streamUrl || imdbUrl(movie)}
          target="_blank"
          rel="noreferrer"
        >
          <span className="provider-logo">{currentProvider.logo}</span>
          <span>
            <strong>
              {streamUrl ? `Open ${currentProvider.name}` : 'Waiting for TMDB'}
            </strong>
            <small>
              {streamUrl
                ? `${currentProvider.description} / TMDB ${movie.tmdbId}`
                : 'Resolving movie id'}
            </small>
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
  onClear: () => void
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
  onClear,
  onOpenDetail,
  onClose,
}: SearchScreenProps) {
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearch(query)
  }

  return (
    <section className="screen search-screen">
      <header className="search-header">
        <h1>Search</h1>
        <button className="avatar-button" type="button" title="Profile">
          AB
        </button>
      </header>

      <section className="search-content visual-search">
        {loading && <LoadingStrip label="Searching Apple TV" />}
        {error && <InlineAlert message={error} />}

        {results.length > 0 ? (
          <div className="recent-panel">
            <div className="recent-heading">
              <h2>Recently Searched</h2>
              <button type="button" onClick={onClear}>
                Clear
              </button>
            </div>
            <div className="recent-list">
              {results.slice(0, 8).map((movie) => (
                <button
                  key={movie.id}
                  className="recent-item"
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
                  <span>
                    <strong>{movie.title}</strong>
                    <small>
                      {movie.type} / {movie.genres[0] ?? movie.year} / {movie.year}
                    </small>
                  </span>
                  <MoreHorizontal />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="category-grid">
            {searchCategories.map((category, index) => (
              <button
                key={category}
                className={`category-card category-${(index % 12) + 1}`}
                type="button"
                onClick={() => {
                  onQueryChange(category)
                  onSearch(category)
                }}
              >
                <span>{category}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="search-bottom">
        <button
          className="close-search icon-close search-library-bubble"
          type="button"
          onClick={onClose}
          aria-label="Close search"
        >
          <Library />
        </button>
        <form className="search-form" onSubmit={submitSearch}>
          <Search />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Apple TV"
            aria-label="Search Apple TV"
          />
          <button className="mic-button" type="button" title="Voice search">
            <Mic />
          </button>
        </form>
      </div>

      {query && results.length > 0 && (
        <div className="floating-clear">
          <button type="button" onClick={onClear}>
            Clear Results
          </button>
        </div>
      )}
    </section>
  )
}

type LibraryScreenProps = {
  savedMovies: Movie[]
  onOpenDetail: (movie: Movie) => void
}

function LibraryScreen({
  savedMovies,
  onOpenDetail,
}: LibraryScreenProps) {
  return (
    <section className="screen library-screen">
      <header className="library-header">
        <h1>Library</h1>
        <button className="avatar-button" type="button" title="Profile">
          AB
        </button>
      </header>

      {savedMovies.length > 0 ? (
        <section className="library-content">
          <h2>Saved Movies</h2>
          <div className="result-grid library-grid">
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
        <section className="library-empty-state">
          <h2>Your Library Is Empty</h2>
          <p>TV shows and movies you save from the app will appear here.</p>
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
  const rowRef = useRef<HTMLDivElement | null>(null)

  if (movies.length === 0) {
    return null
  }

  const scrollRow = () => {
    rowRef.current?.scrollBy({
      left: rowRef.current.clientWidth * 0.86,
      behavior: 'smooth',
    })
  }

  return (
    <section className="movie-rail">
      <div className="rail-header">
        <button
          className="rail-heading"
          type="button"
          aria-label={`Scroll ${title}`}
          onClick={scrollRow}
        >
          <span>{title}</span>
          <ChevronRight />
        </button>
      </div>
      <div ref={rowRef} className={compact ? 'poster-row compact' : 'poster-row'}>
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

function ContinueWatchingRail({
  title,
  movies,
  onOpenDetail,
}: MovieRailProps) {
  const rowRef = useRef<HTMLDivElement | null>(null)

  if (movies.length === 0) {
    return null
  }

  const scrollRow = () => {
    rowRef.current?.scrollBy({
      left: rowRef.current.clientWidth * 0.86,
      behavior: 'smooth',
    })
  }

  return (
    <section className="continue-rail">
      <div className="rail-header">
        <button
          className="rail-heading"
          type="button"
          aria-label={`Scroll ${title}`}
          onClick={scrollRow}
        >
          <span>{title}</span>
          <ChevronRight />
        </button>
      </div>

      <div ref={rowRef} className="continue-row">
        {movies.map((movie) => (
          <button
            key={movie.id}
            className="continue-card"
            type="button"
            onClick={() => onOpenDetail(movie)}
          >
            <img
              src={movie.poster || fallbackPosterForRank(movie.rank)}
              alt=""
              onError={(event) => {
                event.currentTarget.src = fallbackPosterForRank(movie.rank)
              }}
            />
            <span className="continue-tv-mark">tv</span>
            <span className="continue-title">{movie.logoTitle}</span>
            <span className="continue-bottom">
              <Play fill="currentColor" strokeWidth={0} />
              <span className="continue-progress" aria-hidden="true">
                <span style={{ width: `${movie.progress}%` }} />
              </span>
              <span className="continue-time">{continueRuntimeLabel(movie)}</span>
              <MoreHorizontal />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function FeatureRail({ title, movies, onOpenDetail }: MovieRailProps) {
  const rowRef = useRef<HTMLDivElement | null>(null)

  if (movies.length === 0) {
    return null
  }

  const scrollRow = () => {
    rowRef.current?.scrollBy({
      left: rowRef.current.clientWidth * 0.88,
      behavior: 'smooth',
    })
  }

  return (
    <section className="feature-rail">
      <div className="rail-header">
        <button
          className="rail-heading"
          type="button"
          aria-label={`Scroll ${title}`}
          onClick={scrollRow}
        >
          <span>{title}</span>
          <ChevronRight />
        </button>
      </div>

      <div ref={rowRef} className="feature-row">
        {movies.map((movie, index) => (
          <button
            key={movie.id}
            className="feature-card-wide"
            type="button"
            style={
              {
                '--feature-art': `url(${movie.poster})`,
              } as CSSProperties
            }
            onClick={() => onOpenDetail(movie)}
          >
            <img
              src={movie.poster}
              alt=""
              onError={(event) => {
                event.currentTarget.src = fallbackPosterForRank(movie.rank)
              }}
            />
            <span className="feature-wide-badge">
              {index === 0 ? 'New' : movie.year}
            </span>
            <span className="feature-wide-title">{movie.title}</span>
            <span className="feature-wide-meta">
              <span className="provider-badge">tv</span>
              <span>{movie.type}</span>
              <span>{movie.genres[0] ?? 'Thriller'}</span>
              <span>{movie.genres[1] ?? movie.year}</span>
            </span>
          </button>
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
    <section className="detail-section detail-about-section">
      <h2>About</h2>

      <div className="about-card-row">
        <article className="about-summary-card">
          <h3>{movie.title}</h3>
          <strong>{movie.genres.slice(0, 3).join(', ').toUpperCase()}</strong>
          <p>
            {movie.synopsis}
            <span className="more-chip">MORE</span>
          </p>
        </article>
        <article className="about-summary-card">
          <h3>Purchased Content</h3>
          <p>
            When you save access to this item, it appears in your Library and
            can be opened again from this app.
            <span className="more-chip">MORE</span>
          </p>
        </article>
      </div>

      <div className="detail-info-grid">
        <div className="detail-info-column">
          <h3>Information</h3>
          <FactItem label="Released" value={movie.year} />
          <FactItem label="Run Time" value={compactRuntime(movie.runtime)} />
          <FactItem label="Rated" value={movie.maturity} />
          <FactItem label="Director" value={movie.director} />
          <FactItem label="Region of Origin" value="United States" />
        </div>

        <div className="detail-info-column">
          <h3>Languages</h3>
          <FactItem label="Original Audio" value="English" />
          <FactItem
            label="Audio"
            value="English (Dolby Atmos, Dolby 5.1, AAC), Hindi, French, Spanish"
          />
          <FactItem
            label="Subtitles"
            value="English (CC, SDH), Hindi (SDH), Spanish (SDH), French (SDH)"
          />
        </div>

        <div className="detail-info-column">
          <h3>Accessibility</h3>
          <FactItem
            label="SDH"
            value="Subtitles for the deaf and hard of hearing are available."
          />
          <FactItem
            label="AD"
            value="Audio descriptions provide narration for important visual details."
          />
          {movie.ratings.length > 0 && (
            <FactItem
              label="Ratings"
              value={movie.ratings
                .map((rating) => `${rating.Source}: ${rating.Value}`)
                .join(' / ')}
            />
          )}
        </div>
      </div>
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
  onMovies,
  onTvShows,
  onSearch,
  onLibrary,
}: {
  active: PrimaryTab
  onHome: () => void
  onMovies: () => void
  onTvShows: () => void
  onSearch: () => void
  onLibrary: () => void
}) {
  return (
    <div className="bottom-ui">
      <nav className="tab-dock" aria-label="Primary">
        <button
          className={active === 'Home' ? 'active' : ''}
          type="button"
          onClick={onHome}
          aria-current={active === 'Home' ? 'page' : undefined}
          title="Home"
        >
          <Home fill="currentColor" />
          <span>Home</span>
        </button>
        <button
          className={active === 'Movies' ? 'active' : ''}
          type="button"
          onClick={onMovies}
          aria-current={active === 'Movies' ? 'page' : undefined}
          title="Movies"
        >
          <Clapperboard />
          <span>Movies</span>
        </button>
        <button
          className={active === 'TV Shows' ? 'active' : ''}
          type="button"
          onClick={onTvShows}
          aria-current={active === 'TV Shows' ? 'page' : undefined}
          title="TV Shows"
        >
          <Tv />
          <span>TV Shows</span>
        </button>
        <button
          className={active === 'Library' ? 'active' : ''}
          type="button"
          onClick={onLibrary}
          aria-current={active === 'Library' ? 'page' : undefined}
          title="Library"
        >
          <Library />
          <span>Library</span>
        </button>
      </nav>
      <button
        className={active === 'Search' ? 'search-float active' : 'search-float'}
        type="button"
        title="Search"
        aria-label="Search movies"
        aria-current={active === 'Search' ? 'page' : undefined}
        onClick={onSearch}
      >
        <Search />
      </button>
    </div>
  )
}

function DesktopNav({
  active,
  onHome,
  onMovies,
  onTvShows,
  onSearch,
  onLibrary,
}: {
  active: PrimaryTab
  onHome: () => void
  onMovies: () => void
  onTvShows: () => void
  onSearch: () => void
  onLibrary: () => void
}) {
  return (
    <header className="desktop-nav">
      <button className="desktop-brand" type="button" onClick={onHome}>
        <Home fill="currentColor" />
        <span>Home</span>
      </button>
      <nav aria-label="Website">
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
          onClick={onMovies}
        >
          <Clapperboard />
          <span>Movies</span>
        </button>
        <button
          className={active === 'TV Shows' ? 'active' : ''}
          type="button"
          onClick={onTvShows}
        >
          <Tv />
          <span>TV Shows</span>
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
      <div className="desktop-actions">
        <button className="desktop-search" type="button" onClick={onSearch}>
          <Search />
          <span>Search</span>
        </button>
        <button className="avatar-button desktop-avatar" type="button" title="Profile">
          AB
        </button>
      </div>
    </header>
  )
}

export default App
