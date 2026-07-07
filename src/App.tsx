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
  Bell,
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
  Eye,
  EyeOff,
  Pencil,
  Sparkles,
} from 'lucide-react'
import {
  fetchMovieCollection,
  fetchMovieById,
  fetchTvShowCollection,
  fetchAnimeCollection,
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

// Eagerly import all avatar images so Vite bundles them for production
const avatarAssets: Record<string, string> = {}
const assetModules = import.meta.glob<string>(
  './assets/**/*.png',
  { eager: true, import: 'default', query: '?url' }
)
for (const [path, url] of Object.entries(assetModules)) {
  // path looks like './assets/dark/image.png' -> store as 'dark/image.png', 'elite/image.png', etc.
  const key = path.replace('./assets/', '')
  avatarAssets[key] = url
}

type Screen = 'home' | 'movies' | 'tv' | 'anime' | 'detail' | 'watch' | 'search' | 'library' | 'login' | 'profiles'
type PrimaryTab = 'Home' | 'Movies' | 'TV Shows' | 'Anime' | 'Library' | 'Search'
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
const streamSandboxKey = 'omdb.apple-tv-style.stream-sandbox'
const homeCacheKey = 'omdb.apple-tv-style.home-cache-v2'
const currentUserKey = 'omdb.apple-tv-style.current-user'

type UserInfo = {
  name: string
  email: string
  avatarColor?: string
}

function readCurrentUser(): UserInfo | null {
  try {
    const saved = window.localStorage.getItem(currentUserKey)
    return saved ? (JSON.parse(saved) as UserInfo) : null
  } catch {
    return null
  }
}

type HomeCache = {
  movies: Movie[]
  tvShows: Movie[]
  anime?: Movie[]
  movieCollection: MediaCollection
  tvShowCollection: MediaCollection
  animeCollection?: MediaCollection
  tmdbHomeRails: TmdbHomeRails
  homeHeroMovie: Movie | null
}

function readHomeCache(): HomeCache | null {
  try {
    const saved = window.localStorage.getItem(homeCacheKey)
    return saved ? (JSON.parse(saved) as HomeCache) : null
  } catch {
    return null
  }
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '👤'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase()
}

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

function readStreamSandboxEnabled() {
  try {
    return window.localStorage.getItem(streamSandboxKey) !== 'off'
  } catch {
    return true
  }
}

function readSavedMovies(): SavedMovies {
  try {
    const user = readCurrentUser()
    const key = user ? `${savedMoviesKey}.${user.name}` : savedMoviesKey
    const saved = window.localStorage.getItem(key)
    return saved ? (JSON.parse(saved) as SavedMovies) : {}
  } catch {
    return {}
  }
}

function readWatchHistory(): WatchHistory {
  try {
    const user = readCurrentUser()
    const key = user ? `${watchHistoryKey}.${user.name}` : watchHistoryKey
    const saved = window.localStorage.getItem(key)
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

function fallbackPosterForRank(_rank: number) {
  return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
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

type UserProfile = {
  name: string
  avatarColor: string
}

function App() {
  const appShellRef = useRef<HTMLElement | null>(null)
  const [screen, setScreenState] = useState<Screen>(() => {
    const savedUser = readCurrentUser()
    if (!savedUser) {
      return 'login'
    }
    return getInitialScreen()
  })
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(readCurrentUser)
  const [loginBackScreen, setLoginBackScreen] = useState<Screen>('home')
  const [tempUser, setTempUser] = useState<UserInfo | null>(null)
  const [profiles, setProfiles] = useState<UserProfile[]>(() => {
    try {
      const saved = window.localStorage.getItem('omdb.apple-tv-style.profiles-list')
      return saved ? (JSON.parse(saved) as UserProfile[]) : [{ name: 'Children', avatarColor: 'kids' }]
    } catch {
      return [{ name: 'Children', avatarColor: 'kids' }]
    }
  })
  const [designMode, setDesignMode] = useState<'apple' | 'netflix'>(() => {
    return (window.localStorage.getItem('omdb.apple-tv-style.designMode') as 'apple' | 'netflix') || 'apple'
  })

  const toggleDesignMode = () => {
    const nextMode = designMode === 'apple' ? 'netflix' : 'apple'
    setDesignMode(nextMode)
    window.localStorage.setItem('omdb.apple-tv-style.designMode', nextMode)
  }

  const handleAddProfile = (name: string, avatarColor: string) => {
    const newProfile: UserProfile = {
      name: name,
      avatarColor: avatarColor,
    }
    const updated = [...profiles, newProfile]
    setProfiles(updated)
    window.localStorage.setItem('omdb.apple-tv-style.profiles-list', JSON.stringify(updated))
  }

  const handleEditProfile = (oldName: string, newName: string, avatarColor: string) => {
    const updated = profiles.map((p) => {
      if (p.name === oldName) {
        return { name: newName, avatarColor }
      }
      return p
    })
    setProfiles(updated)
    window.localStorage.setItem('omdb.apple-tv-style.profiles-list', JSON.stringify(updated))

    if (oldName !== newName) {
      const oldSaved = window.localStorage.getItem(`${savedMoviesKey}.${oldName}`)
      if (oldSaved) {
        window.localStorage.setItem(`${savedMoviesKey}.${newName}`, oldSaved)
        window.localStorage.removeItem(`${savedMoviesKey}.${oldName}`)
      }
      const oldHistory = window.localStorage.getItem(`${watchHistoryKey}.${oldName}`)
      if (oldHistory) {
        window.localStorage.setItem(`${watchHistoryKey}.${newName}`, oldHistory)
        window.localStorage.removeItem(`${watchHistoryKey}.${oldName}`)
      }

      if (currentUser && currentUser.name === oldName) {
        setCurrentUser({ name: newName, email: currentUser.email })
      }
    }
  }

  const handleDeleteProfile = (name: string) => {
    let updated = profiles.filter((p) => p.name !== name)
    if (updated.length === 0) {
      updated = [{ name: 'Children', avatarColor: 'kids' }]
    }
    setProfiles(updated)
    window.localStorage.setItem('omdb.apple-tv-style.profiles-list', JSON.stringify(updated))

    window.localStorage.removeItem(`${savedMoviesKey}.${name}`)
    window.localStorage.removeItem(`${watchHistoryKey}.${name}`)

    if (currentUser && currentUser.name === name) {
      setCurrentUser(null)
      setScreenState('login')
    }
  }

  const initialCache = useMemo(() => readHomeCache(), [])

  const [movies, setMovies] = useState<Movie[]>(() => initialCache?.movies ?? [])
  const [tvShows, setTvShows] = useState<Movie[]>(() => initialCache?.tvShows ?? [])
  const [anime, setAnime] = useState<Movie[]>(() => initialCache?.anime ?? [])
  const [movieCollection, setMovieCollection] =
    useState<MediaCollection>(() => initialCache?.movieCollection ?? emptyMediaCollection)
  const [tvShowCollection, setTvShowCollection] =
    useState<MediaCollection>(() => initialCache?.tvShowCollection ?? emptyMediaCollection)
  const [animeCollection, setAnimeCollection] =
    useState<MediaCollection>(() => initialCache?.animeCollection ?? emptyMediaCollection)
  const [tmdbHomeRails, setTmdbHomeRails] =
    useState<TmdbHomeRails>(() => initialCache?.tmdbHomeRails ?? emptyTmdbHomeRails)
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(() => initialCache?.homeHeroMovie ?? null)
  const [homeHeroMovie, setHomeHeroMovie] = useState<Movie | null>(() => initialCache?.homeHeroMovie ?? null)
  const [detailBackScreen, setDetailBackScreen] = useState<Screen>('home')
  const [savedMovies, setSavedMovies] = useState<SavedMovies>(readSavedMovies)
  const [watchHistory, setWatchHistory] =
    useState<WatchHistory>(readWatchHistory)
  const [homeLoading, setHomeLoading] = useState(() => !initialCache)
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
  const [streamSandboxEnabled, setStreamSandboxEnabled] = useState(
    readStreamSandboxEnabled,
  )
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
        ...collectionMovies(animeCollection),
        ...movies,
        ...tvShows,
        ...anime,
      ]),
    [movieCollection, movies, tmdbHomeRails, tvShowCollection, tvShows, animeCollection, anime],
  )
  const relatedMedia = selectedMovie && isTvShow(selectedMovie) ? tvShows : movies
  const requiredMedia = screen === 'tv' ? tvShows : screen === 'anime' ? anime : movies
  const needsMovieBootstrap =
    screen === 'home' ||
    screen === 'movies' ||
    screen === 'tv' ||
    screen === 'anime' ||
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
            : screen === 'anime'
              ? 'Anime'
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

  const openProfileOrLogin = () => {
    setLoginBackScreen(screen)
    setScreen('login')
  }

  useEffect(() => {
    let isMounted = true

    async function loadMovies() {
      if (!initialCache) {
        setHomeLoading(true)
      }
      setHomeError('')

      try {
        const [nextTmdbHomeRails, nextAnimeCollection] = await Promise.all([
          fetchTmdbHomeRails(),
          fetchAnimeCollection()
        ])

        if (hasHomeBootstrapRails(nextTmdbHomeRails)) {
          const nextMovies = buildRail(
            nextTmdbHomeRails.featuredMovies,
            nextTmdbHomeRails.movieCollection.top,
          )
          const nextTvShows = buildRail(
            nextTmdbHomeRails.featuredTvShows,
            nextTmdbHomeRails.tvShowCollection.top,
          )
          const nextAnime = nextAnimeCollection.top

          if (!isMounted) {
            return
          }

          setMovies(nextMovies)
          setTvShows(nextTvShows)
          setAnime(nextAnime)
          setMovieCollection(nextTmdbHomeRails.movieCollection)
          setTvShowCollection(nextTmdbHomeRails.tvShowCollection)
          setAnimeCollection(nextAnimeCollection)
          setTmdbHomeRails(nextTmdbHomeRails)
          
          const freshHero = nextMovies[0] ?? null
          setHomeHeroMovie((current) => current ?? freshHero)
          setSelectedMovie((current) => current ?? freshHero)

          try {
            window.localStorage.setItem(
              homeCacheKey,
              JSON.stringify({
                movies: nextMovies,
                tvShows: nextTvShows,
                anime: nextAnime,
                movieCollection: nextTmdbHomeRails.movieCollection,
                tvShowCollection: nextTmdbHomeRails.tvShowCollection,
                animeCollection: nextAnimeCollection,
                tmdbHomeRails: nextTmdbHomeRails,
                homeHeroMovie: freshHero,
              })
            )
          } catch (err) {
            console.error('Failed to write home cache', err)
          }
          return
        }

        const [nextMovieCollection, nextTvShowCollection, fallbackAnimeCollection] = await Promise.all([
          fetchMovieCollection(),
          fetchTvShowCollection(),
          fetchAnimeCollection(),
        ])
        const nextMovies = nextMovieCollection.top
        const nextTvShows = nextTvShowCollection.top
        const nextAnime = fallbackAnimeCollection.top

        if (!isMounted) {
          return
        }

        setMovies(nextMovies)
        setTvShows(nextTvShows)
        setAnime(nextAnime)
        setMovieCollection(nextMovieCollection)
        setTvShowCollection(nextTvShowCollection)
        setAnimeCollection(fallbackAnimeCollection)
        setTmdbHomeRails(nextTmdbHomeRails)
        
        const freshHero = nextMovies[0] ?? null
        setHomeHeroMovie((current) => current ?? freshHero)
        setSelectedMovie((current) => current ?? freshHero)

        try {
          window.localStorage.setItem(
            homeCacheKey,
            JSON.stringify({
              movies: nextMovies,
              tvShows: nextTvShows,
              anime: nextAnime,
              movieCollection: nextMovieCollection,
              tvShowCollection: nextTvShowCollection,
              animeCollection: fallbackAnimeCollection,
              tmdbHomeRails: nextTmdbHomeRails,
              homeHeroMovie: freshHero,
            })
          )
        } catch (err) {
          console.error('Failed to write home cache', err)
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Could not load movies and TV shows.'
        
        if (!initialCache) {
          setHomeError(message)
        }
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
  }, [initialCache])

  useEffect(() => {
    if (currentUser) {
      window.localStorage.setItem(`${savedMoviesKey}.${currentUser.name}`, JSON.stringify(savedMovies))
    } else {
      window.localStorage.setItem(savedMoviesKey, JSON.stringify(savedMovies))
    }
  }, [savedMovies, currentUser])

  useEffect(() => {
    if (currentUser) {
      window.localStorage.setItem(`${watchHistoryKey}.${currentUser.name}`, JSON.stringify(watchHistory))
    } else {
      window.localStorage.setItem(watchHistoryKey, JSON.stringify(watchHistory))
    }
  }, [watchHistory, currentUser])

  useEffect(() => {
    if (currentUser) {
      window.localStorage.setItem(currentUserKey, JSON.stringify(currentUser))

      // Switch watch list and history for the active profile
      const savedStr = window.localStorage.getItem(`${savedMoviesKey}.${currentUser.name}`)
      setSavedMovies(savedStr ? JSON.parse(savedStr) : {})

      const historyStr = window.localStorage.getItem(`${watchHistoryKey}.${currentUser.name}`)
      setWatchHistory(historyStr ? JSON.parse(historyStr) : {})
    } else {
      window.localStorage.removeItem(currentUserKey)
      setSavedMovies({})
      setWatchHistory({})
    }
  }, [currentUser])

  useEffect(() => {
    window.localStorage.setItem(streamProviderKey, streamProvider)
  }, [streamProvider])

  useEffect(() => {
    window.localStorage.setItem(
      streamSandboxKey,
      streamSandboxEnabled ? 'on' : 'off',
    )
  }, [streamSandboxEnabled])

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
      className={`app-shell ${designMode}-theme ${navScrolled ? 'nav-scrolled' : ''}`}
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
          currentUser={currentUser}
          onProfile={openProfileOrLogin}
          profiles={profiles}
          designMode={designMode}
        />
      )}

      {(screen === 'movies' || screen === 'tv' || screen === 'anime') && (
        <BrowseScreen
          key={screen}
          mode={screen}
          movies={screen === 'anime' ? anime : screen === 'tv' ? tvShows : movies}
          collection={screen === 'anime' ? animeCollection : screen === 'tv' ? tvShowCollection : movieCollection}
          featuredMovie={screen === 'anime' ? anime[0] : screen === 'tv' ? featuredTvShow ?? tvShows[0] : featuredMovie ?? movies[0]}
          savedMovies={savedMovies}
          onOpenDetail={openDetail}
          onPlay={openWatch}
          onSave={toggleSaved}
          currentUser={currentUser}
          onProfile={openProfileOrLogin}
          profiles={profiles}
          onSearch={() => setScreen('search')}
          designMode={designMode}
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
          streamSandboxEnabled={streamSandboxEnabled}
          onBack={() => setScreen('detail')}
          onSave={() => toggleSaved(selectedMovie)}
          onStartWatching={markContinueWatching}
          onStreamSandboxChange={setStreamSandboxEnabled}
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
          currentUser={currentUser}
          onProfile={openProfileOrLogin}
          profiles={profiles}
        />
      )}

      {screen === 'library' && (
        <LibraryScreen
          savedMovies={savedList}
          onOpenDetail={openDetail}
          currentUser={currentUser}
          onProfile={openProfileOrLogin}
          profiles={profiles}
          onSearch={() => setScreen('search')}
        />
      )}

      {screen === 'login' && (
        <LoginScreen
          currentUser={currentUser}
          onLogin={(user) => {
            setTempUser(user)
            setScreen('profiles')
          }}
          onLogout={() => {
            setCurrentUser(null)
            setScreen('login')
          }}
          onBack={() => setScreen(loginBackScreen)}
          savedMoviesCount={savedList.length}
          watchHistoryCount={Object.keys(watchHistory).length}
          onSwitchProfile={() => {
            setTempUser(currentUser)
            setScreen('profiles')
          }}
          profiles={profiles}
          designMode={designMode}
          onToggleDesignMode={toggleDesignMode}
        />
      )}

      {screen === 'profiles' && (
        <ProfilesScreen
          profiles={profiles}
          onSelectProfile={(profileName) => {
            const matchedProfile = profiles.find((p) => p.name === profileName)
            const finalUser = {
              name: profileName,
              email: tempUser?.email ?? currentUser?.email ?? 'guest@apple-tv.com',
              avatarColor: matchedProfile?.avatarColor,
            }
            setCurrentUser(finalUser)
            setScreen(loginBackScreen)
            setTempUser(null)
          }}
          onAddProfile={handleAddProfile}
          onEditProfile={handleEditProfile}
          onDeleteProfile={handleDeleteProfile}
          onBack={() => {
            setScreen('login')
            setTempUser(null)
          }}
        />
      )}

      {screen !== 'search' && screen !== 'login' && screen !== 'profiles' && (
        <BottomNav
          active={activeTab}
          onHome={() => setScreen('home')}
          onMovies={() => setScreen('movies')}
          onTvShows={() => setScreen('tv')}
          onAnime={() => setScreen('anime')}
          onLibrary={() => setScreen('library')}
        />
      )}
      {screen !== 'detail' && screen !== 'watch' && screen !== 'login' && screen !== 'profiles' && (
        <DesktopNav
          active={activeTab}
          onHome={() => setScreen('home')}
          onMovies={() => setScreen('movies')}
          onTvShows={() => setScreen('tv')}
          onAnime={() => setScreen('anime')}
          onSearch={() => setScreen('search')}
          onLibrary={() => setScreen('library')}
          currentUser={currentUser}
          onProfile={openProfileOrLogin}
          profiles={profiles}
          designMode={designMode}
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
  currentUser: UserInfo | null
  onProfile: () => void
  profiles: UserProfile[]
  designMode: 'apple' | 'netflix'
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
  currentUser,
  onProfile,
  profiles,
  designMode,
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
            <button className="mobile-search-btn" type="button" title="Search" onClick={onSearch}>
              <Search />
            </button>
            <button className="mute-button" type="button" title="Muted">
              <VolumeX />
            </button>
            <button 
              className={`avatar-button ${currentUser ? 'has-avatar' : ''}`} 
              type="button" 
              title="Profile"
              onClick={onProfile}
            >
              {renderProfileAvatarMini(currentUser, profiles)}
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
            {designMode === 'netflix' ? (
              <button
                className="secondary-play"
                type="button"
                onClick={() => onOpenDetail(featuredMovie)}
              >
                <Info size={20} />
                <span>More Info</span>
              </button>
            ) : (
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
            )}
          </div>

          {designMode === 'apple' && (
            <button className="hero-search" type="button" onClick={onSearch}>
              <Search />
              <span>Search Apple TV</span>
            </button>
          )}
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
        {designMode === 'netflix' && (
          <div className="rating-chip-netflix">
            {featuredMovie.maturity}
          </div>
        )}
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
  mode: 'movies' | 'tv' | 'anime'
  movies: Movie[]
  collection: MediaCollection
  featuredMovie?: Movie
  savedMovies: SavedMovies
  onOpenDetail: (movie: Movie) => void
  onPlay: (movie: Movie) => void
  onSave: (movie: Movie) => void
  currentUser: UserInfo | null
  onProfile: () => void
  profiles: UserProfile[]
  onSearch: () => void
  designMode: 'apple' | 'netflix'
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
  currentUser,
  onProfile,
  profiles,
  onSearch,
  designMode,
}: BrowseScreenProps) {
  const [browseHeroIndex, setBrowseHeroIndex] = useState(0)
  const isTvMode = mode === 'tv'
  const isAnimeMode = mode === 'anime'
  const screenTitle = isAnimeMode ? 'Anime' : isTvMode ? 'TV Shows' : 'Movies'
  const firstRailTitle = isAnimeMode ? 'Top Anime Series' : isTvMode ? 'Top 10 TV Shows' : 'Top 10 Movies'
  const thrillingRailTitle = isAnimeMode
    ? 'Action & Shonen'
    : isTvMode
      ? 'Top 10 Thrilling TV Shows'
      : 'Top 10 Thrilling Movies'
  const adventureRailTitle = isAnimeMode
    ? 'Fantasy & Adventure'
    : isTvMode
      ? 'Top 10 Adventure TV Shows'
      : 'Top 10 Adventure'
  const kidsRailTitle = isAnimeMode ? 'Ghibli & Family' : isTvMode ? 'Kids & Family TV Shows' : 'Kids & Family'
  const freshRailTitle = isAnimeMode ? 'Fresh Anime' : isTvMode ? 'Fresh Episodes' : 'Fresh Picks'
  const essentialsRailTitle = isAnimeMode
    ? 'Anime Essentials'
    : isTvMode
      ? 'Series Essentials'
      : 'Movie Essentials'
  const featureRailTitle = isAnimeMode ? 'Featured Anime' : isTvMode ? 'Featured TV Shows' : 'Featured Movies'
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
              <button className="mobile-search-btn" type="button" title="Search" onClick={onSearch}>
                <Search />
              </button>
              <button className="mute-button" type="button" title="Muted">
                <VolumeX />
              </button>
              <button 
                className={`avatar-button ${currentUser ? 'has-avatar' : ''}`} 
                type="button" 
                title="Profile"
                onClick={onProfile}
              >
                {renderProfileAvatarMini(currentUser, profiles)}
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
              {designMode === 'netflix' ? (
                <button
                  className="secondary-play"
                  type="button"
                  onClick={() => onOpenDetail(heroMovie)}
                >
                  <Info size={20} />
                  <span>More Info</span>
                </button>
              ) : (
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
              )}
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
          {designMode === 'netflix' && (
            <div className="rating-chip-netflix">
              {heroMovie.maturity}
            </div>
          )}
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
  streamSandboxEnabled: boolean
  onBack: () => void
  onSave: () => void
  onStartWatching: (movie: Movie) => void
  onStreamSandboxChange: (enabled: boolean) => void
  onStreamProviderChange: (provider: StreamProvider) => void
}

function WatchScreen({
  movie,
  isSaved,
  streamLoading,
  streamError,
  streamProvider,
  streamSandboxEnabled,
  onBack,
  onSave,
  onStartWatching,
  onStreamSandboxChange,
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
            sandbox={
              streamSandboxEnabled
                ? 'allow-forms allow-presentation allow-same-origin allow-scripts'
                : undefined
            }
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
        <label className="stream-sandbox-toggle">
          <span>
            <strong>Sandbox</strong>
            <small>
              {streamSandboxEnabled
                ? 'Blocks popups and redirects'
                : 'Allows full player behavior'}
            </small>
          </span>
          <input
            type="checkbox"
            checked={streamSandboxEnabled}
            onChange={(event) => onStreamSandboxChange(event.target.checked)}
          />
          <span aria-hidden="true" className="toggle-track">
            <span />
          </span>
        </label>
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
  currentUser: UserInfo | null
  onProfile: () => void
  profiles: UserProfile[]
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
  currentUser,
  onProfile,
  profiles,
}: SearchScreenProps) {
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearch(query)
  }

  return (
    <section className="screen search-screen">
      <header className="search-header">
        <h1>Search</h1>
        <button 
          className={`avatar-button ${currentUser ? 'has-avatar' : ''}`} 
          type="button" 
          title="Profile"
          onClick={onProfile}
        >
          {renderProfileAvatarMini(currentUser, profiles)}
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

type LoginScreenProps = {
  currentUser: UserInfo | null
  onLogin: (user: UserInfo) => void
  onLogout: () => void
  onBack: () => void
  savedMoviesCount: number
  watchHistoryCount: number
  onSwitchProfile: () => void
  profiles: UserProfile[]
  designMode: 'apple' | 'netflix'
  onToggleDesignMode: () => void
}

function LoginScreen({
  currentUser,
  onLogin,
  onLogout,
  onBack,
  savedMoviesCount,
  watchHistoryCount,
  onSwitchProfile,
  profiles,
  designMode,
  onToggleDesignMode,
}: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    const allowedEmails = [
      'avnishpc00@gmail.com',
      'appclone@gmail.com',
      'netflixclone@gmail.com',
    ]
    const requiredPassword = 'Avnish@00'

    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    const isAllowedEmail = allowedEmails.some(
      (allowed) => allowed.toLowerCase() === trimmedEmail.toLowerCase()
    )

    if (!isAllowedEmail || trimmedPassword !== requiredPassword) {
      setError('Invalid email or password.')
      return
    }

    setLoading(true)

    setTimeout(() => {
      setLoading(false)
      onLogin({
        name: trimmedEmail.split('@')[0],
        email: trimmedEmail,
      })
    }, 1500)
  }

  const handleSocialLogin = (provider: 'Apple' | 'Google') => {
    setError('')
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      const targetEmail = provider === 'Apple' ? 'Appclone@gmail.com' : 'avnishpc00@gmail.com'
      onLogin({
        name: targetEmail.split('@')[0],
        email: targetEmail,
      })
    }, 1200)
  }

  if (currentUser) {
    return (
      <section className="screen login-screen profile-mode">
        <div className="login-background">
          <div className="blob blob-purple"></div>
          <div className="blob blob-blue"></div>
          <div className="blob blob-cyan"></div>
        </div>
        
        <header className="login-header">
          <button className="round-nav" type="button" onClick={onBack} title="Back">
            <ChevronLeft />
          </button>
          <h1>Account</h1>
          <div className="placeholder-right" />
        </header>

        <section className="login-content">
          <div className="glass-card profile-card">
            <div className={`profile-avatar-large ${currentUser.avatarColor ? 'has-avatar-img' : ''}`}>
              {renderProfileAvatarLarge(currentUser, profiles)}
            </div>
            
            <h2 className="user-name">{currentUser.name}</h2>
            <p className="user-email">{currentUser.email}</p>
            
            <div className="membership-tag">
              <span className="premium-badge">Apple One Premier</span>
            </div>

            <hr className="card-divider" />

            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-num">{watchHistoryCount}</span>
                <span className="stat-label">Watched</span>
              </div>
              <div className="stat-item">
                <span className="stat-num">{savedMoviesCount}</span>
                <span className="stat-label">Library</span>
              </div>
              <div className="stat-item">
                <span className="stat-num">4K HDR</span>
                <span className="stat-label">Quality</span>
              </div>
            </div>

            <div className="profile-actions">
              <button className="secondary-play full-width-btn" type="button" onClick={onBack}>
                Continue Watching
              </button>
              <button 
                className="secondary-play full-width-btn" 
                type="button" 
                onClick={onSwitchProfile}
                style={{ marginTop: '8px', background: 'rgba(255, 255, 255, 0.08)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)' }}
              >
                Switch Profile
              </button>
              <button 
                className="secondary-play full-width-btn" 
                type="button" 
                onClick={onToggleDesignMode}
                style={{ marginTop: '8px', background: '#E50914', color: '#fff', border: 'none', fontWeight: 'bold' }}
              >
                {designMode === 'netflix' ? 'Switch to Apple TV Design' : 'Switch to Netflix Design'}
              </button>
              <button className="destructive-btn full-width-btn" type="button" onClick={onLogout} style={{ marginTop: '8px' }}>
                Sign Out
              </button>
            </div>
          </div>
        </section>
      </section>
    )
  }

  return (
    <section className="screen login-screen">
      <div className="login-background">
        <div className="blob blob-purple"></div>
        <div className="blob blob-blue"></div>
        <div className="blob blob-cyan"></div>
      </div>

      <header className="login-header" style={{ justifyContent: 'center' }}>
        <h1>Sign In</h1>
      </header>

      <section className="login-content">
        <div className="glass-card login-card">
          <div className="logo-container">
            <div className="apple-tv-logo-symbol">tv</div>
            <h2>Apple TV</h2>
          </div>

          {error && <div className="login-error-msg">{error}</div>}

          <form onSubmit={handleFormSubmit} className="login-form">
            <div className="input-group">
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="Email Address" 
                disabled={loading} 
                required
              />
            </div>

            <div className="input-group password-input-group">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Password" 
                disabled={loading} 
                required
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>

            <button className="primary-play submit-btn" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <LoaderCircle className="spin-icon-btn" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In with Email</span>
              )}
            </button>
          </form>

          <div className="divider-or">
            <span>or</span>
          </div>

          <div className="social-login-group">
            <button 
              className="social-btn apple-btn" 
              type="button" 
              onClick={() => handleSocialLogin('Apple')}
              disabled={loading}
            >
              <span className="social-icon"></span>
              <span>Sign In with Apple</span>
            </button>
            <button 
              className="social-btn google-btn" 
              type="button" 
              onClick={() => handleSocialLogin('Google')}
              disabled={loading}
            >
              <span className="social-icon">G</span>
              <span>Sign In with Google</span>
            </button>
          </div>
        </div>
      </section>
    </section>
  )
}

