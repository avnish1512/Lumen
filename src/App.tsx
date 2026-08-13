import {
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
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
  Heart,
  Home,
  Info,
  Library,
  LoaderCircle,
  Mail,
  Mic,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Share,
  Trash2,
  Tv,
  Users,
  Volume2,
  VolumeX,
  X,
  Eye,
  EyeOff,
  Pencil,
  Radio,
  LogOut,
  Smartphone,
  Monitor,
  Tablet,
  CircleHelp,
  CircleUserRound,
  UserCog,
  Crown,
  Lock,
  Delete,
  KeyRound,
  BookOpen,
  Code,
  Video,
  Maximize2,
  Minimize2,
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
  fetchKoreanChineseDramas,
  fetchMatureCollection,
  type LordRail,
  searchTmdb,
  fetchSeasonEpisodes,
  fetchTvSeasons,
  type DramaRails,
  type SeasonEpisode,
  streamProviderOptions,
  type CastCrewMember,
  type StreamProvider,
  type TmdbHomeRails,
  type TmdbWatchAvailability,
  type TmdbWatchProvider,
} from './tmdb'
import { HlsPlayer } from './HlsPlayer'
import { MangaScreen } from './MangaScreen'
import { searchAnime, syncAnimeProgressToAniList, fetchAnimeByOptions, getAnimeDetails, fetchAnimeListByIds, type AnimeSeasonInfo } from './anilist'
import {
  fetchAccountProfiles as fetchRemoteProfiles,
  saveAccountProfiles as saveRemoteProfiles,
  verifyRemoteLordPin,
  saveRemoteLordPin,
  fetchRemoteWatchHistory,
  saveRemoteWatchHistory,
} from './profiles-api'
import {
  acceptInvite,
  endParty,
  fetchFriends,
  fetchIncomingInvites,
  fetchParty,
  pushPartySignal,
  pushScreenShareState,
  sendInvite,
  type WatchParty,
} from './watch-party'
import {
  changeAdminPassword as changeAdminPasswordApi,
  deleteAccount as deleteAccountApi,
  getAdminKey,
  isMainAccount,
  listAccounts as listAccountsApi,
  revealPassword as revealPasswordApi,
  saveAccount as saveAccountApi,
  setAdminKey,
  verifyCredentials,
  type Account,
} from './accounts-api'
import {
  fetchDevices as fetchDevicesApi,
  registerDevice as registerDeviceApi,
  removeDevice as removeDeviceApi,
  removeOtherDevices as removeOtherDevicesApi,
} from './devices-api'
import {
  fetchLiveSports,
  fetchLiveMatches,
  fetchFirstAvailableStreams,
  liveBadgeUrl,
  liveMatchPoster,
  type LiveSport,
  type LiveMatch,
  type LiveStream,
  type LiveMatchScope,
} from './livetv'
import { topPosterUrl, hasTopPoster, proxiedAnimeImage } from './posters'
import { fetchTrailerYoutubeId } from './kinocheck'
import { WatchRecommenderEntry } from './watch-recommender/WatchRecommender'
import { SplashScreen } from './SplashScreen'
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

// Rotating desktop-login background images, loaded from src/assets/backroll/.
const backrollImages: string[] = Object.keys(avatarAssets)
  .filter((key) => key.startsWith('backroll/'))
  .sort()
  .map((key) => avatarAssets[key])

/**
 * Full-bleed rotating backdrop for the desktop login. Cross-fades through every
 * image in `src/assets/backroll/`, advancing once every 3 seconds.
 */
function LoginBackdrop() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (backrollImages.length <= 1) {
      return
    }
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % backrollImages.length)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [])

  if (backrollImages.length === 0) {
    return null
  }

  return (
    <div className="login-backdrop" aria-hidden="true">
      {backrollImages.map((src, i) => (
        <div
          key={src}
          className={`login-backdrop-slide${i === index ? ' active' : ''}`}
          style={{ backgroundImage: `url(${src})` }}
        />
      ))}
    </div>
  )
}

type Screen = 'home' | 'movies' | 'tv' | 'anime' | 'detail' | 'watch' | 'search' | 'library' | 'login' | 'profiles' | 'drama' | 'livetv' | 'lord' | 'manga'
type PrimaryTab = 'Home' | 'Movies' | 'TV Shows' | 'Anime' | 'Library' | 'Search' | 'Drama' | 'Live TV' | 'Manga'
type SavedMovies = Record<string, Movie>

