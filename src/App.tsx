import {
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  type PointerEvent,
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
  CircleMinus,
  Clapperboard,
  Download,
  Home,
  Info,
  Library,
  LoaderCircle,
  Mic,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Share,
  Trash2,
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
import { fetchMovieGluTrailers, type TrailerClip } from './movieglu'
import {
  buildStreamUrl,
  defaultStreamProvider,
  fetchTmdbHomeRails,
  fetchTmdbMatch,
  fetchTmdbWatchAvailability,
  fetchWatchmodeCastCrew,
  streamProviderOptions,
  type CastCrewMember,
  type StreamProvider,
  type TmdbHomeRails,
  type TmdbWatchAvailability,
  type TmdbWatchProvider,
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
type SearchCategoryTile = {
  image: string
  label: string
}
type LandscapeCard = {
  duration: string
  id: string
  image: string
  movie?: Movie
  title: string
  trailerUrl?: string
}

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
const emptyTmdbHomeRails: TmdbHomeRails = {
  featuredMovies: [],
  featuredTvShows: [],
  movieCollection: emptyMediaCollection,
  newReleases: [],
  trendingNow: [],
  tvShowCollection: emptyMediaCollection,
}
const fallbackPosterImages = [
  'https://image.tmdb.org/t/p/w780/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
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
  return (
    value === 'rivestream' ||
    value === 'vidsync' ||
    value === 'multiembed' ||
    value === 'multiembed-vip'
  )
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

const hiddenMediaBadges = new Set(['CC', 'SDH'])

function visibleMediaBadges(badges: string[]) {
  return badges.filter((badge) => !hiddenMediaBadges.has(badge.trim().toUpperCase()))
}

function useHeroSwipe(
  itemCount: number,
  activeIndex: number,
  onIndexChange: (index: number) => void,
) {
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (itemCount < 2 || !event.isPrimary) {
        return
      }

      swipeStartRef.current = {
        x: event.clientX,
        y: event.clientY,
      }

      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Some mobile WebViews skip pointer capture during native scrolling.
      }
    },
    [itemCount],
  )

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const start = swipeStartRef.current
      swipeStartRef.current = null

      if (!start || itemCount < 2) {
        return
      }

      const deltaX = event.clientX - start.x
      const deltaY = event.clientY - start.y

      if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
        return
      }

      const direction = deltaX < 0 ? 1 : -1
      onIndexChange((activeIndex + direction + itemCount) % itemCount)
    },
    [activeIndex, itemCount, onIndexChange],
  )

  const onPointerCancel = useCallback(() => {
    swipeStartRef.current = null
  }, [])

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
  }
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

function collectionMovies(collection: MediaCollection) {
  return [
    ...collection.top,
    ...collection.thrilling,
    ...collection.adventure,
    ...collection.kidsFamily,
  ]
}

const searchCategoryAliases: Record<string, string[]> = {
  'Apple TV': ['movie', 'series', 'drama', 'adventure'],
  Action: ['action', 'thriller', 'crime'],
  Adventure: ['adventure', 'fantasy', 'sci fi'],
  Bollywood: ['drama', 'music', 'romance'],
  Comedy: ['comedy', 'family'],
  Drama: ['drama'],
  Horror: ['horror', 'thriller'],
  'Kids & Family': ['family', 'animation', 'kids'],
  'Movie Bundles': ['movie', 'collection', 'top'],
  'Regional Indian': ['drama', 'romance', 'music'],
  'Sci-Fi': ['sci fi', 'science fiction', 'fantasy'],
  Sports: ['sport', 'sports', 'documentary'],
}

function movieSearchText(movie: Movie) {
  return normalizeMovieIdentity(
    [movie.title, movie.type, movie.year, ...movie.genres].join(' '),
  )
}

function categoryTileImage(movie: Movie) {
  return (
    cleanImageUrl(movie.poster) ||
    cleanImageUrl(movie.hero) ||
    cleanImageUrl(movie.still)
  )
}

function buildSearchCategoryTiles(categories: string[], apiMovies: Movie[]) {
  const pool = uniqueMovies(apiMovies).filter((movie) => categoryTileImage(movie))

  return categories.map((label, index) => {
    const aliases = searchCategoryAliases[label] ?? [label]
    const normalizedAliases = aliases.map(normalizeMovieIdentity)
    const matchingMovies = pool.filter((movie) => {
      const text = movieSearchText(movie)

      return normalizedAliases.some((alias) => text.includes(alias))
    })
    const candidates = matchingMovies.length > 0 ? matchingMovies : pool
    const movie =
      candidates.length > 0
        ? candidates[(index * 5 + label.length) % candidates.length]
        : null

    return {
      image: movie ? categoryTileImage(movie) : '',
      label,
    }
  })
}