function getAvatarSrc(avatarKey: string): string {
  // Map avatar keys to their actual asset paths in the glob map
  let assetPath = ''
  if (avatarKey.startsWith('elite/')) {
    assetPath = avatarKey
  } else if (avatarKey.startsWith('stranger/')) {
    assetPath = `stranger things/${avatarKey.replace('stranger/', '')}`
  } else if (avatarKey.startsWith('squid/')) {
    assetPath = `squide game/${avatarKey.replace('squid/', '')}`
  } else if (avatarKey.startsWith('money/')) {
    assetPath = `money heist/${avatarKey.replace('money/', '')}`
  } else if (avatarKey.startsWith('dark/')) {
    assetPath = avatarKey
  } else {
    assetPath = `classic_${avatarKey}.png`
  }
  return avatarAssets[assetPath] ?? `/src/assets/${assetPath}`
}

function renderProfileAvatarMini(currentUser: UserInfo | null, profiles: UserProfile[]) {
  if (!currentUser) return '👤'
  const matched = profiles.find((p) => p.name.toLowerCase() === currentUser.name.toLowerCase())
  const avatarColor = currentUser.avatarColor ?? matched?.avatarColor
  
  if (!avatarColor) {
    return getInitials(currentUser.name)
  }

  if (avatarColor === 'kids') {
    return (
      <div 
        className="profile-avatar avatar-kids mini-avatar" 
        style={{ 
          width: '100%', 
          height: '100%', 
          borderRadius: '50%', 
          overflow: 'hidden', 
          position: 'relative',
          display: 'block'
        }}
      >
        <div className="kids-bg" style={{ transform: 'scale(1.2)', width: '100%', height: '100%' }}>
          <div className="stripe red"></div>
          <div className="stripe orange"></div>
          <div className="stripe yellow"></div>
          <div className="stripe green"></div>
          <div className="stripe blue"></div>
        </div>
        <span className="kids-text" style={{ fontSize: '10px', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 800 }}>kids</span>
      </div>
    )
  }

  return (
    <div 
      className="profile-avatar mini-avatar" 
      style={{ 
        width: '100%', 
        height: '100%', 
        borderRadius: '50%', 
        overflow: 'hidden',
        display: 'block'
      }}
    >
      <img 
        src={getAvatarSrc(avatarColor)} 
        alt={currentUser.name} 
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}

function renderProfileAvatarLarge(currentUser: UserInfo | null, profiles: UserProfile[]) {
  if (!currentUser) return '👤'
  const matched = profiles.find((p) => p.name.toLowerCase() === currentUser.name.toLowerCase())
  const avatarColor = currentUser.avatarColor ?? matched?.avatarColor
  
  if (!avatarColor) {
    return getInitials(currentUser.name)
  }

  if (avatarColor === 'kids') {
    return (
      <div 
        className="profile-avatar avatar-kids large-avatar" 
        style={{ 
          width: '100%', 
          height: '100%', 
          borderRadius: '16px', 
          overflow: 'hidden', 
          position: 'relative',
          display: 'block'
        }}
      >
        <div className="kids-bg" style={{ transform: 'scale(1.2)', width: '100%', height: '100%' }}>
          <div className="stripe red"></div>
          <div className="stripe orange"></div>
          <div className="stripe yellow"></div>
          <div className="stripe green"></div>
          <div className="stripe blue"></div>
        </div>
        <span className="kids-text large" style={{ fontSize: '24px', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 800 }}>kids</span>
      </div>
    )
  }

  return (
    <img 
      src={getAvatarSrc(avatarColor)} 
      alt={currentUser.name} 
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '16px' }}
    />
  )
}