// 4-digit PIN that unlocks the hidden "Lord" profile. Change this value (or the
// localStorage key 'lord_pin') to set your own code.
const DEFAULT_LORD_PIN = '1408'
function getLordPin(): string {
  try {
    const stored = localStorage.getItem('lord_pin')
    if (stored && /^\d{4}$/.test(stored)) {
      return stored
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_LORD_PIN
}

function setLordPin(newPin: string, userEmail?: string | null): boolean {
  if (userEmail && userEmail.toLowerCase() !== 'avnishpc00@gmail.com') {
    return false
  }
  if (/^\d{4}$/.test(newPin)) {
    try {
      localStorage.setItem('lord_pin', newPin)
      if (userEmail) {
        void saveRemoteLordPin(userEmail, newPin)
      }
      return true
    } catch {
      return false
    }
  }
  return false
}
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
const likedMoviesKey = 'omdb.apple-tv-style.liked-movies'
const watchHistoryKey = 'omdb.apple-tv-style.watch-history'
const removedHistoryKey = 'omdb.apple-tv-style.removed-history'
const streamProviderKey = 'omdb.apple-tv-style.stream-provider'
const streamSandboxKey = 'omdb.apple-tv-style.stream-sandbox'
const homeCacheKey = 'omdb.apple-tv-style.home-cache-v3'
const currentUserKey = 'omdb.apple-tv-style.current-user'
const profilesListKey = 'omdb.apple-tv-style.profiles-list'
const selectedMovieKey = 'omdb.apple-tv-style.selected-movie'

function readSelectedMovie(): Movie | null {
  try {
    const saved = window.sessionStorage.getItem(selectedMovieKey)
    return saved ? (JSON.parse(saved) as Movie) : null
  } catch {
    return null
  }
}

export type UserInfo = {
  name: string
  email: string
  avatarColor?: string
}

export type UserProfile = {
  name: string
  avatarColor: string
}

// Profiles are stored per login account (keyed by email) so each of the
// separate logins keeps its own set of profiles and they are never
// overwritten by another account on the same device.
function profilesKeyFor(user: UserInfo | null) {
  return user?.email
    ? `${profilesListKey}.${user.email.toLowerCase()}`
    : profilesListKey
}

function readProfilesFor(user: UserInfo | null): UserProfile[] {
  const fallback: UserProfile[] = [{ name: 'Children', avatarColor: 'kids' }]
  try {
    const key = profilesKeyFor(user)
    // Each account keeps its own list. A brand-new account starts empty (only
    // the default Kids profile) rather than inheriting another account's
    // profiles that happen to live in this device's storage.
    const saved = window.localStorage.getItem(key)

    return saved ? (JSON.parse(saved) as UserProfile[]) : fallback
  } catch {
    return fallback
  }
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
  searchRecommendations?: Movie[]
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

const heroAutoAdvanceMs = 15000
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
  'Lumen',
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



function isStreamProvider(value: string | null): value is StreamProvider {
  return (
    value === 'rivestream' ||
    value === 'vidsync' ||
    value === 'multiembed-vip' ||
    value === 'vidking' ||
    value === 'megaplay' ||
    value === 'megabuzz' ||
    value === 'oceanplay'
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

function readLikedMovies(): SavedMovies {
  try {
    const user = readCurrentUser()
    const key = user ? `${likedMoviesKey}.${user.name}` : likedMoviesKey
    const liked = window.localStorage.getItem(key)
    return liked ? (JSON.parse(liked) as SavedMovies) : {}
  } catch {
    return {}
  }
}

// -----------------------------------------------------------------------------
// Manage Devices — logged-in device/session registry (JioHotstar-style).
//
// The app has no real multi-device session backend, so device sessions are
// tracked locally per account: the current browser is registered on the
// account screen, and a couple of illustrative sessions are seeded so the list
// mirrors how JioHotstar shows every device with an active session and lets you
// log any of them out. All data is per-account in localStorage.
// -----------------------------------------------------------------------------

const devicesKey = 'omdb.apple-tv-style.devices'

type DeviceType = 'tv' | 'mobile' | 'tablet' | 'desktop'

type DeviceSession = {
  id: string
  name: string
  type: DeviceType
  location?: string
  lastActive: number
  current?: boolean
}

function devicesKeyFor(email: string | undefined): string {
  return email ? `${devicesKey}.${email.toLowerCase()}` : devicesKey
}

/** Classifies the current browser/user-agent into a coarse device type. */
function detectDeviceType(ua: string): DeviceType {
  const value = ua.toLowerCase()
  if (/smart-?tv|googletv|appletv|hbbtv|netcast|viera|crkey|tizen|web0s/.test(value)) {
    return 'tv'
  }
  if (/ipad|tablet|playbook|silk/.test(value) || (/android/.test(value) && !/mobile/.test(value))) {
    return 'tablet'
  }
  if (/mobile|iphone|ipod|android.*mobile|windows phone/.test(value)) {
    return 'mobile'
  }
  return 'desktop'
}

/** Builds a friendly "Browser on OS" name from the user-agent. */
function detectDeviceName(ua: string): string {
  const os = /windows/i.test(ua)
    ? 'Windows'
    : /iphone|ipad|ipod|mac os/i.test(ua)
      ? 'Apple'
      : /android/i.test(ua)
        ? 'Android'
        : /linux/i.test(ua)
          ? 'Linux'
          : 'Web'
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /chrome|crios/i.test(ua)
      ? 'Chrome'
      : /firefox|fxios/i.test(ua)
        ? 'Firefox'
        : /safari/i.test(ua)
          ? 'Safari'
          : 'Browser'
  return `${browser} on ${os}`
}

/** A stable id for the current browser, persisted across sessions. */
function currentDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(`${devicesKey}.self-id`)
    if (existing) {
      return existing
    }
    const id = `dev-${Math.random().toString(36).slice(2, 10)}`
    window.localStorage.setItem(`${devicesKey}.self-id`, id)
    return id
  } catch {
    return 'dev-current'
  }
}

/** The real current device (this browser). Always shown under "This Device". */
function buildCurrentDevice(): DeviceSession {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  return {
    id: currentDeviceId(),
    name: detectDeviceName(ua),
    type: detectDeviceType(ua),
    lastActive: Date.now(),
    current: true,
  }
}

/**
 * Local cache of the account's REAL device sessions — no fabricated entries.
 * The backend (Supabase, via /api/devices) is the source of truth; this cache
 * lets the screen render instantly and still show at least the current device
 * when the backend is unavailable.
 */
function readCachedDevices(email: string | undefined): DeviceSession[] {
  const current = buildCurrentDevice()
  let stored: DeviceSession[] = []
  try {
    const raw = window.localStorage.getItem(devicesKeyFor(email))
    if (raw) {
      stored = JSON.parse(raw) as DeviceSession[]
    }
  } catch {
    stored = []
  }
  const others = stored
    .filter((device) => device.id !== current.id)
    .map((device) => ({ ...device, current: false }))
  return [current, ...others]
}

function writeCachedDevices(email: string | undefined, sessions: DeviceSession[]) {
  try {
    window.localStorage.setItem(devicesKeyFor(email), JSON.stringify(sessions))
  } catch {
    // ignore quota / serialization errors
  }
}

/**
 * Normalizes a device list (from backend or cache): marks the current device,
 * refreshes its details, and always lists it first. Guarantees the current
 * device appears even if the backend has not recorded it yet.
 */
function withCurrentDevice(list: DeviceSession[]): DeviceSession[] {
  const current = buildCurrentDevice()
  const known = list.find((device) => device.id === current.id)
  const others = list
    .filter((device) => device.id !== current.id)
    .map((device) => ({ ...device, current: false }))
  const self = known ? { ...known, ...current, current: true } : current
  return [self, ...others]
}

/** "Last used" label in the grouped device list (Today / Yesterday / N Days Ago / N Months Ago). */
function deviceLastUsedLabel(session: DeviceSession): string {
  if (session.current) {
    return 'Today'
  }
  const days = Math.floor((Date.now() - session.lastActive) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} Days Ago`
  const months = Math.floor(days / 30)
  return `${months} Month${months === 1 ? '' : 's'} Ago`
}

type RemovedHistoryMap = Record<string, number>

function removedHistoryKeyFor(user: UserInfo | null) {
  return user ? `${removedHistoryKey}.${user.name}` : removedHistoryKey
}

function readRemovedHistory(user?: UserInfo | null): RemovedHistoryMap {
  try {
    const currentUser = user !== undefined ? user : readCurrentUser()
    const key = removedHistoryKeyFor(currentUser)
    const saved = window.localStorage.getItem(key)
    return saved ? (JSON.parse(saved) as RemovedHistoryMap) : {}
  } catch {
    return {}
  }
}

function saveRemovedHistory(removed: RemovedHistoryMap, user?: UserInfo | null) {
  try {
    const currentUser = user !== undefined ? user : readCurrentUser()
    const key = removedHistoryKeyFor(currentUser)
    window.localStorage.setItem(key, JSON.stringify(removed))
  } catch {
    // ignore storage errors
  }
}

function recordMovieRemoved(movie: Movie, user?: UserInfo | null): RemovedHistoryMap {
  const current = readRemovedHistory(user)
  const now = Date.now()
  const next = { ...current }
  if (movie.id) next[movie.id] = now
  if (movie.tmdbId) next[`tmdb:${movie.tmdbType || 'movie'}:${movie.tmdbId}`] = now
  const titleNorm = normalizeMovieIdentity(movie.title)
  if (titleNorm) next[`title:${titleNorm}`] = now
  saveRemovedHistory(next, user)
  return next
}

function unmarkMovieRemoved(movie: Movie, user?: UserInfo | null) {
  const current = readRemovedHistory(user)
  const next = { ...current }
  let changed = false
  if (movie.id && next[movie.id]) {
    delete next[movie.id]
    changed = true
  }
  if (movie.tmdbId && next[`tmdb:${movie.tmdbType || 'movie'}:${movie.tmdbId}`]) {
    delete next[`tmdb:${movie.tmdbType || 'movie'}:${movie.tmdbId}`]
    changed = true
  }
  const titleNorm = normalizeMovieIdentity(movie.title)
  if (titleNorm && next[`title:${titleNorm}`]) {
    delete next[`title:${titleNorm}`]
    changed = true
  }
  if (changed) {
    saveRemovedHistory(next, user)
  }
}

function isMovieRemoved(movie: Movie, removed: RemovedHistoryMap, entryUpdatedAt = 0): boolean {
  const check = (k: string) => {
    const removedAt = removed[k]
    return typeof removedAt === 'number' && (entryUpdatedAt === 0 || removedAt >= entryUpdatedAt)
  }
  if (movie.id && check(movie.id)) return true
  if (movie.tmdbId && check(`tmdb:${movie.tmdbType || 'movie'}:${movie.tmdbId}`)) return true
  const titleNorm = normalizeMovieIdentity(movie.title)
  if (titleNorm && check(`title:${titleNorm}`)) return true
  return false
}

function readWatchHistory(): WatchHistory {
  try {
    const user = readCurrentUser()
    const key = user ? `${watchHistoryKey}.${user.name}` : watchHistoryKey
    const saved = window.localStorage.getItem(key)
    const history = saved ? (JSON.parse(saved) as WatchHistory) : {}
    const removed = readRemovedHistory(user)
    const cleaned: WatchHistory = {}
    for (const [k, entry] of Object.entries(history)) {
      if (entry?.movie && !isMovieRemoved(entry.movie, removed, entry.updatedAt)) {
        cleaned[k] = entry
      }
    }
    return cleaned
  } catch {
    return {}
  }
}

// Merge two watch-history maps, keeping the most-recently-updated entry per
// key, ignoring any entries tombstoned by user removal.
function mergeWatchHistory(a: WatchHistory, b: WatchHistory, removedMap?: RemovedHistoryMap): WatchHistory {
  const removed = removedMap ?? readRemovedHistory()
  const merged: WatchHistory = {}

  for (const [key, entry] of Object.entries(a)) {
    if (entry?.movie && !isMovieRemoved(entry.movie, removed, entry.updatedAt)) {
      merged[key] = entry
    }
  }

  for (const [key, entry] of Object.entries(b)) {
    if (!entry?.movie) continue
    if (isMovieRemoved(entry.movie, removed, entry.updatedAt)) continue
    const existing = merged[key]
    if (!existing || (entry.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
      merged[key] = entry
    }
  }
  return merged
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

function visibleMediaBadges(badges: string[] = []) {
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

      // Never hijack taps that land on interactive controls (Play, More Info,
      // Add, carousel dots, trailer buttons, search…). Calling
      // setPointerCapture on the hero would retarget their click event to the
      // hero container, so the buttons' own onClick never fires.
      const target = event.target as HTMLElement | null
      if (target?.closest('button, a, input, select, textarea, [role="button"]')) {
        swipeStartRef.current = null
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

function seasonsFor(movie: Movie) {
  if (movie.isHentaiOcean) {
    const total = movie.hentaiEpisodes?.length || movie.episodeCount || 1
    return [{ season: 1, episodeCount: total }]
  }

  if (movie.isAnime) {
    if (movie.animeSeasons && movie.animeSeasons.length > 0) {
      return movie.animeSeasons.map((s) => ({
        season: s.season,
        episodeCount: s.episodeCount,
        title: s.title,
        anilistId: s.anilistId,
      }))
    }
    const total = movie.episodeCount && movie.episodeCount > 0 ? movie.episodeCount : 12
    return [{ season: 1, episodeCount: total }]
  }

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

function episodeRuntime(movie: Movie, _season: number, _episode: number) {
  // Anime carry a real per-episode duration from AniList; use it directly.
  if (movie.isAnime && typeof movie.episodeRuntimeMinutes === 'number' && movie.episodeRuntimeMinutes > 0) {
    return `${movie.episodeRuntimeMinutes}m`
  }
  // Otherwise, only surface a real minutes value parsed from the title's
  // runtime. Never fabricate a time — an unknown runtime shows nothing rather
  // than a made-up number.
  const minutesMatch = movie.runtime.match(/(\d+)\s*min/i)
  if (minutesMatch) {
    return `${Number(minutesMatch[1])}m`
  }
  return ''
}

function episodeTitle(_season: number, episode: number) {
  // No real episode title available — use a neutral, honest label rather than a
  // fabricated name that looks like a real episode title.
  return `Episode ${episode}`
}

function formatAnimeEpisodeTitle(number: number, rawTitle?: string): string {
  if (!rawTitle) return `Episode ${number}`
  const trimmed = rawTitle.trim()
  if (!trimmed) return `Episode ${number}`

  // If rawTitle already starts with "Episode X" or "Episode 0X" or "Ep X" or "Ep. X"
  const epRegex = new RegExp(`^ep(isode)?\\.?\\s*0*${number}\\b`, 'i')
  if (epRegex.test(trimmed)) {
    return trimmed
  }

  // If rawTitle starts with number like "1 - Falling" or "01 - Falling" or "1: Falling"
  const numRegex = new RegExp(`^0*${number}\\s*[:\\-.]\\s*`, 'i')
  if (numRegex.test(trimmed)) {
    const cleaned = trimmed.replace(numRegex, '').trim()
    return cleaned ? `Episode ${number} - ${cleaned}` : `Episode ${number}`
  }

  return `Episode ${number} - ${trimmed}`
}

function getAnimeEpisodeDuration(movie: Movie, episodeNumber: number, rawEpDuration?: string): string {
  if (rawEpDuration && /^\d+:\d{2}$/.test(rawEpDuration.trim())) {
    return rawEpDuration.trim()
  }

  let baseMins = 24
  if (typeof movie.episodeRuntimeMinutes === 'number' && movie.episodeRuntimeMinutes > 0) {
    baseMins = movie.episodeRuntimeMinutes
  } else if (movie.runtime) {
    const match = movie.runtime.match(/(\d+)\s*min/i)
    if (match) {
      baseMins = parseInt(match[1], 10)
    }
  }

  const seed = (movie.id || 'anime').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const offset = ((episodeNumber * 19 + seed * 7) % 45) - 25
  const totalSeconds = Math.max(60, baseMins * 60 + offset)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60

  return `${m}:${s < 10 ? '0' : ''}${s}`
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
  Lumen: ['movie', 'series', 'drama', 'adventure'],
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
  if (movie.isJav || movie.id.startsWith('jav-') || movie.id.startsWith('phub-') || movie.label === 'PHub' || movie.label === 'JAV') {
    return false
  }

  if (movie.isHentaiOcean) {
    return (
      (movie.hentaiEpisodes?.length ?? 0) > 1 ||
      (movie.episodeCount ?? 0) > 1 ||
      movie.type.toLowerCase() === 'series'
    )
  }

  if (movie.isAnime) {
    const fmt = (movie.animeFormat ?? '').toUpperCase()

    // Anime films (and music videos) behave like movies: no season/episode list.
    if (fmt === 'MOVIE' || fmt === 'MUSIC') {
      return false
    }

    // A single-episode entry (e.g. a one-shot special) is movie-like too.
    if ((movie.episodeCount ?? 0) === 1) {
      return false
    }

    // Everything else (TV, ONA, OVA, multi-episode specials) is a series.
    return true
  }

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

function mapAniListToMovieStandalone(anime: any, rank = 1): Movie {
  const title = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Unknown Anime'
  const year = anime.seasonYear ? String(anime.seasonYear) : 'N/A'
  const banner = anime.bannerImage || anime.coverImage?.large || ''
  const poster = anime.coverImage?.large || anime.coverImage?.medium || ''
  const animeFormat = (anime.format || '').toUpperCase()
  const isAnimeFilm = animeFormat === 'MOVIE' || animeFormat === 'MUSIC'
  // AniList reports `episodes: null` while a series is still airing; in that
  // case the already-aired count is nextAiringEpisode.episode - 1. Fall back to
  // the total when finished.
  const airedSoFar =
    typeof anime.nextAiringEpisode?.episode === 'number'
      ? Math.max(0, anime.nextAiringEpisode.episode - 1)
      : 0
  const episodeCount = Number(anime.episodes) || airedSoFar || 0
  const trailerYoutubeId =
    anime.trailer && (anime.trailer.site === 'youtube' || anime.trailer.site === 'YouTube')
      ? anime.trailer.id
      : undefined
  const runtime = isAnimeFilm
    ? 'Movie'
    : `${episodeCount || '?'} Episode${episodeCount === 1 ? '' : 's'}`

  // Per-episode artwork/titles from AniList (present on the details response).
  // Keep every entry in episode order (do NOT filter out ones missing a
  // thumbnail) so that `animeEpisodes[episode - 1]` stays aligned to the real
  // episode number. Filtering shifted the array and made episodes show the
  // wrong (or the show's main) poster.
  const animeEpisodes = Array.isArray(anime.streamingEpisodes)
    ? anime.streamingEpisodes.map((entry: any) => ({
        title: String(entry?.title ?? '').trim(),
        thumbnail: String(entry?.thumbnail ?? ''),
      }))
    : undefined

  const nextEpisode =
    typeof anime.nextAiringEpisode?.episode === 'number'
      ? {
          number: anime.nextAiringEpisode.episode as number,
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

function getDailySeed(): number {
  const now = new Date()
  return now.getFullYear() * 1000 + (now.getMonth() + 1) * 31 + now.getDate()
}

function rotateByDailySeed<T>(items: T[], seedOffset = 0): T[] {
  if (!items || items.length === 0) return items
  const seed = getDailySeed() + seedOffset
  const shift = Math.abs(seed) % items.length
  return [...items.slice(shift), ...items.slice(0, shift)]
}

async function fetchAniListHomeCollection(): Promise<MediaCollection> {
  try {
    const page = (getDailySeed() % 3) + 1
    const [trending, action, fantasy, comedy] = await Promise.all([
      fetchAnimeByOptions({ sort: ['TRENDING_DESC', 'POPULARITY_DESC'], perPage: 15, page }),
      fetchAnimeByOptions({ genre: 'Action', sort: ['POPULARITY_DESC'], perPage: 15, page }),
      fetchAnimeByOptions({ genre: 'Fantasy', sort: ['POPULARITY_DESC'], perPage: 15, page }),
      fetchAnimeByOptions({ genre: 'Comedy', sort: ['POPULARITY_DESC'], perPage: 15, page }),
    ])

    const mapList = (list: any[], seedOffset = 0) =>
      rotateByDailySeed(
        list.map((item, i) => mapAniListToMovieStandalone(item, i + 1)),
        seedOffset,
      )

    return {
      top: mapList(trending, 0),
      thrilling: mapList(action, 1),
      adventure: mapList(fantasy, 2),
      kidsFamily: mapList(comedy, 3),
    }
  } catch (e) {
    console.error('Failed to fetch anime collection from AniList', e)
    return fetchAnimeCollection()
  }
}

type AnimeHomeExtras = {
  movieCollection: MediaCollection
  tvCollection: MediaCollection
  newReleases: Movie[]
  trending: Movie[]
}

const emptyAnimeExtras: AnimeHomeExtras = {
  movieCollection: emptyMediaCollection,
  tvCollection: emptyMediaCollection,
  newReleases: [],
  trending: [],
}

// Fetches many AniList category lists and de-duplicates globally so that each
// home rail shows a genuinely different set of anime (popular titles otherwise
// appear across many genres). Earlier rails get first pick of the titles.
async function fetchAnimeRails(): Promise<AnimeHomeExtras> {
  try {
    const seed = getDailySeed()
    const page1 = (seed % 4) + 1
    const page2 = ((seed + 1) % 4) + 1

    const [
      trending,
      action,
      fantasy,
      comedy,
      supernatural,
      romance,
      adventure,
      sliceOfLife,
      newest,
      topRated,
    ] = await Promise.all([
      fetchAnimeByOptions({ sort: ['TRENDING_DESC', 'POPULARITY_DESC'], perPage: 25, page: page1 }),
      fetchAnimeByOptions({ genre: 'Action', sort: ['POPULARITY_DESC'], perPage: 25, page: page1 }),
      fetchAnimeByOptions({ genre: 'Fantasy', sort: ['POPULARITY_DESC'], perPage: 25, page: page2 }),
      fetchAnimeByOptions({ genre: 'Comedy', sort: ['POPULARITY_DESC'], perPage: 25, page: page1 }),
      fetchAnimeByOptions({ genre: 'Supernatural', sort: ['POPULARITY_DESC'], perPage: 25, page: page2 }),
      fetchAnimeByOptions({ genre: 'Romance', sort: ['POPULARITY_DESC'], perPage: 25, page: page1 }),
      fetchAnimeByOptions({ genre: 'Adventure', sort: ['POPULARITY_DESC'], perPage: 25, page: page2 }),
      fetchAnimeByOptions({ genre: 'Slice of Life', sort: ['POPULARITY_DESC'], perPage: 25, page: page1 }),
      fetchAnimeByOptions({ sort: ['START_DATE_DESC', 'POPULARITY_DESC'], perPage: 25, page: page1 }),
      fetchAnimeByOptions({ sort: ['SCORE_DESC'], perPage: 25, page: page2 }),
    ])

    const used = new Set<number>()
    const take = (list: any[], limit = 14, seedOffset = 0): Movie[] => {
      const out: Movie[] = []
      for (const item of list) {
        if (!item || used.has(item.id)) {
          continue
        }
        used.add(item.id)
        out.push(mapAniListToMovieStandalone(item, out.length + 1))
        if (out.length >= limit) {
          break
        }
      }
      return rotateByDailySeed(out, seedOffset)
    }

    // Order defines priority — a title claimed by an earlier rail is skipped later.
    const top = take(trending, 14, 0)
    const actionList = take(action, 14, 1)
    const fantasyList = take(fantasy, 14, 2)
    const comedyList = take(comedy, 14, 3)
    const supernaturalList = take(supernatural, 14, 4)
    const romanceList = take(romance, 14, 5)
    const adventureList = take(adventure, 14, 6)
    const sliceList = take(sliceOfLife, 14, 7)
    const newestList = take(newest, 14, 8)
    const topRatedList = take(topRated, 14, 9)

    return {
      movieCollection: {
        top,
        thrilling: actionList,
        adventure: fantasyList,
        kidsFamily: comedyList,
      },
      tvCollection: {
        top: supernaturalList,
        thrilling: romanceList,
        adventure: adventureList,
        kidsFamily: sliceList,
      },
      newReleases: newestList,
      trending: topRatedList,
    }
  } catch (e) {
    console.error('Failed to fetch anime rails from AniList', e)
    return emptyAnimeExtras
  }
}



// Pull-to-refresh for the WebView / mobile web app. Native browser pull-to-
// refresh is disabled inside the Expo WebView, so we replicate it: when the
// scroll container is already at the top and the user drags down past a
// threshold, we reload the app.
function PullToRefresh({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const [distance, setDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const gesture = useRef({
    startY: null as number | null,
    dist: 0,
    active: false,
    scroller: null as HTMLElement | null,
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }

    const THRESHOLD = 72
    const MAX = 120

    const defaultScrollTop = () =>
      el.scrollHeight > el.clientHeight + 1
        ? el.scrollTop
        : window.scrollY || document.documentElement.scrollTop || 0

    // Find the actual scroll container under the touch. Screens like Account,
    // Manga and Live TV render as their own `position: fixed` scrollers nested
    // inside the app shell, so we must measure *their* scrollTop — not the
    // shell's (which always reads 0 while an overlay is open). Otherwise we'd
    // wrongly think we're at the top and hijack their downward touch scrolling.
    const findScroller = (target: EventTarget | null): HTMLElement | null => {
      let node = target instanceof HTMLElement ? target : null
      while (node && node !== el) {
        const overflowY = getComputedStyle(node).overflowY
        if (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          node.scrollHeight > node.clientHeight + 1
        ) {
          return node
        }
        node = node.parentElement
      }
      return null
    }

    const scrollTopOf = (scroller: HTMLElement | null) =>
      scroller ? scroller.scrollTop : defaultScrollTop()

    const onStart = (event: TouchEvent) => {
      const scroller = findScroller(event.target)
      if (refreshing || event.touches.length !== 1 || scrollTopOf(scroller) > 0) {
        gesture.current.startY = null
        return
      }
      gesture.current.scroller = scroller
      gesture.current.startY = event.touches[0].clientY
      gesture.current.active = false
    }

    const onMove = (event: TouchEvent) => {
      const state = gesture.current
      if (state.startY === null || refreshing) {
        return
      }
      const dy = event.touches[0].clientY - state.startY
      // Cancel if the user scrolls up or the container is no longer at the top.
      if (dy <= 0 || scrollTopOf(state.scroller) > 0) {
        if (state.active) {
          state.active = false
          state.dist = 0
          setDistance(0)
        }
        state.startY = event.touches[0].clientY
        return
      }
      state.active = true
      const pulled = Math.min(MAX, dy * 0.5)
      state.dist = pulled
      setDistance(pulled)
      // Prevent the native rubber-band scroll while we own the gesture.
      event.preventDefault()
    }

    const finish = () => {
      const state = gesture.current
      if (state.startY === null) {
        return
      }
      const trigger = state.active && state.dist >= THRESHOLD
      state.startY = null
      state.active = false
      state.dist = 0
      setDistance(0)
      if (trigger) {
        setRefreshing(true)
        window.setTimeout(() => window.location.reload(), 450)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', finish, { passive: true })
    el.addEventListener('touchcancel', finish, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', finish)
      el.removeEventListener('touchcancel', finish)
    }
  }, [containerRef, refreshing])

  const visible = distance > 0 || refreshing
  const offset = refreshing ? 16 : Math.round(distance) - 44
  const rotation = Math.min(360, (distance / 72) * 360)

  return (
    <div
      className={`pull-refresh${visible ? ' visible' : ''}${refreshing ? ' refreshing' : ''}`}
      style={{ transform: `translateX(-50%) translateY(${offset}px)` }}
      aria-hidden={!visible}
    >
      <span
        className="pull-refresh-spinner"
        style={refreshing ? undefined : { transform: `rotate(${rotation}deg)` }}
      >
        <RefreshCcw size={22} />
      </span>
    </div>
  )
}

function App() {
  const appShellRef = useRef<HTMLElement | null>(null)
  // Show splash only on cold start (new session) or after login.
  // sessionStorage persists across page refresh but clears when the
  // app/tab is closed, matching Netflix's behaviour.
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return !window.sessionStorage.getItem('lumen.splash-done')
    } catch {
      return true
    }
  })

  const [screen, setScreenState] = useState<Screen>(() => {
    const savedUser = readCurrentUser()
    if (!savedUser) {
      return 'login'
    }
    return 'profiles'
  })
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(readCurrentUser)
  const [loginBackScreen, setLoginBackScreen] = useState<Screen>('home')
  const [tempUser, setTempUser] = useState<UserInfo | null>(readCurrentUser)
  const [profiles, setProfiles] = useState<UserProfile[]>(() =>
    readProfilesFor(readCurrentUser()),
  )
  const [designMode, setDesignMode] = useState<'apple' | 'netflix'>(() => {
    return (window.localStorage.getItem('omdb.apple-tv-style.designMode') as 'apple' | 'netflix') || 'apple'
  })

  const toggleDesignMode = () => {
    const nextMode = designMode === 'apple' ? 'netflix' : 'apple'
    setDesignMode(nextMode)
    window.localStorage.setItem('omdb.apple-tv-style.designMode', nextMode)
    // Clear the shared hero pick so each mode starts on its own default hero
    // instead of briefly showing the other mode's carried-over hero/rails.
    setHomeHeroMovie(null)
    setDramaHeroMovie(null)
    // Keep the Lumen (apple) and Anime (netflix) searches independent — don't
    // carry one mode's query/results into the other.
    setSearchQuery('')
    setSearchResults([])
    setSearchError('')
  }

  const handleAddProfile = (name: string, avatarColor: string) => {
    const newProfile: UserProfile = {
      name: name,
      avatarColor: avatarColor,
    }
    const updated = [...profiles, newProfile]
    setProfiles(updated)
    const account = currentUser ?? tempUser
    window.localStorage.setItem(profilesKeyFor(account), JSON.stringify(updated))
    if (account?.email) {
      void saveRemoteProfiles(account.email, updated)
    }
  }

  const handleEditProfile = (oldName: string, newName: string, avatarColor: string) => {
    const updated = profiles.map((p) => {
      if (p.name === oldName) {
        return { name: newName, avatarColor }
      }
      return p
    })
    setProfiles(updated)
    const editAccount = currentUser ?? tempUser
    window.localStorage.setItem(profilesKeyFor(editAccount), JSON.stringify(updated))
    if (editAccount?.email) {
      void saveRemoteProfiles(editAccount.email, updated)
    }

    if (oldName !== newName) {
      const oldSaved = window.localStorage.getItem(`${savedMoviesKey}.${oldName}`)
      if (oldSaved) {
        window.localStorage.setItem(`${savedMoviesKey}.${newName}`, oldSaved)
        window.localStorage.removeItem(`${savedMoviesKey}.${oldName}`)
      }
      const oldLiked = window.localStorage.getItem(`${likedMoviesKey}.${oldName}`)
      if (oldLiked) {
        window.localStorage.setItem(`${likedMoviesKey}.${newName}`, oldLiked)
        window.localStorage.removeItem(`${likedMoviesKey}.${oldName}`)
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
    const delAccount = currentUser ?? tempUser
    window.localStorage.setItem(profilesKeyFor(delAccount), JSON.stringify(updated))
    if (delAccount?.email) {
      void saveRemoteProfiles(delAccount.email, updated)
    }

    window.localStorage.removeItem(`${savedMoviesKey}.${name}`)
    window.localStorage.removeItem(`${likedMoviesKey}.${name}`)
    window.localStorage.removeItem(`${watchHistoryKey}.${name}`)

    if (currentUser && currentUser.name === name) {
      setCurrentUser(null)
      setScreenState('login')
    }
  }

  // Load the active account's own profile list whenever the login changes, so
  // each of the separate logins always sees its own profiles.
  useEffect(() => {
    setProfiles(readProfilesFor(currentUser ?? tempUser))
  }, [currentUser, tempUser])

  // Pull the account's profiles from the backend (Supabase) so they follow the
  // account across devices. Local storage is used as an offline cache; when the
  // backend returns a list it becomes the source of truth.
  useEffect(() => {
    const account = currentUser ?? tempUser
    const email = account?.email
    if (!email) {
      return
    }

    let active = true
    void fetchRemoteProfiles(email).then((remote) => {
      if (!active) {
        return
      }
      if (remote && remote.length > 0) {
        setProfiles(remote)
        try {
          window.localStorage.setItem(profilesKeyFor(account), JSON.stringify(remote))
        } catch {
          // ignore quota / serialization errors
        }
      } else {
        // The backend has no list yet (or the fetch failed). Only seed it from
        // THIS device if the device actually has a user-saved profile list.
        // Never push the synthetic default (just "Children") — otherwise a
        // fresh/second device would wipe the account's real profiles created
        // elsewhere.
        let hasSavedLocal = false
        try {
          hasSavedLocal = Boolean(window.localStorage.getItem(profilesKeyFor(account)))
        } catch {
          hasSavedLocal = false
        }
        if (hasSavedLocal) {
          const local = readProfilesFor(account)
          if (local && local.length > 0) {
            void saveRemoteProfiles(email, local)
          }
        }
      }
    })

    return () => {
      active = false
    }
  }, [currentUser, tempUser, screen])

  // Local fallback PIN (used only if the server verify is unreachable). The
  // authoritative check is server-side via verifyRemoteLordPin — the PIN is
  // never fetched to the client.
  const [lordPin] = useState<string>(getLordPin)
  const [showLordPin, setShowLordPin] = useState(false)

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
  const [animeExtras, setAnimeExtras] = useState<AnimeHomeExtras>(emptyAnimeExtras)
  // BFF "watch together" state.
  const [bffMovie, setBffMovie] = useState<Movie | null>(null)
  const [bffFriends, setBffFriends] = useState<string[]>([])
  const [bffStatus, setBffStatus] = useState('')
  const [incomingInvite, setIncomingInvite] = useState<WatchParty | null>(null)
  const [incomingInvites, setIncomingInvites] = useState<WatchParty[]>([])
  const [activeParty, setActiveParty] = useState<WatchParty | null>(null)
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false)
  const [remoteScreenSharing, setRemoteScreenSharing] = useState<boolean>(false)
  const [screenShareError, setScreenShareError] = useState<string>('')
  const [latestFrameUrl, setLatestFrameUrl] = useState<string | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const frameLoopRef = useRef<number | null>(null)

  const [kcDramas, setKcDramas] = useState<Movie[]>([])
  const [dramaRails, setDramaRails] = useState<DramaRails>({
    kDrama: [],
    cDrama: [],
    newReleases: [],
    romCom: [],
  })
  const [tmdbHomeRails, setTmdbHomeRails] =
    useState<TmdbHomeRails>(() => initialCache?.tmdbHomeRails ?? emptyTmdbHomeRails)
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(
    () => readSelectedMovie() ?? initialCache?.homeHeroMovie ?? null,
  )
  const [homeHeroMovie, setHomeHeroMovie] = useState<Movie | null>(() => initialCache?.homeHeroMovie ?? null)
  const [dramaHeroMovie, setDramaHeroMovie] = useState<Movie | null>(null)
  const [detailBackScreen, setDetailBackScreen] = useState<Screen>('home')
  const [savedMovies, setSavedMovies] = useState<SavedMovies>(readSavedMovies)
  const [likedMovies, setLikedMovies] = useState<SavedMovies>(readLikedMovies)
  const [watchHistory, setWatchHistory] =
    useState<WatchHistory>(readWatchHistory)
  const [homeLoading, setHomeLoading] = useState(() => !initialCache)
  const [homeError, setHomeError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  // Anime UI search filter: 'anime' pulls AniList results (played via AniList id),
  // 'drama' pulls TMDB results (played via TMDB id).
  const [searchMode, setSearchMode] = useState<'anime' | 'drama'>('anime')
  const [searchResults, setSearchResults] = useState<Movie[]>([])
  const [searchRecommendations, setSearchRecommendations] = useState<Movie[]>(() => initialCache?.searchRecommendations ?? [])
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
  const [aniListToken, setAniListToken] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUser) {
      setAniListToken(null)
      return
    }
    const token = window.localStorage.getItem(`omdb.apple-tv-style.anilistToken.${currentUser.name}`)
    setAniListToken(token)
  }, [currentUser])

  const featuredMovie = homeHeroMovie ?? movies[0] ?? null
  const featuredTvShow = tvShows[0] ?? null
  // Anime hero: use the rotating hero pick when it's one of the anime titles,
  // otherwise fall back to the first anime so the carousel can advance.
  const animeHeroMovie =
    (homeHeroMovie && anime.some((item) => item.id === homeHeroMovie.id)
      ? homeHeroMovie
      : anime[0]) ?? null
  const savedList = useMemo(() => Object.values(savedMovies), [savedMovies])
  const likedList = useMemo(() => Object.values(likedMovies), [likedMovies])
  const continueWatching = useMemo(
    () =>
      Object.values(watchHistory)
        .filter(
          (entry) =>
            entry.progress < 100 &&
            !entry.movie.isHentaiOcean &&
            !entry.movie.isJav &&
            !entry.movie.id.startsWith('jav-') &&
            entry.movie.label !== 'JAV' &&
            !entry.movie.genres.some((g) => g.toLowerCase() === 'hentai'),
        )
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 12)
        .map((entry, index) => ({
          ...entry.movie,
          rank: index + 1,
          progress: entry.progress,
        })),
    [watchHistory],
  )
  const continueWatchingLumen = useMemo(
    () => continueWatching.filter((m) => !m.isAnime),
    [continueWatching],
  )
  const continueWatchingAnime = useMemo(
    () => continueWatching.filter((m) => m.isAnime || m.genres.some((g) => g.toLowerCase().includes('anime'))),
    [continueWatching],
  )
  const continueWatchingDrama = useMemo(
    () =>
      continueWatching.filter(
        (m) =>
          !m.isAnime &&
          m.genres.some((g) => g.toLowerCase() === 'drama'),
      ),
    [continueWatching],
  )
  const continueWatchingLord = useMemo(
    () =>
      Object.values(watchHistory)
        .filter(
          (entry) =>
            entry.progress < 100 &&
            !entry.movie.id.startsWith('phub-') &&
            entry.movie.label !== 'PHub' &&
            !entry.movie.hentaiSlug?.startsWith('phub-') &&
            !entry.movie.id.startsWith('jav-') &&
            entry.movie.label !== 'JAV' &&
            !entry.movie.isJav &&
            !entry.movie.hentaiSlug?.startsWith('jav-') &&
            (entry.movie.isHentaiOcean ||
              entry.movie.genres.some((g) => g.toLowerCase() === 'hentai')),
        )
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
  const dramaList = useMemo(() => {
    // Korean/Chinese series (from TMDB) lead, followed by any local drama titles.
    // Anime is intentionally excluded here — otherwise, when the TMDB drama feed
    // is empty, the Drama tab ends up showing anime (many anime carry a "Drama"
    // genre tag), which makes it look like it navigated to the anime screen.
    const localDramas = [...movies, ...tvShows].filter(
      (m) => !m.isAnime && m.genres.some((g) => g.toLowerCase() === 'drama'),
    )
    const all = [...kcDramas, ...localDramas]
    const seen = new Set<string>()
    return all.filter((m) => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })
  }, [movies, tvShows, kcDramas])

  const dramaCollection = useMemo<MediaCollection>(() => {
    const top = dramaList.slice(0, 10)
    const thrilling = dramaList
      .filter((m) =>
        m.genres.some((g) =>
          ['crime', 'thriller', 'mystery', 'horror'].includes(g.toLowerCase()),
        ),
      )
      .slice(0, 10)
    const adventure = dramaList
      .filter((m) =>
        m.genres.some((g) =>
          ['adventure', 'action', 'sci-fi', 'fantasy'].includes(g.toLowerCase()),
        ),
      )
      .slice(0, 10)
    const kidsFamily = dramaList
      .filter(
        (m) =>
          !thrilling.some((t) => t.id === m.id) &&
          !adventure.some((a) => a.id === m.id),
      )
      .slice(0, 10)

    return {
      top: top.length > 0 ? top : dramaList.slice(0, 5),
      thrilling: thrilling.length > 0 ? thrilling : dramaList.slice(2, 7),
      adventure: adventure.length > 0 ? adventure : dramaList.slice(4, 9),
      kidsFamily: kidsFamily.length > 0 ? kidsFamily : dramaList.slice(1, 6),
    }
  }, [dramaList])

  // Distinct drama rails from TMDB: K-Drama / C-Drama / New Releases / Rom-Com.
  // The "movies" collection top = K-Drama, "tv" collection top = C-Drama, so the
  // two Top rails don't repeat; new releases + rom-com fill the other two rails.
  const dramaMovieCollection = useMemo<MediaCollection>(
    () => ({
      top: dramaRails.kDrama.length ? dramaRails.kDrama : dramaCollection.top,
      thrilling: dramaRails.romCom.length ? dramaRails.romCom : dramaCollection.thrilling,
      adventure: dramaRails.newReleases.length ? dramaRails.newReleases : dramaCollection.adventure,
      kidsFamily: dramaRails.cDrama.length ? dramaRails.cDrama : dramaCollection.kidsFamily,
    }),
    [dramaRails, dramaCollection],
  )

  const dramaTvCollection = useMemo<MediaCollection>(
    () => ({
      top: dramaRails.cDrama.length ? dramaRails.cDrama : dramaCollection.top,
      thrilling: dramaRails.romCom.length ? dramaRails.romCom : dramaCollection.thrilling,
      adventure: dramaRails.newReleases.length ? dramaRails.newReleases : dramaCollection.adventure,
      kidsFamily: dramaRails.kDrama.length ? dramaRails.kDrama : dramaCollection.kidsFamily,
    }),
    [dramaRails, dramaCollection],
  )

  const featuredDramaMovie = useMemo(() => {
    return (
      dramaHeroMovie ||
      dramaRails.kDrama[0] ||
      dramaRails.cDrama[0] ||
      dramaList[0] ||
      null
    )
  }, [dramaList, dramaHeroMovie, dramaRails])

  const [showSetLordPin, setShowSetLordPin] = useState(false)
  const [lordMovies, setLordMovies] = useState<Movie[]>([])
  const [lordRails, setLordRails] = useState<LordRail[]>([])
  const [lordLoading, setLordLoading] = useState(false)
  const [lordBackScreen, setLordBackScreen] = useState<Screen>('home')
  const [activeLordTab, setActiveLordTab] = useState<'collection' | 'phub' | 'jav'>('collection')

  const isHentaiSelectedMovie = Boolean(
    selectedMovie &&
      (selectedMovie.isHentaiOcean ||
        selectedMovie.hentaiSlug ||
        selectedMovie.id.startsWith('hentaiocean-') ||
        selectedMovie.genres.some((g) => g.toLowerCase() === 'hentai')),
  )

  useEffect(() => {
    if (
      (screen === 'lord' || isHentaiSelectedMovie) &&
      lordMovies.length === 0 &&
      !lordLoading
    ) {
      setLordLoading(true)
      void fetchMatureCollection()
        .then(({ movies, rails }) => {
          setLordMovies(movies || [])
          setLordRails(rails || [])
        })
        .finally(() => setLordLoading(false))
    }
  }, [screen, isHentaiSelectedMovie, lordMovies.length, lordLoading])

  const relatedMedia = isHentaiSelectedMovie
    ? lordMovies
    : selectedMovie?.isAnime
      ? anime
      : selectedMovie && isTvShow(selectedMovie)
        ? tvShows
        : movies
  const requiredMedia = screen === 'tv' ? tvShows : screen === 'anime' ? anime : movies
  const needsMovieBootstrap =
    screen === 'home' ||
    screen === 'movies' ||
    screen === 'tv' ||
    screen === 'anime' ||
    screen === 'detail' ||
    screen === 'watch'
  const activeTab: PrimaryTab =
    designMode === 'netflix'
      ? screen === 'home'
        ? 'Anime'
        : screen === 'drama'
          ? 'Drama'
          : screen === 'livetv'
            ? 'Live TV'
            : screen === 'manga'
              ? 'Manga'
              : screen === 'search'
                ? 'Search'
                : 'Anime'
      : screen === 'home'
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

  const switchToProfile = (profileName: string) => {
    const matchedProfile = profiles.find((p) => p.name === profileName)
    setCurrentUser({
      name: profileName,
      email: currentUser?.email ?? 'guest@apple-tv.com',
      avatarColor: matchedProfile?.avatarColor,
    })
  }

  const openManageProfiles = () => {
    setLoginBackScreen(screen)
    setTempUser(currentUser)
    setScreen('profiles')
  }

  // "Lord" hidden profile: tapping the menu item asks for a 4-digit PIN; a
  // correct PIN opens the mature (R-rated, non-explicit) collection screen.
  // (showLordPin is declared earlier, above the remote-PIN refresh effect.)

  const openLord = () => {
    setShowLordPin(true)
  }

  const unlockLord = () => {
    setShowLordPin(false)
    setLordBackScreen(screen)
    setScreen('lord')
    if (lordMovies.length === 0) {
      setLordLoading(true)
      void fetchMatureCollection()
        .then(({ movies, rails }) => {
          setLordMovies(movies)
          setLordRails(rails)
        })
        .finally(() => setLordLoading(false))
    }
  }

  const signOut = () => {
    setCurrentUser(null)
    try { window.sessionStorage.removeItem('lumen.splash-done') } catch { /* ignore */ }
    setScreen('login')
  }

  const openHelpCenter = () => {
    // Placeholder support contact — swap for your real help center URL.
    window.open('mailto:support@lumen.tv', '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    let active = true

    void fetchAnimeRails().then((extras) => {
      if (active) {
        setAnimeExtras(extras)
      }
    })

    void fetchKoreanChineseDramas().then((drama) => {
      if (active) {
        setKcDramas(drama.list)
        setDramaRails(drama.rails)
      }
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadMovies() {
      if (!initialCache) {
        setHomeLoading(true)
      }
      setHomeError('')

      try {
        const [nextTmdbHomeRails, nextAnimeCollection, recAnime] = await Promise.all([
          fetchTmdbHomeRails(),
          fetchAniListHomeCollection(),
          fetchAnimeListByIds([21, 1535, 110277, 101922, 16498, 113415, 101280]).catch(() => [])
        ])

        const nextRecommendations = recAnime.map((item, i) => mapAniListToMovieStandalone(item, i + 1))

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
          setSearchRecommendations(nextRecommendations)
          
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
                searchRecommendations: nextRecommendations,
              })
            )
          } catch (err) {
            console.error('Failed to write home cache', err)
          }
          return
        }

        const [nextMovieCollection, nextTvShowCollection, fallbackAnimeCollection, fallbackRecAnime] = await Promise.all([
          fetchMovieCollection(),
          fetchTvShowCollection(),
          fetchAniListHomeCollection(),
          fetchAnimeListByIds([21, 1535, 110277, 101922, 16498, 113415, 101280]).catch(() => [])
        ])
        const nextMovies = nextMovieCollection.top
        const nextTvShows = nextTvShowCollection.top
        const nextAnime = fallbackAnimeCollection.top
        const fallbackRecommendations = fallbackRecAnime.map((item, i) => mapAniListToMovieStandalone(item, i + 1))

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
        setSearchRecommendations(fallbackRecommendations)
        
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
              searchRecommendations: fallbackRecommendations,
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

  // Tracks which profile's data is currently loaded into state. Used to stop
  // the persistence effects from writing the previous profile's watchlist /
  // history into the newly selected profile during a profile switch (which
  // otherwise "bleeds" one profile's activity into every profile).
  const loadedProfileRef = useRef<string | null>(currentUser?.name ?? null)

  useEffect(() => {
    if ((currentUser?.name ?? null) !== loadedProfileRef.current) {
      // A profile switch is in progress; the loader effect below will replace
      // savedMovies with the correct profile's data — don't persist yet.
      return
    }
    if (currentUser) {
      window.localStorage.setItem(`${savedMoviesKey}.${currentUser.name}`, JSON.stringify(savedMovies))
    } else {
      window.localStorage.setItem(savedMoviesKey, JSON.stringify(savedMovies))
    }
  }, [savedMovies, currentUser])

  useEffect(() => {
    if ((currentUser?.name ?? null) !== loadedProfileRef.current) {
      // Profile switch in progress; the loader effect replaces likedMovies.
      return
    }
    if (currentUser) {
      window.localStorage.setItem(`${likedMoviesKey}.${currentUser.name}`, JSON.stringify(likedMovies))
    } else {
      window.localStorage.setItem(likedMoviesKey, JSON.stringify(likedMovies))
    }
  }, [likedMovies, currentUser])

  useEffect(() => {
    if ((currentUser?.name ?? null) !== loadedProfileRef.current) {
      return
    }
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

      const likedStr = window.localStorage.getItem(`${likedMoviesKey}.${currentUser.name}`)
      setLikedMovies(likedStr ? JSON.parse(likedStr) : {})

      const historyStr = window.localStorage.getItem(`${watchHistoryKey}.${currentUser.name}`)
      setWatchHistory(historyStr ? JSON.parse(historyStr) : {})
    } else {
      window.localStorage.removeItem(currentUserKey)
      setSavedMovies({})
      setLikedMovies({})
      setWatchHistory({})
    }
    // Mark this profile as the one now loaded so the persistence effects above
    // are allowed to write its data.
    loadedProfileRef.current = currentUser?.name ?? null
  }, [currentUser])

  // Cross-device "Continue Watching" sync. Keyed by account email + profile so
  // the same person sees the same history on every device they sign in on.
  const watchHistorySyncKey = currentUser?.email
    ? `${currentUser.email.toLowerCase()}::${currentUser.name}`
    : ''

  // Pull the remote history when the active account/profile changes and merge
  // it into the local cache (newest entry per title wins).
  useEffect(() => {
    if (!watchHistorySyncKey) {
      return
    }
    let cancelled = false
    const profileAtFetch = currentUser?.name ?? null
    void (async () => {
      const remote = await fetchRemoteWatchHistory(watchHistorySyncKey)
      if (cancelled || !remote || loadedProfileRef.current !== profileAtFetch) {
        return
      }
      setWatchHistory((local) => mergeWatchHistory(local, remote as WatchHistory))
    })()
    return () => {
      cancelled = true
    }
  }, [watchHistorySyncKey])

  // Debounced push of local history changes back to the server.
  useEffect(() => {
    if (!watchHistorySyncKey || loadedProfileRef.current !== (currentUser?.name ?? null)) {
      return
    }
    const handle = window.setTimeout(() => {
      void saveRemoteWatchHistory(watchHistorySyncKey, watchHistory)
    }, 1500)
    return () => {
      window.clearTimeout(handle)
    }
  }, [watchHistory, watchHistorySyncKey])

  // Record this real device as a signed-in session for the account, so the
  // "Manage Devices" screen reflects actual devices (not sample data). Runs
  // whenever the signed-in account changes.
  useEffect(() => {
    const email = currentUser?.email
    if (!email) {
      return
    }
    const current = buildCurrentDevice()
    void registerDeviceApi(email, {
      id: current.id,
      name: current.name,
      type: current.type,
      lastActive: current.lastActive,
    })
    writeCachedDevices(email, withCurrentDevice(readCachedDevices(email)))
  }, [currentUser])

  useEffect(() => {
    window.localStorage.setItem(streamProviderKey, streamProvider)
  }, [streamProvider])

  // Persist the currently open title so a page refresh on a detail/watch screen
  // restores that title instead of falling back to the cached home hero.
  useEffect(() => {
    try {
      if (selectedMovie) {
        window.sessionStorage.setItem(selectedMovieKey, JSON.stringify(selectedMovie))
      } else {
        window.sessionStorage.removeItem(selectedMovieKey)
      }
    } catch {
      // ignore storage quota / serialization errors
    }
  }, [selectedMovie])

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
    unmarkMovieRemoved(movie, currentUser)
    if (movie.isAnime && movie.anilistId && aniListToken) {
      const episode = movie.streamEpisode ?? 1
      const progressPercent = continueProgressFor(movie)
      const status = progressPercent >= 90 ? 'COMPLETED' : 'CURRENT'

      void syncAnimeProgressToAniList(
        aniListToken,
        movie.anilistId,
        episode,
        status
      ).catch((err) => {
        console.error('Failed to sync progress to AniList:', err)
      })
    }

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
  }, [aniListToken])

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
  // Movies we've already tried to resolve a TMDB stream id for — prevents an
  // infinite re-hydrate loop (which made the Watch button blink) when a title
  // has no TMDB match.
  const streamHydrateAttemptedRef = useRef<Set<string>>(new Set())

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
        let fullMovie: Movie
        if (movie.id.startsWith('anilist-') || movie.isAnime) {
          const rawId = movie.id.replace(/^anilist-/, '')
          const parsedId = /^\d+$/.test(rawId) ? parseInt(rawId, 10) : NaN
          const anilistId =
            movie.anilistId && !isNaN(movie.anilistId)
              ? movie.anilistId
              : !isNaN(parsedId)
                ? parsedId
                : undefined

          if (anilistId) {
            const animeData = await getAnimeDetails(anilistId)
            if (animeData) {
              fullMovie = mapAniListToMovieStandalone(animeData, movie.rank)
              fullMovie.isFull = true
            } else {
              fullMovie = { ...movie, isFull: true }
            }
          } else {
            fullMovie = { ...movie, isFull: true }
          }
        } else if (/^tt\d+/.test(movie.id)) {
          // Only real IMDb ids can be looked up on OMDb.
          fullMovie = await fetchMovieById(movie.id, movie.rank)
        } else {
          // TMDB-sourced titles (drama / TMDB search, id like `tmdb-tv-123`)
          // aren't on OMDb — they already carry full detail from their mapping,
          // so use them as-is instead of triggering an "Incorrect IMDb ID"
          // error.
          fullMovie = { ...movie, isFull: true }
        }

        // Prevent late/stale hydration from overwriting a newer selection.
        if (selectedMovieIdRef.current !== movie.id) {
          return fullMovie
        }

        setSelectedMovie((current) =>
          current?.id === fullMovie.id
            ? {
                ...fullMovie,
                anilistId: current.anilistId ?? movie.anilistId ?? fullMovie.anilistId,
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
        console.warn('hydrateMovie failed, using fallback:', error)
        const fallbackMovie = { ...movie, isFull: true }
        if (selectedMovieIdRef.current === movie.id) {
          setSelectedMovie((current) =>
            current?.id === movie.id ? { ...fallbackMovie, ...current } : fallbackMovie,
          )
        }
        return fallbackMovie
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
      if (movie.tmdbId || movie.isHentaiOcean || movie.isJav || movie.embedUrl || movie.isFull) {
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
          const isTitle = movie.id.startsWith('anilist-') || !movie.id.startsWith('tt')
          const queryParam = isTitle ? movie.title : movie.id
          // For anime, steer the TMDB match toward the right media type so an
          // anime film does not resolve to a same-named TV series (or vice versa).
          const mediaHint = movie.isAnime
            ? isTvShow(movie)
              ? 'tv'
              : 'movie'
            : undefined
          const match = await fetchTmdbMatch(queryParam, isTitle, mediaHint)
          const streamMovie: Movie = {
            ...movie,
            anilistId: movie.anilistId,
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
                    anilistId: current.anilistId ?? streamMovie.anilistId,
                    tmdbId: streamMovie.tmdbId,
                    tmdbType: streamMovie.tmdbType,
                    streamSeason: current.streamSeason ?? streamMovie.streamSeason,
                    streamEpisode: current.streamEpisode ?? streamMovie.streamEpisode,
                  }
                : streamMovie,
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

    if (
      movie.id.startsWith('jav-') ||
      movie.label === 'JAV' ||
      movie.isJav ||
      movie.hentaiSlug?.startsWith('jav-')
    ) {
      setActiveLordTab('jav')
    } else if (
      movie.id.startsWith('phub-') ||
      movie.label === 'PHub' ||
      movie.hentaiSlug?.startsWith('phub-')
    ) {
      setActiveLordTab('phub')
    }

    setSelectedMovie(movie)
    setScreen('detail')
    void hydrateMovie(movie)
  }

  const openWatch = (movie: Movie) => {
    if (screen !== 'detail' && screen !== 'watch') {
      setDetailBackScreen(screen)
    }

    if (
      movie.id.startsWith('jav-') ||
      movie.label === 'JAV' ||
      movie.isJav ||
      movie.hentaiSlug?.startsWith('jav-')
    ) {
      setActiveLordTab('jav')
    } else if (
      movie.id.startsWith('phub-') ||
      movie.label === 'PHub' ||
      movie.hentaiSlug?.startsWith('phub-')
    ) {
      setActiveLordTab('phub')
    }

    setSelectedMovie(movie)
    markContinueWatching(movie)
    setScreen('watch')
    setStreamError('')
    void hydrateMovie(movie).then(markContinueWatching)
    void hydrateStreamingMovie(movie)
  }

  // --- BFF "watch together" ---
  const openBff = (movie: Movie | null) => {
    if (!movie || !currentUser?.email) {
      return
    }
    setBffMovie(movie)
    setBffStatus('')
    setBffFriends([])
    void fetchFriends(currentUser.email).then(setBffFriends)
  }

  const startScreenShare = async () => {
    try {
      setScreenShareError('')
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setScreenShareError('Screen sharing is not supported by your browser.')
        return null
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
      setScreenShareStream(stream)
      setIsScreenSharing(true)

      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare()
        }
      }

      // Start real-time BroadcastChannel canvas frame stream engine with DOM-attached video element
      try {
        let procVideo = document.getElementById('lumen-host-share-proc') as HTMLVideoElement | null
        if (!procVideo) {
          procVideo = document.createElement('video')
          procVideo.id = 'lumen-host-share-proc'
          procVideo.style.position = 'fixed'
          procVideo.style.top = '-9999px'
          procVideo.style.left = '-9999px'
          procVideo.style.width = '640px'
          procVideo.style.height = '360px'
          procVideo.style.opacity = '0'
          procVideo.style.pointerEvents = 'none'
          procVideo.autoplay = true
          procVideo.muted = true
          procVideo.playsInline = true
          document.body.appendChild(procVideo)
        }
        procVideo.srcObject = stream
        void procVideo.play().catch(() => {})

        const procCanvas = document.createElement('canvas')
        procCanvas.width = 640
        procCanvas.height = 360
        const ctx = procCanvas.getContext('2d')

        if (frameLoopRef.current) {
          window.clearInterval(frameLoopRef.current)
        }

        const bcStream = new BroadcastChannel('lumen_live_canvas_stream')
        frameLoopRef.current = window.setInterval(() => {
          if (!stream.active) return
          if (ctx) {
            ctx.drawImage(procVideo, 0, 0, procCanvas.width, procCanvas.height)
            const frameUrl = procCanvas.toDataURL('image/jpeg', 0.55)
            bcStream.postMessage({ type: 'FRAME', frame: frameUrl, partyId: activeParty?.id })
          }
        }, 40)
      } catch (procErr) {
        console.warn('Canvas frame loop setup warning:', procErr)
      }

      if (activeParty && currentUser?.email) {
        void pushScreenShareState(activeParty.id, {
          active: true,
          sharing_user: currentUser.email,
        })

        try {
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close()
          }
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
          })
          peerConnectionRef.current = pc

          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream)
          })

          pc.onicecandidate = (event) => {
            if (event.candidate && activeParty?.id) {
              void pushPartySignal(activeParty.id, {
                type: 'candidate',
                candidate: event.candidate.toJSON(),
                sender: currentUser.email,
              })
            }
          }

          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          void pushPartySignal(activeParty.id, {
            type: 'offer',
            sdp: offer.sdp,
            sender: currentUser.email,
          })
        } catch (webrtcErr) {
          console.warn('WebRTC offer setup warning:', webrtcErr)
        }
      }

      try {
        const bc = new BroadcastChannel('lumen_watch_party_screenshare')
        bc.postMessage({
          type: 'SCREEN_SHARE_START',
          partyId: activeParty?.id,
          sharingUser: currentUser?.email,
        })
        bc.close()
      } catch {}

      return stream
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string }
      if (errorObj?.name !== 'NotAllowedError') {
        setScreenShareError(
          'Could not start screen sharing: ' + (errorObj?.message || String(err)),
        )
      }
      return null
    }
  }

  const stopScreenShare = () => {
    const procVideo = document.getElementById('lumen-host-share-proc') as HTMLVideoElement | null
    if (procVideo) {
      procVideo.pause()
      procVideo.srcObject = null
      procVideo.remove()
    }
    if (frameLoopRef.current) {
      window.clearInterval(frameLoopRef.current)
      frameLoopRef.current = null
    }
    setLatestFrameUrl(null)
    if (screenShareStream) {
      screenShareStream.getTracks().forEach((track) => track.stop())
      setScreenShareStream(null)
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    setIsScreenSharing(false)
    if (activeParty && currentUser?.email) {
      void pushScreenShareState(activeParty.id, {
        active: false,
        sharing_user: currentUser.email,
      })
    }
    try {
      const bc = new BroadcastChannel('lumen_watch_party_screenshare')
      bc.postMessage({ type: 'SCREEN_SHARE_STOP', partyId: activeParty?.id })
      bc.close()
    } catch {}
  }

  const inviteFriend = async (friendEmail: string) => {
    if (!bffMovie || !currentUser?.email) {
      return
    }
    setBffStatus(`Inviting ${friendEmail}…`)
    const party = await sendInvite(currentUser.email, friendEmail, bffMovie)
    if (party) {
      setActiveParty(party)
      setBffStatus(`Invite sent to ${friendEmail}. Opening movie & starting screen share…`)
      const movieToPlay = bffMovie
      window.setTimeout(() => {
        setBffMovie(null)
        openWatch(movieToPlay)
        void startScreenShare()
      }, 900)
    } else {
      setBffStatus('Could not send the invite (is the backend configured?).')
    }
  }

  const acceptInviteAndWatch = async (invite: WatchParty) => {
    await acceptInvite(invite.id)
    setActiveParty({ ...invite, status: 'accepted' })
    setIncomingInvite((current) => (current?.id === invite.id ? null : current))
    setIncomingInvites((current) => current.filter((entry) => entry.id !== invite.id))
    openWatch(invite.movie)
  }

  const dismissInvite = (invite: WatchParty) => {
    void endParty(invite.id)
    setIncomingInvite((current) => (current?.id === invite.id ? null : current))
    setIncomingInvites((current) => current.filter((entry) => entry.id !== invite.id))
  }

  const acceptIncomingInvite = async () => {
    if (!incomingInvite) {
      return
    }
    await acceptInviteAndWatch(incomingInvite)
  }

  // Poll for incoming watch-party invites while signed in.
  useEffect(() => {
    const email = currentUser?.email
    if (!email) {
      return
    }
    let active = true
    const check = () => {
      void fetchIncomingInvites(email).then((invites) => {
        if (!active) return
        const pendingList = invites.filter((invite) => invite.status === 'pending')
        setIncomingInvites(pendingList)
        const pending = pendingList[0]
        setIncomingInvite((current) => {
          // Don't resurface an invite the user is already hosting/answering.
          if (pending && activeParty && pending.id === activeParty.id) return current
          return pending ?? null
        })
      })
    }
    check()
    const timer = window.setInterval(check, 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [currentUser, activeParty])

  // Monitor active watch party live screen share state and WebRTC negotiation across participants.
  useEffect(() => {
    if (!activeParty) {
      setRemoteScreenSharing(false)
      setRemoteStream(null)
      setLatestFrameUrl(null)
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
      return
    }
    let active = true

    const handleOfferSignal = async (offerSdp: string) => {
      try {
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close()
        }
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        })
        peerConnectionRef.current = pc

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0])
            setRemoteScreenSharing(true)
          }
        }

        pc.onicecandidate = (event) => {
          if (event.candidate && activeParty?.id) {
            void pushPartySignal(activeParty.id, {
              type: 'candidate',
              candidate: event.candidate.toJSON(),
              sender: currentUser?.email,
            })
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        void pushPartySignal(activeParty.id, {
          type: 'answer',
          sdp: answer.sdp,
          sender: currentUser?.email,
        })
      } catch (err) {
        console.warn('Failed to handle WebRTC offer:', err)
      }
    }

    const checkPartyState = () => {
      void fetchParty(activeParty.id).then((party) => {
        if (!active || !party) return
        if (
          party.screen_share?.active &&
          party.screen_share.sharing_user !== currentUser?.email
        ) {
          setRemoteScreenSharing(true)
          if (party.signal?.type === 'offer' && party.signal.sdp && party.signal.sender !== currentUser?.email) {
            void handleOfferSignal(party.signal.sdp)
          }
        } else if (!party.screen_share?.active && !isScreenSharing) {
          setRemoteScreenSharing(false)
          setRemoteStream(null)
          setLatestFrameUrl(null)
        }

        if (
          party.signal?.type === 'answer' &&
          party.signal.sdp &&
          party.signal.sender !== currentUser?.email &&
          peerConnectionRef.current &&
          isScreenSharing
        ) {
          peerConnectionRef.current
            .setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: party.signal.sdp }))
            .catch(() => {})
        }
      })
    }
    checkPartyState()
    const timer = window.setInterval(checkPartyState, 2500)

    let bc: BroadcastChannel | null = null
    let bcFrames: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel('lumen_watch_party_screenshare')
      bc.onmessage = (event) => {
        if (
          event.data?.type === 'SCREEN_SHARE_START' &&
          event.data.sharingUser !== currentUser?.email
        ) {
          setRemoteScreenSharing(true)
        } else if (event.data?.type === 'SCREEN_SHARE_STOP' && !isScreenSharing) {
          setRemoteScreenSharing(false)
          setRemoteStream(null)
          setLatestFrameUrl(null)
        }
      }

      bcFrames = new BroadcastChannel('lumen_live_canvas_stream')
      bcFrames.onmessage = (event) => {
        if (event.data?.type === 'FRAME' && event.data.frame && currentUser?.email !== activeParty.host_email) {
          setLatestFrameUrl(event.data.frame)
          setRemoteScreenSharing(true)
        }
      }
    } catch {}

    return () => {
      active = false
      window.clearInterval(timer)
      if (bc) bc.close()
      if (bcFrames) bcFrames.close()
    }
  }, [activeParty, currentUser?.email, isScreenSharing])

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

  // Toggle a title's "liked" state. Liked titles drive the Watch Recommender's
  // personality-based personalization and are shared between the detail and
  // watch screens (they read/write the same per-profile store).
  const toggleLiked = (movie: Movie) => {
    setLikedMovies((current) => {
      const matchingKey = findMatchingMovieKey(
        current,
        movie,
        (likedMovie) => likedMovie,
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

  const removeContinueMovie = useCallback(
    (movie: Movie) => {
      recordMovieRemoved(movie, currentUser)
      setWatchHistory((current) => {
        const next = removeMatchingMovieRecords(current, movie, (entry) => entry.movie)
        if (watchHistorySyncKey) {
          void saveRemoteWatchHistory(watchHistorySyncKey, next)
        }
        return next
      })
    },
    [currentUser, watchHistorySyncKey],
  )

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

  const clearLordContinueWatching = useCallback(() => {
    setWatchHistory((current) => {
      const next = { ...current }
      let changed = false
      Object.entries(current).forEach(([key, entry]) => {
        if (
          entry.movie.isHentaiOcean ||
          entry.movie.genres.some((g) => g.toLowerCase() === 'hentai')
        ) {
          recordMovieRemoved(entry.movie, currentUser)
          delete next[key]
          changed = true
        }
      })
      if (changed && watchHistorySyncKey) {
        void saveRemoteWatchHistory(watchHistorySyncKey, next)
      }
      return changed ? next : current
    })
  }, [currentUser, watchHistorySyncKey])

  const mapAniListToMovie = useCallback((anime: any, rank = 1): Movie => {
    return mapAniListToMovieStandalone(anime, rank)
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchResults([])
    setSearchError('')
    setSearchQuery('')
  }, [])

  const performSearch = useCallback(async (query: string) => {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      return
    }

    setSearchLoading(true)
    setSearchError('')

    try {
      const localQuery = trimmedQuery.toLowerCase()
      const localResults = [...movies, ...tvShows, ...anime].filter((m) =>
        m.title.toLowerCase().includes(localQuery) ||
        m.genres.some((g) => g.toLowerCase().includes(localQuery))
      )
      const seen = new Set<string>()
      const uniqueLocalResults = localResults.filter((m) => {
        if (seen.has(m.id)) return false
        seen.add(m.id)
        return true
      })

      if (designMode === 'netflix') {
        if (searchMode === 'drama') {
          // Drama filter: TMDB titles (no AniList). These carry a tmdbId and no
          // anilistId, so they stream through the TMDB player.
          const [tmdbResults, movieResults] = await Promise.all([
            searchTmdb(trimmedQuery),
            searchMovies(trimmedQuery).catch(() => []),
          ])
          const nonAnimeLocal = uniqueLocalResults.filter((m) => !m.isAnime)
          const combined = [...nonAnimeLocal, ...tmdbResults, ...movieResults]
          const finalSeen = new Set<string>()
          const finalResults = combined.filter((m) => {
            if (finalSeen.has(m.id)) return false
            finalSeen.add(m.id)
            return true
          })

          setSearchResults(finalResults)

          if (finalResults.length === 0) {
            setSearchError('No results found. Try another title.')
          }
        } else {
          // Anime filter: AniList results (played via AniList id) + local anime.
          const animeData = await searchAnime(trimmedQuery).catch(() => ({ results: [] }))
          const mappedAnimeResults = animeData.results.map((anime: any, i: number) => mapAniListToMovie(anime, i + 1))

          const animeLocal = uniqueLocalResults.filter((m) => m.isAnime)
          const combined = [...animeLocal, ...mappedAnimeResults]
          const finalSeen = new Set<string>()
          const finalResults = combined.filter((m) => {
            if (finalSeen.has(m.id)) return false
            finalSeen.add(m.id)
            return true
          })

          setSearchResults(finalResults)

          if (finalResults.length === 0) {
            setSearchError('No results found. Try another title.')
          }
        }
      } else {
        const [tmdbResults, movieResults, animeData] = await Promise.all([
          searchTmdb(trimmedQuery),
          searchMovies(trimmedQuery).catch(() => []),
          searchAnime(trimmedQuery).catch(() => ({ results: [] })),
        ])

        const mappedAnimeResults = animeData.results.map((anime: any, i: number) => mapAniListToMovie(anime, i + 1))
        const combined = [...uniqueLocalResults, ...tmdbResults, ...mappedAnimeResults, ...movieResults]
        const finalSeen = new Set<string>()
        const finalResults = combined.filter((m) => {
          if (finalSeen.has(m.id)) return false
          finalSeen.add(m.id)
          return true
        })

        setSearchResults(finalResults)

        if (finalResults.length === 0) {
          setSearchError('No titles found. Try another title.')
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not search.'
      setSearchError(message)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [mapAniListToMovie, designMode, searchMode, movies, tvShows, anime])

  useEffect(() => {
    const onWatchOrDetail = screen === 'watch' || screen === 'detail'
    if (
      !onWatchOrDetail ||
      !selectedMovie ||
      selectedMovie.tmdbId ||
      streamLoading ||
      streamHydrateAttemptedRef.current.has(selectedMovie.id)
    ) {
      return
    }

    // On the detail screen, resolve the TMDB id ahead of playback only for
    // (non-anime) TV shows — this is what lets the real per-episode stills and
    // titles load (e.g. Breaking Bad opened from OMDb, which has no tmdbId yet).
    // Anime get their episodes from AniList, and movies don't need this until
    // the watch screen.
    if (
      screen === 'detail' &&
      (selectedMovie.isAnime ||
        !(selectedMovie.tmdbType === 'tv' || isTvShow(selectedMovie)))
    ) {
      return
    }

    const movieId = selectedMovie.id
    const timeout = window.setTimeout(() => {
      streamHydrateAttemptedRef.current.add(movieId)
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
      {showSplash && (
        <SplashScreen
          onFinish={() => {
            try { window.sessionStorage.setItem('lumen.splash-done', '1') } catch { /* ignore */ }
            setShowSplash(false)
          }}
        />
      )}
      <PullToRefresh containerRef={appShellRef} />
      {screen === 'home' && featuredMovie && (
        <HomeScreen
          screen={screen}
          featuredMovie={designMode === 'netflix' ? (animeHeroMovie ?? featuredMovie) : featuredMovie}
          movies={designMode === 'netflix' ? anime : movies}
          tvShows={designMode === 'netflix' ? anime : tvShows}
          movieCollection={designMode === 'netflix'
            ? (animeExtras.movieCollection.top.length ? animeExtras.movieCollection : animeCollection)
            : movieCollection}
          tvShowCollection={designMode === 'netflix'
            ? (animeExtras.tvCollection.top.length ? animeExtras.tvCollection : animeCollection)
            : tvShowCollection}
          tmdbHomeRails={designMode === 'netflix' ? {
            featuredMovies: anime.slice(0, 6),
            featuredTvShows: (animeExtras.tvCollection.top.length ? animeExtras.tvCollection.top : anime).slice(0, 6),
            movieCollection: animeExtras.movieCollection.top.length ? animeExtras.movieCollection : animeCollection,
            newReleases: animeExtras.newReleases.length ? animeExtras.newReleases : (animeCollection.top || []),
            trendingNow: animeExtras.trending.length ? animeExtras.trending : (animeCollection.adventure || []),
            tvShowCollection: animeExtras.tvCollection.top.length ? animeExtras.tvCollection : animeCollection,
          } : tmdbHomeRails}
          continueMovies={designMode === 'netflix' ? continueWatchingAnime : continueWatchingLumen}
          savedMovies={savedMovies}
          likedMovies={likedList}
          onOpenDetail={openDetail}
          onPlay={openWatch}
          onSave={toggleSaved}
          onSearch={() => setScreen('search')}
          onSelectHero={setHomeHeroMovie}
          invites={incomingInvites}
          onAcceptInvite={(invite) => void acceptInviteAndWatch(invite)}
          onDismissInvite={dismissInvite}
          onMarkWatched={markWatchedMovie}
          onRemoveContinue={removeContinueMovie}
          onRemoveWatchlist={removeWatchlistMovie}
          currentUser={currentUser}
          onProfile={openProfileOrLogin}
          onSelectProfile={switchToProfile}
          onManageProfiles={openManageProfiles}
          onTransferProfile={openLord}
          onAccount={openProfileOrLogin}
          onHelp={openHelpCenter}
          onSignOut={signOut}
          onSetLordPin={() => setShowSetLordPin(true)}
          profiles={profiles}
          designMode={designMode}
        />
      )}

      {screen === 'drama' && (featuredDramaMovie ?? dramaList[0] ?? movies.find((m) => !m.isAnime)) && (
        <HomeScreen
          screen={screen}
          featuredMovie={(featuredDramaMovie ?? dramaList[0] ?? movies.find((m) => !m.isAnime))!}
          movies={dramaList}
          tvShows={dramaList}
          movieCollection={dramaMovieCollection}
          tvShowCollection={dramaTvCollection}
          tmdbHomeRails={{
            featuredMovies: (dramaRails.kDrama.length ? dramaRails.kDrama : dramaList).slice(0, 6),
            featuredTvShows: (dramaRails.cDrama.length ? dramaRails.cDrama : dramaList).slice(0, 6),
            movieCollection: dramaMovieCollection,
            newReleases: dramaRails.newReleases.length ? dramaRails.newReleases : (dramaCollection.top || []),
            trendingNow: dramaRails.romCom.length ? dramaRails.romCom : (dramaCollection.adventure || []),
            tvShowCollection: dramaTvCollection,
          }}
          continueMovies={continueWatchingDrama}
          savedMovies={savedMovies}
          likedMovies={likedList}
          onOpenDetail={openDetail}
          onPlay={openWatch}
          onSave={toggleSaved}
          onSearch={() => setScreen('search')}
          onSelectHero={setDramaHeroMovie}
          invites={incomingInvites}
          onAcceptInvite={(invite) => void acceptInviteAndWatch(invite)}
          onDismissInvite={dismissInvite}
          onMarkWatched={markWatchedMovie}
          onRemoveContinue={removeContinueMovie}
          onRemoveWatchlist={removeWatchlistMovie}
          currentUser={currentUser}
          onProfile={openProfileOrLogin}
          onSelectProfile={switchToProfile}
          onManageProfiles={openManageProfiles}
          onTransferProfile={openLord}
          onAccount={openProfileOrLogin}
          onHelp={openHelpCenter}
          onSignOut={signOut}
          onSetLordPin={() => setShowSetLordPin(true)}
          profiles={profiles}
          designMode={designMode}
        />
      )}

      {screen === 'livetv' && (
        <LiveTvScreen
          onSearch={() => setScreen('search')}
          currentUser={currentUser}
          onProfile={openProfileOrLogin}
          profiles={profiles}
          onSelectProfile={switchToProfile}
          onManageProfiles={openManageProfiles}
          onTransferProfile={openLord}
          onAccount={openProfileOrLogin}
          onHelp={openHelpCenter}
          onSignOut={signOut}
          onSetLordPin={() => setShowSetLordPin(true)}
        />
      )}

      {screen === 'manga' && (
        <MangaScreen
          onBack={() => setScreen('home')}
          currentUser={currentUser}
          onProfile={openProfileOrLogin}
          profiles={profiles}
          onSelectProfile={switchToProfile}
          onManageProfiles={openManageProfiles}
          onTransferProfile={openLord}
          onAccount={openProfileOrLogin}
          onHelp={openHelpCenter}
          onSignOut={signOut}
          onSetLordPin={() => setShowSetLordPin(true)}
        />
      )}

      {(screen === 'movies' || screen === 'tv' || screen === 'anime') && (
        <BrowseScreen
          key={screen}
          mode={screen}
          movies={designMode === 'netflix' ? anime : (screen === 'anime' ? anime : screen === 'tv' ? tvShows : movies)}
          collection={designMode === 'netflix' ? animeCollection : (screen === 'anime' ? animeCollection : screen === 'tv' ? tvShowCollection : movieCollection)}
          featuredMovie={designMode === 'netflix' ? (anime[0] || featuredMovie) : (screen === 'anime' ? anime[0] : screen === 'tv' ? featuredTvShow ?? tvShows[0] : featuredMovie ?? movies[0])}
          savedMovies={savedMovies}
          likedMovies={likedList}
          invites={incomingInvites}
          onAcceptInvite={(invite) => void acceptInviteAndWatch(invite)}
          onDismissInvite={dismissInvite}
          onOpenDetail={openDetail}
          onPlay={openWatch}
          onSave={toggleSaved}
          currentUser={currentUser}
          onProfile={openProfileOrLogin}
          onSelectProfile={switchToProfile}
          onManageProfiles={openManageProfiles}
          onTransferProfile={openLord}
          onAccount={openProfileOrLogin}
          onHelp={openHelpCenter}
          onSignOut={signOut}
          onSetLordPin={() => setShowSetLordPin(true)}
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
          onPlayEpisode={(season, episode, seasonAnilistId) => {
            openWatch({
              ...selectedMovie,
              anilistId: seasonAnilistId ?? selectedMovie.anilistId,
              tmdbType: selectedMovie.tmdbType ?? 'tv',
              streamSeason: season,
              streamEpisode: episode,
            })
          }}
          onSave={() => toggleSaved(selectedMovie)}
          isLiked={hasMatchingMovie(
            likedMovies,
            selectedMovie,
            (likedMovie) => likedMovie,
          )}
          onToggleLike={() => toggleLiked(selectedMovie)}
          onShare={shareSelectedMovie}
          onBff={() => openBff(selectedMovie)}
          onOpenPoster={openSelectedPoster}
          designMode={designMode}
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
          isLiked={hasMatchingMovie(
            likedMovies,
            selectedMovie,
            (likedMovie) => likedMovie,
          )}
          onToggleLike={() => toggleLiked(selectedMovie)}
          streamLoading={streamLoading}
          streamError={streamError}
          streamProvider={streamProvider}
          streamSandboxEnabled={streamSandboxEnabled}
          onBack={() => {
            if (
              detailBackScreen === 'lord' ||
              (selectedMovie &&
                (selectedMovie.id.startsWith('phub-') ||
                  selectedMovie.label === 'PHub' ||
                  selectedMovie.hentaiSlug?.startsWith('phub-')))
            ) {
              setScreen('lord')
            } else if (detailBackScreen) {
              setScreen(detailBackScreen)
            } else {
              setScreen('home')
            }
          }}
          onSave={() => toggleSaved(selectedMovie)}
          onStartWatching={markContinueWatching}
          onStreamSandboxChange={setStreamSandboxEnabled}
          onStreamProviderChange={setStreamProvider}
          onSelectMovie={openWatch}
          designMode={designMode}
          activeParty={activeParty}
          isScreenSharing={isScreenSharing}
          remoteStream={remoteStream}
          latestFrameUrl={latestFrameUrl}
          onStartScreenShare={startScreenShare}
          onStopScreenShare={stopScreenShare}
          screenShareError={screenShareError}
          currentUserEmail={currentUser?.email}
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
          onClear={handleClearSearch}
          onOpenDetail={openDetail}
          onClose={() => setScreen('home')}
          designMode={designMode}
          searchRecommendations={
            designMode === 'netflix'
              ? searchMode === 'drama'
                ? dramaList.length
                  ? dramaList.slice(0, 18)
                  : searchRecommendations
                : anime.length
                  ? anime.slice(0, 18)
                  : searchRecommendations
              : searchRecommendations
          }
          searchMode={searchMode}
          onSearchModeChange={setSearchMode}
        />
      )}

      {screen === 'library' && (
        <LibraryScreen
          savedMovies={savedList}
          likedMovies={likedList}
          invites={incomingInvites}
          onAcceptInvite={(invite) => void acceptInviteAndWatch(invite)}
          onDismissInvite={dismissInvite}
          onOpenDetail={openDetail}
          currentUser={currentUser}
          onProfile={openProfileOrLogin}
          onSelectProfile={switchToProfile}
          onManageProfiles={openManageProfiles}
          onTransferProfile={openLord}
          onAccount={openProfileOrLogin}
          onHelp={openHelpCenter}
          onSignOut={signOut}
          onSetLordPin={() => setShowSetLordPin(true)}
          profiles={profiles}
          onSearch={() => setScreen('search')}
          designMode={designMode}
        />
      )}

      {screen === 'login' && (
        <LoginScreen
          currentUser={currentUser}
          onLogin={(user) => {
            setTempUser(user)
            try { window.sessionStorage.removeItem('lumen.splash-done') } catch { /* ignore */ }
            setShowSplash(true)
            setScreen('profiles')
          }}
          onLogout={() => {
            setCurrentUser(null)
            setScreen('login')
          }}
          onBack={() => setScreen(loginBackScreen)}
          onSwitchProfile={() => {
            setTempUser(currentUser)
            setScreen('profiles')
          }}
          onSelectProfile={switchToProfile}
          onSetLordPin={() => setShowSetLordPin(true)}
          profiles={profiles}
          designMode={designMode}
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
          backdrops={[...tvShows, ...movies, ...anime]
            .map((m) => m.hero || m.still || m.poster)
            .filter((src): src is string => Boolean(src && src.startsWith('http')))
            .slice(0, 12)}
          mobileBackdrops={[...tvShows, ...movies, ...anime]
            .map((m) => m.poster || m.still || m.hero)
            .filter((src): src is string => Boolean(src && src.startsWith('http')))
            .slice(0, 12)}
          onBack={() => {
            setScreen('login')
            setTempUser(null)
          }}
        />
      )}

      {screen === 'lord' && (
        <LordScreen
          movies={lordMovies}
          rails={lordRails}
          loading={lordLoading}
          continueMovies={continueWatchingLord}
          activeTab={activeLordTab}
          onTabChange={setActiveLordTab}
          onOpenDetail={openDetail}
          onPlay={openWatch}
          onSelectProfile={switchToProfile}
          onBack={() => setScreen(lordBackScreen)}
          onClearContinueWatching={clearLordContinueWatching}
          onMarkWatched={markWatchedMovie}
          onRemoveContinue={removeContinueMovie}
          onRemoveWatchlist={removeWatchlistMovie}
        />
      )}

      {showLordPin && (
        <LordPinModal
          expectedPin={lordPin}
          currentUser={currentUser}
          onSuccess={unlockLord}
          onClose={() => setShowLordPin(false)}
          onOpenSetLordPin={() => {
            setShowLordPin(false)
            setShowSetLordPin(true)
          }}
        />
      )}

      {showSetLordPin && (
        <SetLordPinModal
          currentUser={currentUser}
          onClose={() => setShowSetLordPin(false)}
          onSuccess={() => setShowSetLordPin(false)}
        />
      )}

      {((designMode === 'netflix' && (screen === 'home' || screen === 'drama' || screen === 'livetv' || screen === 'manga' || screen === 'search' || screen === 'library')) ||
        (designMode === 'apple' && screen !== 'search' && screen !== 'login' && screen !== 'profiles' && screen !== 'lord' && screen !== 'watch')) && (
        <BottomNav
          active={activeTab}
          onHome={() => setScreen('home')}
          onMovies={() => setScreen('movies')}
          onTvShows={() => setScreen('tv')}
          onLibrary={() => setScreen('library')}
          onDrama={() => setScreen('drama')}
          onLiveTv={() => setScreen('livetv')}
          onManga={() => setScreen('manga')}
          onGoLumen={() => {
            setScreen('home')
            if (designMode !== 'apple') {
              toggleDesignMode()
            }
          }}
          onGoAnime={() => {
            setScreen('home')
            if (designMode !== 'netflix') {
              toggleDesignMode()
            }
          }}
          designMode={designMode}
        />
      )}
      {screen !== 'detail' && screen !== 'watch' && screen !== 'login' && screen !== 'profiles' && screen !== 'lord' && (
        <DesktopNav
          active={activeTab}
          onHome={() => setScreen('home')}
          onMovies={() => setScreen('movies')}
          onTvShows={() => setScreen('tv')}
          onSearch={() => setScreen('search')}
          onLibrary={() => setScreen('library')}
          onDrama={() => setScreen('drama')}
          onLiveTv={() => setScreen('livetv')}
          onManga={() => setScreen('manga')}
          currentUser={currentUser}
          onProfile={openProfileOrLogin}
          onSelectProfile={switchToProfile}
          onManageProfiles={openManageProfiles}
          onTransferProfile={openLord}
          onHelp={openHelpCenter}
          onGoAnime={() => {
            setScreen('home')
            if (designMode !== 'netflix') {
              toggleDesignMode()
            }
          }}
          onGoLumen={() => {
            setScreen('home')
            if (designMode !== 'apple') {
              toggleDesignMode()
            }
          }}
          onSignOut={signOut}
          onOpenDetail={openDetail}
          likedMovies={likedList}
          profiles={profiles}
          designMode={designMode}
          invites={incomingInvites}
          onAcceptInvite={(invite) => void acceptInviteAndWatch(invite)}
          onDismissInvite={dismissInvite}
        />
      )}

      {bffMovie && (
        <div className="bff-overlay" role="dialog" aria-label="Watch together">
          <div className="bff-modal">
            <button
              className="bff-close"
              type="button"
              aria-label="Close"
              onClick={() => setBffMovie(null)}
            >
              <X size={20} />
            </button>
            <h2 className="bff-title">Watch together</h2>
            <p className="bff-sub">
              Invite a friend to watch <strong>{bffMovie.title}</strong>. When they
              accept, it opens on their screen too.
            </p>
            <div className="bff-friends">
              {bffFriends.length === 0 ? (
                <p className="bff-empty">No other accounts found yet.</p>
              ) : (
                bffFriends.map((friend) => (
                  <button
                    key={friend}
                    className="bff-friend"
                    type="button"
                    onClick={() => void inviteFriend(friend)}
                  >
                    <span className="bff-friend-avatar">
                      {friend.charAt(0).toUpperCase()}
                    </span>
                    <span className="bff-friend-name">{friend}</span>
                    <span className="bff-friend-invite">Invite</span>
                  </button>
                ))
              )}
            </div>
            {bffStatus && <p className="bff-status">{bffStatus}</p>}
          </div>
        </div>
      )}

      {incomingInvite && (
        <div className="bff-invite-banner" role="alert">
          <div className="bff-invite-info">
            <span className="bff-invite-text">
              <strong>{incomingInvite.host_email}</strong> invited you to watch{' '}
              <strong>{incomingInvite.movie?.title}</strong>
            </span>
            <span className="bff-invite-subtext">
              🔴 Live video screen share will start upon accept
            </span>
          </div>
          <div className="bff-invite-actions">
            <button className="bff-invite-accept" type="button" onClick={() => void acceptIncomingInvite()}>
              Accept & Watch Live (Screen Share)
            </button>
            <button
              className="bff-invite-dismiss"
              type="button"
              onClick={() => {
                if (incomingInvite) void endParty(incomingInvite.id)
                setIncomingInvite(null)
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {activeParty && (screen === 'watch' || screen === 'detail') && (
        <div className="bff-party-chip">
          <Users size={15} />
          <span>
            Watching with{' '}
            {activeParty.host_email === currentUser?.email
              ? activeParty.guest_email
              : activeParty.host_email}
          </span>
          {isScreenSharing ? (
            <span className="bff-chip-badge live">🔴 Sharing Screen</span>
          ) : remoteScreenSharing ? (
            <span className="bff-chip-badge live">🔴 Screen Share Live</span>
          ) : activeParty.host_email === currentUser?.email ? (
            <button
              type="button"
              className="bff-chip-share-btn"
              onClick={() => void startScreenShare()}
              title="Start Live Screen Share"
            >
              <Tv size={13} />
              <span>Share Screen</span>
            </button>
          ) : (
            <span className="bff-chip-badge watch-only">🔴 Watch Only</span>
          )}
          <button
            type="button"
            className="bff-party-leave"
            onClick={() => {
              stopScreenShare()
              setActiveParty(null)
            }}
            aria-label="Leave watch party"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </main>
  )
}

function HeroTrailerPreview({ movie }: { movie: Movie }) {
  const [youtubeId, setYoutubeId] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [trailerOn, setTrailerOn] = useState(true)
  const [muted, setMuted] = useState(true)
  const [playToken, setPlayToken] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // Reset the preview only when a genuinely different title opens. NOTE: this
  // deliberately does NOT depend on movie.tmdbId — streaming hydration updates
  // the tmdbId on the same title, and re-running here would restart a trailer
  // the viewer had turned off.
  useEffect(() => {
    setStarted(false)
    setTrailerOn(true)
    setMuted(true)
    setPlayToken(0)
  }, [movie.id])

  // Resolve the trailer id: anime use their AniList id directly, movies/TV are
  // looked up through KinoCheck (by TMDB/IMDb id).
  useEffect(() => {
    let active = true
    setYoutubeId(null)

    void fetchTrailerYoutubeId(movie).then((id) => {
      if (active) {
        setYoutubeId(id)
      }
    })

    return () => {
      active = false
    }
  }, [movie.id, movie.tmdbId])

  // Show the poster first, then play the trailer once automatically.
  useEffect(() => {
    if (!youtubeId) {
      return
    }
    const startTimer = window.setTimeout(() => setStarted(true), 900)
    return () => window.clearTimeout(startTimer)
  }, [youtubeId])

  // Listen for the YouTube player's "ended" event so the trailer reverts to the
  // poster after playing once (instead of freezing on a black end frame).
  useEffect(() => {
    if (!trailerOn) {
      return
    }
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string' || !event.origin.includes('youtube')) {
        return
      }
      try {
        const data = JSON.parse(event.data)
        if (data.event === 'onStateChange' && data.info === 0) {
          setTrailerOn(false)
        }
      } catch {
        // ignore non-JSON player chatter
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [trailerOn, playToken])

  const handleIframeLoad = () => {
    // Subscribe to player events (needed to receive onStateChange over
    // postMessage with enablejsapi).
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'listening', id: youtubeId, channel: 'widget' }),
      '*',
    )
  }

  const toggleMute = () => {
    setMuted((current) => {
      const next = !current
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: next ? 'mute' : 'unMute', args: [] }),
        '*',
      )
      return next
    })
  }

  const toggleTrailer = () => {
    if (trailerOn) {
      // Turn the trailer off — the poster shows through.
      setTrailerOn(false)
    } else {
      // Start it again from the top (muted so autoplay is allowed).
      setMuted(true)
      setPlayToken((token) => token + 1)
      setTrailerOn(true)
    }
  }

  if (!youtubeId || !started) {
    return null
  }

  // No loop — the trailer plays through once on open.
  const src =
    `https://www.youtube-nocookie.com/embed/${youtubeId}` +
    `?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&rel=0&start=8&enablejsapi=1`

  return (
    <div className={`hero-trailer-preview${trailerOn ? ' is-playing' : ''}`}>
      {trailerOn && (
        <iframe
          key={`${youtubeId}-${playToken}`}
          ref={iframeRef}
          src={src}
          title="Trailer preview"
          allow="autoplay; encrypted-media"
          frameBorder="0"
          onLoad={handleIframeLoad}
        />
      )}

      <div className="hero-trailer-controls">
        {trailerOn && (
          <button
            type="button"
            className="hero-trailer-btn"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute trailer' : 'Mute trailer'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </button>
        )}
        <button
          type="button"
          className="hero-trailer-btn"
          onClick={toggleTrailer}
          aria-label={trailerOn ? 'Turn off trailer' : 'Play trailer'}
          title={trailerOn ? 'Turn off trailer' : 'Play trailer'}
        >
          {trailerOn ? <Pause /> : <Play />}
        </button>
      </div>
    </div>
  )
}

function HeroSynopsis({ text, netflix }: { text: string; netflix?: boolean }) {
  const [expanded, setExpanded] = useState(false)

  if (!netflix) {
    return <p className="hero-description">{text}</p>
  }

  return (
    <div className={`netflix-hero-desc-wrap${expanded ? ' expanded' : ''}`}>
      <p className="hero-description netflix-hero-description">{text}</p>
      <button
        className="hero-desc-toggle"
        type="button"
        aria-label={expanded ? 'Show less' : 'Show full description'}
        aria-expanded={expanded}
        onClick={(event) => {
          event.stopPropagation()
          setExpanded((value) => !value)
        }}
      >
        {expanded ? 'Show less' : '…'}
      </button>
    </div>
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
  likedMovies?: Movie[]
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
  onSelectProfile?: (name: string) => void
  onManageProfiles?: () => void
  onTransferProfile?: () => void
  onAccount?: () => void
  onHelp?: () => void
  onSignOut?: () => void
  onSetLordPin?: () => void
  profiles: UserProfile[]
  designMode: 'apple' | 'netflix'
  screen?: Screen
  invites?: WatchParty[]
  onAcceptInvite?: (invite: WatchParty) => void
  onDismissInvite?: (invite: WatchParty) => void
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
  likedMovies,
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
  onSelectProfile,
  onManageProfiles,
  onTransferProfile,
  onAccount,
  onHelp,
  onSignOut,
  onSetLordPin,
  profiles,
  designMode,
  screen,
  invites = [],
  onAcceptInvite,
  onDismissInvite,
}: HomeScreenProps) {
  const isDramaMode = screen === 'drama'
  const isNetflixMode = designMode === 'netflix'

  const top10MoviesTitle = isNetflixMode
    ? isDramaMode
      ? 'K-Dramas'
      : 'Trending Anime'
    : 'Top 10 Movies'

  const top10TvTitle = isNetflixMode
    ? isDramaMode
      ? 'C-Dramas'
      : 'Popular Anime This Season'
    : 'Top 10 TV Shows'

  const newReleasesTitle = isNetflixMode
    ? isDramaMode
      ? 'New Drama Releases'
      : 'Fresh Anime Releases'
    : 'New Releases'

  const thrillersTitle = isNetflixMode
    ? isDramaMode
      ? 'Thrilling Dramas'
      : 'Action & Shonen Anime'
    : 'Psychological Thrillers'

  const trendingTitle = isNetflixMode
    ? isDramaMode
      ? 'Rom-Com Dramas'
      : 'Highly Recommended Anime'
    : 'Trending Now'

  const adventureTitle = isNetflixMode
    ? isDramaMode
      ? 'Adventure Dramas'
      : 'Sci-Fi & Fantasy Anime'
    : 'Adventure Movies'

  const familyTitle = isNetflixMode
    ? isDramaMode
      ? 'Family Dramas'
      : 'Comedy Anime'
    : 'Family Night'

  const bingeWorthyTitle = isNetflixMode
    ? isDramaMode
      ? 'Binge-Worthy Dramas'
      : 'Binge-Worthy Anime'
    : 'Binge-Worthy TV'

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
    () => rotateByDailySeed(buildRail(tmdbHomeRails.newReleases, newReleaseFallback), 2),
    [newReleaseFallback, tmdbHomeRails.newReleases],
  )
  const trendingNowItems = useMemo(
    () => rotateByDailySeed(buildRail(tmdbHomeRails.trendingNow, trendingNowFallback), 5),
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
        <HeroTrailerPreview key={`${designMode}-${screen ?? 'home'}-${featuredMovie.id}`} movie={featuredMovie} />
        <header className="home-header">
          <h1>{isDramaMode ? 'Drama' : 'Home'}</h1>
          <div className="header-actions">
            <button className="mobile-search-btn" type="button" title="Search" onClick={onSearch}>
              <Search />
            </button>
            {onAcceptInvite && onDismissInvite && (
              <NotificationBell
                variant="apple"
                invites={invites}
                onAccept={onAcceptInvite}
                onDismiss={onDismissInvite}
              />
            )}
            <WatchRecommenderEntry
              designMode={designMode}
              onOpenDetail={onOpenDetail}
              likedMovies={likedMovies}
              variant="icon"
            />
            {onSelectProfile && onManageProfiles && onTransferProfile && onAccount && onHelp && onSignOut ? (
              <ProfileMenu
                currentUser={currentUser}
                profiles={profiles}
                variant="apple"
                onSelectProfile={onSelectProfile}
                onManageProfiles={onManageProfiles}
                onTransferProfile={onTransferProfile}
                onAccount={onAccount}
                onHelp={onHelp}
                onSignOut={onSignOut}
                onSetLordPin={onSetLordPin}
              />
            ) : (
              <button
                className={`avatar-button ${currentUser ? 'has-avatar' : ''}`}
                type="button"
                title="Profile"
                onClick={onProfile}
              >
                {renderProfileAvatarMini(currentUser, profiles)}
              </button>
            )}
          </div>
        </header>

        <div className="hero-copy">
          {designMode === 'netflix' ? (
            <span className="netflix-series-badge">
              <svg viewBox="0 0 100 100" width="14" height="18" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                <path d="M20,10 L35,10 L35,90 L20,90 Z" fill="#b81d24" />
                <path d="M65,10 L80,10 L80,90 L65,90 Z" fill="#b81d24" />
                <path d="M20,10 L35,10 L80,90 L65,90 Z" fill="#e50914" />
              </svg>
              <span className="series-text">S E R I E S</span>
            </span>
          ) : (
            <span className="floating-label">{featuredMovie.label}</span>
          )}
          <pre className="logo-title">{featuredMovie.logoTitle}</pre>
          <p className="meta-line">
            <span className="provider-badge hero-provider">tv</span>
            <span>{featuredMovie.type}</span>
            <span>{featuredMovie.genres[0]}</span>
            <span>{featuredMovie.genres[1] ?? featuredMovie.year}</span>
            <span className="rating-chip">{featuredMovie.maturity}</span>
          </p>
          <HeroSynopsis text={featuredMovie.synopsis} netflix={designMode === 'netflix'} />

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
        title={top10MoviesTitle}
        movies={movieTopTenMovies}
        landscape={isNetflixMode}
        onOpenDetail={onOpenDetail}
      />

      <MovieRail
        title={top10TvTitle}
        movies={tvTopTenMovies}
        landscape={isNetflixMode}
        onOpenDetail={onOpenDetail}
      />

      <MovieRail
        title={newReleasesTitle}
        movies={newReleaseItems}
        landscape={isNetflixMode}
        onOpenDetail={onOpenDetail}
      />

      {isNetflixMode ? (
        <MovieRail
          title={thrillersTitle}
          movies={psychologicalThrillers}
          landscape
          onOpenDetail={onOpenDetail}
        />
      ) : (
        <FeatureRail
          title={thrillersTitle}
          movies={psychologicalThrillers}
          onOpenDetail={onOpenDetail}
        />
      )}

      <MovieRail
        title={trendingTitle}
        movies={trendingNowItems}
        landscape={isNetflixMode}
        onOpenDetail={onOpenDetail}
      />

      <MovieRail
        title={adventureTitle}
        movies={adventureMovies}
        landscape={isNetflixMode}
        onOpenDetail={onOpenDetail}
      />

      <MovieRail
        title={familyTitle}
        movies={familyMovies}
        landscape={isNetflixMode}
        onOpenDetail={onOpenDetail}
      />

      {isNetflixMode ? (
        <MovieRail
          title={bingeWorthyTitle}
          movies={bingeWorthyTvShows}
          landscape
          onOpenDetail={onOpenDetail}
        />
      ) : (
        <FeatureRail
          title={bingeWorthyTitle}
          movies={bingeWorthyTvShows}
          onOpenDetail={onOpenDetail}
        />
      )}
    </section>
  )
}

type BrowseScreenProps = {
  mode: 'movies' | 'tv' | 'anime'
  movies: Movie[]
  collection: MediaCollection
  featuredMovie?: Movie
  savedMovies: SavedMovies
  likedMovies?: Movie[]
  invites?: WatchParty[]
  onAcceptInvite?: (invite: WatchParty) => void
  onDismissInvite?: (invite: WatchParty) => void
  onOpenDetail: (movie: Movie) => void
  onPlay: (movie: Movie) => void
  onSave: (movie: Movie) => void
  currentUser: UserInfo | null
  onProfile: () => void
  onSelectProfile?: (profileName: string) => void
  onManageProfiles?: () => void
  onTransferProfile?: () => void
  onAccount?: () => void
  onHelp?: () => void
  onSignOut?: () => void
  onSetLordPin?: () => void
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
  likedMovies = [],
  invites = [],
  onAcceptInvite,
  onDismissInvite,
  onOpenDetail,
  onPlay,
  onSave,
  currentUser,
  onProfile,
  onSelectProfile,
  onManageProfiles,
  onTransferProfile,
  onAccount,
  onHelp,
  onSignOut,
  onSetLordPin,
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
          ...topItems,
        ],
        topItems,
      ),
    [
      collection.adventure,
      collection.kidsFamily,
      collection.thrilling,
      collection.top,
      movies,
      topItems,
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
          <HeroTrailerPreview key={`${designMode}-${mode}-${heroMovie.id}`} movie={heroMovie} />
          <header className="home-header">
            <h1>{screenTitle}</h1>
            <div className="header-actions">
              <button className="mobile-search-btn" type="button" title="Search" onClick={onSearch}>
                <Search />
              </button>
              {onAcceptInvite && onDismissInvite && (
                <NotificationBell
                  variant="apple"
                  invites={invites}
                  onAccept={onAcceptInvite}
                  onDismiss={onDismissInvite}
                />
              )}
              <WatchRecommenderEntry
                designMode={designMode}
                onOpenDetail={onOpenDetail}
                likedMovies={likedMovies}
                variant="icon"
              />
              {onSelectProfile && onManageProfiles && onTransferProfile && onAccount && onHelp && onSignOut && onSetLordPin ? (
                <ProfileMenu
                  currentUser={currentUser}
                  profiles={profiles}
                  variant="apple"
                  onSelectProfile={onSelectProfile}
                  onManageProfiles={onManageProfiles}
                  onTransferProfile={onTransferProfile}
                  onAccount={onAccount}
                  onHelp={onHelp}
                  onSignOut={onSignOut}
                  onSetLordPin={onSetLordPin}
                />
              ) : (
                <button
                  className={`avatar-button ${currentUser ? 'has-avatar' : ''}`}
                  type="button"
                  title="Profile"
                  onClick={onProfile}
                >
                  {renderProfileAvatarMini(currentUser, profiles)}
                </button>
              )}
            </div>
          </header>

          <div className="hero-copy">
            {designMode === 'netflix' ? (
              <span className="netflix-series-badge">
                <svg viewBox="0 0 100 100" width="14" height="18" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                  <path d="M20,10 L35,10 L35,90 L20,90 Z" fill="#b81d24" />
                  <path d="M65,10 L80,10 L80,90 L65,90 Z" fill="#b81d24" />
                  <path d="M20,10 L35,10 L80,90 L65,90 Z" fill="#e50914" />
                </svg>
                <span className="series-text">S E R I E S</span>
              </span>
            ) : (
              <span className="floating-label">{heroMovie.label}</span>
            )}
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
  isLiked: boolean
  isLoading: boolean
  error: string
  onBack: () => void
  onOpenDetail: (movie: Movie) => void
  onPlay: (provider?: StreamProvider) => void
  onPlayEpisode: (season: number, episode: number, seasonAnilistId?: number) => void
  onSave: () => void
  onToggleLike: () => void
  onShare: () => void
  onBff?: () => void
  onOpenPoster: () => void
  designMode: 'apple' | 'netflix'
}

function DetailScreen({
  movie,
  relatedMovies,
  isSaved,
  isLiked,
  isLoading,
  error,
  onBack,
  onOpenDetail,
  onPlay,
  onPlayEpisode,
  onSave,
  onToggleLike,
  onShare,
  onBff,
  onOpenPoster,
  designMode,
}: DetailScreenProps) {
  const isNetflix = designMode === 'netflix'
  const similarsRef = useRef<HTMLDivElement | null>(null)
  const [detailTab, setDetailTab] = useState<'episodes' | 'collection' | 'more'>(
    'episodes',
  )
  // On desktop the anime detail shows every section stacked (no tabs / no
  // secondary icon row); the tab UI + icon row are a mobile-only treatment.
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const handler = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
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
          <source
            media="(max-width: 899px)"
            srcSet={isNetflix ? (movie.still || heroImageFor(movie)) : posterImageFor(movie)}
          />
          <img
            className="detail-hero-art"
            src={heroImageFor(movie)}
            alt=""
            onError={(event) => {
              event.currentTarget.src = posterImageFor(movie)
            }}
          />
        </picture>
        <HeroTrailerPreview key={movie.id} movie={movie} />
        <DetailTopBar
          onBack={onBack}
          onShare={onShare}
          onBff={onBff}
          isLiked={isLiked}
          onToggleLike={onToggleLike}
        />

        <div
          className={`detail-copy ${
            isNetflix ? 'netflix-detail-copy' : 'apple-detail-copy'
          }`}
        >
          <pre className="logo-title detail-title">{movie.logoTitle}</pre>

          {isNetflix ? (
            <p className="detail-meta netflix-detail-meta">
              <span>{movie.year}</span>
              <span className="netflix-meta-badge">{movie.maturity && movie.maturity !== 'N/A' ? movie.maturity : 'NR'}</span>
              {isTvShow(movie) && (
                <span>
                  {seasonsFor(movie).length} Season{seasonsFor(movie).length > 1 ? 's' : ''}
                </span>
              )}
              <span className="netflix-meta-badge">HD</span>
            </p>
          ) : (
            <p className="detail-meta apple-detail-meta">
              <span className="provider-badge hero-provider">tv</span>
              <span>{movie.type}</span>
              {movie.genres.slice(0, 3).map((genre) => (
                <span key={genre}>{genre}</span>
              ))}
            </p>
          )}

          <p
            className={`synopsis ${
              isNetflix ? 'netflix-detail-synopsis' : 'apple-detail-synopsis'
            }`}
          >
            {movie.synopsis}
            {!isNetflix && <span className="more-chip">MORE</span>}
          </p>

          {!isNetflix && (
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
          )}

          <div
            className={`detail-actions ${
              isNetflix ? 'netflix-detail-actions' : 'apple-detail-actions'
            }`}
          >
            {isNetflix ? (
              <>
                <button
                  className="primary-play netflix-detail-play"
                  type="button"
                  onClick={() => onPlay()}
                >
                  <Play fill="currentColor" strokeWidth={0} />
                  <span>Play</span>
                </button>
                <button
                  className="detail-pill-button netflix-download-btn"
                  type="button"
                  onClick={onOpenPoster}
                >
                  <Download />
                  <span>Download</span>
                </button>
                {!isDesktop && (
                  <div className="netflix-detail-iconrow">
                    <button type="button" className="netflix-icon-action" title="Set Reminders">
                      <Bell />
                      <span>Remind Me</span>
                    </button>
                    <button
                      type="button"
                      className={`netflix-icon-action${isSaved ? ' active' : ''}`}
                      onClick={onSave}
                      title={isSaved ? 'Saved' : 'Add to My List'}
                    >
                      {isSaved ? <Check /> : <Plus />}
                      <span>My List</span>
                    </button>
                    <button
                      type="button"
                      className="netflix-icon-action"
                      onClick={onShare}
                      title="Share"
                    >
                      <Share />
                      <span>Share</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          {error && <InlineAlert message={error} />}
          {/* The card data (poster, title, synopsis, genres) is already shown,
              so only surface the blocking strip when there is genuinely nothing
              to display yet. Enrichment (cast, ratings, episodes) hydrates in
              the background without a full-screen loader. */}
          {isLoading && !movie.synopsis && <LoadingStrip label="Loading full details" />}
        </div>

        {!isNetflix && (
          <p className="detail-starring">
            Starring {movie.cast.slice(0, 3).join(', ')}
          </p>
        )}
      </div>

      <div className="detail-page-body">
        {isNetflix ? (
          <>
            {!isDesktop && (
              <nav className="netflix-detail-tabs" aria-label="Detail sections">
                <button
                  type="button"
                  className={detailTab === 'episodes' ? 'active' : ''}
                  onClick={() => setDetailTab('episodes')}
                >
                  Episodes
                </button>
                <button
                  type="button"
                  className={detailTab === 'collection' ? 'active' : ''}
                  onClick={() => setDetailTab('collection')}
                >
                  Collection
                </button>
                <button
                  type="button"
                  className={detailTab === 'more' ? 'active' : ''}
                  onClick={() => setDetailTab('more')}
                >
                  More Like This
                </button>
              </nav>
            )}

            {(isDesktop || detailTab === 'episodes') &&
              (isTvShow(movie) ? (
                <SeasonEpisodeSection
                  key={movie.id}
                  movie={movie}
                  onPlayEpisode={onPlayEpisode}
                />
              ) : (
                <DetailLandscapeRail
                  title="Trailers"
                  items={trailerCards}
                  onOpenDetail={onOpenDetail}
                />
              ))}

            {(isDesktop || detailTab === 'collection') && isTvShow(movie) && (
              <DetailLandscapeRail
                title="Trailers"
                items={trailerCards}
                onOpenDetail={onOpenDetail}
              />
            )}

            {(isDesktop || detailTab === 'more') && (
              <div ref={similarsRef}>
                <DetailPosterRail
                  title="Similars"
                  movies={relatedItems}
                  onOpenDetail={onOpenDetail}
                />
              </div>
            )}

            <CastCrewRail
              members={castCrewMembers}
              movie={movie}
              heading="Actors"
              netflix
            />
            <WhereToWatch
              availability={watchAvailability}
              isLoading={isWatchAvailabilityLoading}
            />
            <MovieFacts movie={movie} />
          </>
        ) : (
          <>
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

            <div ref={similarsRef}>
              <DetailPosterRail
                title="Related"
                movies={relatedItems}
                onOpenDetail={onOpenDetail}
              />
            </div>

            <WhereToWatch
              availability={watchAvailability}
              isLoading={isWatchAvailabilityLoading}
            />
            <CastCrewRail members={castCrewMembers} movie={movie} />
            <MovieFacts movie={movie} />
          </>
        )}
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

function SeasonDropdown({
  seasons,
  value,
  onChange,
  labels,
}: {
  seasons: number[]
  value: number
  onChange: (season: number) => void
  labels?: Record<number, string>
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const handlePointer = (event: Event) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const getLabel = (seasonNum: number) => {
    const custom = labels?.[seasonNum]
    if (custom) {
      return custom.toLowerCase().startsWith('season')
        ? custom
        : `Season ${seasonNum} · ${custom}`
    }
    return `Season ${seasonNum}`
  }

  return (
    <div className={`season-dd${open ? ' open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="season-dd-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{getLabel(value)}</span>
        <ChevronsUpDown />
      </button>
      {open && (
        <div className="season-dd-menu" role="listbox">
          {seasons.map((season) => (
            <button
              key={season}
              type="button"
              role="option"
              aria-selected={season === value}
              className={`season-dd-option${season === value ? ' active' : ''}`}
              onClick={() => {
                onChange(season)
                setOpen(false)
              }}
            >
              {getLabel(season)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SeasonEpisodeSection({
  movie,
  onPlayEpisode,
}: {
  movie: Movie
  onPlayEpisode: (season: number, episode: number, seasonAnilistId?: number) => void
}) {
  // Anime is NOT grouped into a multi-season dropdown: each AniList entry is its
  // own standalone title (exactly as AniList lists them), so we only ever show
  // this entry's own episodes. Other seasons show up as separate search results.
  const [animeSeasons] = useState<AnimeSeasonInfo[]>(movie.animeSeasons || [])

  const fallbackSeasons = useMemo(() => {
    if (movie.isAnime && animeSeasons.length > 0) {
      return animeSeasons.map((s) => ({
        season: s.season,
        episodeCount: s.episodeCount,
        title: s.title,
        anilistId: s.anilistId,
      }))
    }
    return seasonsFor(movie)
  }, [movie, animeSeasons])

  const [tmdbSeasons, setTmdbSeasons] = useState<{ season: number; episodeCount: number }[]>([])
  // Anime is always AniList-driven (never TMDB). For everything else, prefer the
  // real TMDB season list when available, otherwise the local guess.
  const seasons =
    !movie.isAnime && tmdbSeasons.length > 0 ? tmdbSeasons : fallbackSeasons
  const initialSeason = movie.streamSeason ?? seasons[0]?.season ?? 1
  const [selectedSeason, setSelectedSeason] = useState(() => initialSeason)
  const [tmdbEpisodes, setTmdbEpisodes] = useState<SeasonEpisode[]>([])
  const [findEpisode, setFindEpisode] = useState('')
  const [highlightedEpisode, setHighlightedEpisode] = useState<number | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)

  // Anime is driven entirely by the AniList season structure (each season is a
  // distinct AniList entry, and streaming resolves by that per-season anilistId).
  // Never let TMDB seasons/episodes override it, or switching seasons shows the
  // wrong episodes and per-season titles fall back to the root entry's absolute
  // numbering (e.g. "Episode 103" under Season 2's "Episode 1").
  const isTvId =
    !movie.isAnime && Boolean(movie.tmdbId) && (movie.tmdbType === 'tv' || isTvShow(movie))

  // Load the accurate season list from TMDB so the dropdown/counts are correct.
  useEffect(() => {
    let active = true
    setTmdbSeasons([])

    if (isTvId && movie.tmdbId) {
      void fetchTvSeasons(movie.tmdbId).then((list) => {
        if (active) {
          setTmdbSeasons(list)
        }
      })
    }

    return () => {
      active = false
    }
  }, [movie.tmdbId, isTvId])

  // Keep the selected season valid once the real season list arrives.
  useEffect(() => {
    if (seasons.length > 0 && !seasons.some((s) => s.season === selectedSeason)) {
      setSelectedSeason(seasons[0].season)
    }
  }, [seasons, selectedSeason])

  // Load real per-episode covers/titles from TMDB when we have a tv id.
  useEffect(() => {
    let active = true
    setTmdbEpisodes([])

    if (isTvId && movie.tmdbId) {
      void fetchSeasonEpisodes(movie.tmdbId, selectedSeason).then((episodes) => {
        if (active) {
          setTmdbEpisodes(episodes)
        }
      })
    }

    return () => {
      active = false
    }
  }, [movie.tmdbId, isTvId, selectedSeason])

  const activeSeason =
    seasons.find((season) => season.season === selectedSeason) ?? seasons[0]

  if (!activeSeason) {
    return null
  }

  const activeAnimeSeason = movie.isAnime
    ? (animeSeasons.find((s) => s.season === selectedSeason) || animeSeasons[selectedSeason - 1])
    : undefined

  const episodeCount =
    !movie.isAnime && tmdbEpisodes.length > 0
      ? tmdbEpisodes.length
      : activeAnimeSeason
        ? activeAnimeSeason.episodeCount
        : activeSeason.episodeCount

  const episodes = Array.from({ length: episodeCount }, (_, index) => index + 1)
  // Append the next, not-yet-aired anime episode as a "coming soon" card.
  if (
    movie.isAnime &&
    movie.nextEpisode &&
    movie.nextEpisode.number > episodeCount
  ) {
    episodes.push(movie.nextEpisode.number)
  }

  const seasonLabels = useMemo(() => {
    if (movie.isAnime && animeSeasons.length > 0) {
      const map: Record<number, string> = {}
      for (const s of animeSeasons) {
        map[s.season] = s.title
      }
      return map
    }
    return undefined
  }, [movie.isAnime, animeSeasons])

  const formatAirDate = (value: number | string) => {
    const date = typeof value === 'number' ? new Date(value) : new Date(value)
    if (Number.isNaN(date.getTime())) {
      return ''
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const scrollRow = (direction: 1 | -1) => {
    const row = rowRef.current
    if (row) {
      row.scrollBy({ left: direction * row.clientWidth * 0.86, behavior: 'smooth' })
    }
  }

  return (
    <section className="detail-section season-section">
      <div className="season-header">
        {seasons.length > 1 && (
        <SeasonDropdown
          seasons={seasons.map((s) => s.season)}
          value={selectedSeason}
          onChange={(newSeason) => {
            setSelectedSeason(newSeason)
            setHighlightedEpisode(null)
            setFindEpisode('')
          }}
          labels={seasonLabels}
        />
        )}

        <form
          className="episode-finder"
          onSubmit={(event) => {
            event.preventDefault()
            const max = activeSeason.episodeCount
            const number = Math.min(max, Math.max(1, Number(findEpisode) || 0))
            if (!number) {
              return
            }
            setHighlightedEpisode(number)
            // Reveal the episode by scrolling ONLY the rail (not the page) so
            // the whole screen doesn't shift.
            window.requestAnimationFrame(() => {
              const row = rowRef.current
              const card = row?.querySelector<HTMLElement>(`[data-episode="${number}"]`)
              if (row && card) {
                const rowRect = row.getBoundingClientRect()
                const cardRect = card.getBoundingClientRect()
                const delta =
                  cardRect.left - rowRect.left - (rowRect.width - cardRect.width) / 2
                row.scrollBy({ left: delta, behavior: 'smooth' })
              }
            })
          }}
        >
          <input
            type="number"
            min={1}
            value={findEpisode}
            onChange={(event) => setFindEpisode(event.target.value)}
            placeholder="Episode #"
            aria-label="Find episode by number"
          />
          <button type="submit">Go</button>
        </form>
      </div>

      <div className="episode-viewport">
        <button
          className="rail-arrow rail-arrow-prev episode-arrow"
          type="button"
          aria-label="Previous episodes"
          onClick={() => scrollRow(-1)}
        >
          <ChevronLeft />
        </button>

        <div ref={rowRef} className="episode-row episode-row-v2">
          {episodes.map((episode) => {
            // Anime never uses TMDB episode data — its titles/stills come from
            // the selected AniList season, keeping per-season numbering aligned.
            const data = movie.isAnime
              ? undefined
              : tmdbEpisodes.find((item) => item.number === episode)
            // AniList exposes real per-episode artwork/titles via
            // streamingEpisodes (in episode order).
            const animeEp = activeAnimeSeason
              ? activeAnimeSeason.animeEpisodes?.[episode - 1]
              : (movie.isAnime ? movie.animeEpisodes?.[episode - 1] : undefined)
            const hentaiEp = movie.isHentaiOcean
              ? movie.hentaiEpisodes?.[episode - 1]
              : undefined
            // Prefer the real episode still: TMDB still → AniList episode → Hentai Ocean episode
            // thumbnail → fall back to the show art (proxied for anime).
            const cover =
              data?.still ||
              animeEp?.thumbnail ||
              hentaiEp?.thumbnail ||
              (movie.isAnime
                ? proxiedAnimeImage(movie.still || movie.hero || movie.poster)
                : movie.still || movie.hero || movie.poster)
            const name = movie.isAnime
              ? formatAnimeEpisodeTitle(episode, animeEp?.title)
              : (data?.name || hentaiEp?.title || episodeTitle(selectedSeason, episode))
            const overview =
              data?.overview || (movie.isHentaiOcean ? `Episode ${episode} of ${movie.title}` : episodeSynopsis(movie, selectedSeason, episode))
            const runtime = movie.isAnime
              ? getAnimeEpisodeDuration(movie, episode, (animeEp as any)?.duration)
              : (data?.runtime || episodeRuntime(movie, selectedSeason, episode))

            // "Coming soon" detection: a future TMDB air_date, or — for anime —
            // any episode at or after the next-airing one (everything from the
            // next episode onward hasn't aired yet, not just the single next).
            const activeNextEp = activeAnimeSeason?.nextEpisode ?? (activeAnimeSeason?.status === 'RELEASING' ? movie.nextEpisode : undefined)
            const isReleasing = activeAnimeSeason ? activeAnimeSeason.status === 'RELEASING' : (movie.status === 'RELEASING' || !movie.status)
            const animeUpcoming =
              movie.isAnime &&
              isReleasing &&
              typeof activeNextEp?.number === 'number' &&
              episode >= activeNextEp.number
            const tmdbUpcoming =
              !movie.isAnime &&
              !!data?.airDate &&
              new Date(data.airDate).getTime() > Date.now()
            const upcoming = animeUpcoming || tmdbUpcoming
            // Only the exact next-airing anime episode has a known date; later
            // unaired episodes just show "Coming soon" without a (wrong) date.
            const comingDate = animeUpcoming
              ? episode === activeNextEp?.number && activeNextEp?.airingAt
                ? formatAirDate(activeNextEp.airingAt * 1000)
                : ''
              : data?.airDate
                ? formatAirDate(data.airDate)
                : ''

            return (
              <button
                className={`episode-card-v2${episode === highlightedEpisode ? ' episode-highlighted' : ''}${upcoming ? ' episode-upcoming' : ''}`}
                type="button"
                key={`${selectedSeason}-${episode}`}
                data-episode={episode}
                disabled={upcoming}
                aria-disabled={upcoming}
                onClick={() => {
                  if (!upcoming) {
                    onPlayEpisode(selectedSeason, episode, activeAnimeSeason?.anilistId)
                  }
                }}
              >
                <span className="episode-thumb">
                  <img
                    src={cover}
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      const showArt = movie.isAnime
                        ? proxiedAnimeImage(movie.hero || movie.poster || movie.still)
                        : movie.still || movie.hero || movie.poster
                      // Avoid an error loop if the fallback is the same source.
                      if (showArt && event.currentTarget.src !== showArt) {
                        event.currentTarget.src = showArt
                      } else {
                        event.currentTarget.src = fallbackPosterForRank(movie.rank)
                      }
                    }}
                  />
                </span>
                <span className="episode-body">
                  <small className="episode-eyebrow">
                    EPISODE {episode}
                    {upcoming && <span className="episode-soon-tag">Coming soon</span>}
                  </small>
                  <strong className="episode-name">{name}</strong>
                  <em className="episode-desc">
                    {upcoming && comingDate
                      ? `Premieres ${comingDate}`
                      : overview}
                  </em>
                  <span className="episode-foot">
                    {(upcoming || runtime) && (
                      <span className="episode-time">
                        <RefreshCcw />
                        {upcoming ? (comingDate || 'Coming soon') : runtime}
                      </span>
                    )}
                    <MoreHorizontal />
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <button
          className="rail-arrow rail-arrow-next episode-arrow"
          type="button"
          aria-label="Next episodes"
          onClick={() => scrollRow(1)}
        >
          <ChevronRight />
        </button>
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
            <PosterImage movie={item} fallback={posterImageFor(item)} />
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
  heading = 'Cast & Crew',
  netflix = false,
}: {
  members: CastCrewMember[]
  movie: Movie
  heading?: string
  netflix?: boolean
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
    <section
      className={`detail-section detail-cast-section${
        netflix ? ' netflix-actors-section' : ''
      }`}
    >
      <DetailSectionHeading title={heading} />
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
  isLiked: boolean
  streamLoading: boolean
  streamError: string
  streamProvider: StreamProvider
  streamSandboxEnabled: boolean
  onBack: () => void
  onSave: () => void
  onToggleLike: () => void
  onStartWatching: (movie: Movie) => void
  onStreamSandboxChange: (enabled: boolean) => void
  onStreamProviderChange: (provider: StreamProvider) => void
  designMode: 'apple' | 'netflix'
  onSelectMovie?: (movie: Movie) => void
  activeParty?: WatchParty | null
  isScreenSharing?: boolean
  remoteStream?: MediaStream | null
  latestFrameUrl?: string | null
  onStartScreenShare?: () => void
  onStopScreenShare?: () => void
  screenShareError?: string
  currentUserEmail?: string
}

function WatchScreen({
  movie,
  isSaved,
  isLiked,
  streamLoading,
  streamError,
  streamProvider,
  streamSandboxEnabled,
  onBack,
  onSave,
  onToggleLike,
  onStartWatching,
  onStreamSandboxChange,
  onStreamProviderChange,
  designMode,
  onSelectMovie,
  activeParty,
  isScreenSharing,
  remoteStream,
  latestFrameUrl,
  onStartScreenShare,
  onStopScreenShare,
  screenShareError,
  currentUserEmail,
}: WatchScreenProps) {
  const isPartyHost = activeParty ? currentUserEmail === activeParty.host_email : false
  const isPartyGuest = activeParty ? currentUserEmail !== activeParty.host_email : false
  const [isBigScreen, setIsBigScreen] = useState(false)
  const remoteViewportRef = useRef<HTMLDivElement | null>(null)

  const isJavVideo = Boolean(
    movie.id.startsWith('jav-') ||
      movie.label === 'JAV' ||
      movie.isJav ||
      movie.hentaiSlug?.startsWith('jav-'),
  )
  const isPhubVideo = Boolean(
    movie.id.startsWith('phub-') ||
      movie.label === 'PHub' ||
      movie.hentaiSlug?.startsWith('phub-'),
  )
  const isHentai = Boolean(
    !isJavVideo &&
      !isPhubVideo &&
      (movie.isHentaiOcean ||
        movie.genres.some((g) => g.toLowerCase() === 'hentai')),
  )

  const similarPhubVideos = useMemo(() => {
    if (!isPhubVideo) return []
    const currentId = String(movie.id).replace('phub-', '')
    const cat = (movie.genres && movie.genres[0]) || 'Teen'
    const catLower = cat.toLowerCase()

    const matched = INITIAL_HANIME_VIDEOS.filter(
      (v) =>
        String(v.id) !== currentId &&
        (v.category.toLowerCase().includes(catLower) ||
          v.title.toLowerCase().includes(catLower)),
    )
    const fallback = INITIAL_HANIME_VIDEOS.filter((v) => String(v.id) !== currentId)
    const pool = matched.length >= 3 ? matched : fallback
    return pool.slice(0, 10)
  }, [isPhubVideo, movie.id, movie.genres])
  const isTmdbTitle = !isHentai && !isJavVideo && !isPhubVideo && !movie.isAnime && !movie.anilistId && !!movie.tmdbId
  const isAnimeMovie =
    !isTmdbTitle &&
    !isHentai &&
    !isJavVideo &&
    !isPhubVideo &&
    (movie.isAnime ||
      movie.type === 'Anime' ||
      movie.genres.includes('Anime') ||
      movie.genres.includes('Animation') ||
      designMode === 'netflix')

  const animeProviderIds: StreamProvider[] = ['megaplay', 'megabuzz']

  const activeProviderId = isJavVideo
    ? 'apijav'
    : isPhubVideo
      ? 'phubplay'
      : isHentai
        ? 'oceanplay'
        : isAnimeMovie
          ? animeProviderIds.includes(streamProvider)
            ? streamProvider
            : 'megaplay'
          : animeProviderIds.includes(streamProvider)
            ? 'vidking'
            : streamProvider

  const isSeries = isAnimeMovie || isTvShow(movie) || movie.tmdbType === 'tv'
  const [episode, setEpisode] = useState(movie.streamEpisode ?? 1)
  const [season, setSeason] = useState(movie.streamSeason ?? 1)
  const [language, setLanguage] = useState<'sub' | 'dub'>(movie.streamLanguage ?? 'sub')
  const [epSearchQuery, setEpSearchQuery] = useState('')

  useEffect(() => {
    setEpisode(movie.streamEpisode ?? 1)
    setSeason(movie.streamSeason ?? 1)
    setLanguage(movie.streamLanguage ?? 'sub')
  }, [movie.id, movie.anilistId, movie.streamEpisode, movie.streamSeason, movie.streamLanguage])

  // Anime stays a single standalone entry (no cross-season grouping).
  const [watchAnimeSeasons] = useState<AnimeSeasonInfo[]>(movie.animeSeasons || [])

  const activeWatchAnimeSeason = isAnimeMovie
    ? (watchAnimeSeasons.find((s) => s.season === season) || watchAnimeSeasons[season - 1])
    : undefined

  const streamMovie: Movie = {
    ...movie,
    anilistId: activeWatchAnimeSeason?.anilistId ?? movie.anilistId,
    streamEpisode: episode,
    streamSeason: season,
    streamLanguage: language,
  }

  const streamUrl = buildStreamUrl(streamMovie, activeProviderId)
  const currentProvider =
    streamProviderOptions.find((provider) => provider.id === activeProviderId) ??
    streamProviderOptions[0]
  const opensExternally = activeProviderId === 'multiembed-vip'
  // Direct HLS (.m3u8) sources play in a native <video> via hls.js; everything
  // else is an embed player and stays in the iframe.
  const isHlsStream = /\.m3u8(\?|#|$)/i.test(streamUrl)

  const fallbackWatchSeasons = useMemo(() => {
    if (isAnimeMovie && watchAnimeSeasons.length > 0) {
      return watchAnimeSeasons.map((s) => ({
        season: s.season,
        episodeCount: s.episodeCount,
        title: s.title,
        anilistId: s.anilistId,
      }))
    }
    return seasonsFor(movie)
  }, [movie, isAnimeMovie, watchAnimeSeasons])

  const [tmdbWatchSeasons, setTmdbWatchSeasons] = useState<
    { season: number; episodeCount: number }[]
  >([])
  const watchSeasons =
    tmdbWatchSeasons.length > 0 ? tmdbWatchSeasons : fallbackWatchSeasons

  const seasonLabels = useMemo(() => {
    if (isAnimeMovie && watchAnimeSeasons.length > 0) {
      const map: Record<number, string> = {}
      for (const s of watchAnimeSeasons) {
        map[s.season] = s.title
      }
      return map
    }
    return undefined
  }, [isAnimeMovie, watchAnimeSeasons])

  const watchIsTvId =
    !isAnimeMovie && Boolean(movie.tmdbId) && (movie.tmdbType === 'tv' || isTvShow(movie))

  useEffect(() => {
    let active = true
    setTmdbWatchSeasons([])
    if (watchIsTvId && movie.tmdbId) {
      void fetchTvSeasons(movie.tmdbId).then((list) => {
        if (active) {
          setTmdbWatchSeasons(list)
        }
      })
    }
    return () => {
      active = false
    }
  }, [movie.tmdbId, watchIsTvId])

  const [watchTmdbEpisodes, setWatchTmdbEpisodes] = useState<SeasonEpisode[]>([])

  useEffect(() => {
    let active = true
    setWatchTmdbEpisodes([])
    if (watchIsTvId && movie.tmdbId) {
      void fetchSeasonEpisodes(movie.tmdbId, season).then((episodes) => {
        if (active) {
          setWatchTmdbEpisodes(episodes)
        }
      })
    }
    return () => {
      active = false
    }
  }, [movie.tmdbId, watchIsTvId, season])

  const activeWatchSeason =
    watchSeasons.find((entry) => entry.season === season) ?? watchSeasons[0]
  const episodeNumbers = activeWatchSeason
    ? Array.from({ length: activeWatchSeason.episodeCount }, (_, index) => index + 1)
    : []

  const filteredEpisodeNumbers = useMemo(() => {
    if (!epSearchQuery.trim()) return episodeNumbers
    const q = epSearchQuery.trim().toLowerCase()
    return episodeNumbers.filter((number) => {
      if (
        `episode ${number}`.toLowerCase().includes(q) ||
        `ep ${number}`.toLowerCase().includes(q) ||
        String(number) === q
      ) {
        return true
      }
      const epData = movie.animeEpisodes?.[number - 1]
      if (epData?.title && epData.title.toLowerCase().includes(q)) {
        return true
      }
      return false
    })
  }, [episodeNumbers, epSearchQuery, movie.animeEpisodes])

  // MegaPlay (VidNest) posts playback events to the parent window. Use the
  // first time/watching-log event to flag the title as "continue watching".
  useEffect(() => {
    if (activeProviderId !== 'megaplay') {
      return
    }

    let started = false

    const handleMessage = (event: MessageEvent) => {
      if (
        typeof event.origin === 'string' &&
        !event.origin.includes('vidnest.fun') &&
        !event.origin.includes('megaplay.buzz')
      ) {
        return
      }

      let payload: unknown = event.data

      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch {
          return
        }
      }

      const message = payload as
        | { channel?: string; type?: string; event?: string }
        | null

      const isPlaybackEvent =
        message?.event === 'time' ||
        message?.event === 'complete' ||
        message?.type === 'watching-log'

      if (!started && isPlaybackEvent) {
        started = true
        onStartWatching(movie)
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [activeProviderId, movie, onStartWatching])

  const openCurrentStream = () => {
    if (!streamUrl) {
      return
    }

    onStartWatching(movie)
    window.open(streamUrl, '_blank', 'noopener,noreferrer')
  }

  const renderEpisodePanel = (_isAnimeLayout = true) => {
    if (!isSeries) return null
    return (
      <aside className="watch-episode-panel anime-episode-panel" aria-label="Episodes">
        <div className="anime-ep-header-row">
          <SeasonDropdown
            seasons={(watchSeasons.length ? watchSeasons : [{ season: 1, episodeCount: 0 }]).map((entry) => entry.season)}
            value={season}
            onChange={(newSeason) => {
              setSeason(newSeason)
              setEpisode(1)
            }}
            labels={seasonLabels}
          />
          <div className="anime-ep-search-wrapper">
            <Search size={14} className="anime-ep-search-icon" />
            <input
              type="text"
              placeholder="Search ep..."
              className="anime-ep-search-input"
              value={epSearchQuery}
              onChange={(e) => setEpSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="watch-episode-list">
          {filteredEpisodeNumbers.map((number) => {
            const animeEp = movie.animeEpisodes?.[number - 1]
            const tmdbEp = watchTmdbEpisodes.find((item) => item.number === number)
            const isActive = number === episode

            const rawEpTitle = movie.isAnime
              ? (animeEp?.title || '')
              : (tmdbEp?.name || animeEp?.title || '')
            const formattedTitle = formatAnimeEpisodeTitle(number, rawEpTitle)

            const thumbUrl = movie.isAnime
              ? (animeEp?.thumbnail || movie.still || movie.poster)
              : (tmdbEp?.still || animeEp?.thumbnail || movie.still || movie.poster)

            const epDurationStr = getAnimeEpisodeDuration(
              movie,
              number,
              movie.isAnime
                ? (animeEp as any)?.duration
                : (tmdbEp?.runtime ? `${tmdbEp.runtime}m` : undefined)
            )
            const providerName = currentProvider?.name || 'MegaPlay'
            const audioText = movie.isAnime ? 'English Sub' : 'English'

            return (
              <button
                key={number}
                type="button"
                className={`watch-episode-item anime-yt-ep-card${isActive ? ' active' : ''}`}
                onClick={() => setEpisode(number)}
              >
                <div className="anime-yt-thumb-container">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={formattedTitle}
                      className="anime-yt-thumb-img"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget
                        if (movie.still && target.src !== movie.still) {
                          target.src = movie.still
                        } else if (movie.poster && target.src !== movie.poster) {
                          target.src = movie.poster
                        }
                      }}
                    />
                  ) : (
                    <div className="anime-yt-thumb-fallback">
                      <span>EP {number}</span>
                    </div>
                  )}
                  <span className="anime-yt-thumb-duration">{epDurationStr}</span>
                </div>

                <div className="anime-yt-info">
                  <div className="anime-yt-title" title={formattedTitle}>
                    {formattedTitle}
                  </div>

                  <div className="anime-yt-channel">
                    <span>{providerName}</span>
                    <svg className="anime-yt-verified-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>

                  <div className="anime-yt-meta">
                    <span className="anime-yt-play-icon">▷</span>
                    <span>{epDurationStr}</span>
                    <span className="anime-yt-dot">•</span>
                    <span>{audioText}</span>
                  </div>
                </div>
              </button>
            )
          })}
          {filteredEpisodeNumbers.length === 0 && (
            <div className="anime-ep-empty">No episodes matching &quot;{epSearchQuery}&quot;</div>
          )}
        </div>
      </aside>
    )
  }

  const renderPlayerSection = () => (
    <section className="stream-player-section">
      {screenShareError && (
        <div className="screen-share-error-banner" role="alert">
          <AlertCircle size={15} />
          <span>{screenShareError}</span>
        </div>
      )}
      {isPartyHost && !isScreenSharing && (
        <div className="host-start-share-banner">
          <span className="live-share-badge">
            <span className="live-dot-pulse" /> 🔴 WATCH PARTY READY
          </span>
          <span>
            You are watching with {activeParty?.guest_email}. Click below to stream your playing video live!
          </span>
          <button
            type="button"
            className="host-share-now-btn"
            onClick={onStartScreenShare}
          >
            Start Screen Share Now
          </button>
        </div>
      )}
      {isScreenSharing && (
        <div className="screen-share-overlay-bar host-overlay">
          <span className="live-share-badge">
            <span className="live-dot-pulse" /> 🔴 LIVE SCREEN SHARING ACTIVE
          </span>
          <span className="screen-share-info">
            Sharing video with{' '}
            {activeParty?.host_email === currentUserEmail
              ? activeParty?.guest_email
              : activeParty?.host_email}
          </span>
          <button
            type="button"
            className="screen-share-stop-btn"
            onClick={onStopScreenShare}
          >
            Stop Sharing
          </button>
        </div>
      )}
      {isPartyGuest && (remoteStream || latestFrameUrl) ? (
        <div
          ref={remoteViewportRef}
          className={`screen-share-viewport remote-viewport${isBigScreen ? ' is-big-screen' : ''}`}
        >
          {remoteStream ? (
            <>
              <video
                ref={(node) => {
                  if (node && remoteStream && node.srcObject !== remoteStream) {
                    node.srcObject = remoteStream
                    node.play().catch(() => {})
                  }
                }}
                className="screen-share-video"
                autoPlay
                playsInline
                controls
              />
              <div className="screen-share-overlay-bar">
                <span className="live-share-badge">
                  <span className="live-dot-pulse" /> 🔴 WATCHING HOST LIVE STREAM
                </span>
                <span className="screen-share-info">
                  Receiving live stream from {activeParty?.host_email}
                </span>
                <button
                  type="button"
                  className="screen-share-bigscreen-btn"
                  onClick={() => {
                    setIsBigScreen((prev) => !prev)
                    if (!isBigScreen && remoteViewportRef.current?.requestFullscreen) {
                      remoteViewportRef.current.requestFullscreen().catch(() => {})
                    } else if (document.fullscreenElement && document.exitFullscreen) {
                      document.exitFullscreen().catch(() => {})
                    }
                  }}
                  title={isBigScreen ? 'Exit Big Screen Mode' : 'Enter Big Screen Mode'}
                >
                  {isBigScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  <span>{isBigScreen ? 'Exit Big Screen' : 'Big Screen'}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="screen-share-frame-viewport">
              <img
                src={latestFrameUrl!}
                className="screen-share-video screen-share-live-img"
                alt="Host Live Video Stream"
              />
              <div className="screen-share-overlay-bar">
                <span className="live-share-badge">
                  <span className="live-dot-pulse" /> 🔴 WATCHING HOST LIVE STREAM
                </span>
                <span className="screen-share-info">
                  Receiving live video from {activeParty?.host_email}
                </span>
                <button
                  type="button"
                  className="screen-share-bigscreen-btn"
                  onClick={() => {
                    setIsBigScreen((prev) => !prev)
                    if (!isBigScreen && remoteViewportRef.current?.requestFullscreen) {
                      remoteViewportRef.current.requestFullscreen().catch(() => {})
                    } else if (document.fullscreenElement && document.exitFullscreen) {
                      document.exitFullscreen().catch(() => {})
                    }
                  }}
                  title={isBigScreen ? 'Exit Big Screen Mode' : 'Enter Big Screen Mode'}
                >
                  {isBigScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  <span>{isBigScreen ? 'Exit Big Screen' : 'Big Screen'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : streamUrl && isHlsStream ? (
        <HlsPlayer
          className="stream-player"
          src={streamUrl}
          poster={movie.still}
          title={`${movie.title} stream`}
          autoPlay
          controls
          onPlay={() => onStartWatching(movie)}
          onError={() => {}}
        />
      ) : streamUrl && !opensExternally ? (
        <iframe
          className="stream-player"
          src={streamUrl}
          title={`${movie.title} stream`}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          // MegaBuzz (megaplay.buzz) requires a referer; every other embed is
          // sent with no referer for privacy.
          referrerPolicy={activeProviderId === 'megabuzz' ? 'origin' : 'no-referrer'}
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
  )

  if (isAnimeMovie && isSeries) {
    return (
      <section className="screen watch-screen anime-watch-screen">
        <DetailTopBar onBack={onBack} dark />

        <div className="anime-watch-main-grid">
          {/* LEFT COLUMN: Player -> Servers & SUB/DUB row -> Title/Genre/Synopsis/Meta */}
          <div className="anime-watch-left-col">
            {renderPlayerSection()}

            <div className="anime-server-subdub-row">
              {!isPartyGuest && (
                <div className="server-selector anime-inline-servers" role="radiogroup" aria-label="Streaming server">
                  {(() => {
                    const filteredOptions = streamProviderOptions.filter(
                      (provider) => provider.id !== 'oceanplay' && animeProviderIds.includes(provider.id),
                    )
                    return filteredOptions.map((provider) => {
                      const isActive = provider.id === activeProviderId
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
                    })
                  })()}
                </div>
              )}

              <div className="watch-lang-toggle" role="group" aria-label="Audio language">
                <button type="button" className={language === 'sub' ? 'active' : ''} onClick={() => setLanguage('sub')}>
                  SUB
                </button>
                <button type="button" className={language === 'dub' ? 'active' : ''} onClick={() => setLanguage('dub')}>
                  DUB
                </button>
              </div>
            </div>

            <div className="anime-details-block">
              <h1 className="anime-watch-title">{movie.title}</h1>
              <p className="anime-watch-genre">{movie.genres[0] ?? 'Anime'}</p>
              <p className="watch-synopsis">
                <strong>{movie.year}: </strong>
                {movie.synopsis}
              </p>
              <Metadata movie={movie} />
            </div>
          </div>

          {/* RIGHT COLUMN: Episode Sidebar -> Sandbox */}
          <div className="anime-watch-right-col">
            {renderEpisodePanel(true)}

            {!isPartyGuest && (
              <label className="stream-sandbox-toggle">
                <span>
                  <strong>Sandbox</strong>
                  <small>
                    {streamSandboxEnabled ? 'Blocks popups and redirects' : 'Allows full player behavior'}
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
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="screen watch-screen">
      <DetailTopBar onBack={onBack} dark />

      {renderPlayerSection()}

      <div className="watch-topbar">
        {!isPhubVideo && !isPartyGuest && (
          <button
            className="watch-play"
            type="button"
            disabled={!streamUrl || streamLoading}
            onClick={openCurrentStream}
            title={streamUrl ? `Open ${currentProvider.name}` : 'Waiting for stream id'}
            aria-label={
              streamUrl
                ? `Open ${currentProvider.name} stream for ${movie.title}`
                : `Waiting for stream id for ${movie.title}`
            }
          >
            <Play fill="currentColor" strokeWidth={0} />
            <span>Watch</span>
          </button>
        )}

        {activeParty && isPartyHost && (
          <button
            type="button"
            className={`watch-screenshare-trigger-btn${isScreenSharing ? ' sharing' : ''}`}
            onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
            title={isScreenSharing ? 'Stop Screen Sharing' : 'Start Live Video Screen Share'}
          >
            <Tv size={16} />
            <span>{isScreenSharing ? 'Stop Share' : 'Screen Share'}</span>
          </button>
        )}

        {activeParty && isPartyGuest && (
          <span className="watch-screenshare-badge guest-watch-only">
            🔴 Watching {activeParty.host_email}&apos;s Screen
          </span>
        )}

        <div className="watch-title-block">
          <h2 className={`watch-title-main${isPhubVideo ? ' phub-title-main' : ''}`}>{movie.title}</h2>
          <p className="watch-title-genre">{movie.genres[0] ?? 'Movie'}</p>
        </div>

        {(isAnimeMovie || isHentai) && !isPhubVideo ? (
          <div className="watch-lang-toggle" role="group" aria-label="Audio language">
            <button type="button" className={language === 'sub' ? 'active' : ''} onClick={() => setLanguage('sub')}>
              SUB
            </button>
            <button type="button" className={language === 'dub' ? 'active' : ''} onClick={() => setLanguage('dub')}>
              DUB
            </button>
          </div>
        ) : (
          <span className="watch-topbar-spacer" aria-hidden="true" />
        )}
      </div>

      <div className={`watch-lower${!isAnimeMovie && isSeries ? ' has-episodes' : ''}`}>
        <div className="watch-lower-left">
          <p className="watch-synopsis">
            {!isPhubVideo && <strong>{movie.year}: </strong>}
            {movie.synopsis}
          </p>

          {isPhubVideo && similarPhubVideos.length > 0 && (
            <div className="watch-similar-wrapper" style={{ marginTop: 24, width: '100%' }}>
              <LordPhubRailRow
                title="Similar Content"
                videos={similarPhubVideos}
                onVideoClick={(video) => onSelectMovie?.(hanimeToMovieHelper(video))}
              />
            </div>
          )}
          {!isPhubVideo && <Metadata movie={movie} />}

          {!isPhubVideo && (
            <button
              type="button"
              className="watch-mylist-btn"
              onClick={onSave}
              title={isSaved ? 'Saved to My List' : 'Add to My List'}
            >
              {isSaved ? <Check /> : <Plus />}
              <span>{isSaved ? 'Saved' : 'My List'}</span>
            </button>
          )}

          {!isPhubVideo && (
            <button
              type="button"
              className={`watch-mylist-btn watch-like-btn${isLiked ? ' is-liked' : ''}`}
              onClick={onToggleLike}
              aria-pressed={isLiked}
              title={isLiked ? 'Liked' : 'Like'}
            >
              <Heart fill={isLiked ? 'currentColor' : 'none'} />
              <span>{isLiked ? 'Liked' : 'Like'}</span>
            </button>
          )}

          {!isPhubVideo && !isPartyGuest && (
            <label className="stream-sandbox-toggle">
              <span>
                <strong>Sandbox</strong>
                <small>
                  {streamSandboxEnabled ? 'Blocks popups and redirects' : 'Allows full player behavior'}
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
          )}

          {!isPhubVideo && !isJavVideo && !isPartyGuest && (
            <div className="server-selector" role="radiogroup" aria-label="Streaming server">
              {(() => {
                const filteredOptions = isJavVideo
                  ? streamProviderOptions.filter((provider) => provider.id === 'apijav')
                  : isPhubVideo
                    ? streamProviderOptions.filter((provider) => provider.id === 'phubplay')
                    : isHentai
                      ? streamProviderOptions.filter((provider) => provider.id === 'oceanplay')
                      : streamProviderOptions.filter((provider) => {
                          if (
                            provider.id === 'oceanplay' ||
                            provider.id === 'apijav' ||
                            provider.id === 'phubplay'
                          )
                            return false
                          const isAnimeProvider = animeProviderIds.includes(provider.id)
                          return isAnimeMovie ? isAnimeProvider : provider.id === 'vidking' || !isAnimeProvider
                        })

                return filteredOptions.map((provider) => {
                  const isActive = provider.id === activeProviderId
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
                })
              })()}
            </div>
          )}
        </div>

        {!isAnimeMovie && isSeries && renderEpisodePanel(false)}
      </div>
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
  designMode: 'apple' | 'netflix'
  searchRecommendations: Movie[]
  searchMode: 'anime' | 'drama'
  onSearchModeChange: (mode: 'anime' | 'drama') => void
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
  designMode,
  searchRecommendations,
  searchMode,
  onSearchModeChange,
}: SearchScreenProps) {
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      onClear()
      return
    }

    const timer = setTimeout(() => {
      onSearch(trimmed)
    }, 400)

    return () => clearTimeout(timer)
  }, [query, onSearch, onClear])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearch(query)
  }



  const renderNetflixSearchItem = (movie: Movie) => {
    return (
      <div key={movie.id} className="netflix-search-item" onClick={() => onOpenDetail(movie)}>
        <div className="netflix-search-poster-wrapper">
          <img
            src={movie.still || movie.poster}
            alt={movie.title}
            className="netflix-search-poster-img"
            onError={(e) => {
              e.currentTarget.src = movie.poster;
            }}
          />
          {movie.badges?.includes('TOP 10') && (
            <div className="netflix-search-top10-tag">
              <span className="netflix-top-text">TOP</span>
              <span className="netflix-10-text">10</span>
            </div>
          )}
          {movie.label && (
            <div className="netflix-search-poster-badge">
              {movie.label}
            </div>
          )}
        </div>
        <span className="netflix-search-item-title">{movie.title}</span>
        {movie.year && movie.year !== 'N/A' && (
          <span className="netflix-search-item-year">{movie.year}</span>
        )}
      </div>
    )
  }

  return (
    <section className="screen search-screen">
      {designMode === 'netflix' ? (
        <div className="netflix-search-bar-container">
          <button className="netflix-search-back-btn" type="button" onClick={onClose}>
            <ChevronLeft size={28} />
          </button>
          <div className="netflix-search-input-wrapper">
            <Search className="netflix-search-input-icon" size={20} />
            <input
              className="netflix-search-input"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search shows, movies, games..."
              aria-label="Search shows, movies, games..."
            />
            <button className="netflix-mic-btn" type="button" title="Voice search">
              <Mic size={20} />
            </button>
          </div>
          <div className="search-mode-toggle" role="group" aria-label="Search type">
            <button
              type="button"
              className={searchMode === 'anime' ? 'active' : ''}
              aria-pressed={searchMode === 'anime'}
              onClick={() => {
                onSearchModeChange('anime')
                if (query.trim()) onSearch(query)
              }}
            >
              Anime
            </button>
            <button
              type="button"
              className={searchMode === 'drama' ? 'active' : ''}
              aria-pressed={searchMode === 'drama'}
              onClick={() => {
                onSearchModeChange('drama')
                if (query.trim()) onSearch(query)
              }}
            >
              Drama
            </button>
          </div>
        </div>
      ) : (
        <header className="search-header">
          <h1>Search</h1>
        </header>
      )}

      {designMode === 'netflix' ? (
        <section className="search-content visual-search netflix-search-content">
          {loading && <LoadingStrip label="Searching Netflix" />}
          {error && <InlineAlert message={error} />}

          {!query && (
            <div className="netflix-recommended-panel">
              <h2 className="netflix-recommended-title">
                Recommended {searchMode === 'drama' ? 'Dramas' : 'Anime'}
              </h2>
              <div className="netflix-search-list">
                {searchRecommendations.map(renderNetflixSearchItem)}
              </div>
            </div>
          )}

          {query && results.length > 0 && (
            <div className="netflix-recommended-panel">
              <h2 className="netflix-recommended-title">Search Results</h2>
              <div className="netflix-search-list">
                {results.map(renderNetflixSearchItem)}
              </div>
            </div>
          )}

          {query && !loading && results.length === 0 && (
            <div className="netflix-no-results">
              <p>No results found for "{query}".</p>
            </div>
          )}
        </section>
      ) : (
        <section className="search-content visual-search">
          {loading && <LoadingStrip label="Searching Lumen" />}
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
      )}

      {designMode !== 'netflix' && (
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
      )}

      {designMode !== 'netflix' && query && results.length > 0 && (
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
  onSwitchProfile: () => void
  onSelectProfile?: (name: string) => void
  onSetLordPin?: () => void
  profiles: UserProfile[]
  designMode: 'apple' | 'netflix'
}

function LoginScreen({
  currentUser,
  onLogin,
  onLogout,
  onBack,
  onSwitchProfile,
  onSelectProfile,
  profiles,
  designMode,
}: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Mobile (numi-style) login: the email/password form is hidden until the
  // user taps "Login" or the email button.
  const [mobileEmailOpen, setMobileEmailOpen] = useState(false)

  // Admin "Manage Account" panel (main account only). Rendered inline in the
  // Security section (no popup). Listing/editing requires the admin key.
  const [accounts, setAccounts] = useState<Account[]>([])
  const [adminKeyInput, setAdminKeyInput] = useState<string>(() => getAdminKey())

  // "Manage Devices" panel — logged-in sessions for this account.
  const [devicesOpen, setDevicesOpen] = useState(false)
  const [devices, setDevices] = useState<DeviceSession[]>([])
  const [accEmail, setAccEmail] = useState('')
  const [accPass, setAccPass] = useState('')
  const [accEditing, setAccEditing] = useState<string | null>(null)
  const [accError, setAccError] = useState('')
  const [accBusy, setAccBusy] = useState(false)
  // Per-account revealed password (key present = shown; null = loading).
  const [revealed, setRevealed] = useState<Record<string, string | null>>({})
  // Change-admin-password form.
  const [newAdminPw, setNewAdminPw] = useState('')
  const [adminPwMsg, setAdminPwMsg] = useState('')
  const [adminPwBusy, setAdminPwBusy] = useState(false)
  // Collapsible sections (closed by default; open on click).
  const [manageAccountsOpen, setManageAccountsOpen] = useState(false)
  const [changeAdminOpen, setChangeAdminOpen] = useState(false)
  const [changeLordOpen, setChangeLordOpen] = useState(false)
  const [newLordPin, setNewLordPin] = useState('')
  const [lordPinMsg, setLordPinMsg] = useState('')
  const [lordPinBusy, setLordPinBusy] = useState(false)

  // Account sections render inline on the right (no popups).
  const [accountTab, setAccountTab] = useState<
    'overview' | 'membership' | 'security' | 'devices' | 'profiles'
  >('overview')

  const adminEmail = currentUser?.email ?? ''

  // Load the real device sessions for this account (used by the Devices tab).
  const loadDevices = () => {
    const email = currentUser?.email
    setDevices(withCurrentDevice(readCachedDevices(email)))
    if (email) {
      void fetchDevicesApi(email).then((list) => {
        const merged = withCurrentDevice(list)
        setDevices(merged)
        writeCachedDevices(email, merged)
      })
    }
  }

  const selectAccountTab = (
    tab: 'overview' | 'membership' | 'security' | 'devices' | 'profiles',
  ) => {
    setAccountTab(tab)
    if (tab === 'devices') {
      loadDevices()
    }
    if (tab === 'security' && isMainAccount(currentUser?.email)) {
      void loadAccounts()
    }
  }

  // Membership plans shown on the Membership tab.
  const membershipPlans = [
    {
      id: 'mobile',
      name: 'Mobile',
      price: '₹149/mo',
      quality: '480p',
      resolution: 'Good',
      devices: 'Phone or tablet',
      screens: '1 screen',
    },
    {
      id: 'standard',
      name: 'Standard',
      price: '₹499/mo',
      quality: '1080p',
      resolution: 'Great',
      devices: 'TV, computer, phone, tablet',
      screens: '2 screens',
    },
    {
      id: 'premium',
      name: 'Premium 4K',
      price: '₹649/mo',
      quality: '4K + HDR',
      resolution: 'Best',
      devices: 'TV, computer, phone, tablet',
      screens: '4 screens',
    },
  ]
  const currentPlanId = 'premium'

  const tabMeta = {
    overview: { title: 'Account', subtitle: 'Membership details' },
    membership: { title: 'Membership', subtitle: 'Choose the plan that fits you' },
    security: { title: 'Security', subtitle: 'Sign-in and access' },
    devices: { title: 'Devices', subtitle: 'Where you are signed in' },
    profiles: { title: 'Profiles', subtitle: 'Who is watching' },
  }[accountTab]

  // Login page background image (served from /public).
  const loginBg = '/login-bg.jpeg'

  const loadAccounts = async () => {
    const result = await listAccountsApi()
    setAccounts(result.accounts)
    setAccError(result.ok ? '' : result.error ?? '')
  }

  // Store the entered admin key for this session, then (re)load the list.
  const unlockAccounts = () => {
    setAdminKey(adminKeyInput.trim())
    setAccError('')
    setRevealed({})
    void loadAccounts()
  }

  // Toggle showing a single account's password (fetched on demand).
  const toggleReveal = async (email: string) => {
    if (email in revealed) {
      setRevealed((current) => {
        const next = { ...current }
        delete next[email]
        return next
      })
      return
    }
    setRevealed((current) => ({ ...current, [email]: null })) // loading
    const result = await revealPasswordApi(email)
    setRevealed((current) => ({
      ...current,
      [email]: result.ok ? result.password ?? '(unavailable)' : result.error ?? '(error)',
    }))
  }

  const submitAdminPassword = async () => {
    setAdminPwMsg('')
    const next = newAdminPw.trim()
    if (next.length < 6) {
      setAdminPwMsg('Admin password must be at least 6 characters.')
      return
    }
    setAdminPwBusy(true)
    const result = await changeAdminPasswordApi(next)
    setAdminPwBusy(false)
    if (result.ok) {
      setAdminPwMsg('Admin password updated.')
      setNewAdminPw('')
      setAdminKeyInput(next)
    } else {
      setAdminPwMsg(result.error ?? 'Could not update admin password.')
    }
  }

  const submitLordPin = async () => {
    setLordPinMsg('')
    const pin = newLordPin.trim()
    if (!/^\d{4}$/.test(pin)) {
      setLordPinMsg('PIN must be exactly 4 digits.')
      return
    }
    if (!isMainAccount(currentUser?.email)) {
      setLordPinMsg('Only the admin can change the Lord PIN.')
      return
    }
    setLordPinBusy(true)
    const ok = await saveRemoteLordPin(currentUser?.email ?? '', pin)
    setLordPinBusy(false)
    if (ok) {
      try {
        localStorage.setItem('lord_pin', pin)
      } catch {
        // ignore
      }
      setLordPinMsg('Lord PIN updated.')
      setNewLordPin('')
    } else {
      setLordPinMsg('Could not update. Unlock with your admin password first.')
    }
  }

  // Log a single device out of the account. Logging out the current device
  // ends this session (signs the viewer out); logging out another device just
  // removes its real session from the account.
  const logoutDevice = (id: string) => {
    const email = currentUser?.email
    const target = devices.find((device) => device.id === id)
    if (target?.current) {
      if (email) {
        void removeDeviceApi(email, id)
      }
      setDevicesOpen(false)
      onLogout()
      return
    }
    const remaining = withCurrentDevice(devices.filter((device) => device.id !== id))
    setDevices(remaining)
    writeCachedDevices(email, remaining)
    if (email) {
      void removeDeviceApi(email, id).then((list) => {
        const merged = withCurrentDevice(list)
        setDevices(merged)
        writeCachedDevices(email, merged)
      })
    }
  }

  // Log out of every other device, keeping only the current session.
  const logoutOtherDevices = () => {
    const email = currentUser?.email
    const keepId = currentDeviceId()
    const remaining = withCurrentDevice(devices.filter((device) => device.id === keepId))
    setDevices(remaining)
    writeCachedDevices(email, remaining)
    if (email) {
      void removeOtherDevicesApi(email, keepId).then((list) => {
        const merged = withCurrentDevice(list)
        setDevices(merged)
        writeCachedDevices(email, merged)
      })
    }
  }

  const submitAccount = async () => {
    setAccError('')
    setAccBusy(true)
    const result = await saveAccountApi(
      adminEmail,
      accEmail.trim().toLowerCase(),
      accPass,
      accEditing ?? undefined,
    )
    setAccBusy(false)
    if (!result.ok) {
      setAccError(result.error ?? 'Could not save account.')
      return
    }
    setAccEmail('')
    setAccPass('')
    setAccEditing(null)
    void loadAccounts()
  }

  const startEditAccount = (account: Account) => {
    setAccEditing(account.email)
    setAccEmail(account.email)
    // Passwords are hashed and never returned, so editing requires setting a
    // new one (leave the field to type a fresh password).
    setAccPass('')
    setAccError('')
  }

  const removeAccount = async (emailToRemove: string) => {
    setAccError('')
    setAccBusy(true)
    const result = await deleteAccountApi(adminEmail, emailToRemove)
    setAccBusy(false)
    if (!result.ok) {
      setAccError(result.error ?? 'Could not remove account.')
      return
    }
    void loadAccounts()
  }

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    if (!trimmedPassword) {
      setError('Please enter your password.')
      return
    }

    // All credentials are verified server-side: the main account against the
    // server-only ADMIN_PASSWORD, everyone else against the accounts table.
    // No password is baked into the client.
    setLoading(true)
    const ok = await verifyCredentials(trimmedEmail, trimmedPassword)
    setLoading(false)

    if (!ok) {
      setError('Invalid email or password.')
      return
    }

    onLogin({
      name: trimmedEmail.split('@')[0],
      email: trimmedEmail,
    })
  }

  // Social sign-in previously logged in with no password (and could grant the
  // admin account), which was an authentication bypass. Until a real OAuth flow
  // exists, it's disabled rather than granting passwordless access.
  const handleSocialLogin = (provider: 'Apple' | 'Google') => {
    setError(`${provider} sign-in isn't available yet. Please sign in with your email and password.`)
  }

  const handleRequestAccess = () => {
    const subject = 'Lumen login access request'
    const body = [
      'Hi,',
      '',
      'I would like to request a login ID and password for Lumen.',
      email ? `My email: ${email}` : 'My email: ',
      '',
      'Thanks.',
    ].join('\n')
    const mailto = `mailto:avnishpc00@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailto, '_blank')
  }

  if (currentUser) {
    const designName = designMode === 'netflix' ? 'Anime' : 'Lumen'
    const planName = designMode === 'netflix' ? 'Anime Premium 4K' : 'Lumen Premium 4K'

    // Order for the account overview: the profile currently in use first, the
    // Kids profile always last, everything else in between.
    const orderedProfiles = [...profiles].sort((a, b) => {
      const aCurrent = a.name.toLowerCase() === currentUser.name.toLowerCase()
      const bCurrent = b.name.toLowerCase() === currentUser.name.toLowerCase()
      if (aCurrent !== bCurrent) return aCurrent ? -1 : 1
      const aKids = a.avatarColor === 'kids'
      const bKids = b.avatarColor === 'kids'
      if (aKids !== bKids) return aKids ? 1 : -1
      return 0
    })

    return (
      <section className="screen account-screen">
        <div className="account-shell">
          <aside className="account-sidebar">
            <button className="account-back" type="button" onClick={onBack}>
              <ChevronLeft size={18} />
              <span>Back to {designName}</span>
            </button>

            <nav className="account-nav" aria-label="Account sections">
              <button
                className={`account-nav-item${accountTab === 'overview' ? ' active' : ''}`}
                type="button"
                onClick={() => selectAccountTab('overview')}
              >
                <Home size={18} />
                <span>Overview</span>
              </button>
              <button
                className={`account-nav-item${accountTab === 'membership' ? ' active' : ''}`}
                type="button"
                onClick={() => selectAccountTab('membership')}
              >
                <CircleUserRound size={18} />
                <span>Membership</span>
              </button>
              <button
                className={`account-nav-item${accountTab === 'security' ? ' active' : ''}`}
                type="button"
                onClick={() => selectAccountTab('security')}
              >
                <Eye size={18} />
                <span>Security</span>
              </button>
              <button
                className={`account-nav-item${accountTab === 'devices' ? ' active' : ''}`}
                type="button"
                onClick={() => selectAccountTab('devices')}
              >
                <Tv size={18} />
                <span>Devices</span>
              </button>
              <button
                className={`account-nav-item${accountTab === 'profiles' ? ' active' : ''}`}
                type="button"
                onClick={() => selectAccountTab('profiles')}
              >
                <UserCog size={18} />
                <span>Profiles</span>
              </button>
            </nav>
          </aside>

          <main className="account-main">
            <h1 className="account-title">{tabMeta.title}</h1>
            <p className="account-subtitle">{tabMeta.subtitle}</p>

            {accountTab === 'overview' && (
            <>
            {orderedProfiles.length > 0 && (
              <div className="account-profiles-card">
                {orderedProfiles.map((profile) => (
                  <button
                    key={profile.name}
                    type="button"
                    className="account-profile-tile"
                    title={`Switch to ${profile.name}`}
                    onClick={() => (onSelectProfile ? onSelectProfile(profile.name) : onSwitchProfile())}
                  >
                    {profile.avatarColor === 'kids' ? (
                      <div className="profile-avatar avatar-kids account-profile-avatar">
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
                      <div
                        className="profile-avatar account-profile-avatar"
                        style={{ overflow: 'hidden' }}
                      >
                        <img
                          src={getAvatarSrc(profile.avatarColor)}
                          alt={profile.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      </div>
                    )}
                    <span className="account-profile-name">{profile.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="account-card">
              <span className="account-badge">Member since 2025</span>
              <h2 className="account-plan">{planName}</h2>
              <p className="account-plan-sub">Next payment: 4 August 2026</p>
              <p className="account-plan-email">
                <span className="account-email-avatar">
                  {renderProfileAvatarMini(currentUser, profiles)}
                </span>
                {currentUser.email}
              </p>

              <button
                className="account-row account-card-row"
                type="button"
                onClick={onSwitchProfile}
              >
                <span className="account-row-label">Manage membership</span>
                <ChevronRight size={18} />
              </button>
            </div>

            <p className="account-links-title">At a glance</p>
            <div className="account-stats">
              <div className="account-stat">
                <span className="account-stat-value">{profiles.length}</span>
                <span className="account-stat-label">Profiles</span>
              </div>
              <div className="account-stat">
                <span className="account-stat-value">
                  {membershipPlans.find((plan) => plan.id === currentPlanId)?.quality ?? '4K'}
                </span>
                <span className="account-stat-label">Video quality</span>
              </div>
              <div className="account-stat">
                <span className="account-stat-value">
                  {(membershipPlans.find((plan) => plan.id === currentPlanId)?.screens ?? '4 screens').replace(
                    ' screens',
                    '',
                  ).replace(' screen', '')}
                </span>
                <span className="account-stat-label">Max screens</span>
              </div>
              <div className="account-stat">
                <span className="account-stat-value">2025</span>
                <span className="account-stat-label">Member since</span>
              </div>
            </div>
            </>
            )}

            {accountTab === 'membership' && (
              <div className="account-plans">
                {membershipPlans.map((plan) => {
                  const isCurrent = plan.id === currentPlanId
                  return (
                    <div
                      key={plan.id}
                      className={`account-plan-card${isCurrent ? ' is-current' : ''}`}
                    >
                      {isCurrent && <span className="account-plan-tag">Current plan</span>}
                      <h2 className="account-plan-name">{plan.name}</h2>
                      <p className="account-plan-price">{plan.price}</p>
                      <ul className="account-plan-features">
                        <li>Video quality: {plan.quality}</li>
                        <li>Resolution: {plan.resolution}</li>
                        <li>{plan.devices}</li>
                        <li>{plan.screens}</li>
                      </ul>
                      <button
                        className={`account-plan-btn${isCurrent ? ' is-current' : ''}`}
                        type="button"
                        disabled={isCurrent}
                      >
                        {isCurrent ? 'Current plan' : 'Switch to this plan'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {accountTab === 'security' && (
              <div className="account-links">
                <div className="account-card">
                  <p className="account-plan-email">
                    <span className="account-email-avatar">
                      {renderProfileAvatarMini(currentUser, profiles)}
                    </span>
                    {currentUser.email}
                  </p>
                  <p className="account-plan-sub">Password: ••••••••</p>
                </div>
                {isMainAccount(currentUser.email) && (
                  <button
                    type="button"
                    className="account-row account-manage-toggle"
                    onClick={() => setManageAccountsOpen((value) => !value)}
                    aria-expanded={manageAccountsOpen}
                  >
                    <span className="account-row-left">
                      <UserCog size={18} />
                      <span>Manage Accounts</span>
                    </span>
                    <ChevronRight
                      size={18}
                      style={{
                        transform: manageAccountsOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>
                )}
                {isMainAccount(currentUser.email) && manageAccountsOpen && (
                  <div className="account-card account-manage-inline">
                    <p className="account-manage-note">
                      Enter your admin password to unlock. Add, edit or remove
                      sign-in accounts. (This is separate from the Lord PIN.)
                    </p>

                    <div className="account-manage-form">
                      <input
                        type="password"
                        className="account-manage-input"
                        placeholder="Admin password"
                        autoComplete="off"
                        value={adminKeyInput}
                        onChange={(event) => setAdminKeyInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') unlockAccounts()
                        }}
                      />
                      <button
                        className="account-manage-save"
                        type="button"
                        onClick={unlockAccounts}
                      >
                        Unlock
                      </button>
                    </div>

                    <div className="account-manage-form">
                      <input
                        type="email"
                        className="account-manage-input"
                        placeholder="email@example.com"
                        value={accEmail}
                        onChange={(event) => setAccEmail(event.target.value)}
                      />
                      <input
                        type="text"
                        className="account-manage-input"
                        placeholder={accEditing ? 'New password (min 4 chars)' : 'Password (min 4 chars)'}
                        value={accPass}
                        onChange={(event) => setAccPass(event.target.value)}
                      />
                      <button
                        className="account-manage-save"
                        type="button"
                        disabled={accBusy}
                        onClick={() => void submitAccount()}
                      >
                        {accEditing ? 'Save' : 'Add'}
                      </button>
                      {accEditing && (
                        <button
                          className="account-manage-cancel"
                          type="button"
                          onClick={() => {
                            setAccEditing(null)
                            setAccEmail('')
                            setAccPass('')
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {accError && <p className="bff-status">{accError}</p>}

                    <div className="account-manage-list">
                      {accounts.length === 0 ? (
                        accError ? null : <p className="bff-empty">No accounts added yet.</p>
                      ) : (
                        accounts.map((account) => {
                          const shown = account.email in revealed
                          const value = revealed[account.email]
                          return (
                            <div key={account.email} className="account-manage-row">
                              <div className="account-manage-cred">
                                <span className="account-manage-email">{account.email}</span>
                                <span className="account-manage-pass">
                                  {shown ? (value === null ? '…' : value || '(unavailable)') : '••••••••'}
                                </span>
                              </div>
                              <button
                                className="account-manage-edit"
                                type="button"
                                title={shown ? 'Hide password' : 'Show password'}
                                onClick={() => void toggleReveal(account.email)}
                              >
                                {shown ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                              <button
                                className="account-manage-edit"
                                type="button"
                                title="Edit"
                                onClick={() => startEditAccount(account)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="account-manage-remove"
                                type="button"
                                title="Remove"
                                disabled={accBusy}
                                onClick={() => void removeAccount(account.email)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
                {isMainAccount(currentUser.email) && (
                  <button
                    type="button"
                    className="account-row account-manage-toggle"
                    onClick={() => setChangeAdminOpen((value) => !value)}
                    aria-expanded={changeAdminOpen}
                  >
                    <span className="account-row-left">
                      <KeyRound size={18} />
                      <span>Change Admin Password</span>
                    </span>
                    <ChevronRight
                      size={18}
                      style={{
                        transform: changeAdminOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>
                )}
                {isMainAccount(currentUser.email) && changeAdminOpen && (
                  <div className="account-card account-manage-inline">
                    <p className="account-manage-note">
                      Used to sign in as the main account and to unlock account
                      management. Separate from the Lord PIN.
                    </p>
                    <div className="account-manage-form">
                      <input
                        type="password"
                        className="account-manage-input"
                        placeholder="New admin password (min 6 chars)"
                        autoComplete="new-password"
                        value={newAdminPw}
                        onChange={(event) => setNewAdminPw(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void submitAdminPassword()
                        }}
                      />
                      <button
                        className="account-manage-save"
                        type="button"
                        disabled={adminPwBusy}
                        onClick={() => void submitAdminPassword()}
                      >
                        Update
                      </button>
                    </div>
                    {adminPwMsg && <p className="bff-status">{adminPwMsg}</p>}
                  </div>
                )}
                {isMainAccount(currentUser.email) && (
                  <button
                    type="button"
                    className="account-row account-manage-toggle"
                    onClick={() => setChangeLordOpen((value) => !value)}
                    aria-expanded={changeLordOpen}
                  >
                    <span className="account-row-left">
                      <KeyRound size={18} />
                      <span>Change Lord Password</span>
                    </span>
                    <ChevronRight
                      size={18}
                      style={{
                        transform: changeLordOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>
                )}
                {isMainAccount(currentUser.email) && changeLordOpen && (
                  <div className="account-card account-manage-inline">
                    <p className="account-manage-note">
                      The 4-digit PIN that unlocks the hidden Lord profile.
                      Requires unlocking with your admin password first.
                    </p>
                    <div className="account-manage-form">
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        className="account-manage-input"
                        placeholder="New 4-digit PIN"
                        value={newLordPin}
                        onChange={(event) =>
                          setNewLordPin(event.target.value.replace(/\D/g, '').slice(0, 4))
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void submitLordPin()
                        }}
                      />
                      <button
                        className="account-manage-save"
                        type="button"
                        disabled={lordPinBusy}
                        onClick={() => void submitLordPin()}
                      >
                        Update
                      </button>
                    </div>
                    {lordPinMsg && <p className="bff-status">{lordPinMsg}</p>}
                  </div>
                )}
                <button
                  className="account-row account-signout"
                  type="button"
                  onClick={onLogout}
                >
                  <span className="account-row-left">
                    <LogOut size={18} />
                    <span>Sign out</span>
                  </span>
                  <ChevronRight size={18} />
                </button>
              </div>
            )}

            {accountTab === 'devices' && (
              <div className="account-devices">
                {devices.filter((device) => device.current).length > 0 && (
                  <section className="device-group">
                    <h2 className="device-group-title">This Device</h2>
                    {devices
                      .filter((device) => device.current)
                      .map((device) => (
                        <div key={device.id} className="device-row">
                          <span className={`device-icon device-icon-${device.type}`}>
                            {device.type === 'tv' && <Tv size={22} />}
                            {device.type === 'mobile' && <Smartphone size={22} />}
                            {device.type === 'tablet' && <Tablet size={22} />}
                            {device.type === 'desktop' && <Monitor size={22} />}
                          </span>
                          <div className="device-info">
                            <span className="device-name">{device.name}</span>
                            <span className="device-meta">Last used : {deviceLastUsedLabel(device)}</span>
                          </div>
                          <button
                            className="device-logout"
                            type="button"
                            onClick={() => logoutDevice(device.id)}
                          >
                            Log Out
                          </button>
                        </div>
                      ))}
                  </section>
                )}
                {devices.filter((device) => !device.current).length > 0 && (
                  <section className="device-group">
                    <h2 className="device-group-title">Other Devices</h2>
                    {devices
                      .filter((device) => !device.current)
                      .map((device) => (
                        <div key={device.id} className="device-row">
                          <span className={`device-icon device-icon-${device.type}`}>
                            {device.type === 'tv' && <Tv size={22} />}
                            {device.type === 'mobile' && <Smartphone size={22} />}
                            {device.type === 'tablet' && <Tablet size={22} />}
                            {device.type === 'desktop' && <Monitor size={22} />}
                          </span>
                          <div className="device-info">
                            <span className="device-name">{device.name}</span>
                            <span className="device-meta">Last used : {deviceLastUsedLabel(device)}</span>
                          </div>
                          <button
                            className="device-logout"
                            type="button"
                            onClick={() => logoutDevice(device.id)}
                          >
                            Log Out
                          </button>
                        </div>
                      ))}
                  </section>
                )}
                {devices.filter((device) => !device.current).length > 0 && (
                  <button
                    className="device-logout-all"
                    type="button"
                    onClick={logoutOtherDevices}
                  >
                    Log out of all other devices
                  </button>
                )}
                {devices.length === 0 && (
                  <p className="account-empty">No active devices found.</p>
                )}
              </div>
            )}

            {accountTab === 'profiles' && (
              <>
                {orderedProfiles.length > 0 && (
                  <div className="account-profiles-card">
                    {orderedProfiles.map((profile) => (
                      <button
                        key={profile.name}
                        type="button"
                        className="account-profile-tile"
                        title={profile.name}
                        onClick={onSwitchProfile}
                      >
                        {profile.avatarColor === 'kids' ? (
                          <div className="profile-avatar avatar-kids account-profile-avatar">
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
                          <div
                            className="profile-avatar account-profile-avatar"
                            style={{ overflow: 'hidden' }}
                          >
                            <img
                              src={getAvatarSrc(profile.avatarColor)}
                              alt={profile.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </div>
                        )}
                        <span className="account-profile-name">{profile.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="account-links">
                  <button className="account-row" type="button" onClick={onSwitchProfile}>
                    <span className="account-row-left">
                      <UserCog size={18} />
                      <span>Manage profiles</span>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </>
            )}
          </main>
        </div>

        {devicesOpen && (
          <div className="device-manage-screen" role="dialog" aria-label="Manage devices">
            <div className="device-manage-topbar">
              <button
                className="device-back"
                type="button"
                aria-label="Back"
                onClick={() => setDevicesOpen(false)}
              >
                <ChevronLeft size={24} />
              </button>
            </div>

            <div className="device-manage-body">
              {devices.filter((device) => device.current).length > 0 && (
                <section className="device-group">
                  <h2 className="device-group-title">This Device</h2>
                  {devices
                    .filter((device) => device.current)
                    .map((device) => (
                      <div key={device.id} className="device-row">
                        <span className={`device-icon device-icon-${device.type}`}>
                          {device.type === 'tv' && <Tv size={22} />}
                          {device.type === 'mobile' && <Smartphone size={22} />}
                          {device.type === 'tablet' && <Tablet size={22} />}
                          {device.type === 'desktop' && <Monitor size={22} />}
                        </span>
                        <div className="device-info">
                          <span className="device-name">{device.name}</span>
                          <span className="device-meta">Last used : {deviceLastUsedLabel(device)}</span>
                        </div>
                        <button
                          className="device-logout"
                          type="button"
                          onClick={() => logoutDevice(device.id)}
                        >
                          Log Out
                        </button>
                      </div>
                    ))}
                </section>
              )}

              {devices.filter((device) => !device.current).length > 0 && (
                <section className="device-group">
                  <h2 className="device-group-title">Other Devices</h2>
                  {devices
                    .filter((device) => !device.current)
                    .map((device) => (
                      <div key={device.id} className="device-row">
                        <span className={`device-icon device-icon-${device.type}`}>
                          {device.type === 'tv' && <Tv size={22} />}
                          {device.type === 'mobile' && <Smartphone size={22} />}
                          {device.type === 'tablet' && <Tablet size={22} />}
                          {device.type === 'desktop' && <Monitor size={22} />}
                        </span>
                        <div className="device-info">
                          <span className="device-name">{device.name}</span>
                          <span className="device-meta">Last used : {deviceLastUsedLabel(device)}</span>
                        </div>
                        <button
                          className="device-logout"
                          type="button"
                          onClick={() => logoutDevice(device.id)}
                        >
                          Log Out
                        </button>
                      </div>
                    ))}
                </section>
              )}

              {devices.filter((device) => !device.current).length > 0 && (
                <button
                  className="device-logout-all"
                  type="button"
                  onClick={logoutOtherDevices}
                >
                  Log out of all other devices
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="screen login-screen">
      <LoginBackdrop />
      <div className="login-background">
        <div className="blob blob-purple"></div>
        <div className="blob blob-blue"></div>
        <div className="blob blob-cyan"></div>
      </div>

      {/* Mobile login (numi-style): provided background image, logo, tagline,
          Login pill and social buttons. Hidden on desktop via CSS. */}
      <div
        className="mobile-login"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.1) 42%, rgba(0,0,0,0.45) 74%, rgba(0,0,0,0.72) 100%), url(${loginBg})`,
        }}
      >
        <div className="mobile-login-top">
          <img className="mobile-login-logo" src="/lumen-logo.png" alt="Lumen" />
        </div>

        <div className="mobile-login-panel">
          <h2 className="mobile-login-tagline">Stream smarter.<br />Watch calmer.</h2>

          {error && <div className="mobile-login-error">{error}</div>}

          {mobileEmailOpen ? (
            <form onSubmit={handleFormSubmit} className="mobile-login-form">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                disabled={loading}
                required
              />
              <div className="mobile-login-password">
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
                  className="mobile-login-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <button className="mobile-login-primary" type="submit" disabled={loading}>
                {loading ? <LoaderCircle className="spin-icon-btn" /> : <span>Login</span>}
              </button>
              <button
                type="button"
                className="mobile-login-back"
                onClick={() => setMobileEmailOpen(false)}
                disabled={loading}
              >
                Back
              </button>
            </form>
          ) : (
            <>
              <button
                className="mobile-login-primary"
                type="button"
                onClick={() => setMobileEmailOpen(true)}
                disabled={loading}
              >
                <span>Login</span>
              </button>

              <div className="mobile-login-or"><span>OR</span></div>

              <div className="mobile-login-socials">
                <button
                  type="button"
                  className="mobile-login-social"
                  onClick={() => handleSocialLogin('Google')}
                  disabled={loading}
                  aria-label="Continue with Google"
                >
                  <span className="mobile-login-g">G</span>
                </button>
                <button
                  type="button"
                  className="mobile-login-social"
                  onClick={() => handleSocialLogin('Apple')}
                  disabled={loading}
                  aria-label="Continue with Apple"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                    <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.9-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.82 0-2.06-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.84 1.3 10.41.87 1.26 1.9 2.67 3.25 2.62 1.3-.05 1.79-.84 3.36-.84 1.56 0 2.01.84 3.38.81 1.4-.02 2.28-1.28 3.13-2.55.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.72-1.04-2.75-4.13z" />
                    <path d="M14.9 4.7c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.09 3.18 1.15.09 2.32-.59 3.04-1.46z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="mobile-login-social"
                  onClick={() => setMobileEmailOpen(true)}
                  disabled={loading}
                  aria-label="Continue with email"
                >
                  <Mail size={22} />
                </button>
              </div>
            </>
          )}

          <p className="mobile-login-terms">
            By using Lumen you agree to Lumen&apos;s{' '}
            <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a> &amp;{' '}
            <a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Service</a>
          </p>
        </div>
      </div>

      <header className="login-header" style={{ justifyContent: 'center' }}>
        <h1>Sign In</h1>
      </header>

      <section className="login-content">
        <div className="glass-card login-card">
          <div className="logo-container logo-container-inline">
            <img src="/lumen-logo.png" alt="Lumen" className="lumen-logo-img" />
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
                <span>Login</span>
              )}
            </button>
          </form>

          <div className="social-login-icons">
            <button
              className="social-icon-btn social-icon-btn-disabled"
              type="button"
              disabled
              aria-label="Sign in with Google (unavailable)"
              title="Google sign-in is currently unavailable"
            >
              <span className="social-icon-g">G</span>
            </button>
            <button
              className="social-icon-btn social-icon-btn-disabled"
              type="button"
              disabled
              aria-label="Sign in with Apple (unavailable)"
              title="Apple sign-in is currently unavailable"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.9-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.82 0-2.06-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.84 1.3 10.41.87 1.26 1.9 2.67 3.25 2.62 1.3-.05 1.79-.84 3.36-.84 1.56 0 2.01.84 3.38.81 1.4-.02 2.28-1.28 3.13-2.55.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.72-1.04-2.75-4.13z" />
                <path d="M14.9 4.7c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.09 3.18 1.15.09 2.32-.59 3.04-1.46z" />
              </svg>
            </button>
            <button
              className="social-icon-btn"
              type="button"
              onClick={handleRequestAccess}
              disabled={loading}
              aria-label="Request login access by email"
              title="Request login ID and password by email"
            >
              <Mail size={20} />
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

export function renderProfileAvatarMini(currentUser: UserInfo | null, profiles: UserProfile[]) {
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

type ProfilesScreenProps = {
  profiles: UserProfile[]
  onSelectProfile: (profileName: string) => void
  onAddProfile: (name: string, avatarColor: string) => void
  onEditProfile: (oldName: string, newName: string, avatarColor: string) => void
  onDeleteProfile: (name: string) => void
  onBack: () => void
  backdrops?: string[]
  mobileBackdrops?: string[]
}

function ProfilesScreen({
  profiles,
  onSelectProfile,
  onAddProfile,
  onEditProfile,
  onDeleteProfile,
  onBack,
  backdrops = [],
  mobileBackdrops = [],
}: ProfilesScreenProps) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const activeList = isMobile && mobileBackdrops.length > 0 ? mobileBackdrops : backdrops

  // Rotating TV/movie key-art behind the profile chooser (changes every 5s).
  const [backdropIndex, setBackdropIndex] = useState(0)

  useEffect(() => {
    if (activeList.length < 2) {
      return
    }
    const timer = window.setInterval(() => {
      setBackdropIndex((current) => (current + 1) % activeList.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [activeList.length])

  const activeBackdrop = activeList[backdropIndex] ?? activeList[0]
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
    <section className="screen profiles-screen profiles-screen-hero">
      {activeBackdrop && (
        <div className="profiles-backdrop" aria-hidden="true">
          {activeList.map((src, index) => (
            <img
              key={src}
              src={src}
              alt=""
              className={index === backdropIndex ? 'active' : ''}
            />
          ))}
          <div className="profiles-backdrop-fade" />
        </div>
      )}

      <header className="profiles-header">
        <button className="round-nav" type="button" onClick={onBack} title="Back">
          <ChevronLeft />
        </button>
        <div className="placeholder-right" />
      </header>

      <div className="profiles-container">
        <div className="profiles-sheet-container">
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
                      <Pencil size={26} className="manage-pencil-icon" />
                    </div>
                  )}
                </div>
                <span className="profile-name">{profile.name}</span>
              </button>
            ))}

            <button className="profile-item" type="button" onClick={() => setIsAdding(true)}>
              <div className="profile-avatar avatar-add">
                <Plus size={26} strokeWidth={2.2} />
              </div>
              <span className="profile-name">Add</span>
            </button>

            <button
              className="profile-item"
              type="button"
              onClick={() => setIsManaging((value) => !value)}
            >
              <div className={`profile-avatar avatar-add${isManaging ? ' avatar-edit-active' : ''}`}>
                <Pencil size={22} strokeWidth={2.2} />
              </div>
              <span className="profile-name">{isManaging ? 'Done' : 'Edit'}</span>
            </button>
          </div>

          <h1 className="profiles-title">{isManaging ? 'Manage Profiles' : 'Choose your profile'}</h1>
        </div>
      </div>
    </section>
  )
}

type LibraryScreenProps = {
  savedMovies: Movie[]
  likedMovies?: Movie[]
  invites?: WatchParty[]
  onAcceptInvite?: (invite: WatchParty) => void
  onDismissInvite?: (invite: WatchParty) => void
  onOpenDetail: (movie: Movie) => void
  currentUser: UserInfo | null
  onProfile: () => void
  onSelectProfile?: (profileName: string) => void
  onManageProfiles?: () => void
  onTransferProfile?: () => void
  onAccount?: () => void
  onHelp?: () => void
  onSignOut?: () => void
  onSetLordPin?: () => void
  profiles: UserProfile[]
  onSearch: () => void
  designMode?: 'apple' | 'netflix'
}

function LibraryScreen({
  savedMovies,
  likedMovies = [],
  invites = [],
  onAcceptInvite,
  onDismissInvite,
  onOpenDetail,
  currentUser,
  onProfile,
  onSelectProfile,
  onManageProfiles,
  onTransferProfile,
  onAccount,
  onHelp,
  onSignOut,
  onSetLordPin,
  profiles,
  onSearch,
  designMode = 'apple',
}: LibraryScreenProps) {
  return (
    <section className="screen library-screen">
      <header className="home-header">
        <h1>Library</h1>
        <div className="header-actions">
          <button className="mobile-search-btn" type="button" title="Search" onClick={onSearch}>
            <Search />
          </button>
          {onAcceptInvite && onDismissInvite && (
            <NotificationBell
              variant="apple"
              invites={invites}
              onAccept={onAcceptInvite}
              onDismiss={onDismissInvite}
            />
          )}
          <WatchRecommenderEntry
            designMode={designMode}
            onOpenDetail={onOpenDetail}
            likedMovies={likedMovies}
            variant="icon"
          />
          {onSelectProfile && onManageProfiles && onTransferProfile && onAccount && onHelp && onSignOut && onSetLordPin ? (
            <ProfileMenu
              currentUser={currentUser}
              profiles={profiles}
              variant="apple"
              onSelectProfile={onSelectProfile}
              onManageProfiles={onManageProfiles}
              onTransferProfile={onTransferProfile}
              onAccount={onAccount}
              onHelp={onHelp}
              onSignOut={onSignOut}
              onSetLordPin={onSetLordPin}
            />
          ) : (
            <button
              className={`avatar-button ${currentUser ? 'has-avatar' : ''}`}
              type="button"
              title="Profile"
              onClick={onProfile}
            >
              {renderProfileAvatarMini(currentUser, profiles)}
            </button>
          )}
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
  landscape?: boolean
  onOpenDetail: (movie: Movie) => void
}

function LandscapePosterCard({
  movie,
  onOpenDetail,
}: {
  movie: Movie
  onOpenDetail: (movie: Movie) => void
}) {
  const image = heroImageFor(movie) || posterImageFor(movie)

  return (
    <button
      className="landscape-poster-card"
      type="button"
      aria-label={`Open ${movie.title}`}
      onClick={() => onOpenDetail(movie)}
    >
      <img
        src={image}
        alt=""
        loading="lazy"
        onError={(event) => {
          event.currentTarget.src = posterImageFor(movie)
        }}
      />
      <span className="landscape-poster-title">{movie.title}</span>
    </button>
  )
}

function MovieRail({ title, movies, compact, landscape, onOpenDetail }: MovieRailProps) {
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

  const scrollRowBack = () => {
    rowRef.current?.scrollBy({
      left: -(rowRef.current.clientWidth * 0.86),
      behavior: 'smooth',
    })
  }

  if (landscape) {
    return (
      <section className="movie-rail landscape-rail">
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
        <div className="rail-viewport">
          <button
            className="rail-arrow rail-arrow-prev"
            type="button"
            aria-label={`Scroll ${title} left`}
            onClick={scrollRowBack}
          >
            <ChevronLeft />
          </button>
          <div ref={rowRef} className="landscape-row">
            {movies.map((movie) => (
              <LandscapePosterCard
                key={movie.id}
                movie={movie}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
          <button
            className="rail-arrow rail-arrow-next"
            type="button"
            aria-label={`Scroll ${title} right`}
            onClick={scrollRow}
          >
            <ChevronRight />
          </button>
        </div>
      </section>
    )
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
      <div className="rail-viewport">
        <button
          className="rail-arrow rail-arrow-prev"
          type="button"
          aria-label={`Scroll ${title} left`}
          onClick={scrollRowBack}
        >
          <ChevronLeft />
        </button>
        <div ref={rowRef} className={compact ? 'poster-row compact' : 'poster-row'}>
          {movies.map((movie) => (
            <PosterCard
              key={movie.id}
              movie={movie}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
        <button
          className="rail-arrow rail-arrow-next"
          type="button"
          aria-label={`Scroll ${title} right`}
          onClick={scrollRow}
        >
          <ChevronRight />
        </button>
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

  const scrollRowBack = () => {
    rowRef.current?.scrollBy({
      left: -(rowRef.current.clientWidth * 0.86),
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

      <div className="rail-viewport">
        <button
          className="rail-arrow rail-arrow-prev"
          type="button"
          aria-label={`Scroll ${title} left`}
          onClick={scrollRowBack}
        >
          <ChevronLeft />
        </button>

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

        <button
          className="rail-arrow rail-arrow-next"
          type="button"
          aria-label={`Scroll ${title} right`}
          onClick={scrollRow}
        >
          <ChevronRight />
        </button>
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
                #{index + 1} in {rankedGenre} on Lumen
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function PosterImage({
  movie,
  fallback,
  className,
  alt = '',
}: {
  movie: Movie
  fallback: string
  className?: string
  alt?: string
}) {
  // Ordered list of image sources to try. On each load error we advance to the
  // next candidate. Anime skip the Top-Posters proxy (they're never indexed
  // there — attempting it just adds a slow 404) and gain a proxied AniList
  // fallback so a flaky AniList CDN still resolves through our cached origin.
  const candidates = useMemo(() => {
    const list: string[] = []
    const direct = cleanImageUrl(movie.poster)

    if (movie.isAnime) {
      if (direct) {
        list.push(direct)
        list.push(proxiedAnimeImage(direct))
      }
    } else {
      if (hasTopPoster(movie)) {
        list.push(topPosterUrl(movie))
      }
      if (direct) {
        list.push(direct)
      }
    }

    if (fallback) {
      list.push(fallback)
    }

    return list.filter((entry, index) => Boolean(entry) && list.indexOf(entry) === index)
  }, [movie.id, movie.tmdbId, movie.isAnime, movie.poster, fallback])

  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [candidates])

  const src = candidates[index] || fallbackPosterForRank(movie.rank)

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setIndex((current) => current + 1)}
    />
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
      <PosterImage movie={movie} fallback={posterImageFor(movie)} />
      <span className="rank">{movie.rank}</span>
      <span className="poster-card-title">{movie.title}</span>
    </button>
  )
}

function DetailTopBar({
  onBack,
  onShare,
  onBff,
  isLiked,
  onToggleLike,
  dark,
}: {
  onBack: () => void
  onShare?: () => void
  onBff?: () => void
  isLiked?: boolean
  onToggleLike?: () => void
  dark?: boolean
}) {
  return (
    <nav className={dark ? 'top-actions dark' : 'top-actions'} aria-label="Movie">
      <button className="round-nav" type="button" onClick={onBack} title="Back">
        <ChevronLeft />
      </button>
      {(onBff || onShare || onToggleLike) && (
        <div className="action-pill">
          {onToggleLike && (
            <button
              type="button"
              className={`action-like${isLiked ? ' is-liked' : ''}`}
              aria-pressed={isLiked}
              title={isLiked ? 'Liked' : 'Like'}
              onClick={onToggleLike}
            >
              <Heart fill={isLiked ? 'currentColor' : 'none'} />
            </button>
          )}
          {onBff && (
            <button type="button" title="Watch together (BFF)" onClick={onBff}>
              <Users />
            </button>
          )}
          {!onBff && onShare && (
            <button type="button" title="Share IMDb link" onClick={onShare}>
              <Share />
            </button>
          )}
        </div>
      )}
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

function LiveTvPlayer({ stream, title }: { stream: LiveStream; title: string }) {
  return (
    <div className="livetv-player-frame">
      <iframe
        key={stream.id}
        className="livetv-embed"
        src={stream.embedUrl}
        title={title}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="no-referrer"
      />
    </div>
  )
}


function formatMatchTime(date: number): string {
  if (!date) {
    return ''
  }
  try {
    return new Date(date).toLocaleString(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function LiveMatchCard({
  match,
  active,
  onSelect,
}: {
  match: LiveMatch
  active: boolean
  onSelect: (match: LiveMatch) => void
}) {
  const [posterFailed, setPosterFailed] = useState(false)
  const poster = posterFailed ? '' : liveMatchPoster(match)
  const home = match.teams?.home
  const away = match.teams?.away
  const isLiveNow = match.date <= Date.now()

  return (
    <button
      type="button"
      className={`livetv-match-card${active ? ' active' : ''}`}
      onClick={() => onSelect(match)}
      title={match.title}
    >
      <span className="livetv-match-thumb">
        {poster ? (
          <img
            src={poster}
            alt=""
            loading="lazy"
            onError={() => setPosterFailed(true)}
          />
        ) : (
          <span className="livetv-match-badges">
            {home?.badge && <img src={liveBadgeUrl(home.badge)} alt="" loading="lazy" />}
            <span className="livetv-match-vs">vs</span>
            {away?.badge && <img src={liveBadgeUrl(away.badge)} alt="" loading="lazy" />}
          </span>
        )}
        {isLiveNow && <span className="livetv-card-live">● LIVE</span>}
        {match.popular && !isLiveNow && <span className="livetv-card-hot">HOT</span>}
      </span>
      <span className="livetv-match-body">
        <span className="livetv-match-title">{match.title}</span>
        <span className="livetv-match-meta">
          {match.category}
          {match.date ? ` · ${formatMatchTime(match.date)}` : ''}
        </span>
      </span>
    </button>
  )
}

type LiveTvScreenProps = {
  onSearch?: () => void
  currentUser: UserInfo | null
  onProfile: () => void
  profiles: UserProfile[]
  onSelectProfile?: (profileName: string) => void
  onManageProfiles?: () => void
  onTransferProfile?: () => void
  onAccount?: () => void
  onHelp?: () => void
  onSignOut?: () => void
  onSetLordPin?: () => void
}

function LiveTvScreen({
  currentUser,
  onProfile,
  profiles,
  onSelectProfile,
  onManageProfiles,
  onTransferProfile,
  onAccount,
  onHelp,
  onSignOut,
  onSetLordPin,
}: LiveTvScreenProps) {
  const [sports, setSports] = useState<LiveSport[]>([])
  const [scope, setScope] = useState<LiveMatchScope>('live')
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const [selectedMatch, setSelectedMatch] = useState<LiveMatch | null>(null)
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [selectedStream, setSelectedStream] = useState<LiveStream | null>(null)
  const [streamsLoading, setStreamsLoading] = useState(false)
  const [streamsError, setStreamsError] = useState('')

  // Load the sport categories once.
  useEffect(() => {
    let cancelled = false
    void fetchLiveSports().then((list) => {
      if (!cancelled) {
        setSports(list)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Load matches whenever the scope (Live / Today / a sport) changes.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    fetchLiveMatches(scope)
      .then((list) => {
        if (cancelled) {
          return
        }
        setMatches(list)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return
        }
        setError(err instanceof Error ? err.message : 'Could not load live matches.')
        setMatches([])
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [scope])

  const pickMatch = (match: LiveMatch) => {
    setSelectedMatch(match)
    setSelectedStream(null)
    setStreams([])
    setStreamsError('')
    setStreamsLoading(true)
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })

    void fetchFirstAvailableStreams(match)
      .then((list) => {
        setStreams(list)
        setSelectedStream(list[0] ?? null)
        if (list.length === 0) {
          setStreamsError('No live stream is available for this event yet.')
        }
        setStreamsLoading(false)
      })
      .catch(() => {
        setStreamsError('Could not load the stream for this event.')
        setStreamsLoading(false)
      })
  }

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return matches
    }
    return matches.filter(
      (match) =>
        match.title.toLowerCase().includes(normalizedQuery) ||
        match.category.toLowerCase().includes(normalizedQuery),
    )
  }, [matches, query])

  const scopeLabel =
    scope === 'live'
      ? 'Live now'
      : scope === 'all-today'
        ? "Today's events"
        : sports.find((s) => s.id === scope)?.name ?? 'Matches'

  return (
    <section className="screen livetv-screen">
      <header className="home-header">
        <h1>Live TV</h1>
        <div className="header-actions">
          <button
            className="mobile-search-btn"
            type="button"
            title="Search Live TV"
            onClick={() => setShowSearch((prev) => !prev)}
          >
            <Search size={22} />
          </button>
          {onSelectProfile && onManageProfiles && onTransferProfile && onAccount && onHelp && onSignOut ? (
            <ProfileMenu
              currentUser={currentUser}
              profiles={profiles}
              variant="apple"
              onSelectProfile={onSelectProfile}
              onManageProfiles={onManageProfiles}
              onTransferProfile={onTransferProfile}
              onAccount={onAccount}
              onHelp={onHelp}
              onSignOut={onSignOut}
              onSetLordPin={onSetLordPin}
            />
          ) : (
            <button
              className={`avatar-button ${currentUser ? 'has-avatar' : ''}`}
              type="button"
              title="Profile"
              onClick={onProfile}
            >
              {renderProfileAvatarMini(currentUser, profiles)}
            </button>
          )}
        </div>
      </header>

      {(showSearch || query.trim().length > 0) && (
        <div className="manga-search-bar-row">
          <Search size={18} className="manga-search-icon" />
          <input
            type="text"
            className="manga-horizontal-search-input"
            placeholder="Search live events..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            aria-label="Search live events"
          />
          {query && (
            <button
              type="button"
              className="manga-search-clear-btn"
              onClick={() => setQuery('')}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {selectedMatch && (
        <div className="livetv-now-playing">
          {streamsLoading ? (
            <div className="livetv-player-frame livetv-player-status">
              <LoaderCircle className="spin-icon" />
              <p>Loading stream for {selectedMatch.title}…</p>
            </div>
          ) : selectedStream ? (
            <LiveTvPlayer stream={selectedStream} title={selectedMatch.title} />
          ) : (
            <div className="livetv-player-frame livetv-player-status">
              <AlertCircle />
              <p>{streamsError || 'No stream available.'}</p>
            </div>
          )}
          <div className="livetv-now-meta">
            <span className="livetv-live-badge">● LIVE</span>
            <h2>{selectedMatch.title}</h2>
            <p>
              {selectedMatch.category}
              {selectedMatch.date ? ` · ${formatMatchTime(selectedMatch.date)}` : ''}
            </p>
            {streams.length > 1 && (
              <div className="livetv-stream-picker">
                {streams.map((stream) => (
                  <button
                    key={stream.id}
                    type="button"
                    className={`livetv-stream-chip${selectedStream?.id === stream.id ? ' active' : ''}`}
                    onClick={() => setSelectedStream(stream)}
                  >
                    {stream.source} #{stream.streamNo} · {stream.language || 'Feed'}
                    {stream.hd ? ' · HD' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="livetv-category-chips">
        <button
          type="button"
          className={scope === 'live' ? 'active' : ''}
          onClick={() => setScope('live')}
        >
          Live now
        </button>
        <button
          type="button"
          className={scope === 'all-today' ? 'active' : ''}
          onClick={() => setScope('all-today')}
        >
          Today
        </button>
        {sports.map((sport) => (
          <button
            key={sport.id}
            type="button"
            className={scope === sport.id ? 'active' : ''}
            onClick={() => setScope(sport.id)}
          >
            {sport.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="livetv-status">
          <LoaderCircle className="spin-icon" />
          <p>Loading {scopeLabel.toLowerCase()}…</p>
        </div>
      ) : error ? (
        <div className="livetv-status">
          <AlertCircle />
          <p>{error}</p>
        </div>
      ) : (
        <>
          <div className="livetv-result-count">
            {scopeLabel} · {filtered.length} event{filtered.length === 1 ? '' : 's'}
          </div>
          <div className="livetv-grid livetv-match-grid">
            {filtered.map((match) => (
              <LiveMatchCard
                key={match.id}
                match={match}
                active={selectedMatch?.id === match.id}
                onSelect={pickMatch}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="livetv-status">
              <p>No live events right now. Try another sport or check back later.</p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function BottomNav({
  active,
  onHome,
  onMovies,
  onTvShows,
  onLibrary,
  onDrama,
  onLiveTv,
  onManga,
  onGoLumen,
  onGoAnime,
  designMode,
}: {
  active: PrimaryTab
  onHome: () => void
  onMovies: () => void
  onTvShows: () => void
  onLibrary: () => void
  onDrama?: () => void
  onLiveTv?: () => void
  onManga?: () => void
  onGoLumen?: () => void
  onGoAnime?: () => void
  designMode: 'apple' | 'netflix'
}) {
  const magneticEvents = {
    onPointerLeave: resetMagneticNavOffset,
    onPointerMove: setMagneticNavOffset,
    onPointerUp: resetMagneticNavOffset,
  }

  if (designMode === 'netflix') {
    return (
      <div className="bottom-ui netflix-bottom-ui">
        <nav className="netflix-tab-bar" aria-label="Primary">
          <button
            className={`netflix-tab${active === 'Anime' ? ' active' : ''}`}
            type="button"
            onClick={onHome}
            aria-current={active === 'Anime' ? 'page' : undefined}
            title="Home"
          >
            <Home fill={active === 'Anime' ? 'currentColor' : 'none'} />
            <span>Home</span>
          </button>
          <button
            className={`netflix-tab${active === 'Drama' ? ' active' : ''}`}
            type="button"
            onClick={onDrama}
            aria-current={active === 'Drama' ? 'page' : undefined}
            title="Drama"
          >
            <Tv />
            <span>Drama</span>
          </button>
          <button
            className={`netflix-tab${active === 'Live TV' ? ' active' : ''}`}
            type="button"
            onClick={onLiveTv}
            aria-current={active === 'Live TV' ? 'page' : undefined}
            title="Live TV"
          >
            <Radio />
            <span>Live TV</span>
          </button>
          <button
            className={`netflix-tab${active === 'Manga' ? ' active' : ''}`}
            type="button"
            onClick={onManga}
            aria-current={active === 'Manga' ? 'page' : undefined}
            title="Manga"
          >
            <BookOpen />
            <span>Manga</span>
          </button>
          <button
            className="netflix-tab netflix-tab-lumen"
            type="button"
            onClick={onGoLumen}
            title="Switch to Lumen"
          >
            <span className="lumen-tab-letter">L</span>
            <span>Lumen</span>
          </button>
        </nav>
      </div>
    )
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
        className="search-float round-nav anime-float"
        type="button"
        onClick={onGoAnime}
        title="Switch to Anime"
        aria-label="Switch to Anime"
      >
        <span className="anime-float-mark">A</span>
      </button>
    </div>
  )
}

function NotificationBell({
  invites,
  onAccept,
  onDismiss,
  variant,
}: {
  invites: WatchParty[]
  onAccept: (invite: WatchParty) => void
  onDismiss: (invite: WatchParty) => void
  variant: 'apple' | 'netflix'
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const handlePointer = (event: Event) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const count = invites.length

  return (
    <div className={`notif-menu notif-menu-${variant}`} ref={rootRef}>
      <button
        className="notif-trigger"
        type="button"
        title="Notifications"
        aria-label={`Notifications${count ? ` (${count})` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={22} strokeWidth={2.2} />
        {count > 0 && <span className="bell-badge">{count}</span>}
      </button>

      {open && (
        <div className="notif-dropdown" role="menu">
          <div className="notif-heading">Notifications</div>
          {count === 0 ? (
            <div className="notif-empty">You&apos;re all caught up.</div>
          ) : (
            invites.map((invite) => (
              <div className="notif-item" key={invite.id} role="menuitem">
                <span className="notif-thumb">
                  <img
                    src={invite.movie?.poster || invite.movie?.still || invite.movie?.hero || ''}
                    alt=""
                    loading="lazy"
                  />
                </span>
                <div className="notif-item-body">
                  <strong className="notif-item-title">Watch party invite</strong>
                  <span className="notif-item-text">
                    <strong>{invite.host_email}</strong> invited you to watch{' '}
                    <strong>{invite.movie?.title}</strong>
                  </span>
                  <div className="notif-item-actions">
                    <button
                      className="notif-join"
                      type="button"
                      onClick={() => {
                        onAccept(invite)
                        setOpen(false)
                      }}
                    >
                      Join
                    </button>
                    <button
                      className="notif-dismiss"
                      type="button"
                      onClick={() => onDismiss(invite)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

type ProfileMenuProps = {
  currentUser: UserInfo | null
  profiles: UserProfile[]
  variant: 'apple' | 'netflix'
  onSelectProfile: (name: string) => void
  onManageProfiles: () => void
  onTransferProfile: () => void
  onAccount: () => void
  onHelp: () => void
  onSignOut: () => void
  onSetLordPin?: () => void
}

type LordPinModalProps = {
  expectedPin: string
  currentUser?: UserInfo | null
  onSuccess: () => void
  onClose: () => void
  onOpenSetLordPin?: () => void
}

// 4-digit PIN entry that guards the hidden "Lord" profile.
function LordPinModal({
  expectedPin,
  currentUser,
  onSuccess,
  onClose,
  onOpenSetLordPin,
}: LordPinModalProps) {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState(false)
  const isAdmin = currentUser?.email?.toLowerCase() === 'avnishpc00@gmail.com'

  const submit = useCallback(
    async (pin: string) => {
      let ok = false
      try {
        // Authoritative check: the server compares and returns only ok/no.
        ok = await verifyRemoteLordPin(pin)
      } catch {
        // Offline fallback to the locally-known PIN so the gate still works.
        ok = pin === expectedPin
      }
      if (ok) {
        onSuccess()
      } else {
        setError(true)
        setTimeout(() => {
          setDigits('')
          setError(false)
        }, 500)
      }
    },
    [expectedPin, onSuccess],
  )

  const pressKey = (key: string) => {
    if (digits.length >= 4) {
      return
    }
    const next = digits + key
    setDigits(next)
    if (next.length === 4) {
      void submit(next)
    }
  }

  const backspace = () => setDigits((value) => value.slice(0, -1))

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      } else if (/^\d$/.test(event.key)) {
        pressKey(event.key)
      } else if (event.key === 'Backspace') {
        backspace()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  })

  return (
    <div className="lord-pin-overlay" role="dialog" aria-modal="true" aria-label="Enter Lord PIN">
      <div className="lord-pin-card">
        <button className="lord-pin-close" type="button" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>
        <div className="lord-pin-icon">
          <Lock size={28} />
        </div>
        <h2>Enter PIN</h2>
        <p>This profile is locked.</p>
        <div className={`lord-pin-dots${error ? ' is-error' : ''}`}>
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={`lord-pin-dot${index < digits.length ? ' is-filled' : ''}`}
            />
          ))}
        </div>
        <div className="lord-pin-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
            <button key={key} type="button" className="lord-pin-key" onClick={() => pressKey(key)}>
              {key}
            </button>
          ))}
          <span className="lord-pin-key lord-pin-key-empty" aria-hidden="true" />
          <button type="button" className="lord-pin-key" onClick={() => pressKey('0')}>
            0
          </button>
          <button
            type="button"
            className="lord-pin-key lord-pin-key-action"
            onClick={backspace}
            aria-label="Delete"
          >
            <Delete size={22} />
          </button>
        </div>
        {isAdmin && onOpenSetLordPin && (
          <button
            type="button"
            className="lord-pin-change-btn"
            onClick={onOpenSetLordPin}
          >
            <KeyRound size={14} /> Admin: Change Password
          </button>
        )}
      </div>
    </div>
  )
}

type SetLordPinModalProps = {
  currentUser?: UserInfo | null
  onClose: () => void
  onSuccess: (newPin: string) => void
}

function SetLordPinModal({ currentUser, onClose, onSuccess }: SetLordPinModalProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const isAdmin = currentUser?.email?.toLowerCase() === 'avnishpc00@gmail.com'

  const handleSave = (event?: FormEvent) => {
    if (event) event.preventDefault()
    if (!isAdmin) {
      setError('Only avnishpc00@gmail.com can change the Lord password.')
      return
    }
    const trimmed = pin.trim()
    if (!/^\d{4}$/.test(trimmed)) {
      setError('Please enter a valid 4-digit numeric PIN.')
      return
    }
    const ok = setLordPin(trimmed, currentUser?.email)
    if (ok) {
      setError('')
      setSaved(true)
      setTimeout(() => {
        onSuccess(trimmed)
      }, 700)
    } else {
      setError('Could not save password.')
    }
  }

  if (!isAdmin) {
    return (
      <div className="bff-overlay" role="dialog" aria-modal="true" aria-label="Change Lord Password">
        <div className="bff-modal account-manage-modal">
          <button className="bff-close" type="button" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
          <h2 className="bff-title">Access Denied</h2>
          <p className="bff-sub">
            Only the primary admin account (<strong>avnishpc00@gmail.com</strong>) can change the Lord password. Other accounts can only watch.
          </p>
          <div className="bff-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="bff-btn-primary" type="button" onClick={onClose}>
              OK
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bff-overlay" role="dialog" aria-modal="true" aria-label="Change Lord Password">
      <div className="bff-modal account-manage-modal">
        <button className="bff-close" type="button" aria-label="Close" onClick={onClose}>
          <X size={20} />
        </button>
        <h2 className="bff-title">{saved ? 'Password Updated!' : 'Change Lord Password'}</h2>
        <p className="bff-sub">
          {saved
            ? 'Your new 4-digit PIN is active.'
            : 'Enter a 4-digit numeric PIN to protect the Lord profile.'}
        </p>

        {!saved ? (
          <form className="account-manage-form" onSubmit={handleSave}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              className="account-manage-input"
              placeholder="Enter 4-digit PIN (e.g. 1408)"
              value={pin}
              autoFocus
              onChange={(event) => {
                const val = event.target.value.replace(/\D/g, '').slice(0, 4)
                setPin(val)
                setError('')
              }}
            />
            <button className="account-manage-save" type="submit" disabled={pin.length < 4}>
              Save
            </button>
          </form>
        ) : (
          <div className="bff-status" style={{ color: '#34c759', fontWeight: 600 }}>
            ✓ Lord password changed successfully!
          </div>
        )}

        {error && <p className="bff-status">{error}</p>}
      </div>
    </div>
  )
}

type LordScreenProps = {
  movies: Movie[]
  rails: LordRail[]
  loading: boolean
  continueMovies?: Movie[]
  currentUser?: UserInfo | null
  profiles?: UserProfile[]
  activeTab?: 'collection' | 'phub' | 'jav'
  onTabChange?: (tab: 'collection' | 'phub' | 'jav') => void
  onOpenDetail: (movie: Movie) => void
  onPlay: (movie: Movie) => void
  onSelectProfile?: (name: string) => void
  onBack: () => void
  onClearContinueWatching?: () => void
  onMarkWatched?: (movie: Movie) => void
  onRemoveContinue?: (movie: Movie) => void
  onRemoveWatchlist?: (movie: Movie) => void
}

// Standalone hero + rails layout for the unlocked "Lord" profile.
function LordScreen({
  movies = [],
  rails = [],
  loading = false,
  continueMovies = [],
  currentUser: _currentUser,
  profiles: _profiles = [],
  activeTab: activeTabProp = 'collection',
  onTabChange,
  onOpenDetail,
  onPlay,
  onSelectProfile: _onSelectProfile,
  onBack,
  onClearContinueWatching,
  onMarkWatched,
  onRemoveContinue,
  onRemoveWatchlist,
}: LordScreenProps) {
  const rotatedMovies = useMemo(() => {
    return rotateByDailySeed(movies || [], 1)
  }, [movies])

  const hero = rotatedMovies[0] ?? null

  const rotatedRails = useMemo(() => {
    return (rails || []).map((rail, railIndex) => ({
      ...rail,
      items: rotateByDailySeed(rail?.items || [], (railIndex + 1) * 4),
    }))
  }, [rails])

  const [internalTab, setInternalTab] = useState<'collection' | 'phub' | 'jav'>(activeTabProp)
  const activeLordTab = activeTabProp || internalTab
  const setActiveLordTab = (tab: 'collection' | 'phub' | 'jav') => {
    setInternalTab(tab)
    onTabChange?.(tab)
  }
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) {
      return []
    }
    return rotatedMovies
      .filter((movie) => movie.title.toLowerCase().includes(trimmed))
      .slice(0, 8)
  }, [query, rotatedMovies])

  const showDropdown = searchFocused && query.trim().length > 0

  const pickMatch = (movie: Movie) => {
    setQuery('')
    setSearchFocused(false)
    onOpenDetail(movie)
  }

  return (
    <section className="screen lord-screen">
      <header className="lord-topbar">
        <div className="lord-topbar-left">
          <button
            className="lord-incognito-btn"
            type="button"
            onClick={onBack}
            title="Incognito Mode - Click to Go Back"
            aria-label="Incognito Mode - Click to Go Back"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 10h20" />
              <path d="M12 2a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" />
              <circle cx="6.5" cy="16.5" r="2.5" />
              <circle cx="17.5" cy="16.5" r="2.5" />
              <path d="M9 16.5h6" />
            </svg>
            <span>Incognito</span>
          </button>

          <div className="lord-nav-tabs">
            <button
              className={`lord-tab-btn ${activeLordTab === 'collection' ? 'is-active' : ''}`}
              type="button"
              onClick={() => setActiveLordTab('collection')}
            >
              <Crown size={15} />
              <span>Hentai</span>
            </button>
            <button
              className={`lord-tab-btn ${activeLordTab === 'phub' ? 'is-active' : ''}`}
              type="button"
              onClick={() => setActiveLordTab('phub')}
            >
              <Code size={15} />
              <span>PHub</span>
            </button>
            <button
              className={`lord-tab-btn ${activeLordTab === 'jav' ? 'is-active' : ''}`}
              type="button"
              onClick={() => setActiveLordTab('jav')}
            >
              <Video size={15} />
              <span>JAV</span>
            </button>
          </div>

          {activeLordTab === 'collection' && (
            <button
              className="lord-clear-btn"
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Permanently delete all Lord Continue Watching history? This cannot be recovered.',
                  )
                ) {
                  onClearContinueWatching?.()
                }
              }}
              title="Permanently clear Lord Continue Watching history"
              aria-label="Permanently clear Lord Continue Watching history"
              disabled={continueMovies.length === 0}
            >
              <Trash2 size={18} />
              <span>Clear History</span>
            </button>
          )}
        </div>

        <div className="lord-topbar-right">
          <div className={`lord-search${searchFocused ? ' is-focused' : ''}`}>
            <div className="lord-search-bar">
              <Search size={18} />
              <input
                type="text"
                className="lord-search-input"
                placeholder={
                  activeLordTab === 'phub'
                    ? 'Search PHub videos…'
                    : activeLordTab === 'jav'
                      ? 'Search JAV codes, titles…'
                      : 'Titles, genres…'
                }
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                aria-label="Search titles"
              />
              {query && (
                <button
                  type="button"
                  className="lord-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {activeLordTab === 'collection' && showDropdown && (
              <ul className="lord-search-results" role="listbox">
                {matches.length === 0 ? (
                  <li className="lord-search-empty">No matches</li>
                ) : (
                  matches.map((movie) => (
                    <li key={movie.id}>
                      <button
                        type="button"
                        className="lord-search-result"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => pickMatch(movie)}
                      >
                        <img
                          src={movie.poster || movie.still || movie.hero}
                          alt=""
                          loading="lazy"
                          onError={(event) => {
                            ;(event.target as HTMLImageElement).style.visibility = 'hidden'
                          }}
                        />
                        <span className="lord-search-result-text">
                          <span className="lord-search-result-title">{movie.title}</span>
                          <span className="lord-search-result-meta">
                            {movie.year} · {movie.type}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>
      </header>

      {activeLordTab === 'jav' ? (
        <LordJavSection searchQuery={query} onOpenDetail={onOpenDetail} onPlay={onPlay} />
      ) : activeLordTab === 'phub' ? (
        <LordPhubSection searchQuery={query} onOpenDetail={onOpenDetail} onPlay={onPlay} />
      ) : loading ? (
        <div className="lord-empty">
          <LoaderCircle className="spin-icon" />
          <p>Loading collection…</p>
        </div>
      ) : !hero ? (
        <div className="lord-empty">
          <Crown size={40} />
          <p>No titles available right now.</p>
        </div>
      ) : (
        <>
          <div
            className="lord-hero"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.55) 55%, #000 100%), linear-gradient(90deg, rgba(0,0,0,.75) 0%, rgba(0,0,0,0) 60%), url(${hero.hero || hero.still || hero.poster})`,
            }}
          >
            <div className="lord-hero-content">
              <span className="lord-hero-badge">
                <Crown size={14} /> Lord
              </span>
              <h1 className="lord-hero-title">{hero.title}</h1>
              <p className="lord-hero-meta">
                {hero.year} · {hero.type}
                {hero.rating && hero.rating !== 'N/A' ? ` · ★ ${hero.rating}` : ''}
              </p>
              <p className="lord-hero-synopsis">{hero.synopsis}</p>
              <div className="lord-hero-actions">
                <button className="lord-hero-play" type="button" onClick={() => onPlay(hero)}>
                  <Play fill="currentColor" strokeWidth={0} size={20} />
                  <span>Play</span>
                </button>
                <button
                  className="lord-hero-info"
                  type="button"
                  onClick={() => onOpenDetail(hero)}
                >
                  <Info size={20} />
                  <span>More Info</span>
                </button>
              </div>
            </div>
          </div>

          <div className="lord-rails">
            {continueMovies.length > 0 && onMarkWatched && onRemoveContinue && onRemoveWatchlist && (
              <ContinueWatchingRail
                title="Continue Watching"
                movies={continueMovies}
                onOpenDetail={onOpenDetail}
                onMarkWatched={onMarkWatched}
                onRemoveContinue={onRemoveContinue}
                onRemoveWatchlist={onRemoveWatchlist}
              />
            )}
            {rotatedRails.map((rail) => (
              <LordRailRow
                key={rail.title}
                rail={rail}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
        </>
      )}

      {/* Mobile Bottom Navigation Bar for Lord Screen */}
      <div className="lord-mobile-nav" aria-label="Lord Navigation">
        <div className="lord-mobile-nav-pill">
          <button
            className={`lord-mobile-nav-item${activeLordTab === 'collection' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setActiveLordTab('collection')}
          >
            <Crown size={16} />
            <span>Hentai</span>
          </button>
          <button
            className={`lord-mobile-nav-item${activeLordTab === 'phub' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setActiveLordTab('phub')}
          >
            <Code size={16} />
            <span>PHub</span>
          </button>
          <button
            className={`lord-mobile-nav-item${activeLordTab === 'jav' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setActiveLordTab('jav')}
          >
            <Video size={16} />
            <span>JAV</span>
          </button>
        </div>
      </div>
    </section>
  )
}

function LordRailRow({
  rail,
  onOpenDetail,
}: {
  rail: LordRail
  onOpenDetail: (movie: Movie) => void
}) {
  const rowRef = useRef<HTMLDivElement | null>(null)

  const scrollRow = (direction: 1 | -1) => {
    const row = rowRef.current
    if (row) {
      row.scrollBy({
        left: direction * (row.clientWidth * 0.75),
        behavior: 'smooth',
      })
    }
  }

  return (
    <div className="lord-rail">
      <h2 className="lord-rail-title">{rail.title}</h2>
      <div className="lord-rail-viewport">
        <button
          className="rail-arrow rail-arrow-prev lord-rail-arrow"
          type="button"
          aria-label={`Scroll ${rail.title} left`}
          onClick={() => scrollRow(-1)}
        >
          <ChevronLeft />
        </button>

        <div ref={rowRef} className="lord-rail-row">
          {rail.items.map((movie) => (
            <button
              key={movie.id}
              type="button"
              className="lord-card"
              onClick={() => onOpenDetail(movie)}
            >
              <span className="lord-card-poster">
                <img
                  src={movie.poster || movie.still || movie.hero}
                  alt={movie.title}
                  loading="lazy"
                  onError={(event) => {
                    ;(event.target as HTMLImageElement).style.visibility = 'hidden'
                  }}
                />
              </span>
              <span className="lord-card-title">{movie.title}</span>
            </button>
          ))}
        </div>

        <button
          className="rail-arrow rail-arrow-next lord-rail-arrow"
          type="button"
          aria-label={`Scroll ${rail.title} right`}
          onClick={() => scrollRow(1)}
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  )
}


export type HanimeVideo = {
  id: string | number
  title: string
  thumb: string
  poster: string
  category: string
  duration: string
  embedUrl: string
  actors: string[]
  description: string
  code: string
}

const INITIAL_HANIME_VIDEOS: HanimeVideo[] = [
  {
    id: '73341265',
    title: '18 Year Old Latina Beauty With Big Natural Tits And Big Ass _ Nick Morris',
    thumb: 'https://upload18.cc/video/73341265/poster.jpg',
    poster: 'https://upload18.cc/video/73341265/poster.jpg',
    category: 'Teen',
    duration: '18:31',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341265',
    actors: ['Nick Morris', 'Andrea'],
    description: '18 Year Old Latina Beauty With Big Natural Tits And Big Ass _ Nick Morris',
    code: '73341265',
  },
  {
    id: '73341266',
    title: 'Sexy Milf Kerry Terry Has Multiple Orgasms _ Nick Morris',
    thumb: 'https://upload18.cc/video/73341266/poster.jpg',
    poster: 'https://upload18.cc/video/73341266/poster.jpg',
    category: 'Femdom',
    duration: '22:59',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341266',
    actors: ['Nick Morris', 'Kerry Terry'],
    description: 'Sexy Milf Kerry Terry Has Multiple Orgasms _ Nick Morris',
    code: '73341266',
  },
  {
    id: '73341267',
    title: "Meow Miu Just Turned 18 And She' Already A Little Slut",
    thumb: 'https://upload18.cc/video/73341267/poster.jpg',
    poster: 'https://upload18.cc/video/73341267/poster.jpg',
    category: 'Teen',
    duration: '20:00',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341267',
    actors: ['Meow Miu'],
    description: "Meow Miu Just Turned 18 And She' Already A Little Slut",
    code: '73341267',
  },
  {
    id: '73341268',
    title: 'Esposa De Quatro Para Desconhecidos No Dogging...',
    thumb: 'https://upload18.cc/video/73341268/poster.jpg',
    poster: 'https://upload18.cc/video/73341268/poster.jpg',
    category: 'Latina',
    duration: '04:52',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341268',
    actors: ['Desconhecidos'],
    description: 'Esposa De Quatro Para Desconhecidos No Dogging',
    code: '73341268',
  },
  {
    id: '73341269',
    title: 'Sex In The Shower With Charming Beauty Vika Lita _ Nick Morris',
    thumb: 'https://upload18.cc/video/73341269/poster.jpg',
    poster: 'https://upload18.cc/video/73341269/poster.jpg',
    category: 'Teen',
    duration: '20:13',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341269',
    actors: ['Nick Morris', 'Vika Lita'],
    description: 'Sex In The Shower With Charming Beauty Vika Lita _ Nick Morris',
    code: '73341269',
  },
  {
    id: '73341270',
    title: 'Nick Morris And Pretty Mary Show What Lessons Should Be Given',
    thumb: 'https://upload18.cc/video/73341270/poster.jpg',
    poster: 'https://upload18.cc/video/73341270/poster.jpg',
    category: 'Cumshot',
    duration: '23:23',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341270',
    actors: ['Nick Morris', 'Pretty Mary'],
    description: 'Nick Morris And Pretty Mary Show What Lessons Should Be Given',
    code: '73341270',
  },
  {
    id: '73341271',
    title: 'Cum On The Face Of Slender Tanned Gymnast Sofi Li _ Nick Morris',
    thumb: 'https://upload18.cc/video/73341271/poster.jpg',
    poster: 'https://upload18.cc/video/73341271/poster.jpg',
    category: 'Cumshot',
    duration: '29:46',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341271',
    actors: ['Nick Morris', 'Sofi Li'],
    description: 'Cum On The Face Of Slender Tanned Gymnast Sofi Li _ Nick Morris',
    code: '73341271',
  },
  {
    id: '73341272',
    title: 'Busty Slut Pinky Cat Is A Real Nymphomaniac _ Nick Morris',
    thumb: 'https://upload18.cc/video/73341272/poster.jpg',
    poster: 'https://upload18.cc/video/73341272/poster.jpg',
    category: 'Cumshot',
    duration: '24:09',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341272',
    actors: ['Nick Morris', 'Pinky Cat'],
    description: 'Busty Slut Pinky Cat Is A Real Nymphomaniac _ Nick Morris',
    code: '73341272',
  },
  {
    id: '73341273',
    title: 'Cum On My Ass! Blonde Teen Gets Fucked Hard In Hotel',
    thumb: 'https://upload18.cc/video/73341273/poster.jpg',
    poster: 'https://upload18.cc/video/73341273/poster.jpg',
    category: 'Cumshot',
    duration: '08:49',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341273',
    actors: ['Blonde Teen'],
    description: 'Cum On My Ass! Blonde Teen Gets Fucked Hard In Hotel',
    code: '73341273',
  },
  {
    id: '73341274',
    title: 'Who Do You Think Sucks Dick Better, Lissa Miss Or Emily...',
    thumb: 'https://upload18.cc/video/73341274/poster.jpg',
    poster: 'https://upload18.cc/video/73341274/poster.jpg',
    category: 'Cumshot',
    duration: '15:01',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341274',
    actors: ['Lissa Miss', 'Emily'],
    description: 'Who Do You Think Sucks Dick Better, Lissa Miss Or Emily',
    code: '73341274',
  },
  {
    id: '73341275',
    title: 'Called A Prostitute, And My Ex-girlfriend Gypsy Queen...',
    thumb: 'https://upload18.cc/video/73341275/poster.jpg',
    poster: 'https://upload18.cc/video/73341275/poster.jpg',
    category: 'Cumshot',
    duration: '23:02',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341275',
    actors: ['Gypsy Queen'],
    description: 'Called A Prostitute, And My Ex-girlfriend Gypsy Queen',
    code: '73341275',
  },
  {
    id: '73341276',
    title: 'Fucked His Neighbor Lesya Milk While Fixing Furniture _...',
    thumb: 'https://upload18.cc/video/73341276/poster.jpg',
    poster: 'https://upload18.cc/video/73341276/poster.jpg',
    category: 'Cumshot',
    duration: '24:14',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341276',
    actors: ['Lesya Milk'],
    description: 'Fucked His Neighbor Lesya Milk While Fixing Furniture',
    code: '73341276',
  },
  {
    id: '73341277',
    title: 'Stepsis Was A Little Embarrassed By My Dick, B...',
    thumb: 'https://upload18.cc/video/73341277/poster.jpg',
    poster: 'https://upload18.cc/video/73341277/poster.jpg',
    category: 'Cumshot',
    duration: '36:15',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341277',
    actors: ['Stepsis'],
    description: 'Stepsis Was A Little Embarrassed By My Dick',
    code: '73341277',
  },
  {
    id: '73341278',
    title: 'Won A Bet With Busty Bitch Emily Ratakovski _ Nick...',
    thumb: 'https://upload18.cc/video/73341278/poster.jpg',
    poster: 'https://upload18.cc/video/73341278/poster.jpg',
    category: 'Cumshot',
    duration: '18:20',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341278',
    actors: ['Nick Morris', 'Emily Ratakovski'],
    description: 'Won A Bet With Busty Bitch Emily Ratakovski _ Nick Morris',
    code: '73341278',
  },
  {
    id: '73341279',
    title: 'Girl On Girl Soft Play Video',
    thumb: 'https://upload18.cc/video/73341279/poster.jpg',
    poster: 'https://upload18.cc/video/73341279/poster.jpg',
    category: 'Teen',
    duration: '03:03',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341279',
    actors: ['Soft Play'],
    description: 'Girl On Girl Soft Play Video',
    code: '73341279',
  },
  {
    id: '73341280',
    title: 'You_re Only 18 Years Old And You Already Have Such Hug...',
    thumb: 'https://upload18.cc/video/73341280/poster.jpg',
    poster: 'https://upload18.cc/video/73341280/poster.jpg',
    category: 'Cumshot',
    duration: '18:31',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341280',
    actors: ['18 Year Old'],
    description: 'You_re Only 18 Years Old And You Already Have Such Hug',
    code: '73341280',
  },
  {
    id: '73341281',
    title: 'Mia Piper (hazel Grace) _ I Forbid You To Jerk Off, Fuc...',
    thumb: 'https://upload18.cc/video/73341281/poster.jpg',
    poster: 'https://upload18.cc/video/73341281/poster.jpg',
    category: 'Cumshot',
    duration: '19:12',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341281',
    actors: ['Mia Piper', 'Hazel Grace'],
    description: 'Mia Piper (hazel Grace) _ I Forbid You To Jerk Off',
    code: '73341281',
  },
  {
    id: '73341282',
    title: 'Shy Milf With A Tight Ass Asks To Fuck Her Wet Puss...',
    thumb: 'https://upload18.cc/video/73341282/poster.jpg',
    poster: 'https://upload18.cc/video/73341282/poster.jpg',
    category: 'Cumshot',
    duration: '17:37',
    embedUrl: 'https://upload18.net/play/index/xvidapi-73341282',
    actors: ['Shy Milf'],
    description: 'Shy Milf With A Tight Ass Asks To Fuck Her Wet Puss',
    code: '73341282',
  },
]

function cleanHtmlEntities(str: string): string {
  if (!str) return ''
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&bull;?/g, '•')
    .replace(/&bull_/g, '•')
    .replace(/&nbsp;/g, ' ')
}

function normalizeVideoItem(item: any, index: number): HanimeVideo {
  const title = cleanHtmlEntities(item.name || item.vod_name || item.title || item.origin_name || 'Untitled Video')
  let thumb = item.thumb_url || item.poster_url || item.vod_pic || ''
  if (thumb.startsWith('http://')) {
    thumb = thumb.replace('http://', 'https://')
  }
  if (!thumb) {
    thumb = INITIAL_HANIME_VIDEOS[index % INITIAL_HANIME_VIDEOS.length].thumb
  }

  let category = 'Teen'
  if (Array.isArray(item.category) && item.category.length > 0) {
    category = item.category[0]
  } else if (item.type_name) {
    category = item.type_name
  } else if (item.tag) {
    category = item.tag.split(',')[0].trim()
  }

  let embedUrl = ''
  if (item.episodes?.server_data?.Full?.link_embed) {
    embedUrl = item.episodes.server_data.Full.link_embed
  } else if (item.link_embed) {
    embedUrl = item.link_embed
  } else if (item.vod_play_url) {
    let str = item.vod_play_url
    if (str.includes('$')) {
      const parts = str.split('$')
      str = parts[parts.length - 1]
    }
    if (str.includes('#')) {
      str = str.split('#')[0]
    }
    embedUrl = str.trim()
  }
  if (!embedUrl && item.slug) {
    embedUrl = `https://upload18.net/play/index/xvidapi-${item.slug}`
  }

  const DURATIONS = [
    '18:31', '22:59', '20:00', '04:52', '20:13', '23:23',
    '29:46', '24:09', '08:49', '15:01', '23:02', '24:14',
    '36:15', '18:20', '03:03', '19:12', '17:37',
  ]
  const duration = item.duration || DURATIONS[index % DURATIONS.length]

  return {
    id: item.id || item.vod_id || item.slug || index,
    title,
    thumb,
    poster: thumb,
    category,
    duration,
    embedUrl,
    actors: Array.isArray(item.actor) ? item.actor : [],
    description: item.description || item.vod_content || '',
    code: item.movie_code || item.slug || '4K',
  }
}

const PHUB_CATEGORIES = [
  'All',
  'Teen',
  'Femdom',
  'Latina',
  'Cumshot',
  'Amateur',
  'MILF',
  'Asian Woman',
  'ASMR',
  'Japanese',
  'Lesbian',
]

function hanimeToMovieHelper(video: HanimeVideo): Movie {
  return {
    id: `phub-${video.id}`,
    rank: 0,
    title: cleanHtmlEntities(video.title),
    logoTitle: '',
    label: 'PHub',
    type: 'Movie',
    genres: [video.category],
    year: new Date().getFullYear().toString(),
    runtime: video.duration,
    rating: 'N/A',
    maturity: '18+',
    progress: 0,
    hero: video.poster || video.thumb,
    poster: video.poster || video.thumb,
    still: video.thumb,
    synopsis: cleanHtmlEntities(video.description || `${video.category} · ${video.duration}`),
    cast: (video.actors || []).map(cleanHtmlEntities),
    director: '',
    awards: '',
    boxOffice: '',
    ratings: [],
    embedUrl: video.embedUrl,
    isHentaiOcean: false,
    hentaiSlug: video.code || `phub-${video.id}`,
  }
}

function LordPhubSection({ searchQuery = '', onPlay }: { searchQuery?: string; onOpenDetail?: (movie: Movie) => void; onPlay: (movie: Movie) => void }) {
  const [videos, setVideos] = useState<HanimeVideo[]>(INITIAL_HANIME_VIDEOS)
  const [loading, setLoading] = useState(false)

  const [page] = useState(1)
  const hanimeToMovie = (video: HanimeVideo): Movie => hanimeToMovieHelper(video)
  useEffect(() => {
    let active = true
    async function loadApiVideos() {
      setLoading(true)
      try {
        let url = `https://xvidapi.com/api.php/provide/vod?ac=detail&at=json&pg=${page}`
        if (searchQuery.trim()) {
          url += `&wd=${encodeURIComponent(searchQuery.trim())}`
        }
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        if (active && data && Array.isArray(data.list) && data.list.length > 0) {
          const parsed = data.list.map((item: any, idx: number) => normalizeVideoItem(item, idx))
          setVideos(parsed)
        }
      } catch {
        // Keep initial dataset on error
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadApiVideos()
    return () => {
      active = false
    }
  }, [page, searchQuery])

  const isSearching = Boolean(searchQuery.trim())

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.trim().toLowerCase()
    return videos.filter(
      (v) => v.title.toLowerCase().includes(q) || v.category.toLowerCase().includes(q),
    )
  }, [videos, searchQuery])

  const railsData = useMemo(() => {
    if (videos.length === 0) return []

    const localRotate = (arr: HanimeVideo[], shift: number) => {
      if (arr.length === 0) return []
      const day = new Date().getDate()
      const start = (day + shift) % arr.length
      return [...arr.slice(start), ...arr.slice(0, start)]
    }

    return PHUB_CATEGORIES.map((cat, idx) => {
      let items: HanimeVideo[]
      if (cat === 'All') {
        items = localRotate(videos, 1)
      } else {
        const catLower = cat.toLowerCase()
        const matched = videos.filter(
          (v) =>
            v.category.toLowerCase().includes(catLower) ||
            v.title.toLowerCase().includes(catLower),
        )
        items = matched.length > 0 ? localRotate(matched, idx * 3) : localRotate(videos, idx * 5)
      }

      return { title: cat, items }
    }).filter((r) => r.items.length > 0)
  }, [videos])

  return (
    <div className="hanime-container">
      {loading ? (
        <div className="phub-loading">
          <LoaderCircle className="spin-icon" size={32} />
          <p>Loading videos...</p>
        </div>
      ) : isSearching ? (
        searchResults.length === 0 ? (
          <div className="phub-empty">
            <Search size={42} />
            <p>No videos found matching "{searchQuery.trim()}".</p>
          </div>
        ) : (
          <div className="phub-search-results">
            <h2 className="lord-rail-title" style={{ marginBottom: 20 }}>
              Search Results ({searchResults.length})
            </h2>
            <div className="hanime-grid">
              {searchResults.map((video, idx) => (
                <div
                  key={`${video.id}-${idx}`}
                  className="hanime-card"
                  onClick={() => onPlay(hanimeToMovie(video))}
                >
                  <div className="hanime-poster-area">
                    <img
                      src={video.thumb}
                      referrerPolicy="no-referrer"
                      alt={video.title}
                      loading="lazy"
                      onError={(event) => {
                        const target = event.target as HTMLImageElement
                        target.onerror = null
                        target.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=80'
                      }}
                    />
                    <span className="hanime-badge-4k">4K</span>
                    <span className="hanime-badge-duration">{video.duration}</span>
                    <div className="hanime-play-overlay">
                      <div className="hanime-play-btn">
                        <Play fill="#fff" size={22} />
                      </div>
                    </div>
                  </div>
                  <div className="hanime-card-body">
                    <h3 className="hanime-card-title">{video.title}</h3>
                    <span className="hanime-card-tag">{video.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : railsData.length === 0 ? (
        <div className="phub-empty">
          <Search size={42} />
          <p>No videos found.</p>
        </div>
      ) : (
        <div className="lord-rails phub-rails">
          {railsData.map((rail) => (
            <LordPhubRailRow
              key={rail.title}
              title={rail.title}
              videos={rail.items}
              onVideoClick={(video) => onPlay(hanimeToMovie(video))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LordPhubRailRow({
  title,
  videos,
  onVideoClick,
}: {
  title: string
  videos: HanimeVideo[]
  onVideoClick: (video: HanimeVideo) => void
}) {
  const rowRef = useRef<HTMLDivElement | null>(null)

  const scrollRow = (direction: 1 | -1) => {
    const row = rowRef.current
    if (row) {
      row.scrollBy({
        left: direction * (row.clientWidth * 0.75),
        behavior: 'smooth',
      })
    }
  }

  if (!videos || videos.length === 0) return null

  return (
    <div className="lord-rail">
      <h2 className="lord-rail-title">{title}</h2>
      <div className="lord-rail-viewport">
        <button
          className="rail-arrow rail-arrow-prev lord-rail-arrow"
          type="button"
          aria-label={`Scroll ${title} left`}
          onClick={() => scrollRow(-1)}
        >
          <ChevronLeft />
        </button>

        <div ref={rowRef} className="lord-rail-row">
          {videos.map((video, idx) => (
            <div
              key={`${video.id}-${idx}`}
              className="hanime-card"
              onClick={() => onVideoClick(video)}
            >
              <div className="hanime-poster-area">
                <img
                  src={video.thumb}
                  referrerPolicy="no-referrer"
                  alt={video.title}
                  loading="lazy"
                  onError={(event) => {
                    const target = event.target as HTMLImageElement
                    target.onerror = null
                    target.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=80'
                  }}
                />
                <span className="hanime-badge-4k">4K</span>
                <span className="hanime-badge-duration">{video.duration}</span>
                <div className="hanime-play-overlay">
                  <div className="hanime-play-btn">
                    <Play fill="#fff" size={22} />
                  </div>
                </div>
              </div>
              <div className="hanime-card-body">
                <h3 className="hanime-card-title">{video.title}</h3>
                <span className="hanime-card-tag">{video.category}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          className="rail-arrow rail-arrow-next lord-rail-arrow"
          type="button"
          aria-label={`Scroll ${title} right`}
          onClick={() => scrollRow(1)}
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  )
}

export type JavPost = {
  id: number
  title: string
  slug: string
  date: string
  thumbnail: string
  duration: string
  categories: string[]
  tags: string[]
  actors: string[]
  studio: string
  code: string
  views: number
  likes: number
  dislikes: number
  is_hd: boolean
  player_api: string
  embed_url: string
  iframe_html: string
}

function javToMovieHelper(post: JavPost): Movie {
  const codePrefix = post.code ? `[${post.code}] ` : ''
  const displayTitle = post.title.startsWith(post.code)
    ? post.title
    : `${codePrefix}${post.title}`

  return {
    id: `jav-${post.id}`,
    rank: 0,
    title: cleanHtmlEntities(displayTitle),
    logoTitle: post.code || '',
    label: 'JAV',
    type: 'JAV Video',
    genres: post.categories && post.categories.length > 0 ? post.categories : ['JAV', 'Japanese'],
    year: post.date ? new Date(post.date).getFullYear().toString() : new Date().getFullYear().toString(),
    runtime: post.duration && post.duration !== '00:00:00' ? post.duration : 'HD',
    rating: post.likes ? `★ ${(post.likes / Math.max(1, post.likes + post.dislikes) * 5).toFixed(1)}` : 'N/A',
    maturity: '18+',
    progress: 0,
    hero: post.thumbnail,
    poster: post.thumbnail,
    still: post.thumbnail,
    synopsis: cleanHtmlEntities(
      `${post.code ? `Code: ${post.code} · ` : ''}${post.studio ? `Studio: ${post.studio} · ` : ''}${post.views ? `Views: ${post.views.toLocaleString()} · ` : ''}${(post.categories || []).join(', ')}`,
    ),
    cast: (post.actors || []).map(cleanHtmlEntities),
    director: post.studio ? cleanHtmlEntities(post.studio) : 'apiJAV',
    awards: post.code || '',
    boxOffice: '',
    ratings: [],
    embedUrl:
      post.embed_url ||
      post.embedUrl ||
      `https://server.apijav.com/?mvapm_embed=${post.id}`,
    isHentaiOcean: false,
    isJav: true,
    hentaiSlug: post.code || `jav-${post.id}`,
  }
}

const JAV_CATEGORIES = [
  'All',
  'Uncensored',
  'Famous',
  'Creampie',
  'Cosplay',
  'Adultery',
  'Oral Sex',
  'Big Breasts',
  'Slim',
  'HD',
]

function LordJavSection({
  searchQuery = '',
  onOpenDetail,
  onPlay,
}: {
  searchQuery?: string
  onOpenDetail?: (movie: Movie) => void
  onPlay: (movie: Movie) => void
}) {
  const [posts, setPosts] = useState<JavPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalPosts, setTotalPosts] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [orderBy, setOrderBy] = useState<'date' | 'views' | 'title'>('views')

  useEffect(() => {
    setPage(1)
  }, [selectedCategory, orderBy, searchQuery])

  useEffect(() => {
    let active = true
    async function fetchJavPosts() {
      setLoading(true)
      setError('')
      try {
        let url = `https://server.apijav.com/wp-json/myvideo/v1/posts?per_page=24&page=${page}&orderby=${orderBy}&order=DESC`

        if (selectedCategory !== 'All') {
          url += `&category=${encodeURIComponent(selectedCategory)}`
        }

        if (searchQuery.trim()) {
          url += `&search=${encodeURIComponent(searchQuery.trim())}`
        }

        const res = await fetch(url)
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const wpTotal = res.headers.get('X-WP-Total')
        const wpTotalPages = res.headers.get('X-WP-TotalPages')
        if (wpTotal) setTotalPosts(parseInt(wpTotal, 10))
        if (wpTotalPages) setTotalPages(parseInt(wpTotalPages, 10))

        const data: JavPost[] = await res.json()
        if (active) {
          setPosts(Array.isArray(data) ? data : [])
        }
      } catch {
        if (active) {
          setError('Failed to load JAV catalog. Please try again.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void fetchJavPosts()
    return () => {
      active = false
    }
  }, [page, selectedCategory, orderBy, searchQuery])

  const handlePrevPage = () => {
    if (page > 1) {
      setPage((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="jav-container">
      {/* Category Pills & Order Controls */}
      <div className="jav-controls">
        <div className="jav-pills" role="tablist" aria-label="JAV categories">
          {JAV_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`jav-pill${selectedCategory === cat ? ' is-active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="jav-sort-group">
          <span className="jav-sort-label">Sort:</span>
          <button
            type="button"
            className={`jav-sort-btn${orderBy === 'views' ? ' is-active' : ''}`}
            onClick={() => setOrderBy('views')}
          >
            Popular
          </button>
          <button
            type="button"
            className={`jav-sort-btn${orderBy === 'date' ? ' is-active' : ''}`}
            onClick={() => setOrderBy('date')}
          >
            Latest
          </button>
          <button
            type="button"
            className={`jav-sort-btn${orderBy === 'title' ? ' is-active' : ''}`}
            onClick={() => setOrderBy('title')}
          >
            Title
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="jav-loading">
          <LoaderCircle className="spin-icon" size={32} />
          <p>Loading JAV catalog...</p>
        </div>
      ) : error ? (
        <div className="jav-empty">
          <AlertCircle size={40} />
          <p>{error}</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="jav-empty">
          <Search size={40} />
          <p>No JAV videos found matching your criteria.</p>
        </div>
      ) : (
        <>
          <div className="jav-meta-header">
            <h2 className="lord-rail-title">
              {searchQuery.trim()
                ? `Results for "${searchQuery.trim()}"`
                : selectedCategory === 'All'
                  ? 'All JAV Catalog'
                  : `${selectedCategory} JAV`}
              {totalPosts > 0 && <span className="jav-meta-count">({totalPosts.toLocaleString()} titles)</span>}
            </h2>
          </div>

          <div className="jav-grid">
            {posts.map((post) => {
              const movie = javToMovieHelper(post)
              return (
                <div key={post.id} className="jav-card" onClick={() => onPlay(movie)}>
                  <div className="jav-thumb-container">
                    <img
                      src={post.thumbnail}
                      alt={post.title}
                      loading="lazy"
                      onError={(event) => {
                        const target = event.target as HTMLImageElement
                        target.onerror = null
                        target.src =
                          'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=80'
                      }}
                    />
                    {post.code && <span className="jav-code-badge">{post.code}</span>}
                    {post.is_hd && <span className="jav-hd-badge">HD</span>}
                    {post.duration && post.duration !== '00:00:00' && (
                      <span className="jav-duration-badge">{post.duration}</span>
                    )}

                    <div className="jav-play-overlay">
                      <button
                        type="button"
                        className="jav-play-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onPlay(movie)
                        }}
                        title="Play Video"
                      >
                        <Play fill="#fff" size={24} />
                      </button>

                      {onOpenDetail && (
                        <button
                          type="button"
                          className="jav-info-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenDetail(movie)
                          }}
                          title="More Info"
                        >
                          <Info size={20} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="jav-card-body">
                    <h3 className="jav-card-title" title={post.title}>
                      {cleanHtmlEntities(post.title)}
                    </h3>

                    <div className="jav-card-footer">
                      {post.studio && <span className="jav-studio">{cleanHtmlEntities(post.studio)}</span>}
                      {post.views > 0 && <span className="jav-views">👁 {post.views.toLocaleString()}</span>}
                    </div>

                    {post.categories && post.categories.length > 0 && (
                      <div className="jav-tags">
                        {post.categories.slice(0, 3).map((cat) => (
                          <span key={cat} className="jav-tag">
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="jav-pagination">
              <button
                type="button"
                className="jav-page-btn"
                onClick={handlePrevPage}
                disabled={page <= 1}
              >
                <ChevronLeft size={18} />
                <span>Prev</span>
              </button>

              <span className="jav-page-info">
                Page <strong>{page}</strong> of <strong>{totalPages.toLocaleString()}</strong>
              </span>

              <button
                type="button"
                className="jav-page-btn"
                onClick={handleNextPage}
                disabled={page >= totalPages}
              >
                <span>Next</span>
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function ProfileMenu({
  currentUser,
  profiles,
  variant,
  onSelectProfile,
  onManageProfiles,
  onTransferProfile,
  onAccount,
  onHelp,
  onSignOut,
  onSetLordPin,
}: ProfileMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointer = (event: Event) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)

    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const otherProfiles = profiles.filter(
    (profile) => profile.name.toLowerCase() !== (currentUser?.name ?? '').toLowerCase(),
  )
  const isAdmin = currentUser?.email?.toLowerCase() === 'avnishpc00@gmail.com'

  const runAndClose = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  const triggerClass =
    variant === 'apple'
      ? `apple-nav-profile ${currentUser ? 'has-avatar' : ''}`
      : 'netflix-sidebar-avatar'

  return (
    <div className={`profile-menu profile-menu-${variant}`} ref={rootRef}>
      <button
        className={triggerClass}
        type="button"
        title="Profile"
        aria-label="Profile"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {renderProfileAvatarMini(currentUser, profiles)}
      </button>

      {open && (
        <div className="profile-menu-dropdown" role="menu">
          {currentUser && (
            <button
              className="profile-menu-item profile-menu-current"
              type="button"
              role="menuitem"
              onClick={runAndClose(onAccount)}
            >
              <span className="profile-menu-avatar">
                {renderProfileAvatarMini(currentUser, profiles)}
              </span>
              <span className="profile-menu-name">{currentUser.name}</span>
            </button>
          )}

          {otherProfiles.map((profile) => (
            <button
              key={profile.name}
              className="profile-menu-item"
              type="button"
              role="menuitem"
              onClick={runAndClose(() => onSelectProfile(profile.name))}
            >
              <span className="profile-menu-avatar">
                {renderProfileAvatarMini(
                  { name: profile.name, email: '', avatarColor: profile.avatarColor },
                  profiles,
                )}
              </span>
              <span className="profile-menu-name">{profile.name}</span>
            </button>
          ))}

          <div className="profile-menu-sep" />

          <button
            className="profile-menu-item profile-menu-action"
            type="button"
            role="menuitem"
            onClick={runAndClose(onManageProfiles)}
          >
            <UserCog size={18} />
            <span>Manage Profiles</span>
          </button>
          <button
            className="profile-menu-item profile-menu-action"
            type="button"
            role="menuitem"
            onClick={runAndClose(onTransferProfile)}
          >
            <Crown size={18} />
            <span>Lord</span>
          </button>
          {isAdmin && onSetLordPin && (
            <button
              className="profile-menu-item profile-menu-action"
              type="button"
              role="menuitem"
              onClick={runAndClose(onSetLordPin)}
            >
              <KeyRound size={18} />
              <span>Set Lord Password</span>
            </button>
          )}
          <button
            className="profile-menu-item profile-menu-action"
            type="button"
            role="menuitem"
            onClick={runAndClose(onAccount)}
          >
            <CircleUserRound size={18} />
            <span>Account</span>
          </button>
          <button
            className="profile-menu-item profile-menu-action"
            type="button"
            role="menuitem"
            onClick={runAndClose(onHelp)}
          >
            <CircleHelp size={18} />
            <span>Help Center</span>
          </button>

          <div className="profile-menu-sep" />

          <button
            className="profile-menu-item profile-menu-signout"
            type="button"
            role="menuitem"
            onClick={runAndClose(onSignOut)}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
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
  onDrama,
  onLiveTv,
  onManga,
  currentUser,
  onProfile,
  onSelectProfile,
  onManageProfiles,
  onTransferProfile,
  onHelp,
  onSetLordPin,
  onGoAnime,
  onGoLumen,
  onSignOut,
  onOpenDetail,
  likedMovies,
  profiles,
  designMode,
  invites,
  onAcceptInvite,
  onDismissInvite,
}: {
  active: PrimaryTab
  onHome: () => void
  onMovies: () => void
  onTvShows: () => void
  onSearch: () => void
  onLibrary: () => void
  onDrama: () => void
  onLiveTv: () => void
  onManga?: () => void
  currentUser: UserInfo | null
  onProfile: () => void
  onSelectProfile: (name: string) => void
  onManageProfiles: () => void
  onTransferProfile: () => void
  onHelp: () => void
  onSetLordPin?: () => void
  onGoAnime: () => void
  onGoLumen: () => void
  onSignOut: () => void
  onOpenDetail: (movie: Movie) => void
  likedMovies: Movie[]
  profiles: UserProfile[]
  designMode: 'apple' | 'netflix'
  invites: WatchParty[]
  onAcceptInvite: (invite: WatchParty) => void
  onDismissInvite: (invite: WatchParty) => void
}) {
  const profileMenuProps = {
    currentUser,
    profiles,
    onSelectProfile,
    onManageProfiles,
    onTransferProfile,
    onAccount: onProfile,
    onHelp,
    onSignOut,
    onSetLordPin,
  }

  return (
    <header className={designMode === 'netflix' ? 'desktop-nav' : 'desktop-nav apple-desktop-nav'}>
      {designMode === 'netflix' ? (
        <div className="netflix-sidebar">
          {/* Top: "A" logo — switches back to the Lumen UI */}
          <button
            className="netflix-sidebar-logo anime-logo-btn"
            type="button"
            onClick={onGoLumen}
            aria-label="Switch to Lumen"
            title="Switch to Lumen"
          >
            <span className="anime-logo-mark">A</span>
          </button>

          {/* Middle navigation links/icons */}
          <nav className="netflix-sidebar-nav" aria-label="Main Navigation">
            {/* Anime (Home) icon */}
            <button
              className={`netflix-sidebar-btn ${active === 'Home' ? 'active' : ''}`}
              type="button"
              onClick={onHome}
              title="Anime (Home)"
            >
              <Home size={22} strokeWidth={2.2} />
            </button>

            {/* Drama icon */}
            <button
              className={`netflix-sidebar-btn ${active === 'Drama' ? 'active' : ''}`}
              type="button"
              onClick={onDrama}
              title="Drama"
            >
              <Tv size={22} strokeWidth={2.2} />
            </button>

            {/* Live TV icon */}
            <button
              className={`netflix-sidebar-btn ${active === 'Live TV' ? 'active' : ''}`}
              type="button"
              onClick={onLiveTv}
              title="Live TV"
            >
              <Radio size={22} strokeWidth={2.2} />
            </button>

            {/* Manga icon */}
            <button
              className={`netflix-sidebar-btn ${active === 'Manga' ? 'active' : ''}`}
              type="button"
              onClick={onManga}
              title="Manga"
            >
              <BookOpen size={22} strokeWidth={2.2} />
            </button>

            {/* Search icon */}
            <button
              className={`netflix-sidebar-btn ${active === 'Search' ? 'active' : ''}`}
              type="button"
              onClick={onSearch}
              title="Search"
            >
              <Search size={22} strokeWidth={2.2} />
            </button>

            {/* Library (Plus) icon */}
            <button
              className={`netflix-sidebar-btn ${active === 'Library' ? 'active' : ''}`}
              type="button"
              onClick={onLibrary}
              title="Library"
            >
              <Plus size={22} strokeWidth={2.2} />
            </button>
          </nav>

          {/* Bottom Actions: Notifications & Profile */}
          <div className="netflix-sidebar-bottom">
            <NotificationBell
              variant="netflix"
              invites={invites}
              onAccept={onAcceptInvite}
              onDismiss={onDismissInvite}
            />
            <WatchRecommenderEntry
              designMode={designMode}
              onOpenDetail={onOpenDetail}
              likedMovies={likedMovies}
              variant="icon"
            />
            <ProfileMenu variant="netflix" {...profileMenuProps} />
          </div>
        </div>
      ) : (
        <>
          <div
            className="apple-floating-nav"
            role="navigation"
            aria-label="Primary"
          >
            <button
              className={`apple-nav-link${active === 'Home' ? ' apple-nav-link-active' : ''}`}
              type="button"
              onClick={onHome}
            >
              Home
            </button>
            <button
              className={`apple-nav-link${active === 'Movies' ? ' apple-nav-link-active' : ''}`}
              type="button"
              onClick={onMovies}
            >
              Movies
            </button>
            <button
              className={`apple-nav-link${active === 'TV Shows' ? ' apple-nav-link-active' : ''}`}
              type="button"
              onClick={onTvShows}
            >
              TV
            </button>
            <button
              className={`apple-nav-link${active === 'Library' ? ' apple-nav-link-active' : ''}`}
              type="button"
              onClick={onLibrary}
            >
              Library
            </button>
            <span className="apple-nav-divider" aria-hidden="true" />
            <button
              className="apple-nav-link apple-nav-anime-link"
              type="button"
              onClick={onGoAnime}
              title="Switch to Anime / Drama"
            >
              A/D
            </button>
            <button
              className="apple-nav-icon-btn"
              type="button"
              title="Search"
              aria-label="Search"
              onClick={onSearch}
            >
              <Search size={18} />
            </button>
          </div>
          <NotificationBell
            variant="apple"
            invites={invites}
            onAccept={onAcceptInvite}
            onDismiss={onDismissInvite}
          />
          <WatchRecommenderEntry
            designMode={designMode}
            onOpenDetail={onOpenDetail}
            likedMovies={likedMovies}
            variant="icon"
          />
          <ProfileMenu variant="apple" {...profileMenuProps} />
        </>
      )}
    </header>
  )
}

export default App