function hasHomeBootstrapRails(rails: TmdbHomeRails) {
  return (
    rails.featuredMovies.length > 0 &&
    rails.featuredTvShows.length > 0 &&
    rails.movieCollection.top.length > 0 &&
    rails.tvShowCollection.top.length > 0
  )
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

function normalizeMovieIdentity(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}

function movieMatches(left: Movie, right: Movie) {
  if (left.id === right.id) {
    return true
  }

  if (
    left.tmdbId &&
    right.tmdbId &&
    left.tmdbId === right.tmdbId &&
    left.tmdbType === right.tmdbType
  ) {
    return true
  }

  const leftTitle = normalizeMovieIdentity(left.title)
  const rightTitle = normalizeMovieIdentity(right.title)

  return Boolean(
    leftTitle &&
      rightTitle &&
      leftTitle === rightTitle &&
      left.year === right.year &&
      isTvShow(left) === isTvShow(right),
  )
}

function findMatchingMovieKey<T>(
  records: Record<string, T>,
  movie: Movie,
  movieForRecord: (record: T) => Movie,
) {
  return Object.entries(records).find(
    ([key, record]) => key === movie.id || movieMatches(movieForRecord(record), movie),
  )?.[0]
}

function hasMatchingMovie<T>(
  records: Record<string, T>,
  movie: Movie,
  movieForRecord: (record: T) => Movie,
) {
  return Boolean(findMatchingMovieKey(records, movie, movieForRecord))
}

function removeMatchingMovieRecords<T>(
  records: Record<string, T>,
  movie: Movie,
  movieForRecord: (record: T) => Movie,
) {
  let changed = false
  const next = { ...records }

  Object.entries(records).forEach(([key, record]) => {
    if (key === movie.id || movieMatches(movieForRecord(record), movie)) {
      delete next[key]
      changed = true
    }
  })

  return changed ? next : records
}

function imdbUrl(movie: Movie) {
  if (!movie.id.startsWith('tt') && movie.tmdbId) {
    return `https://www.themoviedb.org/movie/${movie.tmdbId}`
  }

  return `https://www.imdb.com/title/${movie.id}/`
}

function fallbackPosterForRank(rank: number) {
  return fallbackPosterImages[(rank - 1) % fallbackPosterImages.length]
}

function cleanImageUrl(value?: string) {
  return value && value !== 'N/A' ? value : ''
}

function posterImageFor(movie: Movie) {
  return cleanImageUrl(movie.poster) || fallbackPosterForRank(movie.rank)
}

function heroImageFor(movie: Movie) {
  return (
    cleanImageUrl(movie.hero) ||
    cleanImageUrl(movie.still) ||
    posterImageFor(movie)
  )
}

function isPosterShapedHero(movie: Movie) {
  const heroImage = heroImageFor(movie)
  const posterImage = posterImageFor(movie)

  return (
    heroImage === posterImage ||
    (/\/p\/w(?:342|500|780)\//.test(heroImage) &&
      !/\/p\/(?:original|w1280)\//.test(heroImage))
  )
}

function heroBackgroundStyle(movie: Movie, gradient: string) {
  const heroImage = heroImageFor(movie)
  const posterImage = posterImageFor(movie)
  const isPosterHero = isPosterShapedHero(movie)

  return {
    '--hero-art': `url(${heroImage})`,
    '--poster-art': `url(${posterImage})`,
    '--hero-fit': isPosterHero ? 'contain' : 'cover',
    '--hero-position': isPosterHero ? 'center center' : 'center top',
    backgroundImage: `${gradient}, url(${heroImage})`,
  } as CSSProperties
}

function setMagneticNavOffset(event: PointerEvent<HTMLElement>) {
  const target = event.currentTarget
  const rect = target.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 12
  const y = ((event.clientY - rect.top) / rect.height - 0.5) * 10

  target.style.setProperty('--nav-magnetic-x', `${x.toFixed(2)}px`)
  target.style.setProperty('--nav-magnetic-y', `${y.toFixed(2)}px`)
}

function resetMagneticNavOffset(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty('--nav-magnetic-x', '0px')
  event.currentTarget.style.setProperty('--nav-magnetic-y', '0px')
}

function App() {
  const appShellRef = useRef<HTMLElement | null>(null)
  const [screen, setScreenState] = useState<Screen>(getInitialScreen)
  const [movies, setMovies] = useState<Movie[]>([])
  const [tvShows, setTvShows] = useState<Movie[]>([])
  const [movieCollection, setMovieCollection] =
    useState<MediaCollection>(emptyMediaCollection)
  const [tvShowCollection, setTvShowCollection] =
    useState<MediaCollection>(emptyMediaCollection)
  const [tmdbHomeRails, setTmdbHomeRails] =
    useState<TmdbHomeRails>(emptyTmdbHomeRails)
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [homeHeroMovie, setHomeHeroMovie] = useState<Movie | null>(null)
  const [detailBackScreen, setDetailBackScreen] = useState<Screen>('home')
  const [savedMovies, setSavedMovies] = useState<SavedMovies>(readSavedMovies)
  const [watchHistory, setWatchHistory] =
    useState<WatchHistory>(readWatchHistory)
  const [homeLoading, setHomeLoading] = useState(true)
  const [homeError, setHomeError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Movie[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [streamLoading, setStreamLoading] = useState(false)
  const [streamError, setStreamError] = useState('')
  const [streamProvider, setStreamProvider] =
    useState<StreamProvider>(readStreamProvider)
  const [navScrolled, setNavScrolled] = useState(false)
  const [navScrollProgress, setNavScrollProgress] = useState(0)

  const featuredMovie = homeHeroMovie ?? movies[0] ?? null
  const featuredTvShow = tvShows[0] ?? null
  const savedList = useMemo(() => Object.values(savedMovies), [savedMovies])
  const continueWatching = useMemo(
    () =>
      Object.values(watchHistory)
        .filter((entry) => entry.progress < 100)
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 12)
        .map((entry, index) => ({
          ...entry.movie,
          rank: index + 1,
          progress: entry.progress,
        })),
    [watchHistory],
  )
  const searchCategoryTiles = useMemo(
    () =>
      buildSearchCategoryTiles(searchCategories, [
        ...tmdbHomeRails.featuredMovies,
        ...tmdbHomeRails.featuredTvShows,
        ...tmdbHomeRails.newReleases,
        ...tmdbHomeRails.trendingNow,
        ...collectionMovies(tmdbHomeRails.movieCollection),
        ...collectionMovies(tmdbHomeRails.tvShowCollection),
        ...collectionMovies(movieCollection),
        ...collectionMovies(tvShowCollection),
        ...movies,
        ...tvShows,
      ]),
    [movieCollection, movies, tmdbHomeRails, tvShowCollection, tvShows],
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
      const shell = appShellRef.current

      if (shell) {
        shell.scrollTo({ top: 0, behavior: 'auto' })
      }

      window.scrollTo({ top: 0, behavior: 'auto' })
    })
  }

  useEffect(() => {
    let isMounted = true

    async function loadMovies() {
      setHomeLoading(true)
      setHomeError('')

      try {
        const nextTmdbHomeRails = await fetchTmdbHomeRails()

        if (hasHomeBootstrapRails(nextTmdbHomeRails)) {
          const nextMovies = buildRail(
            nextTmdbHomeRails.featuredMovies,
            nextTmdbHomeRails.movieCollection.top,
          )
          const nextTvShows = buildRail(
            nextTmdbHomeRails.featuredTvShows,
            nextTmdbHomeRails.tvShowCollection.top,
          )

          if (!isMounted) {
            return
          }

          setMovies(nextMovies)
          setTvShows(nextTvShows)
          setMovieCollection(nextTmdbHomeRails.movieCollection)
          setTvShowCollection(nextTmdbHomeRails.tvShowCollection)
          setTmdbHomeRails(nextTmdbHomeRails)
          setHomeHeroMovie((current) => current ?? nextMovies[0] ?? null)
          setSelectedMovie((current) => current ?? nextMovies[0] ?? null)
          return
        }

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
        setTmdbHomeRails(nextTmdbHomeRails)
        setHomeHeroMovie((current) => current ?? nextMovies[0] ?? null)
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

  useEffect(() => {
    let frameId = 0

    const updateNavMotion = () => {
      frameId = 0
      const shell = appShellRef.current
      const shellCanScroll =
        Boolean(shell) && shell!.scrollHeight > shell!.clientHeight + 1
      const scrollTop =
        shellCanScroll && shell
          ? shell.scrollTop
          : window.scrollY || document.documentElement.scrollTop
      const nextScrolled = scrollTop > 18
      const nextProgress = Math.min(1, scrollTop / 180)

      setNavScrolled((current) =>
        current === nextScrolled ? current : nextScrolled,
      )
      setNavScrollProgress((current) =>
        Math.abs(current - nextProgress) < 0.02 ? current : nextProgress,
      )
    }

    const requestNavMotion = () => {
      if (frameId) {
        return
      }

      frameId = window.requestAnimationFrame(updateNavMotion)
    }

    const shell = appShellRef.current
    shell?.addEventListener('scroll', requestNavMotion, { passive: true })
    window.addEventListener('scroll', requestNavMotion, { passive: true })
    requestNavMotion()

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }

      shell?.removeEventListener('scroll', requestNavMotion)
      window.removeEventListener('scroll', requestNavMotion)
    }
  }, [])

  const markContinueWatching = useCallback((movie: Movie) => {
    setWatchHistory((current) => {
      const matchingKey =
        findMatchingMovieKey(current, movie, (entry) => entry.movie) ?? movie.id
      const existing = current[matchingKey]
      const historyMovie = existing
        ? mergeKnownMovie(existing.movie, movie)
        : movie
      const nextProgress =
        existing && existing.progress >= 100
          ? continueProgressFor(movie)
          : Math.max(existing?.progress ?? 0, continueProgressFor(movie))

      return {
        ...current,
        [matchingKey]: {
          movie: historyMovie,
          updatedAt: Date.now(),
          progress: nextProgress,
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
    setHomeHeroMovie((current) =>
      current && movieMatches(current, movie)
        ? mergeKnownMovie(current, movie)
        : current,
    )
    setWatchHistory((current) => {
      const matchingKey = findMatchingMovieKey(
        current,
        movie,
        (entry) => entry.movie,
      )
      const existing = matchingKey ? current[matchingKey] : null

      if (!matchingKey || !existing) {
        return current
      }

      return {
        ...current,
        [matchingKey]: {
          ...existing,
          movie: mergeKnownMovie(existing.movie, movie),
          progress:
            existing.progress >= 100
              ? continueProgressFor(movie)
              : Math.max(existing.progress, continueProgressFor(movie)),
        },
      }
    })
  }

  const inFlightRef = useRef<
    Record<string, Promise<Movie>>
  >({})
  const selectedMovieIdRef = useRef<string | null>(null)

  useEffect(() => {
    selectedMovieIdRef.current = selectedMovie?.id ?? null
  }, [selectedMovie?.id])

  const hydrateMovie = async (movie: Movie) => {
    if (movie.isFull) {
      return movie
    }

    const key = `hydrateMovie:${movie.id}`

    const existing = inFlightRef.current[key]
    if (existing) {
      return existing
    }

    const promise = (async () => {
      setDetailLoading(true)
      setDetailError('')

      try {
        const fullMovie = await fetchMovieById(movie.id, movie.rank)

        // Prevent late/stale hydration from overwriting a newer selection.
        if (selectedMovieIdRef.current !== movie.id) {
          return fullMovie
        }

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
        if (selectedMovieIdRef.current === movie.id) {
          setDetailError(message)
        }
        return movie
      } finally {
        if (selectedMovieIdRef.current === movie.id) {
          setDetailLoading(false)
        }
      }
    })()

    inFlightRef.current[key] = promise

    try {
      return await promise
    } finally {
      delete inFlightRef.current[key]
    }
  }

  const hydrateStreamingMovie = useCallback(
    async (movie: Movie) => {
      if (movie.tmdbId) {
        return movie
      }

      const key = `hydrateStreamingMovie:${movie.id}`

      const existing = inFlightRef.current[key]
      if (existing) {
        return existing
      }

      const promise = (async () => {
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
              match.mediaType === 'tv'
                ? movie.streamEpisode ?? 1
                : undefined,
          }

          // Prevent late/stale streaming hydration from overwriting newer selection.
          if (selectedMovieIdRef.current === movie.id) {
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
          }

          upsertMovie(streamMovie)
          markContinueWatching(streamMovie)

          setSavedMovies((current) => {
            const matchingKey = findMatchingMovieKey(
              current,
              movie,
              (savedMovie) => savedMovie,
            )

            if (!matchingKey) {
              return current
            }

            return {
              ...current,
              [matchingKey]: {
                ...current[matchingKey],
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
          if (selectedMovieIdRef.current === movie.id) {
            setStreamError(message)
          }
          return movie
        } finally {
          if (selectedMovieIdRef.current === movie.id) {
            setStreamLoading(false)
          }
        }
      })()

      inFlightRef.current[key] = promise

      try {
        return await promise
      } finally {
        delete inFlightRef.current[key]
      }
    },
    [markContinueWatching],
  )

  const openDetail = (movie: Movie) => {
    if (screen !== 'detail' && screen !== 'watch') {
      setDetailBackScreen(screen)
    }

    setSelectedMovie(movie)
    setScreen('detail')
    void hydrateMovie(movie)
  }

  const openWatch = (movie: Movie) => {
    if (screen !== 'detail' && screen !== 'watch') {
      setDetailBackScreen(screen)
    }

    setSelectedMovie(movie)
    markContinueWatching(movie)
    setScreen('watch')
    setStreamError('')
    void hydrateMovie(movie).then(markContinueWatching)
    void hydrateStreamingMovie(movie)
  }

  const toggleSaved = (movie: Movie) => {
    setSavedMovies((current) => {
      const matchingKey = findMatchingMovieKey(
        current,
        movie,
        (savedMovie) => savedMovie,
      )
      const next = { ...current }

      if (matchingKey) {
        delete next[matchingKey]
      } else {
        next[movie.id] = movie
      }

      return next
    })
  }

  const removeSavedMovie = useCallback((movie: Movie) => {
    setSavedMovies((current) =>
      removeMatchingMovieRecords(current, movie, (savedMovie) => savedMovie),
    )
  }, [])

  const removeContinueMovie = useCallback((movie: Movie) => {
    setWatchHistory((current) =>
      removeMatchingMovieRecords(current, movie, (entry) => entry.movie),
    )
  }, [])

  const markWatchedMovie = useCallback((movie: Movie) => {
    setWatchHistory((current) => {
      let changed = false
      const next = { ...current }
      const updatedAt = Date.now()

      Object.entries(current).forEach(([key, entry]) => {
        if (key === movie.id || movieMatches(entry.movie, movie)) {
          next[key] = {
            ...entry,
            movie: mergeKnownMovie(entry.movie, movie),
            progress: 100,
            updatedAt,
          }
          changed = true
        }
      })

      if (changed) {
        return next
      }

      return {
        ...current,
        [movie.id]: {
          movie,
          progress: 100,
          updatedAt,
        },
      }
    })
  }, [])

  const removeWatchlistMovie = useCallback(
    (movie: Movie) => {
      removeSavedMovie(movie)
      removeContinueMovie(movie)
    },
    [removeContinueMovie, removeSavedMovie],
  )

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

  const appShellStyle = {
    '--nav-logo-scale': 1 - navScrollProgress * 0.025,
    '--nav-logo-y': `${navScrollProgress * -7}px`,
    '--nav-scroll-progress': navScrollProgress,
  } as CSSProperties

  if (homeLoading && requiredMedia.length === 0 && needsMovieBootstrap) {
    return (
      <main
        ref={appShellRef}
        className={navScrolled ? 'app-shell nav-scrolled' : 'app-shell'}
        style={appShellStyle}
      >
        <LoadingScreen />
      </main>
    )
  }

  if (homeError && requiredMedia.length === 0 && needsMovieBootstrap) {
    return (
      <main
        ref={appShellRef}
        className={navScrolled ? 'app-shell nav-scrolled' : 'app-shell'}
        style={appShellStyle}
      >
        <ErrorScreen error={homeError} onRetry={retryHome} />
      </main>
    )
  }

  return (
    <main
      ref={appShellRef}
      className={navScrolled ? 'app-shell nav-scrolled' : 'app-shell'}
      style={appShellStyle}
    >
      {screen === 'home' && featuredMovie && (
        <HomeScreen
          featuredMovie={featuredMovie}
          movies={movies}
          tvShows={tvShows}
          movieCollection={movieCollection}
          tvShowCollection={tvShowCollection}
          tmdbHomeRails={tmdbHomeRails}
          continueMovies={continueWatching}
          savedMovies={savedMovies}
          onOpenDetail={openDetail}
          onPlay={openWatch}
          onSave={toggleSaved}
          onSearch={() => setScreen('search')}
          onSelectHero={setHomeHeroMovie}
          onMarkWatched={markWatchedMovie}
          onRemoveContinue={removeContinueMovie}
          onRemoveWatchlist={removeWatchlistMovie}
        />
      )}

      {(screen === 'movies' || screen === 'tv') && (
        <BrowseScreen
          key={screen}
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
          isSaved={hasMatchingMovie(
            savedMovies,
            selectedMovie,
            (savedMovie) => savedMovie,
          )}
          isLoading={detailLoading}
          error={detailError}
          onBack={() => setScreen(detailBackScreen)}
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
          isSaved={hasMatchingMovie(
            savedMovies,
            selectedMovie,
            (savedMovie) => savedMovie,
          )}
          streamLoading={streamLoading}
          streamError={streamError}
          streamProvider={streamProvider}
          onBack={() => setScreen('detail')}
          onSave={() => toggleSaved(selectedMovie)}
          onStartWatching={markContinueWatching}
          onStreamProviderChange={setStreamProvider}
        />
      )}

      {screen === 'search' && (
        <SearchScreen
          query={searchQuery}
          results={searchResults}
          categoryTiles={searchCategoryTiles}
          loading={searchLoading}
          error={searchError}
          onQueryChange={setSearchQuery}
          onSearch={performSearch}
          onClear={() => {
            setSearchResults([])
            setSearchError('')
            setSearchQuery('')
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
      {screen !== 'detail' && screen !== 'watch' && (
        <DesktopNav
          active={activeTab}
          onHome={() => setScreen('home')}
          onMovies={() => setScreen('movies')}
          onTvShows={() => setScreen('tv')}
          onSearch={() => setScreen('search')}
          onLibrary={() => setScreen('library')}
        />
      )}
    </main>
  )
}

type HomeScreenProps = {
  featuredMovie: Movie
  movies: Movie[]
  tvShows: Movie[]
  movieCollection: MediaCollection
  tvShowCollection: MediaCollection
  tmdbHomeRails: TmdbHomeRails
  continueMovies: Movie[]
  savedMovies: SavedMovies
  onOpenDetail: (movie: Movie) => void
  onPlay: (movie: Movie) => void
  onSave: (movie: Movie) => void
  onSearch: () => void
  onSelectHero: (movie: Movie) => void
  onMarkWatched: (movie: Movie) => void
  onRemoveContinue: (movie: Movie) => void
  onRemoveWatchlist: (movie: Movie) => void
}

function HomeScreen({
  featuredMovie,
  movies,
  tvShows,
  movieCollection,
  tvShowCollection,
  tmdbHomeRails,
  continueMovies,
  savedMovies,
  onOpenDetail,
  onPlay,
  onSave,
  onSearch,
  onSelectHero,
  onMarkWatched,
  onRemoveContinue,
  onRemoveWatchlist,
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
  const adventureMovies = useMemo(
    () => buildRail(movieCollection.adventure, movieTopTenMovies),
    [movieCollection.adventure, movieTopTenMovies],
  )
  const familyMovies = useMemo(
    () => buildRail(movieCollection.kidsFamily, movieTopTenMovies),
    [movieCollection.kidsFamily, movieTopTenMovies],
  )
  const bingeWorthyTvShows = useMemo(
    () =>
      buildRail(
        [
          ...tvShowCollection.thrilling,
          ...tvShowCollection.adventure,
          ...tvShowCollection.kidsFamily,
        ],
        tvTopTenMovies,
      ),
    [
      tvShowCollection.adventure,
      tvShowCollection.kidsFamily,
      tvShowCollection.thrilling,
      tvTopTenMovies,
    ],
  )
  const newReleaseFallback = useMemo(
    () => [
      ...movieCollection.adventure,
      ...movieCollection.kidsFamily,
      ...movies,
    ],
    [movieCollection.adventure, movieCollection.kidsFamily, movies],
  )
  const trendingNowFallback = useMemo(
    () => [
      ...movieCollection.thrilling,
      ...movieCollection.adventure,
      ...tvShowCollection.top,
      ...movieTopTenMovies,
    ],
    [
      movieCollection.adventure,
      movieCollection.thrilling,
      movieTopTenMovies,
      tvShowCollection.top,
    ],
  )
  const newReleaseItems = useMemo(
    () => buildRail(tmdbHomeRails.newReleases, newReleaseFallback),
    [newReleaseFallback, tmdbHomeRails.newReleases],
  )
  const trendingNowItems = useMemo(
    () => buildRail(tmdbHomeRails.trendingNow, trendingNowFallback),
    [tmdbHomeRails.trendingNow, trendingNowFallback],
  )
  const activeHeroIndex = Math.max(
    0,
    heroMovies.findIndex((movie) => movie.id === featuredMovie.id),
  )
  const selectHeroIndex = useCallback(
    (index: number) => {
      const movie = heroMovies[index]

      if (movie) {
        onSelectHero(movie)
      }
    },
    [heroMovies, onSelectHero],
  )
  const heroSwipeHandlers = useHeroSwipe(
    heroMovies.length,
    activeHeroIndex,
    selectHeroIndex,
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
        className="home-hero swipeable-hero"
        style={heroBackgroundStyle(
          featuredMovie,
          'linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.06) 30%, rgba(0,0,0,.78) 78%, #000 100%)',
        )}
        {...heroSwipeHandlers}
      >
        <img
          className="hero-art-image"
          src={posterImageFor(featuredMovie)}
          alt=""
          onError={(event) => {
            event.currentTarget.src = heroImageFor(featuredMovie)
          }}
        />
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
                hasMatchingMovie(
                  savedMovies,
                  featuredMovie,
                  (savedMovie) => savedMovie,
                )
                  ? 'Remove from library'
                  : 'Add to library'
              }
            >
              {hasMatchingMovie(
                savedMovies,
                featuredMovie,
                (savedMovie) => savedMovie,
              ) ? <Check /> : <Plus />}
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
        onMarkWatched={onMarkWatched}
        onRemoveContinue={onRemoveContinue}
        onRemoveWatchlist={onRemoveWatchlist}
      />

      <MovieRail
        title="Top 10 Movies"
        movies={movieTopTenMovies}
        onOpenDetail={onOpenDetail}
      />

      <MovieRail
        title="Top 10 TV Shows"
        movies={tvTopTenMovies}
        onOpenDetail={onOpenDetail}
      />

      <MovieRail
        title="New Releases"
        movies={newReleaseItems}
        onOpenDetail={onOpenDetail}
      />

      <FeatureRail
        title="Psychological Thrillers"
        movies={psychologicalThrillers}
        onOpenDetail={onOpenDetail}
      />

      <MovieRail
        title="Trending Now"
        movies={trendingNowItems}
        onOpenDetail={onOpenDetail}
      />

      <MovieRail
        title="Adventure Movies"
        movies={adventureMovies}
        onOpenDetail={onOpenDetail}
      />

      <MovieRail
        title="Family Night"
        movies={familyMovies}
        onOpenDetail={onOpenDetail}
      />

      <FeatureRail
        title="Binge-Worthy TV"
        movies={bingeWorthyTvShows}
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
  const [browseHeroIndex, setBrowseHeroIndex] = useState(0)
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
  const freshRailTitle = isTvMode ? 'Fresh Episodes' : 'Fresh Picks'
  const essentialsRailTitle = isTvMode
    ? 'Series Essentials'
    : 'Movie Essentials'
  const featureRailTitle = isTvMode ? 'Featured TV Shows' : 'Featured Movies'
  const topItems = useMemo(
    () => buildRail(collection.top, movies),
    [collection.top, movies],
  )
  const heroMovies = useMemo(() => topItems.slice(0, 6), [topItems])
  const activeHeroIndex =
    heroMovies.length > 0 ? browseHeroIndex % heroMovies.length : 0
  const heroMovie = heroMovies[activeHeroIndex] ?? featuredMovie ?? movies[0]
  const selectBrowseHeroIndex = useCallback((index: number) => {
    setBrowseHeroIndex(index)
  }, [])
  const heroSwipeHandlers = useHeroSwipe(
    heroMovies.length,
    activeHeroIndex,
    selectBrowseHeroIndex,
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
  const freshItems = useMemo(
    () =>
      buildRail(
        [
          ...collection.top.slice(4),
          ...collection.thrilling.slice(3),
          ...collection.adventure.slice(3),
          ...collection.kidsFamily.slice(3),
        ],
        movies,
      ),
    [
      collection.adventure,
      collection.kidsFamily,
      collection.thrilling,
      collection.top,
      movies,
    ],
  )
  const essentialItems = useMemo(
    () =>
      buildRail(
        [
          ...collection.thrilling,
          ...collection.adventure,
          ...collection.kidsFamily,
          ...collection.top,
        ],
        movies,
      ),
    [
      collection.adventure,
      collection.kidsFamily,
      collection.thrilling,
      collection.top,
      movies,
    ],
  )
  const featuredBrowseItems = useMemo(
    () =>
      buildRail(
        [
          ...collection.top.slice(1),
          ...collection.adventure,
          ...collection.thrilling,
          ...collection.kidsFamily,
        ],
        topItems,
      ),
    [
      collection.adventure,
      collection.kidsFamily,
      collection.thrilling,
      collection.top,
      topItems,
    ],
  )

  useEffect(() => {
    if (heroMovies.length < 2) {
      return
    }

    const timeout = window.setTimeout(() => {
      setBrowseHeroIndex((current) => (current + 1) % heroMovies.length)
    }, heroAutoAdvanceMs)

    return () => window.clearTimeout(timeout)
  }, [activeHeroIndex, heroMovies.length])

  return (
    <section className="screen browse-screen">
      {heroMovie && (
        <div
          className="home-hero channel-hero swipeable-hero"
          style={heroBackgroundStyle(
            heroMovie,
            'linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.08) 32%, rgba(0,0,0,.62) 70%, #000 100%)',
          )}
          {...heroSwipeHandlers}
        >
          <img
            className="hero-art-image"
            src={posterImageFor(heroMovie)}
            alt=""
            onError={(event) => {
              event.currentTarget.src = heroImageFor(heroMovie)
            }}
          />
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
            <span className="floating-label">{heroMovie.label}</span>
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
                  hasMatchingMovie(
                    savedMovies,
                    heroMovie,
                    (savedMovie) => savedMovie,
                  )
                    ? 'Remove from library'
                    : 'Add to library'
                }
              >
                {hasMatchingMovie(
                  savedMovies,
                  heroMovie,
                  (savedMovie) => savedMovie,
                ) ? <Check /> : <Plus />}
              </button>
            </div>
          </div>

          <div className="carousel-dots" aria-label={`${screenTitle} featured carousel`}>
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
                onClick={() => setBrowseHeroIndex(index)}
              />
            ))}
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
      <FeatureRail
        title={featureRailTitle}
        movies={featuredBrowseItems}
        onOpenDetail={onOpenDetail}
      />
      <MovieRail
        title={kidsRailTitle}
        movies={kidsFamilyItems}
        onOpenDetail={onOpenDetail}
      />
      <MovieRail
        title={freshRailTitle}
        movies={freshItems}
        onOpenDetail={onOpenDetail}
      />
      <FeatureRail
        title={essentialsRailTitle}
        movies={essentialItems}
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
  const [trailerClipState, setTrailerClipState] = useState<{
    clips: TrailerClip[]
    movieId: string
  } | null>(null)

  useEffect(() => {
    let shouldUpdate = true

    void fetchMovieGluTrailers({
      id: movie.id,
      title: movie.title,
    })
      .then((clips) => {
        if (shouldUpdate) {
          setTrailerClipState({
            clips,
            movieId: movie.id,
          })
        }
      })
      .catch(() => {
        if (shouldUpdate) {
          setTrailerClipState({
            clips: [],
            movieId: movie.id,
          })
        }
      })

    return () => {
      shouldUpdate = false
    }
  }, [movie.id, movie.title])
  const trailerCards = useMemo<LandscapeCard[]>(() => {
    const clips =
      trailerClipState?.movieId === movie.id ? trailerClipState.clips : []

    if (clips.length > 0) {
      return clips.map((clip, index) => ({
        duration: clip.duration || 'Trailer',
        id: `movieglu-${clip.id}-${index}`,
        image: clip.image || movie.still || movie.hero || movie.poster,
        title: clip.title || `${movie.title} Trailer`,
        trailerUrl: clip.url,
      }))
    }

    return trailerItems.map((item, index) => ({
      duration: landscapeDuration(index),
      id: `fallback-trailer-${item.id}-${index}`,
      image: item.poster || item.still || item.hero,
      movie: item,
      title: landscapeTitle(item, index),
      trailerUrl: trailerSearchUrl(item.title),
    }))
  }, [movie, trailerClipState, trailerItems])
  const [watchAvailabilityState, setWatchAvailabilityState] = useState<{
    availability: TmdbWatchAvailability
    movieId: string
  } | null>(null)
  const [castCrewState, setCastCrewState] = useState<{
    members: CastCrewMember[]
    movieId: string
  } | null>(null)

  useEffect(() => {
    let shouldUpdate = true

    void fetchTmdbWatchAvailability({
      imdbId: movie.id.startsWith('tt') ? movie.id : undefined,
      mediaType: movie.tmdbType,
      tmdbId: movie.tmdbId,
    })
      .then((availability) => {
        if (shouldUpdate) {
          setWatchAvailabilityState({
            availability,
            movieId: movie.id,
          })
        }
      })
      .catch(() => {
        if (shouldUpdate) {
          setWatchAvailabilityState({
            availability: {
              link: '',
              providers: [],
              region: 'IN',
            },
            movieId: movie.id,
          })
        }
      })

    return () => {
      shouldUpdate = false
    }
  }, [movie.id, movie.tmdbId, movie.tmdbType])

  useEffect(() => {
    let shouldUpdate = true

    void fetchWatchmodeCastCrew({
      imdbId: movie.id.startsWith('tt') ? movie.id : undefined,
      mediaType: movie.tmdbType,
      tmdbId: movie.tmdbId,
    }).then((members) => {
      if (shouldUpdate) {
        setCastCrewState({
          members,
          movieId: movie.id,
        })
      }
    })

    return () => {
      shouldUpdate = false
    }
  }, [movie.id, movie.tmdbId, movie.tmdbType])

  const castCrewMembers =
    castCrewState?.movieId === movie.id ? castCrewState.members : []
  const watchAvailability =
    watchAvailabilityState?.movieId === movie.id
      ? watchAvailabilityState.availability
      : null
  const isWatchAvailabilityLoading = watchAvailabilityState?.movieId !== movie.id

  return (
    <section className="screen detail-screen">
      <div
        className="detail-hero apple-detail-hero"
        style={heroBackgroundStyle(
          movie,
          'linear-gradient(90deg, rgba(0,0,0,.58), rgba(0,0,0,.14) 42%, rgba(0,0,0,.08) 70%), linear-gradient(180deg, rgba(0,0,0,.14), rgba(0,0,0,.1) 46%, rgba(36,36,36,.94) 100%)',
        )}
      >
        <picture className="detail-hero-picture">
          <source media="(max-width: 899px)" srcSet={posterImageFor(movie)} />
          <img
            className="detail-hero-art"
            src={heroImageFor(movie)}
            alt=""
            onError={(event) => {
              event.currentTarget.src = posterImageFor(movie)
            }}
          />
        </picture>
        <DetailTopBar
          onBack={onBack}
          onShare={onShare}
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
            {visibleMediaBadges(movie.badges)
              .slice(0, 5)
              .map((badge) => (
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
          items={trailerCards}
          onOpenDetail={onOpenDetail}
        />

        <DetailPosterRail
          title="Related"
          movies={relatedItems}
          onOpenDetail={onOpenDetail}
        />

        <WhereToWatch
          availability={watchAvailability}
          isLoading={isWatchAvailabilityLoading}
        />
        <CastCrewRail members={castCrewMembers} movie={movie} />
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

function trailerSearchUrl(title: string) {
  const params = new URLSearchParams({
    search_query: `${title} official trailer`,
  })

  return `https://www.youtube.com/results?${params}`
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
  items,
  onOpenDetail,
}: {
  title: string
  items: LandscapeCard[]
  onOpenDetail: (movie: Movie) => void
}) {
  const rowRef = useRef<HTMLDivElement | null>(null)

  if (items.length === 0) {
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
        {items.map((item) => (
          <button
            key={item.id}
            className="detail-landscape-card"
            type="button"
            aria-label={`Open ${item.title}`}
            onClick={() => {
              if (item.trailerUrl) {
                window.open(item.trailerUrl, '_blank', 'noopener,noreferrer')
                return
              }

              if (item.movie) {
                onOpenDetail(item.movie)
              }
            }}
          >
            <img
              src={item.image || fallbackPosterForRank(item.movie?.rank ?? 1)}
              alt=""
              onError={(event) => {
                event.currentTarget.src = fallbackPosterForRank(
                  item.movie?.rank ?? 1,
                )
              }}
            />
            <span className="detail-card-copy">
              <strong>{item.title}</strong>
              <small>
                <Play fill="currentColor" strokeWidth={0} />
                {item.duration}
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
            aria-label={`Open ${item.title}`}
            onClick={() => onOpenDetail(item)}
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

function watchProviderTypeLabel(type: TmdbWatchProvider['type']) {
  if (type === 'flatrate') {
    return 'Subscription'
  }

  if (type === 'ads') {
    return 'Free with ads'
  }

  return type[0].toUpperCase() + type.slice(1)
}

function WhereToWatch({
  availability,
  isLoading,
}: {
  availability: TmdbWatchAvailability | null
  isLoading: boolean
}) {
  const providers = availability?.providers ?? []
  const region = availability?.region ?? 'IN'
  const link = availability?.link ?? ''
  const source = availability?.source ?? 'Watchmode'

  return (
    <section className="detail-section detail-watch-options">
      <h2>Where to Watch</h2>
      <div className="watch-option-grid">
        {providers.length > 0 ? (
          providers.map((provider) => {
            const cardContent = (
              <>
                <span className="watch-option-logo platform-logo">
                  {provider.logoUrl ? (
                    <img src={provider.logoUrl} alt="" />
                  ) : (
                    initialsFor(provider.name)
                  )}
                </span>
                <span>
                  <strong>{provider.name}</strong>
                  <small>{watchProviderTypeLabel(provider.type)}</small>
                  <em>Available in {region}</em>
                </span>
              </>
            )

            const providerLink = provider.link || link

            if (providerLink) {
              return (
                <a
                  className="watch-option-card"
                  href={providerLink}
                  key={provider.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  {cardContent}
                </a>
              )
            }

            return (
              <div className="watch-option-card" key={provider.id}>
                {cardContent}
              </div>
            )
          })
        ) : (
          <div className="watch-option-card watch-option-card-muted">
            <span className="watch-option-logo platform-logo">tv</span>
            <span>
              <strong>
                {isLoading ? 'Checking availability' : 'No platform listed'}
              </strong>
              <small>
                {isLoading
                  ? `Loading ${source} data`
                  : `No ${region} providers found for this title`}
              </small>
              <em>Where to Watch</em>
            </span>
          </div>
        )}
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

function CastCrewRail({
  members,
  movie,
}: {
  members: CastCrewMember[]
  movie: Movie
}) {
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
  const fallbackMembers = movie.cast.slice(0, 9).map((name, index) => ({
    id: `fallback-${name}-${index}`,
    imageUrl: '',
    name,
    role:
      index === 0 && movie.director !== 'Director unavailable'
        ? movie.director
        : roles[index % roles.length],
    type: 'Cast' as const,
  }))
  const people = members.length > 0 ? members.slice(0, 14) : fallbackMembers

  if (people.length === 0) {
    return null
  }

  return (
    <section className="detail-section detail-cast-section">
      <DetailSectionHeading title="Cast & Crew" />
      <div className="detail-cast-row">
        {people.map((person, index) => (
          <button className="cast-person-card" key={person.id} type="button">
            <span
              className={person.imageUrl ? 'cast-avatar has-image' : 'cast-avatar'}
              style={
                {
                  '--avatar-hue': `${(index * 41 + movie.title.length * 7) % 360}deg`,
                } as CSSProperties
              }
            >
              {person.imageUrl ? (
                <img
                  src={person.imageUrl}
                  alt=""
                  onError={(event) => {
                    const avatar = event.currentTarget.parentElement

                    if (avatar) {
                      avatar.textContent = initialsFor(person.name)
                      avatar.classList.remove('has-image')
                    }
                  }}
                />
              ) : (
                initialsFor(person.name)
              )}
            </span>
            <strong>{person.name}</strong>
            <small>{person.role}</small>
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
  onStartWatching: (movie: Movie) => void
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
  onStartWatching,
  onStreamProviderChange,
}: WatchScreenProps) {
  const streamUrl = buildStreamUrl(movie, streamProvider)
  const currentProvider =
    streamProviderOptions.find((provider) => provider.id === streamProvider) ??
    streamProviderOptions[0]
  const opensExternally =
    streamProvider === 'multiembed' || streamProvider === 'multiembed-vip'
  const openCurrentStream = () => {
    if (!streamUrl) {
      return
    }

    onStartWatching(movie)
    window.open(streamUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="screen watch-screen">
      <DetailTopBar
        onBack={onBack}
        onShare={() => window.open(imdbUrl(movie), '_blank', 'noopener,noreferrer')}
        dark
      />

      <section className="stream-player-section">
        {streamUrl && !opensExternally ? (
          <iframe
            className="stream-player"
            src={streamUrl}
            title={`${movie.title} stream`}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        ) : streamUrl ? (
          <div
            className="stream-placeholder external-stream-placeholder"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.2), rgba(0,0,0,.84)), url(${movie.still})`,
            }}
          >
            <Play fill="currentColor" strokeWidth={0} />
            <h2>{currentProvider.name}</h2>
            <p>This server opens outside the embedded player.</p>
            <button
              className="stream-open-button"
              type="button"
              onClick={openCurrentStream}
            >
              <span>Open Player</span>
            </button>
          </div>
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
          <span>Watch</span>
        </button>

        <p className="watch-synopsis">
          <strong>{movie.year}:</strong> {movie.synopsis}
        </p>
        <Metadata movie={movie} />
      </section>

      <section className="content-section watch-card-section">
        <h2 className="visually-hidden">Streaming servers</h2>
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
  categoryTiles: SearchCategoryTile[]
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
  categoryTiles,
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
            {categoryTiles.map((category, index) => (
              <button
                key={category.label}
                className={`category-card category-${(index % 12) + 1}${
                  category.image ? ' has-art' : ''
                }`}
                style={
                  category.image
                    ? ({
                        '--category-art': `url(${category.image})`,
                      } as CSSProperties)
                    : undefined
                }
                type="button"
                onClick={() => {
                  onQueryChange(category.label)
                  onSearch(category.label)
                }}
              >
                <span>{category.label}</span>
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
            placeholder="Movie"
            aria-label="Search movie"
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

type ContinueWatchingRailProps = MovieRailProps & {
  onMarkWatched: (movie: Movie) => void
  onRemoveContinue: (movie: Movie) => void
  onRemoveWatchlist: (movie: Movie) => void
}

type ContinueMenuState = {
  movie: Movie
  left: number
  top: number
  width: number
}

function ContinueWatchingRail({
  title,
  movies,
  onOpenDetail,
  onMarkWatched,
  onRemoveContinue,
  onRemoveWatchlist,
}: ContinueWatchingRailProps) {
  const rowRef = useRef<HTMLDivElement | null>(null)
  const [menuState, setMenuState] = useState<ContinueMenuState | null>(null)

  useEffect(() => {
    if (!menuState) {
      return
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuState(null)
      }
    }

    const closeOnScroll = () => setMenuState(null)

    window.addEventListener('keydown', closeOnEscape)
    window.addEventListener('scroll', closeOnScroll, true)

    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [menuState])

  if (movies.length === 0) {
    return null
  }

  const scrollRow = () => {
    rowRef.current?.scrollBy({
      left: rowRef.current.clientWidth * 0.86,
      behavior: 'smooth',
    })
  }

  const closeMenu = () => setMenuState(null)

  const openMenu = (event: MouseEvent<HTMLButtonElement>, movie: Movie) => {
    event.preventDefault()
    event.stopPropagation()

    const rect = event.currentTarget.getBoundingClientRect()
    const width = Math.min(270, window.innerWidth - 90)
    const actionCount = isTvShow(movie) ? 8 : 6
    const estimatedHeight = 18 + actionCount * 45
    const left = Math.min(
      Math.max(24, rect.right - width + 16),
      window.innerWidth - width - 24,
    )
    const top = Math.min(
      Math.max(92, rect.bottom - 16),
      Math.max(92, window.innerHeight - estimatedHeight - 96),
    )

    setMenuState({
      movie,
      left,
      top,
      width,
    })
  }

  const runMenuAction = (action: () => void | Promise<void>) => {
    closeMenu()
    void action()
  }

  const downloadContinueArtwork = (movie: Movie) => {
    const imageUrl = movie.poster || movie.hero || movie.still

    if (!imageUrl) {
      return
    }

    const link = document.createElement('a')
    const filename =
      normalizeMovieIdentity(movie.title).replace(/\s+/g, '-') || 'movie'

    link.href = imageUrl
    link.download = `${filename}-artwork.jpg`
    link.rel = 'noopener noreferrer'
    link.target = '_blank'
    document.body.append(link)
    link.click()
    link.remove()
  }

  const shareContinueItem = async (movie: Movie, label: string) => {
    const url = imdbUrl(movie)

    try {
      if (navigator.share) {
        await navigator.share({
          title: movie.title,
          text: `${label}: ${movie.title}`,
          url,
        })
        return
      }

      await navigator.clipboard.writeText(url)
    } catch {
      // Share sheets can be cancelled without needing app feedback.
    }
  }

  const activeMenuMovie = menuState?.movie
  const activeMenuIsTv = activeMenuMovie ? isTvShow(activeMenuMovie) : false

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
          <article className="continue-card-shell" key={movie.id}>
            <button
              className="continue-card"
              type="button"
              aria-label={`Open ${movie.title}`}
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
              <span className="continue-bottom">
                <Play fill="currentColor" strokeWidth={0} />
                <span className="continue-progress" aria-hidden="true">
                  <span style={{ width: `${movie.progress}%` }} />
                </span>
                <span className="continue-time">
                  {continueRuntimeLabel(movie)}
                </span>
              </span>
            </button>
            <button
              className="continue-more-button"
              type="button"
              aria-label={`More actions for ${movie.title}`}
              aria-expanded={menuState?.movie.id === movie.id}
              onClick={(event) => openMenu(event, movie)}
            >
              <MoreHorizontal />
            </button>
          </article>
        ))}
      </div>

      {activeMenuMovie && menuState && (
        <>
          <button
            className="continue-menu-backdrop"
            type="button"
            aria-label="Close continue watching menu"
            onClick={closeMenu}
          />
          <div
            className="continue-action-menu"
            role="menu"
            aria-label={`${activeMenuMovie.title} actions`}
            style={{
              left: `${menuState.left}px`,
              top: `${menuState.top}px`,
              width: `${menuState.width}px`,
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                runMenuAction(() => downloadContinueArtwork(activeMenuMovie))
              }
            >
              <Download />
              <span>Download</span>
            </button>
            {activeMenuIsTv && (
              <button
                type="button"
                role="menuitem"
                onClick={() => runMenuAction(() => onOpenDetail(activeMenuMovie))}
              >
                <Info />
                <span>Go to Episode</span>
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => runMenuAction(() => onOpenDetail(activeMenuMovie))}
            >
              <Info />
              <span>{activeMenuIsTv ? 'Go to Show' : 'Go to Movie'}</span>
            </button>
            {activeMenuIsTv && (
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  runMenuAction(() =>
                    shareContinueItem(activeMenuMovie, 'Share Episode'),
                  )
                }
              >
                <Share />
                <span>Share Episode</span>
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                runMenuAction(() =>
                  shareContinueItem(
                    activeMenuMovie,
                    activeMenuIsTv ? 'Share Show' : 'Share Movie',
                  ),
                )
              }
            >
              <Share />
              <span>{activeMenuIsTv ? 'Share Show' : 'Share Movie'}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                runMenuAction(() => onRemoveWatchlist(activeMenuMovie))
              }
            >
              <CircleMinus />
              <span>Remove from Watchlist</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                runMenuAction(() => onMarkWatched(activeMenuMovie))
              }
            >
              <Check />
              <span>Mark as Watched</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                runMenuAction(() => onRemoveContinue(activeMenuMovie))
              }
            >
              <Trash2 />
              <span>Remove from Recently Watched</span>
            </button>
          </div>
        </>
      )}
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
        {movies.map((movie, index) => {
          const rankedGenre =
            movie.genres.find((genre) => /thriller/i.test(genre)) ??
            movie.genres[0] ??
            'Thriller'
          const featureGenres = Array.from(new Set(movie.genres)).filter(
            (genre) => genre !== rankedGenre,
          )

          return (
            <button
              key={movie.id}
              className="feature-card-wide"
              type="button"
              aria-label={`Open ${movie.title}`}
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
              <span className="feature-wide-meta">
                <span className="provider-badge">tv</span>
                <span>{movie.type}</span>
                <span>{rankedGenre}</span>
                <span>{featureGenres[0] ?? movie.year}</span>
              </span>
              <span className="feature-wide-rankline">
                #{index + 1} in {rankedGenre} on Apple TV
              </span>
            </button>
          )
        })}
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
      aria-label={`Open ${movie.title}`}
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
    </button>
  )
}

function DetailTopBar({
  onBack,
  onShare,
  dark,
}: {
  onBack: () => void
  onShare: () => void
  dark?: boolean
}) {
  return (
    <nav className={dark ? 'top-actions dark' : 'top-actions'} aria-label="Movie">
      <button className="round-nav" type="button" onClick={onBack} title="Back">
        <ChevronLeft />
      </button>
      <div className="action-pill">
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
      {visibleMediaBadges(movie.badges).map((badge) => (
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
            value="English, Hindi, Spanish, French"
          />
        </div>

        {movie.ratings.length > 0 && (
          <div className="detail-info-column">
            <h3>Ratings</h3>
            <FactItem
              label="Ratings"
              value={movie.ratings
                .map((rating) => `${rating.Source}: ${rating.Value}`)
                .join(' / ')}
            />
          </div>
        )}
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
  const magneticEvents = {
    onPointerLeave: resetMagneticNavOffset,
    onPointerMove: setMagneticNavOffset,
    onPointerUp: resetMagneticNavOffset,
  }

  return (
    <div className="bottom-ui">
      <nav className="tab-dock" aria-label="Primary">
        <button
          {...magneticEvents}
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
          {...magneticEvents}
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
          {...magneticEvents}
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
          {...magneticEvents}
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
        {...magneticEvents}
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
  const magneticEvents = {
    onPointerLeave: resetMagneticNavOffset,
    onPointerMove: setMagneticNavOffset,
    onPointerUp: resetMagneticNavOffset,
  }

  return (
    <header className="desktop-nav">
      <button
        {...magneticEvents}
        className="desktop-brand"
        type="button"
        onClick={onHome}
      >
        <Home fill="currentColor" />
        <span>Home</span>
      </button>
      <nav aria-label="Website" {...magneticEvents}>
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
        <button
          {...magneticEvents}
          className={
            active === 'Search' ? 'desktop-search active' : 'desktop-search'
          }
          type="button"
          onClick={onSearch}
        >
          <Search />
          <span>Search</span>
        </button>
        <button
          {...magneticEvents}
          className="avatar-button desktop-avatar"
          type="button"
          title="Profile"
        >
          AB
        </button>
      </div>
    </header>
  )
}

export default App