type ProfilesScreenProps = {
  profiles: UserProfile[]
  onSelectProfile: (profileName: string) => void
  onAddProfile: (name: string, avatarColor: string) => void
  onEditProfile: (oldName: string, newName: string, avatarColor: string) => void
  onDeleteProfile: (name: string) => void
  onBack: () => void
}

function ProfilesScreen({
  profiles,
  onSelectProfile,
  onAddProfile,
  onEditProfile,
  onDeleteProfile,
  onBack
}: ProfilesScreenProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [isChoosingIcon, setIsChoosingIcon] = useState(false)
  const [newName, setNewName] = useState('')
  const [isKids, setIsKids] = useState(false)
  const [selectedAvatarColor, setSelectedAvatarColor] = useState('red')
  const [error, setError] = useState('')

  // Edit profile states
  const [isManaging, setIsManaging] = useState(false)
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null)
  const [editName, setEditName] = useState('')
  const [editIsKids, setEditIsKids] = useState(false)

  const handleCreate = () => {
    setError('')
    const trimmed = newName.trim()
    if (!trimmed) {
      setError('Profile name cannot be empty.')
      return
    }
    if (profiles.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A profile with this name already exists.')
      return
    }
    const finalColor = isKids ? 'kids' : selectedAvatarColor
    onAddProfile(trimmed, finalColor)
    setNewName('')
    setIsKids(false)
    setSelectedAvatarColor('red')
    setIsAdding(false)
  }

  const handleSaveEdit = () => {
    setError('')
    if (!editingProfile) return
    const trimmed = editName.trim()
    if (!trimmed) {
      setError('Profile name cannot be empty.')
      return
    }
    if (profiles.some((p) => p.name.toLowerCase() === trimmed.toLowerCase() && p.name !== editingProfile.name)) {
      setError('A profile with this name already exists.')
      return
    }
    const finalColor = editIsKids ? 'kids' : selectedAvatarColor
    onEditProfile(editingProfile.name, trimmed, finalColor)
    setEditingProfile(null)
    setError('')
  }

  const handleDelete = () => {
    if (!editingProfile) return
    onDeleteProfile(editingProfile.name)
    setEditingProfile(null)
    setError('')
  }

  if (editingProfile) {
    if (isChoosingIcon) {
      return (
        <section className="screen choose-icon-screen">
          <header className="choose-icon-header">
            <button 
              className="round-nav" 
              type="button" 
              onClick={() => setIsChoosingIcon(false)} 
              title="Back"
            >
              <ChevronLeft />
            </button>
            <h1>Choose Icon</h1>
            <div className="placeholder-right" />
          </header>

          <div className="choose-icon-container">
            <div className="choose-icon-section">
              <h2>The Classics</h2>
              <div className="choose-icon-row">
                {['red', 'yellow', 'blue', 'grey'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="choose-avatar-btn"
                    onClick={() => {
                      setSelectedAvatarColor(color)
                      setIsChoosingIcon(false)
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <img 
                      src={getAvatarSrc(color)} 
                      alt={color} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="choose-icon-section">
              <h2>Elite</h2>
              <div className="choose-icon-row">
                {[
                  'image.png',
                  'image copy.png',
                  'image copy 2.png',
                  'image copy 3.png',
                  'image copy 4.png',
                  'image copy 5.png',
                  'image copy 6.png',
                  'image copy 7.png',
                  'image copy 8.png',
                  'image copy 9.png',
                  'image copy 10.png'
                ].map((filename) => (
                  <button
                    key={filename}
                    type="button"
                    className="choose-avatar-btn"
                    onClick={() => {
                      setSelectedAvatarColor(`elite/${filename}`)
                      setIsChoosingIcon(false)
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <img 
                      src={avatarAssets[`elite/${filename}`] ?? `/src/assets/elite/${filename}`} 
                      alt={filename} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="choose-icon-section">
              <h2>Stranger Things</h2>
              <div className="choose-icon-row">
                {[
                  'image.png',
                  'image copy.png',
                  'image copy 2.png',
                  'image copy 3.png',
                  'image copy 4.png',
                  'image copy 5.png',
                  'image copy 6.png',
                  'image copy 7.png',
                  'image copy 8.png',
                  'image copy 9.png',
                  'image copy 10.png',
                  'image copy 11.png',
                  'image copy 12.png'
                ].map((filename) => (
                  <button
                    key={filename}
                    type="button"
                    className="choose-avatar-btn"
                    onClick={() => {
                      setSelectedAvatarColor(`stranger/${filename}`)
                      setIsChoosingIcon(false)
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <img 
                      src={avatarAssets[`stranger things/${filename}`] ?? `/src/assets/stranger things/${filename}`} 
                      alt={filename} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="choose-icon-section">
              <h2>Squid Game</h2>
              <div className="choose-icon-row">
                {[
                  'image.png',
                  'image copy.png',
                  'image copy 2.png',
                  'image copy 3.png',
                  'image copy 4.png',
                  'image copy 5.png',
                  'image copy 6.png',
                  'image copy 7.png',
                  'image copy 8.png',
                  'image copy 9.png',
                  'image copy 10.png',
                  'image copy 11.png',
                  'image copy 12.png',
                  'image copy 13.png',
                  'image copy 14.png',
                  'image copy 15.png'
                ].map((filename) => (
                  <button
                    key={filename}
                    type="button"
                    className="choose-avatar-btn"
                    onClick={() => {
                      setSelectedAvatarColor(`squid/${filename}`)
                      setIsChoosingIcon(false)
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <img 
                      src={avatarAssets[`squide game/${filename}`] ?? `/src/assets/squide game/${filename}`} 
                      alt={filename} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="choose-icon-section">
              <h2>Money Heist</h2>
              <div className="choose-icon-row">
                {[
                  'image.png',
                  'image copy.png',
                  'image copy 2.png',
                  'image copy 3.png',
                  'image copy 4.png',
                  'image copy 5.png',
                  'image copy 6.png',
                  'image copy 7.png',
                  'image copy 8.png',
                  'image copy 9.png'
                ].map((filename) => (
                  <button
                    key={filename}
                    type="button"
                    className="choose-avatar-btn"
                    onClick={() => {
                      setSelectedAvatarColor(`money/${filename}`)
                      setIsChoosingIcon(false)
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <img 
                      src={avatarAssets[`money heist/${filename}`] ?? `/src/assets/money heist/${filename}`} 
                      alt={filename} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="choose-icon-section">
              <h2>Dark</h2>
              <div className="choose-icon-row">
                {[
                  'image.png',
                  'image copy.png',
                  'image copy 2.png',
                  'image copy 3.png',
                  'image copy 4.png',
                  'image copy 5.png',
                  'image copy 6.png',
                  'image copy 7.png',
                  'image copy 8.png',
                  'image copy 9.png'
                ].map((filename) => (
                  <button
                    key={filename}
                    type="button"
                    className="choose-avatar-btn"
                    onClick={() => {
                      setSelectedAvatarColor(`dark/${filename}`)
                      setIsChoosingIcon(false)
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <img 
                      src={avatarAssets[`dark/${filename}`] ?? `/src/assets/dark/${filename}`} 
                      alt={filename} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )
    }

    return (
      <section className="screen add-profile-screen edit-profile-screen">
        <header className="add-profile-header">
          <button 
            className="header-text-btn" 
            type="button" 
            onClick={() => {
              setEditingProfile(null)
              setError('')
            }}
          >
            Cancel
          </button>
          <h1>Edit Profile</h1>
          <button 
            className="header-text-btn save-btn" 
            type="button" 
            onClick={handleSaveEdit}
            disabled={!editName.trim()}
          >
            Save
          </button>
        </header>

        <div className="add-profile-container">
          <div className="avatar-edit-container">
            {editIsKids ? (
              <div className="profile-avatar avatar-kids large-avatar">
                <div className="kids-bg">
                  <div className="stripe red"></div>
                  <div className="stripe orange"></div>
                  <div className="stripe yellow"></div>
                  <div className="stripe green"></div>
                  <div className="stripe blue"></div>
                </div>
                <span className="kids-text large">kids</span>
              </div>
            ) : (
              <div className="profile-avatar large-avatar" style={{ overflow: 'hidden' }}>
                <img 
                  src={getAvatarSrc(selectedAvatarColor)} 
                  alt="Selected Avatar" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            )}
            <button 
              className="avatar-edit-pencil-btn" 
              type="button" 
              onClick={() => setIsChoosingIcon(true)}
              title="Change Icon"
            >
              <Pencil size={18} />
            </button>
          </div>

          <div className="add-profile-form">
            {error && <div className="login-error-msg center-text">{error}</div>}
            <div className="input-group">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Profile name"
                maxLength={15}
                required
              />
            </div>

            <div className="children-toggle-section">
              <button 
                type="button"
                className={`ios-toggle-switch ${editIsKids ? 'active' : ''}`}
                onClick={() => setEditIsKids(!editIsKids)}
              >
                <span className="toggle-handle" />
              </button>
              <h2 className="children-title-label">Children's Profile</h2>
              <p className="children-desc">
                Made for children 12 and under, but parents have all the control.
              </p>
            </div>

            <button
              className="destructive-btn full-width-btn"
              type="button"
              onClick={handleDelete}
              style={{ marginTop: '30px', height: '48px', width: '100%', maxWidth: '280px', borderRadius: '8px' }}
            >
              Delete Profile
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (isAdding) {
    if (isChoosingIcon) {
      return (
        <section className="screen choose-icon-screen">
          <header className="choose-icon-header">
            <button 
              className="round-nav" 
              type="button" 
              onClick={() => setIsChoosingIcon(false)} 
              title="Back"
            >
              <ChevronLeft />
            </button>
            <h1>Choose Icon</h1>
            <div className="placeholder-right" />
          </header>

          <div className="choose-icon-container">
            <div className="choose-icon-section">
              <h2>The Classics</h2>
              <div className="choose-icon-row">
                {['red', 'yellow', 'blue', 'grey'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="choose-avatar-btn"
                    onClick={() => {
                      setSelectedAvatarColor(color)
                      setIsChoosingIcon(false)
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <img 
                      src={getAvatarSrc(color)} 
                      alt={color} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="choose-icon-section">
              <h2>Elite</h2>
              <div className="choose-icon-row">
                {[
                  'image.png',
                  'image copy.png',
                  'image copy 2.png',
                  'image copy 3.png',
                  'image copy 4.png',
                  'image copy 5.png',
                  'image copy 6.png',
                  'image copy 7.png',
                  'image copy 8.png',
                  'image copy 9.png',
                  'image copy 10.png'
                ].map((filename) => (
                  <button
                    key={filename}
                    type="button"
                    className="choose-avatar-btn"
                    onClick={() => {
                      setSelectedAvatarColor(`elite/${filename}`)
                      setIsChoosingIcon(false)
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <img 
                      src={avatarAssets[`elite/${filename}`] ?? `/src/assets/elite/${filename}`} 
                      alt={filename} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="choose-icon-section">
              <h2>Stranger Things</h2>
              <div className="choose-icon-row">
                {[
                  'image.png',
                  'image copy.png',
                  'image copy 2.png',
                  'image copy 3.png',
                  'image copy 4.png',
                  'image copy 5.png',
                  'image copy 6.png',
                  'image copy 7.png',
                  'image copy 8.png',
                  'image copy 9.png',
                  'image copy 10.png',
                  'image copy 11.png',
                  'image copy 12.png'
                ].map((filename) => (
                  <button
                    key={filename}
                    type="button"
                    className="choose-avatar-btn"
                    onClick={() => {
                      setSelectedAvatarColor(`stranger/${filename}`)
                      setIsChoosingIcon(false)
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <img 
                      src={avatarAssets[`stranger things/${filename}`] ?? `/src/assets/stranger things/${filename}`} 
                      alt={filename} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="choose-icon-section">
              <h2>Squid Game</h2>
              <div className="choose-icon-row">
                {[
                  'image.png',
                  'image copy.png',
                  'image copy 2.png',
                  'image copy 3.png',
                  'image copy 4.png',
                  'image copy 5.png',
                  'image copy 6.png',
                  'image copy 7.png',
                  'image copy 8.png',
                  'image copy 9.png',
                  'image copy 10.png',
                  'image copy 11.png',
                  'image copy 12.png',
                  'image copy 13.png',
                  'image copy 14.png',
                  'image copy 15.png'
                ].map((filename) => (
                  <button
                    key={filename}
                    type="button"
                    className="choose-avatar-btn"
                    onClick={() => {
                      setSelectedAvatarColor(`squid/${filename}`)
                      setIsChoosingIcon(false)
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <img 
                      src={avatarAssets[`squide game/${filename}`] ?? `/src/assets/squide game/${filename}`} 
                      alt={filename} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="choose-icon-section">
              <h2>Money Heist</h2>
              <div className="choose-icon-row">
                {[
                  'image.png',
                  'image copy.png',
                  'image copy 2.png',
                  'image copy 3.png',
                  'image copy 4.png',
                  'image copy 5.png',
                  'image copy 6.png',
                  'image copy 7.png',
                  'image copy 8.png',
                  'image copy 9.png'
                ].map((filename) => (
                  <button
                    key={filename}
                    type="button"
                    className="choose-avatar-btn"
                    onClick={() => {
                      setSelectedAvatarColor(`money/${filename}`)
                      setIsChoosingIcon(false)
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <img 
                      src={avatarAssets[`money heist/${filename}`] ?? `/src/assets/money heist/${filename}`} 
                      alt={filename} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="choose-icon-section">
              <h2>Dark</h2>
              <div className="choose-icon-row">
                {[
                  'image.png',
                  'image copy.png',
                  'image copy 2.png',
                  'image copy 3.png',
                  'image copy 4.png',
                  'image copy 5.png',
                  'image copy 6.png',
                  'image copy 7.png',
                  'image copy 8.png',
                  'image copy 9.png'
                ].map((filename) => (
                  <button
                    key={filename}
                    type="button"
                    className="choose-avatar-btn"
                    onClick={() => {
                      setSelectedAvatarColor(`dark/${filename}`)
                      setIsChoosingIcon(false)
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <img 
                      src={avatarAssets[`dark/${filename}`] ?? `/src/assets/dark/${filename}`} 
                      alt={filename} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )
    }

    return (
      <section className="screen add-profile-screen">
        <header className="add-profile-header">
          <button 
            className="header-text-btn" 
            type="button" 
            onClick={() => {
              setIsAdding(false)
              setNewName('')
              setError('')
              setIsKids(false)
              setSelectedAvatarColor('red')
            }}
          >
            Cancel
          </button>
          <h1>Add Profile</h1>
          <button 
            className="header-text-btn save-btn" 
            type="button" 
            onClick={handleCreate}
            disabled={!newName.trim()}
          >
            Save
          </button>
        </header>

        <div className="add-profile-container">
          <div className="avatar-edit-container">
            {isKids ? (
              <div className="profile-avatar avatar-kids large-avatar">
                <div className="kids-bg">
                  <div className="stripe red"></div>
                  <div className="stripe orange"></div>
                  <div className="stripe yellow"></div>
                  <div className="stripe green"></div>
                  <div className="stripe blue"></div>
                </div>
                <span className="kids-text large">kids</span>
              </div>
            ) : (
              <div className="profile-avatar large-avatar" style={{ overflow: 'hidden' }}>
                <img 
                  src={getAvatarSrc(selectedAvatarColor)} 
                  alt="Selected Avatar" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            )}
            <button 
              className="avatar-edit-pencil-btn" 
              type="button" 
              onClick={() => setIsChoosingIcon(true)}
              title="Change Icon"
            >
              <Pencil size={18} />
            </button>
          </div>

          <div className="add-profile-form">
            {error && <div className="login-error-msg center-text">{error}</div>}
            <div className="input-group">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Profile name"
                maxLength={15}
                required
              />
            </div>

            <div className="children-toggle-section">
              <button 
                type="button"
                className={`ios-toggle-switch ${isKids ? 'active' : ''}`}
                onClick={() => setIsKids(!isKids)}
              >
                <span className="toggle-handle" />
              </button>
              <h2 className="children-title-label">Children's Profile</h2>
              <p className="children-desc">
                Made for children 12 and under, but parents have all the control.
              </p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="screen profiles-screen">
      <header className="profiles-header">
        <button className="round-nav" type="button" onClick={onBack} title="Back">
          <ChevronLeft />
        </button>
        <div className="placeholder-right" />
      </header>

      <div className="profiles-container">
        <h1 className="profiles-title">{isManaging ? 'Manage Profiles' : "Who's watching?"}</h1>
        
        <div className="profiles-grid">
          {profiles.map((profile) => (
            <button 
              key={profile.name}
              className="profile-item" 
              type="button" 
              onClick={() => {
                if (isManaging) {
                  setEditingProfile(profile)
                  setEditName(profile.name)
                  setEditIsKids(profile.avatarColor === 'kids')
                  setSelectedAvatarColor(profile.avatarColor === 'kids' ? 'red' : profile.avatarColor)
                } else {
                  onSelectProfile(profile.name)
                }
              }}
            >
              <div className="profile-avatar-container" style={{ position: 'relative', width: '100%', aspectRatio: '1' }}>
                {profile.avatarColor === 'kids' ? (
                  <div className="profile-avatar avatar-kids">
                    <div className="kids-bg">
                      <div className="stripe red"></div>
                      <div className="stripe orange"></div>
                      <div className="stripe yellow"></div>
                      <div className="stripe green"></div>
                      <div className="stripe blue"></div>
                    </div>
                    <span className="kids-text">kids</span>
                  </div>
                ) : (
                  <div className="profile-avatar" style={{ overflow: 'hidden', width: '100%', height: '100%' }}>
                    <img 
                      src={getAvatarSrc(profile.avatarColor)} 
                      alt={profile.name} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                )}
                {isManaging && (
                  <div className="profile-avatar-manage-overlay">
                    <Pencil size={32} className="manage-pencil-icon" />
                  </div>
                )}
              </div>
              <span className="profile-name">{profile.name}</span>
            </button>
          ))}

          <button className="profile-item" type="button" onClick={() => setIsAdding(true)}>
            <div className="profile-avatar avatar-add">
              <Plus size={32} />
            </div>
            <span className="profile-name">Add Profile</span>
          </button>
        </div>

        <button 
          className={`manage-profiles-btn ${isManaging ? 'active-done' : ''}`} 
          type="button"
          onClick={() => setIsManaging(!isManaging)}
        >
          {isManaging ? 'Done' : 'Manage Profiles'}
        </button>
      </div>
    </section>
  )
}

type LibraryScreenProps = {
  savedMovies: Movie[]
  onOpenDetail: (movie: Movie) => void
  currentUser: UserInfo | null
  onProfile: () => void
  profiles: UserProfile[]
  onSearch: () => void
}

function LibraryScreen({
  savedMovies,
  onOpenDetail,
  currentUser,
  onProfile,
  profiles,
  onSearch,
}: LibraryScreenProps) {
  return (
    <section className="screen library-screen">
      <header className="library-header">
        <h1>Library</h1>
        <div className="header-actions">
          <button className="mobile-search-btn" type="button" title="Search" onClick={onSearch}>
            <Search />
          </button>
          <button 
            className={`avatar-button ${currentUser ? 'has-avatar' : ''}`} 
            type="button" 
            title="Profile"
            onClick={onProfile}
          >
            {renderProfileAvatarMini(currentUser, profiles)}
          </button>
        </div>
      </header>

      <section className="library-content">
        {!currentUser && (
          <div className="glass-card library-signin-banner">
            <div className="banner-text">
              <h3>Sync Your Library</h3>
              <p>Sign in to save and sync TV shows, movies, and watch history across all your devices.</p>
            </div>
            <button className="primary-play small" type="button" onClick={onProfile}>
              Sign In
            </button>
          </div>
        )}

        {savedMovies.length > 0 ? (
          <>
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
          </>
        ) : (
          <div className="library-empty-state">
            <h2>Your Library Is Empty</h2>
            <p>TV shows and movies you save from the app will appear here.</p>
          </div>
        )}
      </section>
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
  onAnime,
  onLibrary,
}: {
  active: PrimaryTab
  onHome: () => void
  onMovies: () => void
  onTvShows: () => void
  onAnime: () => void
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
          className={active === 'Anime' ? 'active' : ''}
          type="button"
          onClick={onAnime}
          aria-current={active === 'Anime' ? 'page' : undefined}
          title="Anime"
        >
          <Sparkles />
          <span>Anime</span>
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
    </div>
  )
}

function DesktopNav({
  active,
  onHome,
  onMovies,
  onTvShows,
  onAnime,
  onSearch,
  onLibrary,
  currentUser,
  onProfile,
  profiles,
  designMode,
}: {
  active: PrimaryTab
  onHome: () => void
  onMovies: () => void
  onTvShows: () => void
  onAnime: () => void
  onSearch: () => void
  onLibrary: () => void
  currentUser: UserInfo | null
  onProfile: () => void
  profiles: UserProfile[]
  designMode: 'apple' | 'netflix'
}) {
  const magneticEvents = {
    onPointerLeave: resetMagneticNavOffset,
    onPointerMove: setMagneticNavOffset,
    onPointerUp: resetMagneticNavOffset,
  }

  return (
    <header className="desktop-nav">
      {designMode === 'netflix' ? (
        <>
          <button className="desktop-brand netflix-logo-btn" type="button" onClick={onHome}>
            NETFLIX
          </button>
          <nav aria-label="Website" className="netflix-desktop-links">
            <button className={active === 'Home' ? 'active' : ''} type="button" onClick={onHome}>Home</button>
            <button className={active === 'TV Shows' ? 'active' : ''} type="button" onClick={onTvShows}>Shows</button>
            <button className={active === 'Movies' ? 'active' : ''} type="button" onClick={onMovies}>Movies</button>
            <button type="button">Games</button>
            <button type="button">New & Popular</button>
            <button className={active === 'Library' ? 'active' : ''} type="button" onClick={onLibrary}>My List</button>
            <button type="button">Browse by Languages</button>
          </nav>
          <div className="desktop-actions netflix-actions">
            <button className="netflix-action-btn search-btn" type="button" onClick={onSearch} title="Search">
              <Search size={20} />
            </button>
            <button className="netflix-action-btn bell-btn" type="button" title="Notifications">
              <Bell size={20} />
              <span className="bell-badge">7</span>
            </button>
            <button className="avatar-button desktop-avatar netflix-avatar" type="button" onClick={onProfile} title="Profile">
              {renderProfileAvatarMini(currentUser, profiles)}
            </button>
          </div>
        </>
      ) : (
        <>
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
              className={active === 'Anime' ? 'active' : ''}
              type="button"
              onClick={onAnime}
            >
              <Sparkles />
              <span>Anime</span>
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
              className={`avatar-button desktop-avatar ${currentUser ? 'has-avatar' : ''}`}
              type="button"
              title="Profile"
              onClick={onProfile}
            >
              {renderProfileAvatarMini(currentUser, profiles)}
            </button>
          </div>
        </>
      )}
    </header>
  )
}

export default App
