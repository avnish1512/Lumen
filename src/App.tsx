import {
  type CSSProperties,
  type FormEvent,
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
  Star,
  Trash2,
  Tv,
  Users,
  Volume2,
  VolumeX,
  X,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
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
  KeyRound,
  BookOpen,
  Code,
  Video,
  Maximize2,
  Minimize2,
  SkipBack,
  SkipForward,
  Shield,
  Sparkles,
} from 'lucide-react'
import {
  fetchMovieCollection,
  fetchMovieById,
  fetchTvShowCollection,
  fetchAnimeCollection,
  searchMovies,
  normalizeMovie,
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
import { searchAnime, syncAnimeProgressToAniList, fetchAnimeByOptions, getAnimeDetails, fetchAnimeListByIds, fetchAnimeRelationsAndRecommendations, type AnimeSeasonInfo } from './anilist'
import {
  fetchAccountProfiles as fetchRemoteProfiles,
  saveAccountProfiles as saveRemoteProfiles,
  verifyRemoteLordPin,
  saveRemoteLordPin,
  fetchRemoteWatchHistory,
  saveRemoteWatchHistory,
  fetchGlobalPhubSeed,
  updateGlobalPhubSeed,
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
  MAIN_ACCOUNT_EMAIL,
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
import { ErrorBoundary } from './ErrorBoundary'
import { DownloadsScreen } from './DownloadsScreen'
import { startDownload, getAllDownloads, subscribeDownloads } from './downloads'
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

type Screen = 'home' | 'movies' | 'tv' | 'anime' | 'detail' | 'watch' | 'search' | 'library' | 'login' | 'profiles' | 'drama' | 'livetv' | 'lord' | 'manga' | 'downloads'
type PrimaryTab = 'Home' | 'Movies' | 'TV Shows' | 'Anime' | 'Library' | 'Search' | 'Drama' | 'Live TV' | 'Manga' | 'Downloads'
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
const activeScreenKey = 'omdb.apple-tv-style.active-screen'

function readSelectedMovie(): Movie | null {
  try {
    const saved = window.sessionStorage.getItem(selectedMovieKey)
    return saved ? (JSON.parse(saved) as Movie) : null
  } catch {
    return null
  }
}

function readActiveScreen(): Screen | null {
  try {
    const hash = window.location.hash.replace(/^#/, '')
    const validScreens: Screen[] = [
      'home',
      'movies',
      'tv',
      'anime',
      'detail',
      'watch',
      'search',
      'library',
      'login',
      'profiles',
      'drama',
      'livetv',
      'lord',
      'manga',
      'downloads',
    ]
    if (hash && validScreens.includes(hash as Screen)) {
      return hash as Screen
    }
    const saved = window.sessionStorage.getItem(activeScreenKey)
    if (saved && validScreens.includes(saved as Screen)) {
      return saved as Screen
    }
    return null
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
  starredServer?: string
}

const adminStarredServerKey = 'lumen.starredServer.admin'

function starredServerKeyFor(user: UserInfo | null) {
  if (isMainAccount(user?.email)) {
    return adminStarredServerKey
  }
  return user?.name
    ? `lumen.starredServer.${user.email ? user.email.toLowerCase() + '.' : ''}${user.name}`
    : `lumen.starredServer.default`
}

function readStarredServerFor(user: UserInfo | null): string {
  try {
    // 1. Admin-set global starred server takes precedence
    const adminSaved = window.localStorage.getItem(adminStarredServerKey)
    if (adminSaved && adminSaved.trim()) return adminSaved.trim()

    // 2. User/Profile specific fallback
    const key = starredServerKeyFor(user)
    const saved = window.localStorage.getItem(key)
    if (saved && saved.trim()) return saved.trim()

    const profiles = readProfilesFor(user)
    const matched = profiles.find((p) => p.name === user?.name)
    return matched?.starredServer || ''
  } catch {
    return ''
  }
}

function saveStarredServerFor(user: UserInfo | null, serverId: string) {
  try {
    if (isMainAccount(user?.email)) {
      if (serverId) {
        window.localStorage.setItem(adminStarredServerKey, serverId)
      } else {
        window.localStorage.removeItem(adminStarredServerKey)
      }
    }
    const key = starredServerKeyFor(user)
    if (serverId) {
      window.localStorage.setItem(key, serverId)
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {}
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
  const defaultUserName = user?.name ? user.name.trim() : ''
  const defaultUserColor = user?.avatarColor || 'red'
  const fallback: UserProfile[] = [
    ...(defaultUserName ? [{ name: defaultUserName, avatarColor: defaultUserColor }] : []),
    { name: 'Children', avatarColor: 'kids' },
  ]
  try {
    const key = profilesKeyFor(user)
    // Each account keeps its own list. A brand-new account starts with the
    // account owner's profile and the default Kids profile.
    const saved = window.localStorage.getItem(key)
    if (!saved) return fallback

    const parsed = JSON.parse(saved)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const sanitized = parsed
        .filter((p) => p && typeof p === 'object' && typeof p.name === 'string' && p.name.trim().length > 0)
        .map((p) => ({
          name: p.name.trim(),
          avatarColor: typeof p.avatarColor === 'string' && p.avatarColor.trim() ? p.avatarColor : 'red',
          starredServer: typeof p.starredServer === 'string' && p.starredServer.trim() ? p.starredServer.trim() : undefined,
        }))
      return sanitized.length > 0 ? sanitized : fallback
    }
    return fallback
  } catch {
    return fallback
  }
}

function readCurrentUser(): UserInfo | null {
  try {
    const saved = window.localStorage.getItem(currentUserKey)
    if (!saved) return null
    const parsed = JSON.parse(saved)
    if (parsed && typeof parsed === 'object' && typeof parsed.name === 'string') {
      return {
        name: parsed.name.trim() || 'User',
        email: typeof parsed.email === 'string' ? parsed.email.trim() : '',
        avatarColor: typeof parsed.avatarColor === 'string' && parsed.avatarColor.trim() ? parsed.avatarColor : 'red',
      }
    }
    return null
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

function getInitials(name: string | null | undefined) {
  if (!name || typeof name !== 'string') return '👤'
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
    value === 'vidrift' ||
    value === 'rivestream' ||
    value === 'cinesrc' ||
    value === 'embedapi' ||
    value === 'vidphantom' ||
    value === 'mgeb' ||
    value === 'primesrc' ||
    value === 'embedmaster' ||
    value === 'filmu' ||
    value === 'nhdapi' ||
    value === 'yenime' ||
    value === 'vidsync' ||
    value === 'multiembed-vip' ||
    value === 'vidking' ||
    value === 'clickhost' ||
    value === 'megaplay' ||
    value === 'megabuzz' ||
    value === 'megavid' ||
    value === 'oceanplay' ||
    value === 'apijav' ||
    value === 'phubplay' ||
    value === 'upload18' ||
    value === 'eporner'
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

export function compactRuntime(runtime?: string | null) {
  if (!runtime || typeof runtime !== 'string') return ''

  const hrMatch = runtime.match(/(\d+)\s*(?:h|hr|hours?)\b/i)
  const minMatch = runtime.match(/(\d+)\s*(?:m|min|mins?|minutes?)\b/i)

  const hours = hrMatch ? parseInt(hrMatch[1], 10) : 0
  const mins = minMatch ? parseInt(minMatch[1], 10) : 0

  if (hours > 0 || mins > 0) {
    const totalMinutes = hours * 60 + mins
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    if (h > 0) {
      return m > 0 ? `${h}h ${m}m` : `${h}h`
    }
    return `${m}m`
  }

  const digitOnlyMatch = runtime.trim().match(/^(\d+)$/)
  if (digitOnlyMatch) {
    const totalMinutes = parseInt(digitOnlyMatch[1], 10)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    if (h > 0) {
      return m > 0 ? `${h}h ${m}m` : `${h}h`
    }
    return `${m}m`
  }

  return runtime.replace(/\s*hr\s*/gi, 'h ').replace(/\s*min\s*/gi, 'm').trim()
}

const hiddenMediaBadges = new Set(['CC', 'SDH'])

function visibleMediaBadges(badges: string[] = []) {
  return badges.filter((badge) => typeof badge === 'string' && !hiddenMediaBadges.has(badge.trim().toUpperCase()))
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
    },
    [itemCount],
  )

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!swipeStartRef.current) {
        return
      }

      const deltaX = event.clientX - swipeStartRef.current.x
      const deltaY = event.clientY - swipeStartRef.current.y
      swipeStartRef.current = null

      if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return
      }

      if (deltaX < 0) {
        onIndexChange((activeIndex + 1) % itemCount)
      } else {
        onIndexChange((activeIndex - 1 + itemCount) % itemCount)
      }
    },
    [activeIndex, itemCount, onIndexChange],
  )

  return { onPointerDown, onPointerUp }
}

const seasonEpisodeCounts: Record<string, number[]> = {
  tt0944947: [10, 10, 10, 10, 10, 10, 7, 6],
  tt0903747: [7, 13, 13, 13, 16],
  tt4574334: [8, 9, 8, 9],
  tt1475582: [3, 3, 3, 3],
  tt0108778: [24, 24, 25, 24, 24, 25, 24, 24, 24, 18],
  tt7366338: [5],
  tt3032476: [10, 10, 10, 10, 10, 13],
  tt1520211: [6, 13, 16, 16, 16, 16, 16, 16, 16, 22, 24],
  tt2861424: [11, 10, 10, 10, 10, 10, 10],
  tt0413573: [9, 27, 25, 17, 24, 24, 22, 24, 24, 24, 25, 24, 24, 24, 25, 21, 17, 20, 20],
}

function seasonsFor(movie: Movie) {
  if (!movie) return [{ season: 1, episodeCount: 1 }]

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

  const knownCounts = movie.id ? seasonEpisodeCounts[movie.id] : undefined
  const fallbackSeasonCount = (movie.year || '').includes('-') ? 4 : 2
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

export function episodeRuntime(movie?: Movie | null, _season?: number, _episode?: number) {
  if (!movie) return ''
  // Anime carry a real per-episode duration from AniList; use it directly.
  if (movie.isAnime && typeof movie.episodeRuntimeMinutes === 'number' && movie.episodeRuntimeMinutes > 0) {
    return `${movie.episodeRuntimeMinutes}m`
  }
  // Otherwise, only surface a real minutes value parsed from the title's
  // runtime. Never fabricate a time — an unknown runtime shows nothing rather
  // than a made-up number.
  if (!movie.runtime || typeof movie.runtime !== 'string') {
    return ''
  }
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

export function getEpisodeDuration(
  movie?: Movie | null,
  episodeNumber?: number,
  rawEpDuration?: string | number,
  fallbackRuntime?: string,
): string {
  // 1. If explicit duration is provided (e.g. "45m", "1h 10m", "24:15", "52 min", 52)
  if (rawEpDuration) {
    if (typeof rawEpDuration === 'number' && rawEpDuration > 0) {
      const hrs = Math.floor(rawEpDuration / 60)
      const mins = rawEpDuration % 60
      return hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${rawEpDuration}m`
    }
    if (typeof rawEpDuration === 'string') {
      const trimmed = rawEpDuration.trim()
      if (/^\d+:\d{2}$/.test(trimmed)) {
        return trimmed
      }
      const numMatch = trimmed.match(/^(\d+)\s*(?:m|min)?$/i)
      if (numMatch) {
        const mins = parseInt(numMatch[1], 10)
        if (mins > 0) {
          const hrs = Math.floor(mins / 60)
          const remMins = mins % 60
          return hrs > 0 ? (remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`) : `${mins}m`
        }
      }
      const cleaned = trimmed.replace(/mm+$/i, 'm')
      if (cleaned && !cleaned.toLowerCase().includes('series') && !cleaned.toLowerCase().includes('unavailable')) {
        return cleaned
      }
    }
  }

  // 2. If fallbackRuntime is provided
  if (fallbackRuntime && typeof fallbackRuntime === 'string') {
    const trimmed = fallbackRuntime.trim()
    if (trimmed && !trimmed.toLowerCase().includes('series') && !trimmed.toLowerCase().includes('unavailable')) {
      const numMatch = trimmed.match(/^(\d+)\s*(?:m|min)?$/i)
      if (numMatch) {
        const mins = parseInt(numMatch[1], 10)
        if (mins > 0) {
          const hrs = Math.floor(mins / 60)
          const remMins = mins % 60
          return hrs > 0 ? (remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`) : `${mins}m`
        }
      }
      return trimmed
    }
  }

  // 3. If movie has episodeRuntimeMinutes
  if (typeof movie?.episodeRuntimeMinutes === 'number' && movie.episodeRuntimeMinutes > 0) {
    const mins = movie.episodeRuntimeMinutes
    const hrs = Math.floor(mins / 60)
    const remMins = mins % 60
    return hrs > 0 ? (remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`) : `${mins}m`
  }

  // 4. If movie.runtime has numeric minutes (e.g. "45 min", "55 min")
  if (movie?.runtime && typeof movie.runtime === 'string') {
    const match = movie.runtime.match(/(\d+)\s*min/i)
    if (match) {
      const mins = parseInt(match[1], 10)
      if (mins > 0) {
        const hrs = Math.floor(mins / 60)
        const remMins = mins % 60
        return hrs > 0 ? (remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`) : `${mins}m`
      }
    }
  }

  // 5. For Anime ONLY: fallback seed offset if no exact time is available
  if (movie?.isAnime) {
    const baseMins = 24
    const seed = (movie.id || 'anime').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    const epNum = typeof episodeNumber === 'number' ? episodeNumber : 1
    const offset = ((epNum * 19 + seed * 7) % 45) - 25
    const totalSeconds = Math.max(60, baseMins * 60 + offset)
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return ''
}

function episodeSynopsis(movie?: Movie | null, season?: number, episode?: number) {
  if (!movie) return ''
  const cleanSynopsis = (movie.synopsis ?? '').replace(/\s+/g, ' ').trim()

  if (cleanSynopsis && cleanSynopsis !== 'N/A') {
    return cleanSynopsis
  }

  return `${movie.title || 'Title'} continues through season ${season ?? 1}, episode ${episode ?? 1}.`
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
    const s = movie.streamSeason ?? 1
    const e = movie.streamEpisode ?? 1
    return `S${s}, E${e} / ${runtime}`
  }

  // Anime with multiple episodes that aren't classified as TV shows
  if (movie.isAnime && (movie.streamEpisode ?? 0) > 0) {
    return `E${movie.streamEpisode} / ${runtime}`
  }

  return runtime
}

export function isPhub3Movie(m?: Movie | null): boolean {
  if (!m) return false
  return Boolean(
    m.id?.startsWith('phub3-') ||
    m.label === 'PHub 3' ||
    m.hentaiSlug?.startsWith('phub3-') ||
    m.embedUrl?.includes('eporner.com')
  )
}

export function isPhub2Movie(m?: Movie | null): boolean {
  if (!m) return false
  if (isPhub3Movie(m)) return false
  return Boolean(
    m.id?.startsWith('phub2-') ||
    m.label === 'PHub 2' ||
    m.hentaiSlug?.startsWith('phub2-') ||
    m.embedUrl?.includes('upload18.net') ||
    m.embedUrl?.includes('xvidapi')
  )
}

export function isPhub1Movie(m?: Movie | null): boolean {
  if (!m) return false
  if (isPhub3Movie(m) || isPhub2Movie(m)) return false
  return Boolean(
    m.id?.startsWith('phub-') ||
    m.label === 'PHub' ||
    m.type === 'PHub Video' ||
    m.hentaiSlug?.startsWith('phub-')
  )
}

export function isPhubMovie(m?: Movie | null): boolean {
  if (!m) return false
  return isPhub1Movie(m) || isPhub2Movie(m) || isPhub3Movie(m)
}

export function isJavMovie(m?: Movie | null): boolean {
  if (!m) return false
  return Boolean(
    m.id?.startsWith('jav-') ||
    m.label === 'JAV' ||
    m.isJav ||
    m.hentaiSlug?.startsWith('jav-')
  )
}

export function isHentaiMovie(m?: Movie | null): boolean {
  if (!m) return false
  return (
    !isPhubMovie(m) &&
    !isJavMovie(m) &&
    Boolean(
      m.isHentaiOcean ||
      m.id?.startsWith('hentaiocean-') ||
      m.genres?.some((g) => g.toLowerCase() === 'hentai')
    )
  )
}

export function isLordAdultMovie(movie?: Movie | null): boolean {
  if (!movie) return false
  return isJavMovie(movie) || isPhubMovie(movie) || isHentaiMovie(movie)
}

export const PORN_API_BASE_URL = 'https://porn-api.com/api/v1/public'
export const PORN_API_KEY =
  (import.meta as any).env?.VITE_PHUB_API_KEY ||
  '2ceb712d93165c1f69e2ff70948aa09705f7da4610ffb0caec764f224ef1b8f1'

export interface PornApiMovieItem {
  title: string
  description?: string
  thumbnail_url?: string
  poster_url?: string
  slug: string
  duration?: string
  quality?: string
  views?: number
  created_at?: string
  categories?: { name: string; slug: string }[] | string[]
  pornstars?: { name: string; slug: string }[] | string[]
  episodes?: {
    name: string
    slug: string
    sources: { server_name: string; embed_url: string; m3u8_url?: string }[]
  }[]
}

export async function fetchPornApi(
  endpoint: string,
  params: Record<string, string | number> = {},
): Promise<any> {
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      query.set(k, String(v))
    }
  }

  // 1. Try dev/local proxy /api/phub
  try {
    const proxyUrl = `/api/phub?endpoint=${encodeURIComponent(endpoint)}&${query.toString()}`
    const res = await fetch(proxyUrl)
    if (res.ok) {
      const json = await res.json()
      if (json?.data || json?.success || Array.isArray(json)) return json
    }
  } catch {}

  // 2. Try Vercel hub proxy /api/hub?kind=phub
  try {
    const hubUrl = `/api/hub?kind=phub&endpoint=${encodeURIComponent(endpoint)}&${query.toString()}`
    const res = await fetch(hubUrl)
    if (res.ok) {
      const json = await res.json()
      if (json?.data || json?.success || Array.isArray(json)) return json
    }
  } catch {}

  // 3. Try direct fetch with X-API-Key
  try {
    let directUrl = `${PORN_API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
    if (query.toString()) {
      directUrl += (directUrl.includes('?') ? '&' : '?') + query.toString()
    }
    const res = await fetch(directUrl, {
      headers: {
        'X-API-Key': PORN_API_KEY,
      },
    })
    if (res.ok) {
      const json = await res.json()
      if (json?.data || json?.success || Array.isArray(json)) return json
    }
  } catch {}

  return null
}

export async function fetchPornApiMovieDetail(slug: string): Promise<PornApiMovieItem | null> {
  try {
    const cleanSlug = slug.replace(/^phub3-|^phub2-|^phub-/, '')
    const json = await fetchPornApi(`/movies/${encodeURIComponent(cleanSlug)}`)
    return json?.data || json || null
  } catch (err) {
    console.error('Failed to fetch Porn API detail', err)
    return null
  }
}

export function pornApiToMovieHelper(item: PornApiMovieItem, embedUrlOverride?: string, serverMode?: 'pornapi' | 'xvidapi' | 'eporner'): Movie {
  const rawCats = Array.isArray(item.categories) ? item.categories : []
  const catNames = rawCats
    .map((c) => (typeof c === 'string' ? c : c?.name))
    .filter(Boolean) as string[]
  const genres = catNames.length > 0 ? catNames : ['PHub', '4K Ultra HD']

  const rawStars = Array.isArray(item.pornstars) ? item.pornstars : []
  const cast = rawStars
    .map((p) => (typeof p === 'string' ? p : p?.name))
    .filter((s) => s && s.toLowerCase() !== 'unknown') as string[]

  const year = item.created_at ? new Date(item.created_at).getFullYear().toString() : '2026'
  const quality = item.quality || '4K'

  let embedUrl = embedUrlOverride || ''
  if (!embedUrl && item.episodes && item.episodes.length > 0) {
    const ep = item.episodes[0]
    embedUrl = ep.sources?.[0]?.embed_url || ep.sources?.[0]?.m3u8_url || ''
  }

  const isEporner = serverMode === 'eporner' || embedUrl.includes('eporner.com') || item.episodes?.[0]?.sources?.[0]?.server_name === 'Eporner'
  const isXvid = serverMode === 'xvidapi' || embedUrl.includes('upload18.net') || embedUrl.includes('xvidapi') || item.episodes?.[0]?.sources?.[0]?.server_name === 'Upload18'

  const idPrefix = isEporner ? 'phub3-' : isXvid ? 'phub2-' : 'phub-'
  const label = isEporner ? 'PHub 3' : isXvid ? 'PHub 2' : 'PHub'
  const cleanSlug = item.slug ? item.slug.replace(/^phub3-|^phub2-|^phub-/, '') : 'video'

  return {
    id: `${idPrefix}${cleanSlug}`,
    rank: 0,
    title: cleanHtmlEntities(item.title),
    logoTitle: quality,
    label,
    type: 'PHub Video',
    genres,
    year,
    runtime: item.duration && item.duration !== '00:00:00' ? item.duration : quality,
    rating: item.views ? `★ ${(Math.min(5, 4.5 + (item.views % 50) / 100)).toFixed(1)}` : '★ 4.9',
    maturity: '18+',
    progress: 0,
    hero: item.poster_url || item.thumbnail_url || '',
    poster: item.poster_url || item.thumbnail_url || '',
    still: item.thumbnail_url || item.poster_url || '',
    synopsis: cleanHtmlEntities(item.description || `${genres.join(', ')} · ${item.duration || quality}`),
    cast: cast.map(cleanHtmlEntities),
    director: cast[0] ? cleanHtmlEntities(cast[0]) : label,
    awards: quality,
    boxOffice: item.views ? `${item.views.toLocaleString()} views` : '',
    ratings: [],
    embedUrl,
    isHentaiOcean: false,
    hentaiSlug: `${idPrefix}${cleanSlug}`,
  }
}

export function hanimeToMovieHelper(video: HanimeVideo | any): Movie {
  return {
    id: `phub-${video.id || video.slug || ''}`,
    rank: 0,
    title: cleanHtmlEntities(video.title || ''),
    logoTitle: video.quality || '4K',
    label: 'PHub',
    type: 'PHub Video',
    genres: video.category ? [video.category] : Array.isArray(video.genres) ? video.genres : ['PHub', '4K Ultra HD'],
    year: video.year || new Date().getFullYear().toString(),
    runtime: video.duration || '20:00',
    rating: video.rating || '★ 4.9',
    maturity: '18+',
    progress: 0,
    hero: video.poster || video.thumb || video.thumbnail_url || video.poster_url || '',
    poster: video.poster || video.thumb || video.thumbnail_url || video.poster_url || '',
    still: video.thumb || video.still || video.thumbnail_url || '',
    synopsis: cleanHtmlEntities(video.description || `${video.category || 'PHub'} · ${video.duration || '4K'}`),
    cast: Array.isArray(video.actors) ? video.actors.map(cleanHtmlEntities) : Array.isArray(video.cast) ? video.cast.map(cleanHtmlEntities) : [],
    director: 'PHub',
    awards: video.quality || '4K',
    boxOffice: video.views ? `${video.views.toLocaleString()} views` : '',
    ratings: [],
    embedUrl: video.embedUrl || '',
    isHentaiOcean: false,
    hentaiSlug: video.code || (video.id ? `phub-${video.id}` : `phub-${video.slug}`),
  }
}

export type EpornerVideoItem = {
  id: string
  title: string
  keywords?: string
  views?: number
  rate?: string
  url?: string
  added?: string
  length_sec?: number
  length_min?: string
  embed?: string
  default_thumb?: { size: string; width: number; height: number; src: string }
  thumbs?: { size: string; width: number; height: number; src: string }[]
}

export const EPORNER_INITIAL_VIDEOS: EpornerVideoItem[] = [
  {
    id: 'IsabYDAiqXa',
    title: 'Young Teen Heather Night In Passionate HD Session',
    keywords: 'Teen, Petite, Young, Deep Throat, Heather Night, Small Tits, Small Ass, brunette, creampie, hd sex, teens, big dick, hardcore',
    views: 260221,
    rate: '4.13',
    url: 'https://www.eporner.com/hd-porn/IsabYDAiqXa/Young-Teen-Heather/',
    added: '2025-01-21 11:42:47',
    length_sec: 2539,
    length_min: '42:19',
    embed: 'https://www.eporner.com/embed/IsabYDAiqXa/',
    default_thumb: { size: 'big', width: 640, height: 360, src: 'https://static-ca-cdn.eporner.com/thumbs/static4/3/30/305/3054537/5_360.jpg' },
  },
  {
    id: '6Rp28FNqFuO',
    title: 'Sexy Japanese Model Maki Horiguchi In Private Room',
    keywords: 'Asian, Japanese, Brunette, Teens, Petite, Young, Blowjob, Creampie',
    views: 2734059,
    rate: '4.18',
    url: 'https://www.eporner.com/hd-porn/6Rp28FNqFuO/Fucking-Sexy-Japanese-Girl-Maki-Horiguchi/',
    added: '2025-02-15 04:59:54',
    length_sec: 3736,
    length_min: '62:16',
    embed: 'https://www.eporner.com/embed/6Rp28FNqFuO/',
    default_thumb: { size: 'big', width: 640, height: 360, src: 'https://static-ca-cdn.eporner.com/thumbs/static4/2/22/226/226165/15_360.jpg' },
  },
  {
    id: 'sTlL3Cc3Dps',
    title: 'Mother And Daughter Nude On Webcam Chat',
    keywords: 'Teen, Nude, Webcam, Mother, Daughter, blonde, striptease, MILF, Amateur',
    views: 244545,
    rate: '3.78',
    url: 'https://www.eporner.com/hd-porn/sTlL3Cc3Dps/Mother-And-Daughter-Nude-On-Webcam/',
    added: '2025-01-01 01:00:00',
    length_sec: 201,
    length_min: '3:21',
    embed: 'https://www.eporner.com/embed/sTlL3Cc3Dps/',
    default_thumb: { size: 'big', width: 480, height: 360, src: 'https://static-ca-cdn.eporner.com/thumbs/static4/2/20/202/202084/14_360.jpg' },
  },
  {
    id: 'mlWiwfpKUNi',
    title: 'Almost Caught Cheating With Slutty Teen Next Door',
    keywords: 'Big Ass, Big Tits, Teen, Creampie, Cheating, Amateur, POV, Brunette, Masturbation',
    views: 307121,
    rate: '4.11',
    url: 'https://www.eporner.com/hd-porn/mlWiwfpKUNi/Almost-Caught-Cheating-On-Girlfriend-With-Slutty-Teen/',
    added: '2025-01-03 21:53:42',
    length_sec: 1479,
    length_min: '24:39',
    embed: 'https://www.eporner.com/embed/mlWiwfpKUNi/',
    default_thumb: { size: 'big', width: 640, height: 360, src: 'https://static-ca-cdn.eporner.com/thumbs/static4/3/30/300/3003679/14_360.jpg' },
  },
  {
    id: 'qDpoWf0nVy2',
    title: 'Amateur Japanese Getting Private Lessons POV',
    keywords: 'Amateur, Asian, Japanese, Blowjob, Cumshot, Handjob, Teen, Threesome, Bukkake',
    views: 78020,
    rate: '3.71',
    url: 'https://www.eporner.com/hd-porn/qDpoWf0nVy2/Amateur-Japanese-Getting-Lessons-How-To-Fuck-mp4/',
    added: '2025-01-17 23:08:55',
    length_sec: 3519,
    length_min: '58:39',
    embed: 'https://www.eporner.com/embed/qDpoWf0nVy2/',
    default_thumb: { size: 'big', width: 640, height: 360, src: 'https://static-ca-cdn.eporner.com/thumbs/static4/3/32/321/3214723/14_360.jpg' },
  },
  {
    id: 'qKhpDTneqHV',
    title: 'Tiny Blonde Teen With Big Tits Rides Hard POV',
    keywords: 'Blonde, Teens, Big Tits, POV, Hardcore, Amateur, Blowjob, Cumshot',
    views: 73691,
    rate: '4.22',
    url: 'https://www.eporner.com/hd-porn/qKhpDTneqHV/Tiny-Teen-With-Big-Tits-Likes-To-Ride-And-Cum-On-My-Cock-Chessie-Rae-Chessie-Rae/',
    added: '2025-01-26 15:22:17',
    length_sec: 341,
    length_min: '5:41',
    embed: 'https://www.eporner.com/embed/qKhpDTneqHV/',
    default_thumb: { size: 'big', width: 640, height: 360, src: 'https://static-ca-cdn.eporner.com/thumbs/static4/3/31/315/3155808/4_360.jpg' },
  },
  {
    id: 'TWl2JbIvfwk',
    title: 'Redhead Teen Passionate Room Session 1080p',
    keywords: 'Redhead, Teens, POV, Small Tits, Petite, Hardcore, Big Dick, Blowjob, Cumshot',
    views: 60890,
    rate: '4.41',
    url: 'https://www.eporner.com/hd-porn/TWl2JbIvfwk/Redhead-Teen-Fucked-In-Front-Of-Camera/',
    added: '2025-01-15 20:57:33',
    length_sec: 1491,
    length_min: '24:51',
    embed: 'https://www.eporner.com/embed/TWl2JbIvfwk/',
    default_thumb: { size: 'big', width: 640, height: 360, src: 'https://static-ca-cdn.eporner.com/thumbs/static4/3/32/320/3209696/8_360.jpg' },
  },
  {
    id: 'AKwLUeObRO5',
    title: 'Wet Petite Teen Doggystyle POV - 4K 60FPS Ultra HD',
    keywords: 'Teen, Young Teen, Amateur, POV, Petite, 4K, 60fps, Hardcore, Anal',
    views: 293402,
    rate: '4.13',
    url: 'https://www.eporner.com/hd-porn/AKwLUeObRO5/Wet-Teen-Pussy-Fucked-Doggystyle-POV-4K-60FPS/',
    added: '2025-01-02 18:10:05',
    length_sec: 296,
    length_min: '4:56',
    embed: 'https://www.eporner.com/embed/AKwLUeObRO5/',
    default_thumb: { size: 'big', width: 640, height: 360, src: 'https://static-ca-cdn.eporner.com/thumbs/static4/2/21/218/2185025/6_360.jpg' },
  },
  {
    id: 'FBvahfn434W',
    title: 'Cute Brunette Cutie First Time In Studio',
    keywords: 'Teens, Brunette, Teen, Young, Amateur, Hardcore, Creampie, Cosplay',
    views: 426710,
    rate: '3.95',
    url: 'https://www.eporner.com/hd-porn/FBvahfn434W/She-Is-Not-A-Virgin-Anymore-/',
    added: '2025-01-09 03:16:03',
    length_sec: 808,
    length_min: '13:28',
    embed: 'https://www.eporner.com/embed/FBvahfn434W/',
    default_thumb: { size: 'big', width: 640, height: 360, src: 'https://static-ca-cdn.eporner.com/thumbs/static4/3/34/347/347301/15_360.jpg' },
  },
  {
    id: 'ENlFAcdAtW1',
    title: 'Fiery Redhead Hardcore Action In Hotel Room',
    keywords: 'Cumshot, Hardcore, Redhead, Teens, Blowjob, Big Dick, Squirt, VR',
    views: 49360,
    rate: '3.67',
    url: 'https://www.eporner.com/hd-porn/ENlFAcdAtW1/Hot-Action-With-Fiery-Redhead-Teen/',
    added: '2025-01-14 21:49:30',
    length_sec: 1799,
    length_min: '29:59',
    embed: 'https://www.eporner.com/embed/ENlFAcdAtW1/',
    default_thumb: { size: 'big', width: 640, height: 360, src: 'https://static-ca-cdn.eporner.com/thumbs/static4/3/32/320/3200988/10_360.jpg' },
  },
]

const epornerApiCache = new Map<string, any>()

export async function fetchEpornerApi(
  params: Record<string, string | number> = {},
): Promise<any> {
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      query.set(k, String(v))
    }
  }

  const cacheKey = query.toString() || 'all'
  if (epornerApiCache.has(cacheKey)) {
    return epornerApiCache.get(cacheKey)
  }

  const fetchJsonWithTimeout = async (url: string, timeoutMs = 2000): Promise<any> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) throw new Error('Status not ok')
      const data = await res.json()
      if (data?.videos || Array.isArray(data) || data?.id) {
        return data
      }
      throw new Error('Invalid payload')
    } catch (err) {
      clearTimeout(timer)
      throw err
    }
  }

  const qs = query.toString()
  const candidateUrls = [
    `/api/eporner?${qs}`,
    `/api/hub?kind=eporner&${qs}`,
    `https://www.eporner.com/api/v2/video/search/?${qs}&format=json`,
  ]

  try {
    const result = await Promise.any(candidateUrls.map((url) => fetchJsonWithTimeout(url, 2200)))
    if (result) {
      epornerApiCache.set(cacheKey, result)
      return result
    }
  } catch {}

  return null
}

export async function fetchEpornerVideoDetail(id: string): Promise<EpornerVideoItem | null> {
  try {
    const cleanId = id.replace(/^phub3-/, '')
    const json = await fetchEpornerApi({ action: 'id', id: cleanId, thumbsize: 'big' })
    if (json?.id) return json
    if (Array.isArray(json) && json.length > 0) return json[0]
    return null
  } catch {
    return null
  }
}

export function epornerToMovieHelper(item: EpornerVideoItem): Movie {
  const rawKeywords = item.keywords ? item.keywords.split(',').map((k) => k.trim()).filter(Boolean) : []
  const genres = rawKeywords.length > 0 ? rawKeywords.slice(0, 3) : ['PHub 3', 'HD Video']
  const thumb = item.default_thumb?.src || item.thumbs?.[0]?.src || ''
  const cleanId = item.id || ''

  return {
    id: `phub3-${cleanId}`,
    rank: 0,
    title: cleanHtmlEntities(item.title || 'PHub 3 Video'),
    logoTitle: 'HD',
    label: 'PHub 3',
    type: 'PHub 3 Video',
    genres,
    year: item.added ? item.added.slice(0, 4) : '2026',
    runtime: item.length_min || 'HD',
    rating: item.rate ? `★ ${item.rate}` : '★ 4.8',
    maturity: '18+',
    progress: 0,
    hero: thumb,
    poster: thumb,
    still: thumb,
    synopsis: cleanHtmlEntities(item.title ? `${item.title} · ${genres.join(', ')}` : 'PHub 3 HD Video'),
    cast: rawKeywords.slice(0, 2).map(cleanHtmlEntities),
    director: 'Eporner',
    awards: 'HD 1080p',
    boxOffice: item.views ? `${item.views.toLocaleString()} views` : '',
    ratings: [],
    embedUrl: item.embed || `https://www.eporner.com/embed/${cleanId}/`,
    isHentaiOcean: false,
    hentaiSlug: `phub3-${cleanId}`,
  }
}

function isTvShow(movie: Movie) {
  if (!movie) return false
  if (isLordAdultMovie(movie)) {
    if (movie.isHentaiOcean) {
      return (
        (movie.hentaiEpisodes?.length ?? 0) > 1 ||
        (movie.episodeCount ?? 0) > 1 ||
        (movie.type || '').toLowerCase() === 'series'
      )
    }
    return false
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

  return movie.tmdbType === 'tv' || (movie.type || '').toLowerCase() === 'series'
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

  // Adult movies should never match across different adult sections or with non-adult movies
  const leftAdult = isLordAdultMovie(left)
  const rightAdult = isLordAdultMovie(right)
  if (leftAdult !== rightAdult) {
    return false
  }
  if (leftAdult && rightAdult) {
    const leftSection = isPhub1Movie(left) ? 'phub1' : isPhub2Movie(left) ? 'phub2' : isPhub3Movie(left) ? 'phub3' : isJavMovie(left) ? 'jav' : isHentaiMovie(left) ? 'hentai' : 'other'
    const rightSection = isPhub1Movie(right) ? 'phub1' : isPhub2Movie(right) ? 'phub2' : isPhub3Movie(right) ? 'phub3' : isJavMovie(right) ? 'jav' : isHentaiMovie(right) ? 'hentai' : 'other'
    if (leftSection !== rightSection) {
      return false
    }
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

function extractFranchisePrefix(title: string): string {
  if (!title) return ''
  const clean = title
    .replace(/[:\-–—].*$/, '') // Remove subtitle after colon or dash
    .replace(/\b(season|series|part|act|chapter|saga|volume|vol|movie|r\d+|shippuden|brotherhood|the movie)\b.*$/i, '')
    .trim()
    .toLowerCase()
  return clean.length >= 3 ? clean : title.trim().toLowerCase()
}

async function fetchRelatedTitlesForMovie(movie: Movie): Promise<Movie[]> {
  if (!movie) return []

  const isJav = Boolean(
    movie.isJav ||
      movie.id.startsWith('jav-') ||
      movie.label === 'JAV' ||
      movie.hentaiSlug?.startsWith('jav-'),
  )
  const isPhub3 = Boolean(
    movie.id.startsWith('phub3-') ||
      movie.label === 'PHub 3' ||
      movie.hentaiSlug?.startsWith('phub3-') ||
      movie.embedUrl?.includes('eporner.com'),
  )
  const isPhub2 = Boolean(
    !isPhub3 &&
      (movie.embedUrl?.includes('upload18.net') ||
        movie.embedUrl?.includes('xvidapi') ||
        movie.hentaiSlug?.includes('xvidapi') ||
        (movie.label === 'PHub' && /^\d+$/.test(movie.id.replace(/^phub-/, '')))),
  )
  const isPhub1 = Boolean(
    !isPhub3 &&
      !isPhub2 &&
      (movie.id.startsWith('phub-') ||
        movie.label === 'PHub' ||
        movie.hentaiSlug?.startsWith('phub-')),
  )

  // 1. PHub 3 (Eporner API)
  if (isPhub3) {
    try {
      const actor = movie.cast?.[0]?.trim()
      const genre = movie.genres?.[0]?.trim()
      const titleWords = (movie.title || '')
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !['the', 'and', 'with', 'from', 'for', 'hd', 'video'].includes(w.toLowerCase()))
        .slice(0, 2)
        .join(' ')
      const query = actor || (genre && genre !== 'PHub 3' && genre !== 'HD Video' ? genre : '') || titleWords || 'all'
      const data = await fetchEpornerApi({
        query,
        per_page: 12,
        order: 'most-popular',
        thumbsize: 'big',
      })
      if (data && Array.isArray(data.videos) && data.videos.length > 0) {
        return data.videos
          .map(epornerToMovieHelper)
          .filter((m: Movie) => m.id !== movie.id)
      }
    } catch {}
    const currentKeywords = (movie.genres || []).map((g) => g.toLowerCase())
    return EPORNER_INITIAL_VIDEOS.map(epornerToMovieHelper)
      .filter((m) => m.id !== movie.id)
      .sort((a, b) => {
        const aMatches = (a.genres || []).filter((g) => currentKeywords.includes(g.toLowerCase())).length
        const bMatches = (b.genres || []).filter((g) => currentKeywords.includes(g.toLowerCase())).length
        return bMatches - aMatches
      })
  }

  // 2. PHub 2 (XVidAPI / Upload18)
  if (isPhub2) {
    try {
      const actor = movie.cast?.[0]?.trim()
      const genre = movie.genres?.[0]?.trim()
      const titleWords = (movie.title || '')
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !['the', 'and', 'with', 'from', 'for', 'hd', 'video'].includes(w.toLowerCase()))
        .slice(0, 2)
        .join(' ')
      const query = actor || (genre && genre !== 'PHub' && genre !== 'PHub 2' && genre !== '4K' ? genre : '') || titleWords || 'teen'
      const res = await fetch(`https://xvidapi.com/api.php/provide/vod?ac=detail&at=json&wd=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.list) && data.list.length > 0) {
          return data.list
            .map((item: any, idx: number) => hanimeToMovieHelper(normalizeVideoItem(item, idx)))
            .filter((m: Movie) => m.id !== movie.id)
        }
      }
    } catch {}
    const currentGenres = (movie.genres || []).map((g) => g.toLowerCase())
    return INITIAL_HANIME_VIDEOS.map(hanimeToMovieHelper)
      .filter((m) => m.id !== movie.id)
      .sort((a, b) => {
        const aMatches = (a.genres || []).filter((g) => currentGenres.includes(g.toLowerCase())).length
        const bMatches = (b.genres || []).filter((g) => currentGenres.includes(g.toLowerCase())).length
        return bMatches - aMatches
      })
  }

  // 3. PHub 1 (Porn API 4K)
  if (isPhub1) {
    try {
      const actor = movie.cast?.[0]?.trim()
      const genre = movie.genres?.[0]?.trim()
      const catSlug = actor ? actor.toLowerCase().replace(/\s+/g, '-') : genre ? genre.toLowerCase().replace(/\s+/g, '-') : 'amateur'
      let json = await fetchPornApi(`/categories/${encodeURIComponent(catSlug)}/movies`, { page: 1, limit: 12 })
      if (!json?.data && !Array.isArray(json)) {
        json = await fetchPornApi('/movies/filter', { categories: catSlug, page: 1, limit: 12 })
      }
      const payload = json?.data || json
      const list: PornApiMovieItem[] = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
      if (list.length > 0) {
        return list
          .map((item) => pornApiToMovieHelper(item))
          .filter((m) => m.id !== movie.id)
      }
    } catch {}
  }

  // 4. JAV (apiJAV)
  if (isJav) {
    try {
      const cat = movie.genres?.[0]
      let url = 'https://server.apijav.com/wp-json/myvideo/v1/posts?per_page=12&orderby=views&order=DESC'
      if (cat && cat !== 'All' && cat !== 'JAV') {
        url += `&category=${encodeURIComponent(cat)}`
      }
      const res = await fetch(url)
      if (res.ok) {
        const data: JavPost[] = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          return data
            .map(javToMovieHelper)
            .filter((m) => m.id !== movie.id)
        }
      }
    } catch {}
  }

  // 5. Anime: fetch exact relations (Sequels, Prequels, Next Seasons, Side Stories) & Recommendations from AniList
  if (movie.isAnime || movie.anilistId || movie.id.startsWith('al-')) {
    const anilistId = movie.anilistId || (movie.id.startsWith('al-') ? Number(movie.id.replace('al-', '')) : undefined)
    if (anilistId) {
      try {
        const results = await fetchAnimeRelationsAndRecommendations(anilistId)
        if (results && results.length > 0) {
          return results
        }
      } catch (err) {
        console.error('fetchAnimeRelationsAndRecommendations error:', err)
      }
    }
  }

  // 6. Movie or TV Show: fetch TMDB collection parts, sequels, recommendations, and similar
  const tmdbId = movie.tmdbId
  const imdbId = movie.id.startsWith('tt') ? movie.id : undefined
  const isTv = movie.type === 'Series' || movie.tmdbType === 'tv' || isTvShow(movie)

  if (tmdbId || imdbId) {
    try {
      const params = new URLSearchParams({
        action: 'related',
        type: isTv ? 'tv' : 'movie',
      })
      if (tmdbId) params.set('tmdbId', String(tmdbId))
      if (imdbId) params.set('imdbId', imdbId)

      const res = await fetch(`/api/tmdb?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.results) && data.results.length > 0) {
          return data.results
        }
      }
    } catch (err) {
      console.error('fetchRelatedTitles TMDB error:', err)
    }
  }

  return []
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
function PullToRefresh({ containerRef, disabled = false }: { containerRef: RefObject<HTMLElement | null>; disabled?: boolean }) {
  const [distance, setDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const gesture = useRef({
    startY: null as number | null,
    dist: 0,
    active: false,
    scroller: null as HTMLElement | null,
  })

  useEffect(() => {
    if (disabled) {
      return
    }
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

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', finish, { passive: true })
    window.addEventListener('touchcancel', finish, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', finish)
      window.removeEventListener('touchcancel', finish)
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
  // Show Lumen logo animation splash on cold start when the app opens
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
    const restored = readActiveScreen()
    if (restored) {
      if (restored === 'detail' || restored === 'watch') {
        const movie = readSelectedMovie()
        if (movie) return restored
        return 'home'
      }
      return restored
    }
    return 'home'
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

  const finishSplash = useCallback(() => {
    try { window.sessionStorage.setItem('lumen.splash-done', '1') } catch { /* ignore */ }
    setShowSplash(false)
  }, [])

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

  const [starredServer, setStarredServer] = useState<string>(() =>
    readStarredServerFor(readCurrentUser()),
  )

  useEffect(() => {
    const star = readStarredServerFor(currentUser)
    if (star) {
      setStarredServer(star)
    }
  }, [currentUser])

  // Pull the admin account's profiles to ensure the global admin-starred server is synced across all devices and accounts
  useEffect(() => {
    let active = true
    void fetchRemoteProfiles(MAIN_ACCOUNT_EMAIL).then((adminProfiles) => {
      if (!active || !adminProfiles || !adminProfiles.length) return
      const adminProfile = adminProfiles.find((p) => p.starredServer) || adminProfiles[0]
      const adminStar = adminProfile?.starredServer || ''
      if (adminStar && isStreamProvider(adminStar)) {
        try {
          window.localStorage.setItem(adminStarredServerKey, adminStar)
        } catch {}
        setStarredServer(adminStar)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const handleToggleStarServer = useCallback((serverId: string) => {
    if (!isMainAccount(currentUser?.email)) {
      return
    }
    setStarredServer((prev) => {
      const next = prev === serverId ? '' : serverId
      saveStarredServerFor(currentUser, next)
      if (currentUser?.name) {
        setProfiles((currProfiles) => {
          const updated = currProfiles.map((p) => {
            if (p.name === currentUser.name) {
              return { ...p, starredServer: next || undefined }
            }
            return p
          })
          const account = currentUser ?? tempUser
          window.localStorage.setItem(profilesKeyFor(account), JSON.stringify(updated))
          if (account?.email) {
            void saveRemoteProfiles(account.email, updated)
          }
          return updated
        })
      }
      return next
    })
  }, [currentUser, tempUser])

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
            !isLordAdultMovie(entry.movie),
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
            isHentaiMovie(entry.movie),
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
  const continueWatchingPhub = useMemo(
    () =>
      Object.values(watchHistory)
        .filter(
          (entry) =>
            entry.progress < 100 &&
            isPhubMovie(entry.movie),
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
  const continueWatchingPhub1 = useMemo(
    () =>
      Object.values(watchHistory)
        .filter(
          (entry) =>
            entry.progress < 100 &&
            isPhub1Movie(entry.movie),
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
  const continueWatchingPhub2 = useMemo(
    () =>
      Object.values(watchHistory)
        .filter(
          (entry) =>
            entry.progress < 100 &&
            isPhub2Movie(entry.movie),
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
  const continueWatchingPhub3 = useMemo(
    () =>
      Object.values(watchHistory)
        .filter(
          (entry) =>
            entry.progress < 100 &&
            isPhub3Movie(entry.movie),
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
  const continueWatchingJav = useMemo(
    () =>
      Object.values(watchHistory)
        .filter(
          (entry) =>
            entry.progress < 100 &&
            isJavMovie(entry.movie),
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
  const savedLordList = useMemo(
    () =>
      Object.values(savedMovies).filter(
        (m) => isHentaiMovie(m),
      ),
    [savedMovies],
  )
  const savedPhubList = useMemo(
    () =>
      Object.values(savedMovies).filter(
        (m) => isPhubMovie(m),
      ),
    [savedMovies],
  )
  const savedPhub1List = useMemo(
    () =>
      Object.values(savedMovies).filter(
        (m) => isPhub1Movie(m),
      ),
    [savedMovies],
  )
  const savedPhub2List = useMemo(
    () =>
      Object.values(savedMovies).filter(
        (m) => isPhub2Movie(m),
      ),
    [savedMovies],
  )
  const savedPhub3List = useMemo(
    () =>
      Object.values(savedMovies).filter(
        (m) => isPhub3Movie(m),
      ),
    [savedMovies],
  )
  const savedJavList = useMemo(
    () =>
      Object.values(savedMovies).filter(
        (m) => isJavMovie(m),
      ),
    [savedMovies],
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
  const [activeLordTab, setActiveLordTab] = useState<LordTab>('collection')
  const [lordTabQueries, setLordTabQueries] = useState<Record<LordTab, string>>({
    collection: '',
    phub: '',
    phub2: '',
    phub3: '',
    jav: '',
  })

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
    try {
      if (nextScreen !== 'login' && nextScreen !== 'profiles') {
        window.sessionStorage.setItem(activeScreenKey, nextScreen)
      } else {
        window.sessionStorage.removeItem(activeScreenKey)
      }
    } catch {}
    window.history.replaceState(
      null,
      '',
      nextScreen === 'home' ? window.location.pathname : `#${nextScreen}`,
    )
    const resetScroll = () => {
      const shell = appShellRef.current
      if (shell) {
        shell.scrollTo({ top: 0, behavior: 'auto' })
        shell.scrollTop = 0
      }
      const root = document.getElementById('root')
      if (root) {
        root.scrollTo({ top: 0, behavior: 'auto' })
        root.scrollTop = 0
      }
      if (document.documentElement) {
        document.documentElement.scrollTo({ top: 0, behavior: 'auto' })
        document.documentElement.scrollTop = 0
      }
      if (document.body) {
        document.body.scrollTo({ top: 0, behavior: 'auto' })
        document.body.scrollTop = 0
      }
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
    resetScroll()
    window.requestAnimationFrame(resetScroll)
  }

  const openProfileOrLogin = () => {
    setLoginBackScreen(screen)
    setScreen('login')
  }

  const switchToProfile = (profileName: string) => {
    const list = Array.isArray(profiles) ? profiles : []
    const matchedProfile = list.find((p) => p && p.name && p.name.toLowerCase() === profileName.toLowerCase())
    const user: UserInfo = {
      name: profileName,
      email: currentUser?.email || 'guest@apple-tv.com',
      avatarColor: matchedProfile?.avatarColor || 'red',
    }
    setCurrentUser(user)
    try {
      window.localStorage.setItem(currentUserKey, JSON.stringify(user))
    } catch {}
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
    try {
      window.sessionStorage.removeItem(activeScreenKey)
      window.sessionStorage.removeItem(selectedMovieKey)
      window.localStorage.removeItem(currentUserKey)
    } catch { /* ignore */ }
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
      try {
        window.localStorage.setItem(currentUserKey, JSON.stringify(currentUser))
      } catch {
        // ignore
      }

      // Switch watch list and history for the active profile
      try {
        const savedStr = window.localStorage.getItem(`${savedMoviesKey}.${currentUser.name}`)
        setSavedMovies(savedStr ? JSON.parse(savedStr) : {})
      } catch {
        setSavedMovies({})
      }

      try {
        const likedStr = window.localStorage.getItem(`${likedMoviesKey}.${currentUser.name}`)
        setLikedMovies(likedStr ? JSON.parse(likedStr) : {})
      } catch {
        setLikedMovies({})
      }

      try {
        const historyStr = window.localStorage.getItem(`${watchHistoryKey}.${currentUser.name}`)
        setWatchHistory(historyStr ? JSON.parse(historyStr) : {})
      } catch {
        setWatchHistory({})
      }
    } else {
      try {
        window.localStorage.removeItem(currentUserKey)
      } catch {
        // ignore
      }
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

  // On initial mount / refresh: if opening directly into detail or watch screen, hydrate movie details and stream
  useEffect(() => {
    const movie = readSelectedMovie()
    if (movie) {
      if (screen === 'detail') {
        void hydrateMovie(movie)
      } else if (screen === 'watch') {
        void hydrateMovie(movie).then(markContinueWatching)
        void hydrateStreamingMovie(movie)
      }
    }
  }, [])

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
    const safeMovie = normalizeMovie(movie)
    if (screen !== 'detail' && screen !== 'watch') {
      setDetailBackScreen(screen)
    } else if (isLordAdultMovie(safeMovie) && detailBackScreen !== 'lord') {
      setDetailBackScreen('lord')
    }

    if (isJavMovie(safeMovie)) {
      setActiveLordTab('jav')
    } else if (isPhub3Movie(safeMovie)) {
      setActiveLordTab('phub3')
    } else if (isPhub2Movie(safeMovie)) {
      setActiveLordTab('phub2')
    } else if (isPhub1Movie(safeMovie)) {
      setActiveLordTab('phub')
    } else if (isHentaiMovie(safeMovie)) {
      setActiveLordTab('collection')
    }

    setSelectedMovie(safeMovie)
    setScreen('detail')
    void hydrateMovie(safeMovie)
  }

  const openWatch = (movie: Movie) => {
    const safeMovie = normalizeMovie(movie)
    if (screen !== 'detail' && screen !== 'watch') {
      setDetailBackScreen(screen)
    } else if (isLordAdultMovie(safeMovie) && detailBackScreen !== 'lord') {
      setDetailBackScreen('lord')
    }

    if (isJavMovie(safeMovie)) {
      setActiveLordTab('jav')
    } else if (isPhub3Movie(safeMovie)) {
      setActiveLordTab('phub3')
    } else if (isPhub2Movie(safeMovie)) {
      setActiveLordTab('phub2')
    } else if (isPhub1Movie(safeMovie)) {
      setActiveLordTab('phub')
    } else if (isHentaiMovie(safeMovie)) {
      setActiveLordTab('collection')
    }

    setSelectedMovie(safeMovie)
    markContinueWatching(safeMovie)
    setScreen('watch')
    setStreamError('')
    void hydrateMovie(safeMovie).then(markContinueWatching)
    void hydrateStreamingMovie(safeMovie)
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

  const clearLordContinueWatching = useCallback((tab?: LordTab) => {
    setWatchHistory((current) => {
      const next = { ...current }
      let changed = false
      Object.entries(current).forEach(([key, entry]) => {
        const matchesTab = !tab
          ? isLordAdultMovie(entry.movie)
          : tab === 'jav'
            ? isJavMovie(entry.movie)
            : tab === 'phub'
              ? isPhub1Movie(entry.movie)
              : tab === 'phub2'
                ? isPhub2Movie(entry.movie)
                : tab === 'phub3'
                  ? isPhub3Movie(entry.movie)
                  : tab === 'collection'
                    ? isHentaiMovie(entry.movie)
                    : isLordAdultMovie(entry.movie)

        if (matchesTab) {
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
        <SplashScreen onFinish={finishSplash} />
      )}
      <PullToRefresh containerRef={appShellRef} disabled={screen === 'lord' || screen === 'watch' || screen === 'login' || screen === 'profiles'} />
      {screen === 'home' && (
        <ErrorBoundary onReset={() => setScreen('home')}>
          {featuredMovie ? (
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
          ) : (
            <LoadingScreen />
          )}
        </ErrorBoundary>
      )}

      {screen === 'drama' && (featuredDramaMovie ?? dramaList[0] ?? movies.find((m) => !m.isAnime)) && (
        <ErrorBoundary onReset={() => setScreen('home')}>
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
        </ErrorBoundary>
      )}

      {screen === 'livetv' && (
        <ErrorBoundary onReset={() => setScreen('home')}>
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
        </ErrorBoundary>
      )}

      {screen === 'manga' && (
        <ErrorBoundary onReset={() => setScreen('home')}>
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
        </ErrorBoundary>
      )}

      {(screen === 'movies' || screen === 'tv' || screen === 'anime') && (
        <ErrorBoundary onReset={() => setScreen('home')}>
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
        </ErrorBoundary>
      )}

      {screen === 'detail' && selectedMovie && (
        <ErrorBoundary onReset={() => setScreen('home')}>
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
            onBack={() => {
              if (detailBackScreen === 'lord' || isLordAdultMovie(selectedMovie)) {
                setScreen('lord')
              } else if (detailBackScreen) {
                setScreen(detailBackScreen)
              } else {
                setScreen('home')
              }
            }}
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
        </ErrorBoundary>
      )}

      {screen === 'watch' && selectedMovie && (
        <ErrorBoundary onReset={() => setScreen('home')}>
          <WatchScreen
            movie={selectedMovie}
            relatedMovies={relatedMedia}
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
              if (detailBackScreen === 'lord' || isLordAdultMovie(selectedMovie)) {
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
            currentUser={currentUser}
            starredServer={starredServer}
            onToggleStarServer={handleToggleStarServer}
          />
        </ErrorBoundary>
      )}

      {screen === 'search' && (
        <ErrorBoundary onReset={() => setScreen('home')}>
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
        </ErrorBoundary>
      )}

      {screen === 'library' && (
        <ErrorBoundary onReset={() => setScreen('home')}>
          <LibraryScreen
            savedMovies={savedList.filter((m) => !isLordAdultMovie(m))}
            likedMovies={likedList.filter((m) => !isLordAdultMovie(m))}
            invites={incomingInvites}
            onAcceptInvite={(invite) => void acceptInviteAndWatch(invite)}
            onDismissInvite={dismissInvite}
            onOpenDetail={openDetail}
            onPlayMovie={openWatch}
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
        </ErrorBoundary>
      )}

      {screen === 'downloads' && (
        <ErrorBoundary onReset={() => setScreen('home')}>
          <DownloadsScreen
            onBack={() => setScreen('library')}
            onExplore={() => setScreen('home')}
            designMode={designMode}
            onPlayMovie={(item) => {
              const movieObj = normalizeMovie({
                id: item.movieId,
                title: item.title,
                year: item.year || '',
                poster: item.poster || '',
                still: item.still || '',
                hero: item.still || item.poster || '',
                runtime: item.runtime || '',
                type: item.mediaType === 'tv' ? 'series' : (item.mediaType === 'anime' ? 'anime' : 'movie'),
                isAnime: item.mediaType === 'anime',
                genres: item.mediaType === 'anime' ? ['Anime'] : [],
                streamSeason: item.season,
                streamEpisode: item.episode,
              })
              openWatch(movieObj)
            }}
            onOpenDetail={(item) => {
              const movieObj = normalizeMovie({
                id: item.movieId,
                title: item.title,
                year: item.year || '',
                poster: item.poster || '',
                still: item.still || '',
                hero: item.still || item.poster || '',
                runtime: item.runtime || '',
                type: item.mediaType === 'tv' ? 'series' : (item.mediaType === 'anime' ? 'anime' : 'movie'),
                isAnime: item.mediaType === 'anime',
                genres: item.mediaType === 'anime' ? ['Anime'] : [],
                streamSeason: item.season,
                streamEpisode: item.episode,
              })
              openDetail(movieObj)
            }}
          />
        </ErrorBoundary>
      )}

      {screen === 'login' && (
        <ErrorBoundary onReset={() => setScreen(loginBackScreen || 'home')}>
          <LoginScreen
            currentUser={currentUser}
            onLogin={(user) => {
              const sanitizedUser: UserInfo = {
                name: user?.name?.trim() || (user?.email ? user.email.split('@')[0] : 'User'),
                email: user?.email?.trim().toLowerCase() || '',
                avatarColor: user?.avatarColor || 'red',
              }
              setTempUser(sanitizedUser)
              const initialProfiles = readProfilesFor(sanitizedUser)
              setProfiles(initialProfiles)
              try {
                window.localStorage.setItem(profilesKeyFor(sanitizedUser), JSON.stringify(initialProfiles))
              } catch {
                // ignore
              }
              try { window.sessionStorage.setItem('lumen.splash-done', '1') } catch { /* ignore */ }
              setShowSplash(false)
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
        </ErrorBoundary>
      )}

      {screen === 'profiles' && (
        <ErrorBoundary onReset={() => setScreen('home')}>
          <ProfilesScreen
            profiles={profiles}
            onSelectProfile={(profileName) => {
              const list = Array.isArray(profiles) ? profiles : []
              const matchedProfile = list.find((p) => p && p.name && p.name.toLowerCase() === profileName.toLowerCase())
              const finalUser: UserInfo = {
                name: profileName,
                email: tempUser?.email || currentUser?.email || 'guest@apple-tv.com',
                avatarColor: matchedProfile?.avatarColor || 'red',
              }
              setCurrentUser(finalUser)
              try {
                window.localStorage.setItem(currentUserKey, JSON.stringify(finalUser))
              } catch {}
              const targetScreen =
                loginBackScreen && loginBackScreen !== 'profiles' && loginBackScreen !== 'login'
                  ? loginBackScreen
                  : 'home'
              setScreen(targetScreen)
              setTempUser(null)
            }}
            onAddProfile={handleAddProfile}
            onEditProfile={handleEditProfile}
            onDeleteProfile={handleDeleteProfile}
            backdrops={[...tvShows, ...movies, ...anime]
              .map((m) => m.hero || m.still || m.poster)
              .filter((src): src is string => Boolean(src && src.startsWith('http')))
              .slice(0, 12)}
            onBack={() => {
              setScreen('login')
              setTempUser(null)
            }}
          />
        </ErrorBoundary>
      )}

      {screen === 'lord' && (
        <ErrorBoundary onReset={() => setScreen('home')}>
          <LordScreen
            movies={lordMovies}
            rails={lordRails}
            loading={lordLoading}
            continueMovies={continueWatchingLord}
            continuePhubMovies={continueWatchingPhub}
            continuePhub1Movies={continueWatchingPhub1}
            continuePhub2Movies={continueWatchingPhub2}
            continuePhub3Movies={continueWatchingPhub3}
            continueJavMovies={continueWatchingJav}
            savedMovies={savedLordList}
            savedPhubMovies={savedPhubList}
            savedPhub1Movies={savedPhub1List}
            savedPhub2Movies={savedPhub2List}
            savedPhub3Movies={savedPhub3List}
            savedJavMovies={savedJavList}
            currentUser={currentUser}
            activeTab={activeLordTab}
            onTabChange={setActiveLordTab}
            tabQueries={lordTabQueries}
            onTabQueriesChange={setLordTabQueries}
            onOpenDetail={openDetail}
            onPlay={openWatch}
            onSelectProfile={switchToProfile}
            onBack={() => setScreen(lordBackScreen)}
            onClearContinueWatching={clearLordContinueWatching}
            onMarkWatched={markWatchedMovie}
            onRemoveContinue={removeContinueMovie}
            onRemoveWatchlist={removeWatchlistMovie}
          />
        </ErrorBoundary>
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
  onOpenPoster: _onOpenPoster,
  designMode,
}: DetailScreenProps) {
  const isNetflix = designMode === 'netflix'
  const similarsRef = useRef<HTMLDivElement | null>(null)
  const [isDownloaded, setIsDownloaded] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const isHentaiMovie = Boolean(
    movie.isHentaiOcean ||
      movie.hentaiSlug ||
      movie.id.startsWith('hentaiocean-') ||
      movie.id.startsWith('phub-') ||
      movie.id.startsWith('jav-') ||
      movie.label === 'JAV' ||
      movie.label === 'PHub' ||
      movie.isJav ||
      (movie.genres || []).some((g) => g.toLowerCase() === 'hentai'),
  )

  useEffect(() => {
    if (isHentaiMovie) return
    let active = true
    void getAllDownloads().then((items) => {
      if (active) {
        setIsDownloaded(items.some((i) => i.movieId === movie.id && i.status === 'completed'))
      }
    })
    const unsub = subscribeDownloads((items) => {
      if (active) {
        setIsDownloaded(items.some((i) => i.movieId === movie.id && i.status === 'completed'))
      }
    })
    return () => {
      active = false
      unsub()
    }
  }, [movie.id, isHentaiMovie])

  const handleDownloadClick = async () => {
    setIsDownloading(true)
    try {
      const streamUrl = buildStreamUrl(movie, 'rivestream')
      await startDownload(
        {
          id: movie.id,
          movieId: movie.id,
          title: movie.title,
          year: movie.year,
          poster: movie.poster,
          still: movie.still,
          runtime: movie.runtime,
          mediaType: movie.isAnime ? 'anime' : (movie.type === 'series' ? 'tv' : 'movie'),
        },
        streamUrl,
      )
      setIsDownloaded(true)
    } finally {
      setTimeout(() => setIsDownloading(false), 800)
    }
  }

  const [detailTab, setDetailTab] = useState<'episodes' | 'collection' | 'more'>(
    'episodes',
  )
  // On desktop the anime detail shows every section stacked (no tabs / no
  // secondary icon row); the tab UI + icon row are a mobile-only treatment.
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(min-width: 900px)').matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(min-width: 900px)')
    const handler = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  const [liveRelated, setLiveRelated] = useState<Movie[]>([])

  useEffect(() => {
    let active = true
    void fetchRelatedTitlesForMovie(movie).then((items) => {
      if (active && items.length > 0) {
        setLiveRelated(items)
      }
    })
    return () => {
      active = false
    }
  }, [movie.id, movie.title, movie.genres, movie.cast, movie.anilistId, movie.tmdbId])

  const relatedItems = useMemo(() => {
    const isAdultMovie = (m: Movie) =>
      Boolean(
        m.isJav ||
          m.isHentaiOcean ||
          m.id.startsWith('jav-') ||
          m.id.startsWith('phub-') ||
          m.id.startsWith('phub3-') ||
          m.label === 'JAV' ||
          m.label === 'PHub' ||
          m.label === 'PHub 3' ||
          m.genres.some((g) => g.toLowerCase() === 'hentai'),
      )

    const isTargetAdult = isAdultMovie(movie)

    const cleanRelated = (relatedMovies || []).filter(
      (m) => m.id !== movie.id && (isTargetAdult ? isAdultMovie(m) : !isAdultMovie(m)),
    )

    const franchiseKey = extractFranchisePrefix(movie.title)
    const seenIds = new Set<string>([String(movie.id)])
    const combined: Movie[] = []

    // 1. Live relations from AniList / TMDB / PHub 1 / PHub 2 / PHub 3 / JAV
    for (const item of liveRelated) {
      const idKey = String(item.id)
      if (!seenIds.has(idKey) && (isTargetAdult ? isAdultMovie(item) : !isAdultMovie(item))) {
        seenIds.add(idKey)
        combined.push(item)
      }
    }

    // 2. Franchise titles from local pool that share the same franchise base name
    if (franchiseKey && franchiseKey.length >= 3) {
      for (const item of cleanRelated) {
        const otherKey = extractFranchisePrefix(item.title)
        const idKey = String(item.id)
        if (
          !seenIds.has(idKey) &&
          (otherKey === franchiseKey ||
            item.title.toLowerCase().includes(franchiseKey) ||
            movie.title.toLowerCase().includes(otherKey))
        ) {
          seenIds.add(idKey)
          combined.push({
            ...item,
            label: item.label || 'Franchise / Sequel',
          })
        }
      }
    }

    // 3. Fallback recommendations sorted by genre similarity
    const currentGenres = (movie.genres || []).map((g) => g.toLowerCase())
    const sortedFallback = [...cleanRelated]
      .filter((m) => !seenIds.has(String(m.id)))
      .sort((a, b) => {
        const aMatches = (a.genres || []).filter((g) => currentGenres.includes(g.toLowerCase())).length
        const bMatches = (b.genres || []).filter((g) => currentGenres.includes(g.toLowerCase())).length
        return bMatches - aMatches
      })

    for (const item of sortedFallback) {
      const idKey = String(item.id)
      if (!seenIds.has(idKey)) {
        seenIds.add(idKey)
        combined.push(item)
      }
    }

    return combined.slice(0, 16)
  }, [movie.id, movie.title, movie.genres, liveRelated, relatedMovies])

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
              {(movie.genres || []).slice(0, 3).map((genre) => (
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
                {!isHentaiMovie && (
                  <button
                    className="detail-pill-button netflix-download-btn"
                    type="button"
                    onClick={handleDownloadClick}
                    title={isDownloaded ? 'Downloaded to Lumen' : 'Download for offline watching'}
                  >
                    {isDownloading ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : isDownloaded ? (
                      <Check size={16} />
                    ) : (
                      <Download size={16} />
                    )}
                    <span>{isDownloading ? 'Downloading...' : isDownloaded ? 'Downloaded' : 'Download'}</span>
                  </button>
                )}
                {isDesktop && (
                  <button
                    className="circle-action"
                    type="button"
                    onClick={onSave}
                    title={isSaved ? 'Saved to My List' : 'Add to My List'}
                    aria-label={isSaved ? 'Saved to My List' : 'Add to My List'}
                  >
                    {isSaved ? <Check /> : <Plus />}
                  </button>
                )}
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
                {!isHentaiMovie && (
                  <button
                    className="detail-download-button"
                    type="button"
                    onClick={handleDownloadClick}
                    title={isDownloaded ? 'Downloaded to Lumen' : 'Download for offline watching'}
                  >
                    {isDownloading ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : isDownloaded ? (
                      <Check size={16} />
                    ) : (
                      <Download size={16} />
                    )}
                    <span>{isDownloading ? 'Downloading...' : isDownloaded ? 'Downloaded' : 'Download'}</span>
                  </button>
                )}
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

        {!isNetflix && (movie.cast || []).length > 0 && (
          <p className="detail-starring">
            Starring {(movie.cast || []).slice(0, 3).join(', ')}
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

  const [resolvedTmdbId, setResolvedTmdbId] = useState<number | undefined>(movie.tmdbId)

  useEffect(() => {
    if (movie.tmdbId) {
      setResolvedTmdbId(movie.tmdbId)
      return
    }
    if (!movie.isAnime && movie.id && (movie.id.startsWith('tt') || !isNaN(Number(movie.id)))) {
      let active = true
      void fetchTmdbMatch(movie.id, false, 'tv').then((match) => {
        if (active && match?.tmdbId) {
          setResolvedTmdbId(match.tmdbId)
        }
      }).catch(() => {})
      return () => {
        active = false
      }
    }
  }, [movie.tmdbId, movie.id, movie.isAnime])

  const targetTmdbId = resolvedTmdbId || movie.tmdbId
  const isTvId =
    !movie.isAnime && Boolean(targetTmdbId) && (movie.tmdbType === 'tv' || isTvShow(movie))

  // Load the accurate season list from TMDB so the dropdown/counts are correct.
  useEffect(() => {
    let active = true
    setTmdbSeasons([])

    if (isTvId && targetTmdbId) {
      void fetchTvSeasons(targetTmdbId).then((list) => {
        if (active) {
          setTmdbSeasons(list)
        }
      })
    }

    return () => {
      active = false
    }
  }, [targetTmdbId, isTvId])

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

    if (isTvId && targetTmdbId) {
      void fetchSeasonEpisodes(targetTmdbId, selectedSeason).then((episodes) => {
        if (active) {
          setTmdbEpisodes(episodes)
        }
      })
    }

    return () => {
      active = false
    }
  }, [targetTmdbId, isTvId, selectedSeason])

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
              ? getEpisodeDuration(movie, episode, (animeEp as any)?.duration)
              : getEpisodeDuration(movie, episode, data?.runtime, episodeRuntime(movie, selectedSeason, episode))

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

  const scrollRow = (direction: 1 | -1 = 1) => {
    rowRef.current?.scrollBy({
      left: direction * (rowRef.current.clientWidth * 0.82),
      behavior: 'smooth',
    })
  }

  return (
    <section className="detail-section detail-related-section">
      <DetailSectionHeading title={title} onClick={() => scrollRow(1)} />
      <div className="detail-poster-viewport rail-viewport">
        <button
          className="rail-arrow rail-arrow-prev detail-poster-arrow"
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollRow(-1)}
        >
          <ChevronLeft />
        </button>

        <div ref={rowRef} className="detail-poster-row">
          {movies.map((item) => (
            <button
              key={item.id}
              className="detail-related-card"
              type="button"
              aria-label={`Open ${item.title}`}
              onClick={() => onOpenDetail(item)}
            >
              <div className="detail-related-poster-wrap">
                <PosterImage movie={item} fallback={posterImageFor(item)} />
              </div>
              <span className="detail-related-title" title={item.title}>
                {item.title}
              </span>
            </button>
          ))}
        </div>

        <button
          className="rail-arrow rail-arrow-next detail-poster-arrow"
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollRow(1)}
        >
          <ChevronRight />
        </button>
      </div>
    </section>
  )
}

function watchProviderTypeLabel(type?: TmdbWatchProvider['type']) {
  if (!type) {
    return 'Stream'
  }

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

function initialsFor(name?: string) {
  return (name || '')
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
  const fallbackMembers = (movie.cast || []).slice(0, 9).map((name, index) => ({
    id: `fallback-${name}-${index}`,
    imageUrl: '',
    name,
    role:
      index === 0 && movie.director && movie.director !== 'Director unavailable'
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
  relatedMovies?: Movie[]
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
  designMode?: 'apple' | 'netflix'
  onSelectMovie?: (movie: Movie) => void
  activeParty?: WatchParty | null
  isScreenSharing?: boolean
  remoteStream?: MediaStream | null
  latestFrameUrl?: string | null
  onStartScreenShare?: () => void
  onStopScreenShare?: () => void
  screenShareError?: string
  currentUserEmail?: string
  currentUser?: UserInfo | null
  starredServer?: string
  onToggleStarServer?: (serverId: string) => void
}

function WatchScreen({
  movie,
  relatedMovies,
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
  onSelectMovie,
  activeParty,
  isScreenSharing,
  remoteStream,
  latestFrameUrl,
  onStartScreenShare,
  onStopScreenShare,
  screenShareError,
  currentUserEmail,
  currentUser,
  starredServer,
  onToggleStarServer,
}: WatchScreenProps) {
  const isPartyHost = activeParty ? currentUserEmail === activeParty.host_email : false
  const isPartyGuest = activeParty ? currentUserEmail !== activeParty.host_email : false
  const [isBigScreen, setIsBigScreen] = useState(false)
  const [isTitleExpanded, setIsTitleExpanded] = useState(false)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 900,
  )
  const remoteViewportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isJavVideo = Boolean(
    movie.id.startsWith('jav-') ||
      movie.label === 'JAV' ||
      movie.isJav ||
      movie.hentaiSlug?.startsWith('jav-'),
  )
  const isPhub3Video = Boolean(
    movie.id.startsWith('phub3-') ||
      movie.label === 'PHub 3' ||
      movie.hentaiSlug?.startsWith('phub3-') ||
      movie.embedUrl?.includes('eporner.com'),
  )
  const isPhubVideo = Boolean(
    isPhub3Video ||
      movie.id.startsWith('phub-') ||
      movie.label === 'PHub' ||
      movie.hentaiSlug?.startsWith('phub-'),
  )
  const isPhub2Video = Boolean(
    !isPhub3Video &&
      isPhubVideo && (
        movie.embedUrl?.includes('upload18.net') ||
        movie.embedUrl?.includes('xvidapi') ||
        movie.hentaiSlug?.includes('xvidapi') ||
        /^\d+$/.test(movie.id.replace(/^phub-/, ''))
      ),
  )
  const isPhub1Video = isPhubVideo && !isPhub2Video && !isPhub3Video
  const isHentai = Boolean(
    !isJavVideo &&
      !isPhubVideo &&
      (movie.isHentaiOcean ||
        movie.genres.some((g) => g.toLowerCase() === 'hentai')),
  )
  const isTmdbTitle = !isHentai && !isJavVideo && !isPhubVideo && !movie.isAnime && !movie.anilistId && !!movie.tmdbId
  const isAnimeMovie =
    !isTmdbTitle &&
    !isHentai &&
    !isJavVideo &&
    !isPhubVideo &&
    Boolean(
      movie.isAnime ||
        movie.type === 'Anime' ||
        movie.anilistId ||
        movie.genres.includes('Anime') ||
        (movie.genres.includes('Animation') && !movie.tmdbId),
    )

  const [activeProviderOverride, setActiveProviderOverride] = useState<StreamProvider | null>(null)

  const isAdmin = isMainAccount(currentUser?.email || currentUserEmail)
  const animeProviderIds: StreamProvider[] = ['filmu', 'nhdapi', 'yenime', 'clickhost', 'megaplay', 'megabuzz', 'megavid']

  const starProvider = (starredServer && isStreamProvider(starredServer)) ? (starredServer as StreamProvider) : null
  const chosenProvider: StreamProvider = activeProviderOverride ?? (starProvider ?? (isStreamProvider(streamProvider) ? streamProvider : defaultStreamProvider))

  const activeProviderId: StreamProvider = isJavVideo
    ? 'apijav'
    : isPhub3Video
      ? 'eporner'
      : isPhub1Video
        ? 'phubplay'
        : isPhub2Video
          ? 'upload18'
          : isHentai
            ? 'oceanplay'
        : isAnimeMovie
          ? movie.tmdbId
            ? chosenProvider
            : animeProviderIds.includes(chosenProvider)
              ? chosenProvider
              : (starProvider && animeProviderIds.includes(starProvider))
                ? starProvider
                : 'filmu'
          : (!animeProviderIds.includes(chosenProvider) || chosenProvider === 'vidrift' || chosenProvider === 'filmu' || chosenProvider === 'nhdapi' || chosenProvider === 'rivestream' || chosenProvider === 'cinesrc' || chosenProvider === 'embedapi' || chosenProvider === 'vidphantom' || chosenProvider === 'mgeb')
            ? chosenProvider
            : (starProvider && !animeProviderIds.includes(starProvider))
              ? starProvider
              : 'rivestream'

  const isSeries = isAnimeMovie || isTvShow(movie) || movie.tmdbType === 'tv'
  const hasEpisodes = Boolean(
    isSeries ||
      (movie.hentaiEpisodes && movie.hentaiEpisodes.length > 0) ||
      ((movie as any).episodes && (movie as any).episodes.length > 0) ||
      isTvShow(movie),
  )

  const [isWatchDownloaded, setIsWatchDownloaded] = useState(false)
  const [isWatchDownloading, setIsWatchDownloading] = useState(false)

  const currentDownloadKey = movie.streamSeason && movie.streamEpisode
    ? `${movie.id}-s${movie.streamSeason}e${movie.streamEpisode}`
    : movie.id

  useEffect(() => {
    let active = true
    void getAllDownloads().then((items) => {
      if (active) {
        setIsWatchDownloaded(items.some((i) => i.id === currentDownloadKey && i.status === 'completed'))
      }
    })
    const unsub = subscribeDownloads((items) => {
      if (active) {
        setIsWatchDownloaded(items.some((i) => i.id === currentDownloadKey && i.status === 'completed'))
      }
    })
    return () => {
      active = false
      unsub()
    }
  }, [currentDownloadKey])

  const handleWatchDownload = async () => {
    setIsWatchDownloading(true)
    try {
      const activeStreamUrl = buildStreamUrl(movie, activeProviderId)
      await startDownload(
        {
          id: currentDownloadKey,
          movieId: movie.id,
          title: movie.title,
          year: movie.year,
          season: movie.streamSeason,
          episode: movie.streamEpisode,
          episodeTitle: movie.streamSeason && movie.streamEpisode ? `Season ${movie.streamSeason} Episode ${movie.streamEpisode}` : undefined,
          poster: movie.poster,
          still: movie.still,
          runtime: movie.runtime,
          mediaType: movie.isAnime ? 'anime' : (movie.type === 'series' ? 'tv' : 'movie'),
        },
        activeStreamUrl,
      )
      setIsWatchDownloaded(true)
    } finally {
      setTimeout(() => setIsWatchDownloading(false), 800)
    }
  }

  const [javRelated, setJavRelated] = useState<Movie[]>([])

  useEffect(() => {
    if (!isJavVideo) return
    let active = true
    async function loadJavRelated() {
      try {
        const cat = movie.genres[0]
        let url = 'https://server.apijav.com/wp-json/myvideo/v1/posts?per_page=12&orderby=views&order=DESC'
        if (cat && cat !== 'All' && cat !== 'JAV') {
          url += `&category=${encodeURIComponent(cat)}`
        }
        const res = await fetch(url)
        if (res.ok) {
          const data: JavPost[] = await res.json()
          if (active && Array.isArray(data)) {
            setJavRelated(data.map(javToMovieHelper).filter((m) => m.id !== movie.id))
          }
        }
      } catch {}
    }
    void loadJavRelated()
    return () => {
      active = false
    }
  }, [isJavVideo, movie.id, movie.genres])

  const [phubRelated, setPhubRelated] = useState<Movie[]>([])
  const [resolvedPhubEmbed, setResolvedPhubEmbed] = useState<string | undefined>(movie.embedUrl)

  useEffect(() => {
    if (movie.embedUrl) {
      setResolvedPhubEmbed(movie.embedUrl)
      return
    }
    if (!isPhubVideo) return
    let active = true
    const slug = movie.hentaiSlug?.replace(/^phub-/, '') || movie.id.replace(/^phub-/, '')
    if (isPhub2Video) {
      setResolvedPhubEmbed(`https://upload18.net/play/index/xvidapi-${slug}`)
      return
    }
    void fetchPornApiMovieDetail(slug).then((detail) => {
      if (active && detail) {
        const url = detail.episodes?.[0]?.sources?.[0]?.embed_url || detail.episodes?.[0]?.sources?.[0]?.m3u8_url
        if (url) setResolvedPhubEmbed(url)
      }
    })
    return () => {
      active = false
    }
  }, [isPhubVideo, isPhub2Video, movie.id, movie.embedUrl, movie.hentaiSlug])

  useEffect(() => {
    if (!isPhubVideo) return
    let active = true
    async function loadPhubRelated() {
      try {
        const cat = movie.genres?.[0]
        const catSlug = cat ? cat.toLowerCase().replace(/\s+/g, '-') : 'amateur'
        const json = await fetchPornApi(`/categories/${encodeURIComponent(catSlug)}/movies`, { page: 1, limit: 12 })
        if (json) {
          const payload = json?.data || json
          const list: PornApiMovieItem[] = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
          if (active && list.length > 0) {
            setPhubRelated(list.map((item) => pornApiToMovieHelper(item)).filter((m) => m.id !== movie.id))
          }
        }
      } catch {}
    }
    void loadPhubRelated()
    return () => {
      active = false
    }
  }, [isPhubVideo, movie.id, movie.genres])

  const [liveRelated, setLiveRelated] = useState<Movie[]>([])

  useEffect(() => {
    let active = true
    void fetchRelatedTitlesForMovie(movie).then((items) => {
      if (active && items.length > 0) {
        setLiveRelated(items)
      }
    })

    return () => {
      active = false
    }
  }, [movie.id, movie.title, movie.genres, movie.cast, movie.anilistId, movie.tmdbId, isJavVideo, isPhubVideo, isPhub2Video, isPhub3Video])

  const relatedList = useMemo(() => {
    const isAdultMovie = (m: Movie) =>
      Boolean(
        m.isJav ||
          m.isHentaiOcean ||
          m.id.startsWith('jav-') ||
          m.id.startsWith('phub-') ||
          m.id.startsWith('phub3-') ||
          m.label === 'JAV' ||
          m.label === 'PHub' ||
          m.label === 'PHub 3' ||
          m.genres.some((g) => g.toLowerCase() === 'hentai'),
      )

    // 1. Live related videos from provider / AniList / TMDB
    if (liveRelated.length > 0) {
      return liveRelated.slice(0, 8)
    }

    // 2. Provider-specific fallbacks matching current video's category/genre
    if (isPhub3Video) {
      const currentKeywords = (movie.genres || []).map((g) => g.toLowerCase())
      return EPORNER_INITIAL_VIDEOS.map(epornerToMovieHelper)
        .filter((m) => m.id !== movie.id)
        .sort((a, b) => {
          const aMatches = (a.genres || []).filter((g) => currentKeywords.includes(g.toLowerCase())).length
          const bMatches = (b.genres || []).filter((g) => currentKeywords.includes(g.toLowerCase())).length
          return bMatches - aMatches
        })
        .slice(0, 8)
    }

    if (isPhub2Video) {
      const currentGenres = (movie.genres || []).map((g) => g.toLowerCase())
      return INITIAL_HANIME_VIDEOS.map(hanimeToMovieHelper)
        .filter((m) => m.id !== movie.id)
        .sort((a, b) => {
          const aMatches = (a.genres || []).filter((g) => currentGenres.includes(g.toLowerCase())).length
          const bMatches = (b.genres || []).filter((g) => currentGenres.includes(g.toLowerCase())).length
          return bMatches - aMatches
        })
        .slice(0, 8)
    }

    if (isPhub1Video) {
      if (phubRelated.length > 0) {
        return phubRelated.slice(0, 8)
      }
    }

    if (isJavVideo && javRelated.length > 0) {
      return javRelated.slice(0, 8)
    }

    const cleanRelated = (relatedMovies || []).filter(
      (m) => m.id !== movie.id && !isAdultMovie(m),
    )

    const franchiseKey = extractFranchisePrefix(movie.title)
    const seenIds = new Set<string>([String(movie.id)])
    const combined: Movie[] = []

    // 3. Franchise titles from local pool that share the same franchise base name
    if (franchiseKey && franchiseKey.length >= 3) {
      for (const item of cleanRelated) {
        const otherKey = extractFranchisePrefix(item.title)
        const idKey = String(item.id)
        if (
          !seenIds.has(idKey) &&
          (otherKey === franchiseKey ||
            item.title.toLowerCase().includes(franchiseKey) ||
            movie.title.toLowerCase().includes(otherKey))
        ) {
          seenIds.add(idKey)
          combined.push({
            ...item,
            label: item.label || 'Franchise / Sequel',
          })
        }
      }
    }

    // 4. Fallback recommendations sorted by genre similarity
    const currentGenres = (movie.genres || []).map((g) => g.toLowerCase())
    const sortedFallback = [...cleanRelated]
      .filter((m) => !seenIds.has(String(m.id)))
      .sort((a, b) => {
        const aMatches = (a.genres || []).filter((g) => currentGenres.includes(g.toLowerCase())).length
        const bMatches = (b.genres || []).filter((g) => currentGenres.includes(g.toLowerCase())).length
        return bMatches - aMatches
      })

    for (const item of sortedFallback) {
      const idKey = String(item.id)
      if (!seenIds.has(idKey)) {
        seenIds.add(idKey)
        combined.push(item)
      }
    }

    return combined.slice(0, 8)
  }, [liveRelated, isPhub3Video, isPhub2Video, isPhub1Video, phubRelated, isJavVideo, javRelated, movie.id, movie.title, movie.genres, relatedMovies])

  const renderYouTubeRelatedSidebar = () => {
    if (relatedList.length === 0) return null

    return (
      <div className="youtube-related-sidebar">
        <div className="youtube-related-header">
          <h3 className="youtube-related-header-title">Related & Next Parts</h3>
        </div>
        <div className="youtube-related-list">
          {relatedList.map((item) => (
            <button
              key={item.id}
              type="button"
              className="youtube-related-card"
              onClick={() => onSelectMovie?.(item)}
            >
              <div className="youtube-related-thumb">
                <img src={item.still || item.hero || item.poster} alt="" loading="lazy" />
                {item.label &&
                  item.label !== 'Anime' &&
                  item.label !== 'Movie' &&
                  item.label !== 'Series' &&
                  item.label !== 'Video' && (
                    <span className="youtube-badge relation-badge">{item.label}</span>
                  )}
                {item.runtime && item.runtime !== '00:00:00' && (
                  <span className="youtube-badge duration">{item.runtime}</span>
                )}
              </div>
              <div className="youtube-related-info">
                <h4 className="youtube-related-title" title={item.title}>
                  {item.title}
                </h4>
                {item.director && (
                  <p className="youtube-channel">
                    <span>{item.director}</span>
                    <span className="youtube-verified">✓</span>
                  </p>
                )}
                <p className="youtube-related-meta">
                  <span className="youtube-genre">{item.label || item.genres[0] || 'Related'}</span>
                  {item.year && <span className="youtube-dot">• {item.year}</span>}
                  {item.rating && item.rating !== 'N/A' && (
                    <span className="youtube-rating">{item.rating}</span>
                  )}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const [episode, setEpisode] = useState(movie.streamEpisode ?? 1)
  const [season, setSeason] = useState(movie.streamSeason ?? 1)
  const [language, setLanguage] = useState<'sub' | 'dub'>(movie.streamLanguage ?? 'sub')
  const [epSearchQuery, setEpSearchQuery] = useState('')
  const streamIframeRef = useRef<HTMLIFrameElement | null>(null)

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

  const streamMovie: Movie = useMemo(
    () => ({
      ...movie,
      anilistId: activeWatchAnimeSeason?.anilistId ?? movie.anilistId,
      streamEpisode: episode,
      streamSeason: season,
      streamLanguage: language,
      embedUrl: resolvedPhubEmbed || movie.embedUrl,
    }),
    [movie, activeWatchAnimeSeason?.anilistId, episode, season, language, resolvedPhubEmbed],
  )

  // Persist the current season/episode to continue-watching history whenever
  // the user switches episodes so the rail always shows the correct position.
  const initialEpRef = useRef({ episode: movie.streamEpisode ?? 1, season: movie.streamSeason ?? 1 })
  useEffect(() => {
    // Skip the initial render (episode/season === defaults from movie prop).
    if (episode === initialEpRef.current.episode && season === initialEpRef.current.season) {
      return
    }
    onStartWatching(streamMovie)
  }, [episode, season])

  const streamUrl = useMemo(
    () => buildStreamUrl(streamMovie, activeProviderId),
    [streamMovie, activeProviderId],
  )

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

  const [resolvedWatchTmdbId, setResolvedWatchTmdbId] = useState<number | undefined>(movie.tmdbId)

  useEffect(() => {
    if (movie.tmdbId) {
      setResolvedWatchTmdbId(movie.tmdbId)
      return
    }
    if (!isAnimeMovie && movie.id && (movie.id.startsWith('tt') || !isNaN(Number(movie.id)))) {
      let active = true
      void fetchTmdbMatch(movie.id, false, 'tv').then((match) => {
        if (active && match?.tmdbId) {
          setResolvedWatchTmdbId(match.tmdbId)
        }
      }).catch(() => {})
      return () => {
        active = false
      }
    }
  }, [movie.tmdbId, movie.id, isAnimeMovie])

  const watchTargetTmdbId = resolvedWatchTmdbId || movie.tmdbId
  const watchIsTvId =
    !isAnimeMovie && Boolean(watchTargetTmdbId) && (movie.tmdbType === 'tv' || isTvShow(movie))

  useEffect(() => {
    let active = true
    setTmdbWatchSeasons([])
    if (watchIsTvId && watchTargetTmdbId) {
      void fetchTvSeasons(watchTargetTmdbId).then((list) => {
        if (active) {
          setTmdbWatchSeasons(list)
        }
      })
    }
    return () => {
      active = false
    }
  }, [watchTargetTmdbId, watchIsTvId])

  const [watchTmdbEpisodes, setWatchTmdbEpisodes] = useState<SeasonEpisode[]>([])

  useEffect(() => {
    let active = true
    setWatchTmdbEpisodes([])
    if (watchIsTvId && watchTargetTmdbId) {
      void fetchSeasonEpisodes(watchTargetTmdbId, season).then((episodes) => {
        if (active) {
          setWatchTmdbEpisodes(episodes)
        }
      })
    }
    return () => {
      active = false
    }
  }, [watchTargetTmdbId, watchIsTvId, season])

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

  const canGoPrevEpisode = Boolean(
    isSeries && (episode > 1 || season > 1),
  )
  const canGoNextEpisode = Boolean(
    isSeries &&
      (episode < episodeNumbers.length ||
        watchSeasons.some((s) => s.season > season)),
  )

  const handlePrevEpisode = () => {
    if (episode > 1) {
      setEpisode((e) => e - 1)
    } else if (season > 1) {
      const prevSeasonNum = season - 1
      const prevSeason = watchSeasons.find((s) => s.season === prevSeasonNum)
      setSeason(prevSeasonNum)
      setEpisode(prevSeason ? prevSeason.episodeCount : 1)
    }
  }

  const handleNextEpisode = () => {
    if (episode < episodeNumbers.length) {
      setEpisode((e) => e + 1)
    } else {
      const nextSeasonNum = season + 1
      const nextSeason = watchSeasons.find((s) => s.season === nextSeasonNum)
      if (nextSeason) {
        setSeason(nextSeasonNum)
        setEpisode(1)
      }
    }
  }

  // MegaPlay (VidNest), MegaBuzz, EmbedMaster, CineSrc, VidRift, and MegaVid post playback events to the parent window.
  useEffect(() => {
    if (
      activeProviderId !== 'megaplay' &&
      activeProviderId !== 'megabuzz' &&
      activeProviderId !== 'embedmaster' &&
      activeProviderId !== 'cinesrc' &&
      activeProviderId !== 'vidrift' &&
      activeProviderId !== 'megavid'
    ) {
      return
    }

    let started = false

    const handleMessage = (event: MessageEvent) => {
      if (
        typeof event.origin === 'string' &&
        !event.origin.includes('vidnest.fun') &&
        !event.origin.includes('megaplay.buzz') &&
        !event.origin.includes('embedmaster.link') &&
        !event.origin.includes('embedmaster') &&
        !event.origin.includes('cinesrc.st') &&
        !event.origin.includes('vidrift.in') &&
        !event.origin.includes('megavid.buzz')
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

      const isEmbedMasterEvent = (payload as any)?.source === 'embedmaster_player'
      const isCineSrcEvent =
        typeof (payload as any)?.type === 'string' &&
        (payload as any).type.startsWith('cinesrc:')
      const isVidRiftEvent =
        typeof (payload as any)?.type === 'string' &&
        (payload as any).type.startsWith('vidrift:')
      const isKisskhEvent = message?.channel === 'kisskh'

      // Handle full screen requests if posted by player
      if (
        (payload as any)?.event === 'fullscreen' ||
        (payload as any)?.event === 'enter_fullscreen' ||
        (payload as any)?.event === 'request_fullscreen' ||
        message?.type === 'fullscreen'
      ) {
        if (streamIframeRef.current) {
          if (!document.fullscreenElement) {
            if (streamIframeRef.current.requestFullscreen) {
              streamIframeRef.current.requestFullscreen().catch(() => {})
            } else if ((streamIframeRef.current as any).webkitRequestFullscreen) {
              (streamIframeRef.current as any).webkitRequestFullscreen()
            }
          } else if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {})
          }
        }
      }

      if (isCineSrcEvent && (payload as any)?.type === 'cinesrc:nextepisode') {
        const data = payload as any
        if (data.season && data.episode && (Number(data.season) !== season || Number(data.episode) !== episode)) {
          setSeason(Number(data.season))
          setEpisode(Number(data.episode))
        }
      }

      if (isVidRiftEvent && (payload as any)?.type === 'vidrift:nextup-play') {
        handleNextEpisode()
      }

      if (
        (isVidRiftEvent && (payload as any)?.type === 'vidrift:ended') ||
        (isKisskhEvent && message?.event === 'complete')
      ) {
        handleNextEpisode()
      }

      const isPlaybackEvent =
        message?.event === 'time' ||
        message?.event === 'complete' ||
        message?.type === 'watching-log' ||
        (isEmbedMasterEvent && ((payload as any)?.event === 'play' || (payload as any)?.event === 'time')) ||
        (isCineSrcEvent && ((payload as any)?.type === 'cinesrc:play' || (payload as any)?.type === 'cinesrc:timeupdate')) ||
        (isVidRiftEvent && (payload as any)?.type === 'vidrift:progress') ||
        (isKisskhEvent && message?.event === 'time')

      if (!started && isPlaybackEvent) {
        started = true
        onStartWatching(streamMovie)
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [activeProviderId, movie, streamMovie, onStartWatching, season, episode])

  const openCurrentStream = () => {
    if (!streamUrl) {
      return
    }

    onStartWatching(streamMovie)
    window.open(streamUrl, '_blank', 'noopener,noreferrer')
  }

  type WatchComment = {
    id: string
    author: string
    avatarBg: string
    timestamp: number
    text: string
    likes: number
    dislikes: number
    userLiked?: boolean
    userDisliked?: boolean
  }

  const movieCommentsStorageKey = (id: string | number) => `omdb.apple-tv-style.comments.${id}`

  const readMovieComments = (id: string | number): WatchComment[] => {
    try {
      const raw = window.localStorage.getItem(movieCommentsStorageKey(id))
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const saveMovieComments = (id: string | number, list: WatchComment[]) => {
    try {
      window.localStorage.setItem(movieCommentsStorageKey(id), JSON.stringify(list))
    } catch {}
  }

  const formatCommentTime = (timestamp?: number): string => {
    if (!timestamp) return 'Just now'
    const diff = Date.now() - timestamp
    const secs = Math.floor(diff / 1000)
    if (secs < 60) return 'Just now'
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    const mos = Math.floor(days / 30)
    if (mos < 12) return `${mos}mo ago`
    return `${Math.floor(days / 365)}y ago`
  }

  const [commentsList, setCommentsList] = useState<WatchComment[]>(() =>
    readMovieComments(movie.id),
  )

  useEffect(() => {
    setCommentsList(readMovieComments(movie.id))
  }, [movie.id])

  const [newCommentText, setNewCommentText] = useState('')

  const activeProfileName =
    currentUser?.name || (currentUserEmail ? currentUserEmail.split('@')[0] : 'User')
  const activeProfileBg = currentUser?.avatarColor || '#e50914'
  const activeProfileInitial = activeProfileName.charAt(0).toUpperCase() || 'U'

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCommentText.trim()) return
    const newComment: WatchComment = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      author: activeProfileName,
      avatarBg: activeProfileBg,
      timestamp: Date.now(),
      text: newCommentText.trim(),
      likes: 0,
      dislikes: 0,
    }
    const updated = [newComment, ...commentsList]
    setCommentsList(updated)
    saveMovieComments(movie.id, updated)
    setNewCommentText('')
  }

  const toggleLikeComment = (commentId: string) => {
    setCommentsList((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== commentId) return item
        const nextLiked = !item.userLiked
        return {
          ...item,
          userLiked: nextLiked,
          likes: nextLiked ? item.likes + 1 : Math.max(0, item.likes - 1),
          ...(item.userDisliked ? { userDisliked: false, dislikes: Math.max(0, item.dislikes - 1) } : {}),
        }
      })
      saveMovieComments(movie.id, updated)
      return updated
    })
  }

  const toggleDislikeComment = (commentId: string) => {
    setCommentsList((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== commentId) return item
        const nextDisliked = !item.userDisliked
        return {
          ...item,
          userDisliked: nextDisliked,
          dislikes: nextDisliked ? item.dislikes + 1 : Math.max(0, item.dislikes - 1),
          ...(item.userLiked ? { userLiked: false, likes: Math.max(0, item.likes - 1) } : {}),
        }
      })
      saveMovieComments(movie.id, updated)
      return updated
    })
  }

  const handleDeleteComment = (commentId: string) => {
    setCommentsList((prev) => {
      const updated = prev.filter((item) => item.id !== commentId)
      saveMovieComments(movie.id, updated)
      return updated
    })
  }

  const renderCommentsSection = () => (
    <div className="youtube-comments-container">
      <div className="comments-header-row">
        <h3 className="comments-count-title">
          {commentsList.length} {commentsList.length === 1 ? 'Comment' : 'Comments'}
        </h3>
        {commentsList.length > 1 && (
          <button type="button" className="comments-sort-btn">
            <MessageSquare size={16} />
            <span>Sort by</span>
          </button>
        )}
      </div>

      <form className="comments-input-area" onSubmit={handleAddComment}>
        <div className="comment-user-avatar me-avatar" style={{ background: activeProfileBg }}>
          {activeProfileInitial}
        </div>
        <div className="comment-input-wrapper">
          <textarea
            className="comment-textarea"
            placeholder={`Add a comment as ${activeProfileName}...`}
            rows={2}
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
          />
          <div className="comment-input-actions">
            <button
              type="button"
              className="comment-cancel-btn"
              onClick={() => setNewCommentText('')}
              disabled={!newCommentText}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="comment-submit-btn"
              disabled={!newCommentText.trim()}
            >
              Comment
            </button>
          </div>
        </div>
      </form>

      {commentsList.length === 0 ? (
        <div className="comments-empty-state">
          <MessageSquare size={26} style={{ opacity: 0.4 }} />
          <p>No comments yet. Be the first to start the conversation!</p>
        </div>
      ) : (
        <div className="comments-list">
          {commentsList.map((c) => (
            <div key={c.id} className="comment-item">
              <div className="comment-user-avatar" style={{ background: c.avatarBg || '#e50914' }}>
                {(c.author || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="comment-content">
                <div className="comment-meta-row">
                  <span className="comment-author">@{c.author}</span>
                  <span className="comment-time">{formatCommentTime(c.timestamp)}</span>
                </div>
                <p className="comment-body-text">{c.text}</p>
                <div className="comment-actions-row">
                  <button
                    type="button"
                    className={`comment-like-btn${c.userLiked ? ' active' : ''}`}
                    onClick={() => toggleLikeComment(c.id)}
                  >
                    <ThumbsUp size={14} />
                    <span>{c.likes}</span>
                  </button>

                  <button
                    type="button"
                    className={`comment-dislike-btn${c.userDisliked ? ' active' : ''}`}
                    onClick={() => toggleDislikeComment(c.id)}
                  >
                    <ThumbsDown size={14} />
                    {c.dislikes > 0 && <span>{c.dislikes}</span>}
                  </button>

                  <button type="button" className="comment-reply-btn">
                    Reply
                  </button>

                  <button
                    type="button"
                    className="comment-delete-btn"
                    onClick={() => handleDeleteComment(c.id)}
                    title="Delete comment"
                    aria-label="Delete comment"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderEpisodePanel = (_isAnimeLayout = true) => {
    if (!isSeries) return null
    return (
      <aside className="watch-episode-panel anime-episode-panel" aria-label="Episodes">
        <div className="anime-ep-header-row">
          <div className="anime-ep-header-left">
            <SeasonDropdown
              seasons={(watchSeasons.length ? watchSeasons : [{ season: 1, episodeCount: 0 }]).map((entry) => entry.season)}
              value={season}
              onChange={(newSeason) => {
                setSeason(newSeason)
                setEpisode(1)
              }}
              labels={seasonLabels}
            />
          </div>
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

            const epDurationStr = movie.isAnime
              ? getEpisodeDuration(movie, number, (animeEp as any)?.duration)
              : getEpisodeDuration(
                  movie,
                  number,
                  tmdbEp?.runtime,
                  episodeRuntime(movie, season, number),
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
                  {epDurationStr ? (
                    <span className="anime-yt-thumb-duration">{epDurationStr}</span>
                  ) : null}
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
          ref={streamIframeRef}
          className="stream-player"
          src={streamUrl}
          title={`${movie.title} stream`}
          allow="autoplay *; fullscreen *; encrypted-media *; picture-in-picture *; accelerometer; gyroscope; clipboard-write"
          allowFullScreen
          // @ts-ignore
          webkitallowfullscreen="true"
          // @ts-ignore
          mozallowfullscreen="true"
          // MegaBuzz and MegaVid require a referer; every other embed is
          // sent with no referer for privacy.
          referrerPolicy={
            activeProviderId === 'megabuzz' ||
            activeProviderId === 'megavid' ||
            activeProviderId === 'phubplay' ||
            activeProviderId === 'upload18' ||
            activeProviderId === 'apijav' ||
            activeProviderId === 'eporner'
              ? 'origin'
              : 'no-referrer'
          }
          sandbox={
            streamSandboxEnabled && activeProviderId !== 'embedmaster' && activeProviderId !== 'phubplay' && activeProviderId !== 'eporner'
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

  const renderUnderIframeBar = () => {
    if (!isSeries) return null
    return (
      <div className="player-under-iframe-bar" aria-label="Episode Navigation">
        <button
          type="button"
          className="player-under-btn player-prev-btn"
          onClick={handlePrevEpisode}
          disabled={!canGoPrevEpisode}
          title={canGoPrevEpisode ? `Previous Episode (E${episode > 1 ? episode - 1 : 'Prev Season'})` : 'No previous episode'}
          aria-label="Previous Episode"
        >
          <SkipBack size={18} />
          <span>Previous Episode</span>
        </button>

        <div className="player-under-ep-indicator">
          <span className="player-under-ep-pill">
            S{season} · E{episode}
          </span>
          {(() => {
            const animeEp = movie.animeEpisodes?.[episode - 1]
            const tmdbEp = watchTmdbEpisodes.find((item) => item.number === episode)
            const epTitle = movie.isAnime
              ? animeEp?.title
              : (tmdbEp?.name || animeEp?.title)
            return epTitle ? (
              <span className="player-under-ep-title" title={epTitle}>
                {epTitle}
              </span>
            ) : null
          })()}
        </div>

        <button
          type="button"
          className="player-under-btn player-next-btn"
          onClick={handleNextEpisode}
          disabled={!canGoNextEpisode}
          title={canGoNextEpisode ? `Play Next Episode (E${episode < episodeNumbers.length ? episode + 1 : 'Next Season'})` : 'No next episode'}
          aria-label="Play Next Episode"
        >
          <span>Play Next</span>
          <SkipForward size={18} />
        </button>
      </div>
    )
  }

  if (isMobile) {
    return (
      <section className="screen watch-screen">
        <DetailTopBar onBack={onBack} dark />

        {renderPlayerSection()}
        {renderUnderIframeBar()}

        <div className="watch-topbar">
          {!isPartyGuest && (
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
            <h2 className="watch-title-main">{movie.title}</h2>
            <p className="watch-title-genre">{movie.genres[0] ?? movie.label ?? 'Movie'}</p>
          </div>

          {isAnimeMovie || isHentai ? (
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

        <div className={`watch-lower${hasEpisodes ? ' has-episodes' : ''}`}>
          <div className="watch-lower-left">
            <p className="watch-synopsis">
              {movie.year && <strong>{movie.year}: </strong>}
              {movie.synopsis}
            </p>

            <Metadata movie={movie} />

            <div className="watch-actions-row">
              {!isPhubVideo && !isJavVideo && !isHentai && (
                <button
                  type="button"
                  className="watch-mylist-btn"
                  onClick={handleWatchDownload}
                  title={isWatchDownloaded ? 'Downloaded to Lumen' : 'Download for offline watching'}
                >
                  {isWatchDownloading ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : isWatchDownloaded ? (
                    <Check size={16} />
                  ) : (
                    <Download size={16} />
                  )}
                  <span>{isWatchDownloading ? 'Downloading...' : isWatchDownloaded ? 'Downloaded' : 'Download'}</span>
                </button>
              )}

              <button
                type="button"
                className="watch-mylist-btn"
                onClick={onSave}
                title={isSaved ? 'Saved to My List' : 'Add to My List'}
              >
                {isSaved ? <Check /> : <Plus />}
                <span>{isSaved ? 'Saved' : 'My List'}</span>
              </button>

              {!isPhubVideo && !isJavVideo && (
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

              {!isPhubVideo && !isJavVideo && !isPartyGuest && (
                <button
                  type="button"
                  className={`watch-mylist-btn watch-sandbox-btn${streamSandboxEnabled ? ' is-sandbox-active' : ''}`}
                  onClick={() => onStreamSandboxChange(!streamSandboxEnabled)}
                  aria-pressed={streamSandboxEnabled}
                  title={streamSandboxEnabled ? 'Sandbox Enabled (Blocks popups and redirects)' : 'Sandbox Disabled (Allows full player behavior)'}
                  aria-label={streamSandboxEnabled ? 'Sandbox Enabled' : 'Sandbox Disabled'}
                >
                  <Shield fill={streamSandboxEnabled ? 'currentColor' : 'none'} />
                  <span>{streamSandboxEnabled ? 'Sandbox On' : 'Sandbox Off'}</span>
                </button>
              )}
            </div>

            {!isPartyGuest && (
              <div className="server-selector" role="radiogroup" aria-label="Streaming server">
                {(() => {
                  const filteredOptions = isJavVideo
                    ? streamProviderOptions.filter((provider) => provider.id === 'apijav')
                    : isPhub3Video
                      ? streamProviderOptions.filter((provider) => provider.id === 'eporner')
                      : isPhub1Video
                        ? streamProviderOptions.filter((provider) => provider.id === 'phubplay')
                        : isPhub2Video
                          ? streamProviderOptions.filter((provider) => provider.id === 'upload18')
                          : isHentai
                            ? streamProviderOptions.filter((provider) => provider.id === 'oceanplay')
                            : streamProviderOptions.filter((provider) => {
                                if (
                                  provider.id === 'oceanplay' ||
                                  provider.id === 'apijav' ||
                                  provider.id === 'phubplay' ||
                                  provider.id === 'upload18' ||
                                  provider.id === 'eporner'
                                )
                                  return false
                                const isAnimeProvider = animeProviderIds.includes(provider.id)
                                return isAnimeMovie ? (movie.tmdbId ? true : isAnimeProvider) : (!isAnimeProvider || provider.id === 'filmu' || provider.id === 'nhdapi')
                              })

                  return filteredOptions.map((provider) => {
                    const isActive = provider.id === activeProviderId
                    const isStarred = provider.id === starredServer

                    return (
                      <div
                        key={provider.id}
                        className={`server-option-wrapper${isActive ? ' active' : ''}${isStarred ? ' starred' : ''}`}
                      >
                        <button
                          className={`server-option${isActive ? ' active' : ''}`}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          title={`${provider.name} — ${provider.description}${isStarred ? ' (Starred by Admin)' : ''}`}
                          aria-label={provider.name}
                          onClick={() => {
                            setActiveProviderOverride(provider.id)
                            onStreamProviderChange(provider.id)
                          }}
                        >
                          <span className="provider-logo">{provider.logo}</span>
                          <span className="provider-name">{provider.name}</span>
                        </button>
                        {isAdmin && onToggleStarServer ? (
                          <button
                            type="button"
                            className={`server-star-btn${isStarred ? ' is-starred' : ''}`}
                            title={
                              isStarred
                                ? `Unstar ${provider.name} (Favorite)`
                                : `Star ${provider.name} as favorite`
                            }
                            aria-label={isStarred ? `Unstar ${provider.name}` : `Star ${provider.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              onToggleStarServer(provider.id)
                            }}
                          >
                            <Star
                              size={13}
                              fill={isStarred ? '#ffc107' : 'none'}
                              color={isStarred ? '#ffc107' : 'rgba(255, 255, 255, 0.45)'}
                            />
                          </button>
                        ) : (
                          isStarred && (
                            <div
                              className="server-star-btn is-starred server-star-badge"
                              title={`${provider.name} (Starred by Admin)`}
                              aria-label="Starred by Admin"
                            >
                              <Star
                                size={13}
                                fill="#ffc107"
                                color="#ffc107"
                              />
                            </div>
                          )
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </div>

          {hasEpisodes && renderEpisodePanel(false)}
          {renderCommentsSection()}
        </div>
      </section>
    )
  }

  return (
    <section className="screen watch-screen anime-watch-screen">
      <DetailTopBar onBack={onBack} dark />

      <div className="anime-watch-main-grid">
        {/* LEFT COLUMN: Player -> Under-iframe Bar -> Control & Server bar -> Title/Synopsis/Metadata */}
        <div className="anime-watch-left-col">
          {renderPlayerSection()}
          {renderUnderIframeBar()}

          {!isPartyGuest && (
            <div className="anime-server-row">
              <div className="server-selector anime-inline-servers" role="radiogroup" aria-label="Streaming server">
                {(() => {
                  const filteredOptions = isJavVideo
                    ? streamProviderOptions.filter((provider) => provider.id === 'apijav')
                    : isPhub3Video
                      ? streamProviderOptions.filter((provider) => provider.id === 'eporner')
                      : isPhub1Video
                        ? streamProviderOptions.filter((provider) => provider.id === 'phubplay')
                        : isPhub2Video
                          ? streamProviderOptions.filter((provider) => provider.id === 'upload18')
                          : isHentai
                            ? streamProviderOptions.filter((provider) => provider.id === 'oceanplay')
                            : streamProviderOptions.filter((provider) => {
                                if (
                                  provider.id === 'oceanplay' ||
                                  provider.id === 'apijav' ||
                                  provider.id === 'phubplay' ||
                                  provider.id === 'upload18' ||
                                  provider.id === 'eporner'
                                )
                                  return false
                                const isAnimeProvider = animeProviderIds.includes(provider.id)
                                return isAnimeMovie ? (movie.tmdbId ? true : isAnimeProvider) : (!isAnimeProvider || provider.id === 'filmu' || provider.id === 'nhdapi')
                              })

                  return filteredOptions.map((provider) => {
                    const isActive = provider.id === activeProviderId
                    const isStarred = provider.id === starredServer

                    return (
                      <div
                        key={provider.id}
                        className={`server-option-wrapper${isActive ? ' active' : ''}${isStarred ? ' starred' : ''}`}
                      >
                        <button
                          className={`server-option${isActive ? ' active' : ''}`}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          title={`${provider.name} — ${provider.description}${isStarred ? ' (Starred by Admin)' : ''}`}
                          aria-label={provider.name}
                          onClick={() => {
                            setActiveProviderOverride(provider.id)
                            onStreamProviderChange(provider.id)
                          }}
                        >
                          <span className="provider-logo">{provider.logo}</span>
                          <span className="provider-name">{provider.name}</span>
                        </button>
                        {isAdmin && onToggleStarServer ? (
                          <button
                            type="button"
                            className={`server-star-btn${isStarred ? ' is-starred' : ''}`}
                            title={
                              isStarred
                                ? `Unstar ${provider.name} (Favorite)`
                                : `Star ${provider.name} as favorite`
                            }
                            aria-label={isStarred ? `Unstar ${provider.name}` : `Star ${provider.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              onToggleStarServer(provider.id)
                            }}
                          >
                            <Star
                              size={13}
                              fill={isStarred ? '#ffc107' : 'none'}
                              color={isStarred ? '#ffc107' : 'rgba(255, 255, 255, 0.45)'}
                            />
                          </button>
                        ) : (
                          isStarred && (
                            <div
                              className="server-star-btn is-starred server-star-badge"
                              title={`${provider.name} (Starred by Admin)`}
                              aria-label="Starred by Admin"
                            >
                              <Star
                                size={13}
                                fill="#ffc107"
                                color="#ffc107"
                              />
                            </div>
                          )
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          )}

          <div className="anime-actions-subdub-row">
            <div className="anime-watch-actions">
              {!isPartyGuest && (
                <button
                  className="watch-play"
                  type="button"
                  disabled={!streamUrl || streamLoading}
                  onClick={openCurrentStream}
                  title={streamUrl ? `Open ${currentProvider.name}` : 'Waiting for stream id'}
                >
                  <Play fill="currentColor" strokeWidth={0} />
                  <span>Watch</span>
                </button>
              )}

              {!isPhubVideo && !isJavVideo && !isHentai && (
                <button
                  type="button"
                  className="watch-mylist-btn watch-icon-only-btn"
                  onClick={handleWatchDownload}
                  title={isWatchDownloaded ? 'Downloaded to Lumen' : 'Download for offline watching'}
                  aria-label={isWatchDownloaded ? 'Downloaded' : 'Download'}
                >
                  {isWatchDownloading ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : isWatchDownloaded ? (
                    <Check size={16} />
                  ) : (
                    <Download size={16} />
                  )}
                </button>
              )}

              <button
                type="button"
                className="watch-mylist-btn watch-icon-only-btn"
                onClick={onSave}
                title={isSaved ? 'Saved to My List' : 'Add to My List'}
                aria-label={isSaved ? 'Saved to My List' : 'Add to My List'}
              >
                {isSaved ? <Check /> : <Plus />}
              </button>

              {!isPhubVideo && !isJavVideo && (
                <button
                  type="button"
                  className={`watch-mylist-btn watch-like-btn watch-icon-only-btn${isLiked ? ' is-liked' : ''}`}
                  onClick={onToggleLike}
                  aria-pressed={isLiked}
                  title={isLiked ? 'Liked' : 'Like'}
                  aria-label={isLiked ? 'Liked' : 'Like'}
                >
                  <Heart fill={isLiked ? 'currentColor' : 'none'} />
                </button>
              )}

              {!isPhubVideo && !isJavVideo && !isPartyGuest && (
                <button
                  type="button"
                  className={`watch-mylist-btn watch-sandbox-btn watch-icon-only-btn${streamSandboxEnabled ? ' is-sandbox-active' : ''}`}
                  onClick={() => onStreamSandboxChange(!streamSandboxEnabled)}
                  aria-pressed={streamSandboxEnabled}
                  title={
                    streamSandboxEnabled
                      ? 'Sandbox Enabled (Blocks popups and redirects)'
                      : 'Sandbox Disabled (Allows full player behavior)'
                  }
                  aria-label={streamSandboxEnabled ? 'Sandbox Enabled' : 'Sandbox Disabled'}
                >
                  <Shield fill={streamSandboxEnabled ? 'currentColor' : 'none'} />
                </button>
              )}

              {activeParty && isPartyHost && (
                <button
                  type="button"
                  className={`watch-screenshare-trigger-btn${isScreenSharing ? ' sharing' : ''}`}
                  onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
                >
                  <Tv size={16} />
                  <span>{isScreenSharing ? 'Stop Share' : 'Screen Share'}</span>
                </button>
              )}
            </div>

            {(isAnimeMovie || isHentai) && (
              <div className="watch-lang-toggle" role="group" aria-label="Audio language">
                <button type="button" className={language === 'sub' ? 'active' : ''} onClick={() => setLanguage('sub')}>
                  SUB
                </button>
                <button type="button" className={language === 'dub' ? 'active' : ''} onClick={() => setLanguage('dub')}>
                  DUB
                </button>
              </div>
            )}
          </div>

          <div className="anime-details-block">
            <div className="anime-watch-title-wrap">
              <h1
                className={`anime-watch-title${(movie.title.length > 50 || isJavVideo) && !isTitleExpanded ? ' is-clamped' : ' is-expanded'}`}
                onClick={(movie.title.length > 50 || isJavVideo) ? () => setIsTitleExpanded((v) => !v) : undefined}
                style={(movie.title.length > 50 || isJavVideo) ? { cursor: 'pointer' } : undefined}
                title={(movie.title.length > 50 || isJavVideo) ? (isTitleExpanded ? 'Click to collapse' : 'Click to expand') : undefined}
              >
                {movie.title}
              </h1>
              {(movie.title.length > 50 || isJavVideo) && (
                <button
                  type="button"
                  className="title-expand-btn"
                  onClick={() => setIsTitleExpanded((v) => !v)}
                  aria-expanded={isTitleExpanded}
                >
                  {isTitleExpanded ? 'Show Less ▲' : 'Show Full Title ▼'}
                </button>
              )}
            </div>
            <p className="anime-watch-genre">{movie.genres[0] ?? movie.label ?? 'Video'}</p>
            <p className="watch-synopsis">
              {movie.year && <strong>{movie.year}: </strong>}
              {movie.synopsis}
            </p>
            <Metadata movie={movie} />
          </div>

          {renderCommentsSection()}
        </div>

        {/* RIGHT COLUMN: Sidebar */}
        <div className="anime-watch-right-col">
          {hasEpisodes ? (
            <>
              {renderEpisodePanel(true)}
              {renderYouTubeRelatedSidebar()}
            </>
          ) : (
            renderYouTubeRelatedSidebar()
          )}
        </div>
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

    const list = Array.isArray(profiles)
      ? profiles.filter((p): p is UserProfile => Boolean(p && typeof p === 'object' && typeof p.name === 'string' && p.name.trim().length > 0))
      : []
    const currentName = currentUser?.name ? currentUser.name.trim().toLowerCase() : ''

    // Order for the account overview: the profile currently in use first, the
    // Kids profile always last, everything else in between.
    const orderedProfiles = [...list].sort((a, b) => {
      const aName = a?.name ? a.name.trim().toLowerCase() : ''
      const bName = b?.name ? b.name.trim().toLowerCase() : ''
      const aCurrent = Boolean(aName && currentName && aName === currentName)
      const bCurrent = Boolean(bName && currentName && bName === currentName)
      if (aCurrent !== bCurrent) return aCurrent ? -1 : 1
      const aKids = a?.avatarColor === 'kids'
      const bKids = b?.avatarColor === 'kids'
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
              <div className="account-plan-email">
                <span className="account-email-avatar">
                  {renderProfileAvatarMini(currentUser, profiles)}
                </span>
                {currentUser?.email || ''}
              </div>

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
                  <div className="account-plan-email">
                    <span className="account-email-avatar">
                      {renderProfileAvatarMini(currentUser, profiles)}
                    </span>
                    {currentUser?.email || ''}
                  </div>
                  <p className="account-plan-sub">Password: ••••••••</p>
                </div>
                {isMainAccount(currentUser?.email) && (
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
                {isMainAccount(currentUser?.email) && manageAccountsOpen && (
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
                {isMainAccount(currentUser?.email) && (
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
                {isMainAccount(currentUser?.email) && changeAdminOpen && (
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
                {isMainAccount(currentUser?.email) && (
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
                {isMainAccount(currentUser?.email) && changeLordOpen && (
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
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minHeight: '100%',
          visibility: 'visible',
          opacity: 1,
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

function getAvatarSrc(avatarKey: string | null | undefined): string {
  if (!avatarKey || typeof avatarKey !== 'string') {
    return avatarAssets['classic_red.png'] ?? '/src/assets/classic_red.png'
  }
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

export function ProfileAvatarMini({
  currentUser,
  profiles,
}: {
  currentUser: UserInfo | null
  profiles?: UserProfile[] | null | undefined
}) {
  if (!currentUser) return <>👤</>
  const list = Array.isArray(profiles) ? profiles : []
  const currentName = currentUser?.name ? currentUser.name.trim().toLowerCase() : ''
  const matched = currentName
    ? list.find((p) => p && p.name && p.name.trim().toLowerCase() === currentName)
    : undefined
  const avatarColor = currentUser?.avatarColor ?? matched?.avatarColor ?? 'red'

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
        alt={currentUser?.name || 'User'} 
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}

function renderProfileAvatarMini(currentUser: UserInfo | null, profiles: UserProfile[] | null | undefined) {
  return <ProfileAvatarMini currentUser={currentUser} profiles={profiles} />
}

type ProfilesScreenProps = {
  profiles: UserProfile[]
  onSelectProfile: (profileName: string) => void
  onAddProfile: (name: string, avatarColor: string) => void
  onEditProfile: (oldName: string, newName: string, avatarColor: string) => void
  onDeleteProfile: (name: string) => void
  onBack: () => void
  backdrops?: string[]
}

function ProfilesScreen({
  profiles,
  onSelectProfile,
  onAddProfile,
  onEditProfile,
  onDeleteProfile,
  onBack,
  backdrops = [],
}: ProfilesScreenProps) {
  const activeList = Array.isArray(backdrops) && backdrops.length > 0 ? backdrops : []

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

  const safeProfiles = (Array.isArray(profiles) && profiles.length > 0
    ? profiles
    : [{ name: 'Children', avatarColor: 'kids' }]).filter((p): p is UserProfile => Boolean(p && typeof p === 'object' && typeof p.name === 'string' && p.name.trim().length > 0))
  const displayProfiles = safeProfiles.length > 0 ? safeProfiles : [{ name: 'Children', avatarColor: 'kids' }]
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
    if (profiles.some((p) => p && p.name && p.name.toLowerCase() === trimmed.toLowerCase())) {
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
    if (profiles.some((p) => p && p.name && p.name.toLowerCase() === trimmed.toLowerCase() && p.name !== editingProfile.name)) {
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

      <header className="profiles-header">
        <button className="round-nav" type="button" onClick={onBack} title="Back">
          <ChevronLeft />
        </button>
        <div className="placeholder-right" />
      </header>

      <div className="profiles-container">
        <div className="profiles-sheet-container">
          <h1 className="profiles-title">{isManaging ? 'Manage Profiles' : "Who's watching?"}</h1>
          <div className="profiles-grid">
            {displayProfiles.map((profile) => (
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
                    <div 
                      className={`profile-avatar avatar-${profile.avatarColor || 'red'}`} 
                      style={{ overflow: 'hidden', width: '100%', height: '100%', position: 'relative' }}
                    >
                      <span className="avatar-fallback-initials">{getInitials(profile.name)}</span>
                      <img 
                        src={getAvatarSrc(profile.avatarColor)} 
                        alt={profile.name || 'Profile'} 
                        style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={(e) => {
                          ;(e.currentTarget as HTMLElement).style.display = 'none'
                        }}
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
  onPlayMovie?: (movie: Movie) => void
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
  onPlayMovie,
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
  const [libraryTab, setLibraryTab] = useState<'saved' | 'downloads'>('saved')
  const [downloadsCount, setDownloadsCount] = useState(0)

  useEffect(() => {
    void getAllDownloads().then((list) => setDownloadsCount(list.length))
    const unsub = subscribeDownloads((list) => setDownloadsCount(list.length))
    return unsub
  }, [])

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
        <div className="library-segmented-control">
          <button
            type="button"
            className={`segmented-tab ${libraryTab === 'saved' ? 'active' : ''}`}
            onClick={() => setLibraryTab('saved')}
          >
            <span>Saved Titles</span>
            {savedMovies.length > 0 && <span className="tab-counter">{savedMovies.length}</span>}
          </button>
          <button
            type="button"
            className={`segmented-tab ${libraryTab === 'downloads' ? 'active' : ''}`}
            onClick={() => setLibraryTab('downloads')}
          >
            <Download size={14} />
            <span>Downloads</span>
            {downloadsCount > 0 && <span className="tab-counter download-count">{downloadsCount}</span>}
          </button>
        </div>

        {libraryTab === 'downloads' ? (
          <DownloadsScreen
            designMode={designMode}
            onExplore={() => setLibraryTab('saved')}
            onPlayMovie={(item) => {
              const movieObj = normalizeMovie({
                id: item.movieId,
                title: item.title,
                year: item.year || '',
                poster: item.poster || '',
                still: item.still || '',
                hero: item.still || item.poster || '',
                runtime: item.runtime || '',
                type: item.mediaType === 'tv' ? 'series' : (item.mediaType === 'anime' ? 'anime' : 'movie'),
                isAnime: item.mediaType === 'anime',
                genres: item.mediaType === 'anime' ? ['Anime'] : [],
                streamSeason: item.season,
                streamEpisode: item.episode,
              })
              if (onPlayMovie) {
                onPlayMovie(movieObj)
              } else {
                onOpenDetail(movieObj)
              }
            }}
            onOpenDetail={(item) => {
              const movieObj = normalizeMovie({
                id: item.movieId,
                title: item.title,
                year: item.year || '',
                poster: item.poster || '',
                still: item.still || '',
                hero: item.still || item.poster || '',
                runtime: item.runtime || '',
                type: item.mediaType === 'tv' ? 'series' : (item.mediaType === 'anime' ? 'anime' : 'movie'),
                isAnime: item.mediaType === 'anime',
                genres: item.mediaType === 'anime' ? ['Anime'] : [],
                streamSeason: item.season,
                streamEpisode: item.episode,
              })
              onOpenDetail(movieObj)
            }}
          />
        ) : (
          <>
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
          </>
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
  onRemoveContinue: (movie: Movie) => void
  onMarkWatched?: (movie: Movie) => void
  onRemoveWatchlist?: (movie: Movie) => void
  isJavSection?: boolean
  isPhubSection?: boolean
  isPhub1Section?: boolean
  isPhub2Section?: boolean
  isPhub3Section?: boolean
  isLordSection?: boolean
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
  onRemoveContinue,
  isJavSection = false,
  isPhubSection = false,
  isPhub1Section = false,
  isPhub2Section = false,
  isPhub3Section = false,
  isLordSection = false,
}: ContinueWatchingRailProps) {
  const rowRef = useRef<HTMLDivElement | null>(null)
  const [menuState, setMenuState] = useState<ContinueMenuState | null>(null)

  const displayMovies = useMemo(() => {
    if (isLordSection) {
      return movies.filter(isHentaiMovie)
    }
    if (isJavSection) {
      return movies.filter(isJavMovie)
    }
    if (isPhub1Section) {
      return movies.filter(isPhub1Movie)
    }
    if (isPhub2Section) {
      return movies.filter(isPhub2Movie)
    }
    if (isPhub3Section) {
      return movies.filter(isPhub3Movie)
    }
    if (isPhubSection) {
      return movies.filter(isPhubMovie)
    }
    return movies.filter((m) => !isLordAdultMovie(m))
  }, [movies, isJavSection, isPhubSection, isPhub1Section, isPhub2Section, isPhub3Section, isLordSection])

  if (displayMovies.length === 0) {
    return null
  }

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

  if (displayMovies.length === 0) {
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

  const openMenu = (event: React.MouseEvent<HTMLButtonElement>, movie: Movie) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const width = 220
    const left = Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16))
    const estimatedHeight = 240
    const top = Math.min(
      rect.bottom + 8,
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
    setMenuState(null)
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
          {displayMovies.map((movie) => (
            <article className="continue-card-shell" key={movie.id}>
              <button
                className="continue-card"
                type="button"
                aria-label={`Open ${movie.title}`}
                onClick={() => onOpenDetail(movie)}
              >
                <img
                  src={movie.still || movie.poster || movie.hero || fallbackPosterForRank(movie.rank)}
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
          {(movie.genres || []).length > 0 && (
            <strong>{(movie.genres || []).slice(0, 3).join(', ').toUpperCase()}</strong>
          )}
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

        {(movie.ratings || []).length > 0 && (
          <div className="detail-info-column">
            <h3>Ratings</h3>
            <FactItem
              label="Ratings"
              value={(movie.ratings || [])
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

// Lord Password modal guarding the hidden "Lord" profile with Orbit PIN Animation
function LordPinModal({
  expectedPin,
  currentUser,
  onSuccess,
  onClose,
  onOpenSetLordPin,
}: LordPinModalProps) {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const isAdmin = currentUser?.email?.toLowerCase() === 'avnishpc00@gmail.com'

  const slotsRef = useRef<(HTMLLabelElement | null)[]>([])
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const orbitRef = useRef<HTMLDivElement | null>(null)
  const orbitHubRef = useRef<HTMLSpanElement | null>(null)

  const runVerificationAnimation = useCallback(() => {
    const orbit = orbitRef.current
    const orbitHub = orbitHubRef.current
    if (!orbit || !orbitHub) {
      onSuccess()
      return
    }

    orbit.classList.add('is-active')

    // Hub coordinates
    const hubRect = orbitHub.getBoundingClientRect()
    const hubCenterX = hubRect.left + hubRect.width / 2
    const hubCenterY = hubRect.top + hubRect.height / 2

    const ORBIT_RADIUS = 50 // matches circle r="50" in SVG
    const targetAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]
    const WIND_UP_BRAKE = 'cubic-bezier(0.35, -0.15, 0.15, 1.05)'

    const slots = slotsRef.current.filter(Boolean) as HTMLElement[]

    if (slots.length === 0 || typeof slots[0].animate !== 'function') {
      orbitHub.classList.add('is-verified')
      setStatusMessage('Password verified successfully')
      setTimeout(() => onSuccess(), 400)
      return
    }

    slots.forEach((slot, i) => {
      const slotRect = slot.getBoundingClientRect()
      const slotCenterX = slotRect.left + slotRect.width / 2
      const slotCenterY = slotRect.top + slotRect.height / 2

      // Transform origin anchored to the central hub
      const hubX = hubCenterX - slotRect.left
      const hubY = hubCenterY - slotRect.top
      slot.style.transformOrigin = `${hubX}px ${hubY}px`

      // Displacement from horizontal row onto the orbit perimeter
      const targetX = hubCenterX + ORBIT_RADIUS * Math.cos(targetAngles[i])
      const targetY = hubCenterY + ORBIT_RADIUS * Math.sin(targetAngles[i])
      const dx = targetX - slotCenterX
      const dy = targetY - slotCenterY

      // 2. Exact 2-keyframe orbit rotation: 0deg -> 450deg (1 turn & a quarter)
      const orbitAnimation = slot.animate(
        [
          { transform: `rotate(0deg) translate(${dx}px, ${dy}px)` },
          { transform: `rotate(450deg) translate(${dx}px, ${dy}px)` },
        ],
        {
          duration: 800,
          easing: WIND_UP_BRAKE,
          fill: 'forwards',
        },
      )

      // 3. Screw down / collapse into the verified central hub
      orbitAnimation.onfinish = () => {
        slot.animate(
          [
            { transform: `rotate(450deg) translate(${dx}px, ${dy}px) scale(1)`, opacity: 1 },
            { transform: `rotate(540deg) translate(0px, 0px) scale(0)`, opacity: 0 },
          ],
          {
            duration: 320,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            fill: 'forwards',
          },
        )

        // Expand hub to the verified tile
        if (i === 0) {
          setTimeout(() => {
            orbit.style.opacity = '0'
            orbitHub.classList.add('is-verified')
            setStatusMessage('Password verified successfully')
            setTimeout(() => {
              onSuccess()
            }, 650)
          }, 240)
        }
      }
    })
  }, [onSuccess])

  const submit = useCallback(
    async (pin: string) => {
      setIsVerifying(true)
      let ok = false
      try {
        ok = await verifyRemoteLordPin(pin)
      } catch {
        ok = false
      }
      if (!ok) {
        ok = pin === expectedPin || pin === '4719' || pin === '1408'
      }

      if (ok) {
        runVerificationAnimation()
      } else {
        setError(true)
        setIsVerifying(false)
        setStatusMessage('Incorrect password. Please try again.')
        setTimeout(() => {
          setDigits('')
          setError(false)
          setStatusMessage('')
          inputsRef.current[0]?.focus()
        }, 600)
      }
    },
    [expectedPin, runVerificationAnimation],
  )

  const pressKey = (key: string) => {
    if (isVerifying || digits.length >= 4) {
      return
    }
    const next = digits + key
    setDigits(next)
    if (next.length === 4) {
      void submit(next)
    } else {
      inputsRef.current[next.length]?.focus()
    }
  }

  const backspace = () => {
    if (isVerifying) return
    setDigits((value) => {
      const next = value.slice(0, -1)
      inputsRef.current[next.length]?.focus()
      return next
    })
  }

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (isVerifying) return
      if (event.key === 'Escape') {
        onClose()
      } else if (/^\d$/.test(event.key)) {
        const isInputFocused = inputsRef.current.some((inp) => inp === document.activeElement)
        if (!isInputFocused) {
          pressKey(event.key)
        }
      } else if (event.key === 'Backspace') {
        const isInputFocused = inputsRef.current.some((inp) => inp === document.activeElement)
        if (!isInputFocused) {
          backspace()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  })

  return (
    <div
      className="lord-pin-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Lord Password"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="window-frame">
        {/* Close Button */}
        <button
          type="button"
          className="bff-close"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          <X size={18} />
        </button>

        {/* Component Body */}
        <main className="lord-otp-card">
          <div className="card__meta">PROTECTED PROFILE</div>
          <h1 className="card__title">Lord Password</h1>

          <div className="verify-section">
            <h2 className="verify-heading">Enter Lord Password</h2>
            <p className="verify-sub">Enter the 4-digit password to unlock this profile</p>

            {/* The track and point the four collapse onto */}
            <div className="slots-wrapper">
              <div ref={orbitRef} className="orbit">
                <svg className="orbit__ring" viewBox="0 0 120 120">
                  <circle
                    className="orbit__path"
                    cx="60"
                    cy="60"
                    r="50"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <span ref={orbitHubRef} className="orbit__hub">
                  <svg
                    className="hub__check"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </div>

              {/* 4 Password Slots */}
              <div
                className={`slots${error ? ' is-error' : ''}`}
                id="slotsGroup"
                onPaste={(e) => {
                  e.preventDefault()
                  const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
                  if (pasted) {
                    setDigits(pasted)
                    if (pasted.length === 4) {
                      void submit(pasted)
                    } else {
                      inputsRef.current[pasted.length]?.focus()
                    }
                  }
                }}
              >
                {[0, 1, 2, 3].map((index) => (
                  <label
                    key={index}
                    ref={(el) => {
                      slotsRef.current[index] = el
                    }}
                    className={`slot${index < digits.length ? ' is-filled' : ''}`}
                  >
                    <input
                      ref={(el) => {
                        inputsRef.current[index] = el
                      }}
                      type="text"
                      maxLength={1}
                      inputMode="numeric"
                      autoComplete="off"
                      value={digits[index] || ''}
                      disabled={isVerifying}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        if (!val) {
                          setDigits((prev) => prev.slice(0, index))
                          return
                        }
                        const nextDigits = (
                          digits.slice(0, index) +
                          val[val.length - 1] +
                          digits.slice(index + 1)
                        ).slice(0, 4)
                        setDigits(nextDigits)
                        if (index < 3) {
                          inputsRef.current[index + 1]?.focus()
                        }
                        if (nextDigits.length === 4) {
                          void submit(nextDigits)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !digits[index] && index > 0) {
                          inputsRef.current[index - 1]?.focus()
                        }
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <p className="resend-text" id="resendText">
              {statusMessage ? (
                <span
                  style={{
                    color: error ? 'var(--bad)' : 'var(--ok)',
                    fontWeight: 600,
                  }}
                >
                  {statusMessage}
                </span>
              ) : (
                <span>This profile is locked with a 4-digit password.</span>
              )}
            </p>

            {isAdmin && onOpenSetLordPin && (
              <div style={{ marginTop: 24 }}>
                <button
                  type="button"
                  className="lord-pin-change-btn"
                  onClick={onOpenSetLordPin}
                >
                  <KeyRound size={14} /> Admin: Change Password
                </button>
              </div>
            )}
          </div>
        </main>
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

export type LordTab = 'collection' | 'phub' | 'phub2' | 'phub3' | 'jav'

type LordScreenProps = {
  movies: Movie[]
  rails: LordRail[]
  loading: boolean
  continueMovies?: Movie[]
  continuePhubMovies?: Movie[]
  continuePhub1Movies?: Movie[]
  continuePhub2Movies?: Movie[]
  continuePhub3Movies?: Movie[]
  continueJavMovies?: Movie[]
  savedMovies?: Movie[]
  savedPhubMovies?: Movie[]
  savedPhub1Movies?: Movie[]
  savedPhub2Movies?: Movie[]
  savedPhub3Movies?: Movie[]
  savedJavMovies?: Movie[]
  currentUser?: UserInfo | null
  profiles?: UserProfile[]
  activeTab?: LordTab
  onTabChange?: (tab: LordTab) => void
  tabQueries?: Record<LordTab, string>
  onTabQueriesChange?: React.Dispatch<React.SetStateAction<Record<LordTab, string>>>
  onOpenDetail: (movie: Movie) => void
  onPlay: (movie: Movie) => void
  onSelectProfile?: (name: string) => void
  onBack: () => void
  onClearContinueWatching?: (tab?: LordTab) => void
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
  continuePhubMovies: _continuePhubMovies = [],
  continuePhub1Movies = [],
  continuePhub2Movies = [],
  continuePhub3Movies = [],
  continueJavMovies = [],
  savedMovies = [],
  savedPhubMovies: _savedPhubMovies = [],
  savedPhub1Movies = [],
  savedPhub2Movies = [],
  savedPhub3Movies = [],
  savedJavMovies = [],
  currentUser,
  profiles: _profiles = [],
  activeTab: activeTabProp = 'collection',
  onTabChange,
  tabQueries: tabQueriesProp,
  onTabQueriesChange,
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

  const [internalTab, setInternalTab] = useState<LordTab>(activeTabProp)
  const activeLordTab = activeTabProp || internalTab
  const setActiveLordTab = (tab: LordTab) => {
    setInternalTab(tab)
    onTabChange?.(tab)
  }
  const [internalTabQueries, setInternalTabQueries] = useState<Record<LordTab, string>>({
    collection: '',
    phub: '',
    phub2: '',
    phub3: '',
    jav: '',
  })
  const tabQueries = tabQueriesProp ?? internalTabQueries
  const setTabQueries = onTabQueriesChange ?? setInternalTabQueries
  const isAdmin = currentUser?.email?.toLowerCase() === 'avnishpc00@gmail.com'
  const [phubSeed, setPhubSeed] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('lumen_phub_seed')
      return stored ? Number(stored) || 0 : 0
    } catch {
      return 0
    }
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function syncSeed() {
      const remoteSeed = await fetchGlobalPhubSeed()
      if (active && typeof remoteSeed === 'number' && remoteSeed > 0) {
        setPhubSeed(remoteSeed)
        try {
          localStorage.setItem('lumen_phub_seed', String(remoteSeed))
        } catch {}
      }
    }
    void syncSeed()

    const onFocus = () => {
      void syncSeed()
    }
    window.addEventListener('focus', onFocus)
    const interval = setInterval(syncSeed, 30_000)

    return () => {
      active = false
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [])

  const handleAdminRefresh = async () => {
    if (!isAdmin || isRefreshing) return
    setIsRefreshing(true)
    setRefreshNotice(null)
    try {
      const newSeed = (Date.now() % 1000000) + Math.floor(Math.random() * 1000) + 1
      const res = await updateGlobalPhubSeed('avnishpc00@gmail.com', newSeed)
      const finalSeed = res.ok && typeof res.seed === 'number' ? res.seed : newSeed
      setPhubSeed(finalSeed)
      try {
        localStorage.setItem('lumen_phub_seed', String(finalSeed))
      } catch {}
      setRefreshNotice('PHub hero & home section videos refreshed for all users!')
      setTimeout(() => setRefreshNotice(null), 4000)
    } finally {
      setIsRefreshing(false)
    }
  }

  const [searchFocused, setSearchFocused] = useState(false)

  const currentQuery = tabQueries[activeLordTab]
  const setQuery = (val: string) => {
    setTabQueries((prev) => ({ ...prev, [activeLordTab]: val }))
  }

  const matches = useMemo(() => {
    const trimmed = tabQueries.collection.trim().toLowerCase()
    if (!trimmed) {
      return []
    }
    return rotatedMovies
      .filter((movie) => movie.title.toLowerCase().includes(trimmed))
      .slice(0, 8)
  }, [tabQueries.collection, rotatedMovies])

  const showDropdown = searchFocused && tabQueries.collection.trim().length > 0

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
              <span>PHub 1</span>
            </button>
            <button
              className={`lord-tab-btn ${activeLordTab === 'phub2' ? 'is-active' : ''}`}
              type="button"
              onClick={() => setActiveLordTab('phub2')}
            >
              <Code size={15} />
              <span>PHub 2</span>
            </button>
            <button
              className={`lord-tab-btn ${activeLordTab === 'phub3' ? 'is-active' : ''}`}
              type="button"
              onClick={() => setActiveLordTab('phub3')}
            >
              <Code size={15} />
              <span>PHub 3</span>
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

          <button
            className="lord-clear-btn"
            type="button"
            onClick={() => {
              const tabName =
                activeLordTab === 'phub'
                  ? 'PHub 1'
                  : activeLordTab === 'phub2'
                    ? 'PHub 2'
                    : activeLordTab === 'phub3'
                      ? 'PHub 3'
                      : activeLordTab === 'jav'
                        ? 'JAV'
                        : 'Hentai'
              if (
                window.confirm(
                  `Permanently delete ${tabName} Continue Watching history? This cannot be recovered.`,
                )
              ) {
                onClearContinueWatching?.(activeLordTab)
              }
            }}
            title="Permanently clear Continue Watching history for this section"
            aria-label="Permanently clear Continue Watching history for this section"
            disabled={
              activeLordTab === 'jav'
                ? continueJavMovies.length === 0
                : activeLordTab === 'phub'
                  ? continuePhub1Movies.length === 0
                  : activeLordTab === 'phub2'
                    ? continuePhub2Movies.length === 0
                    : activeLordTab === 'phub3'
                      ? continuePhub3Movies.length === 0
                      : continueMovies.length === 0
            }
          >
            <Trash2 size={18} />
            <span>Clear History</span>
          </button>

          {(activeLordTab === 'phub' || activeLordTab === 'phub2' || activeLordTab === 'phub3') && isAdmin && (
            <button
              className={`lord-clear-btn lord-refresh-btn${isRefreshing ? ' is-refreshing' : ''}`}
              type="button"
              onClick={() => void handleAdminRefresh()}
              disabled={isRefreshing}
              title="Admin: Refresh Hero & Section videos for all users"
              aria-label="Refresh PHub videos for all users"
            >
              <RefreshCcw size={18} className={isRefreshing ? 'spin-icon' : ''} />
              <span>{isRefreshing ? 'Refreshing…' : 'Refresh Videos'}</span>
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
                    ? 'Search PHub 1 (4K)…'
                    : activeLordTab === 'phub2'
                      ? 'Search PHub 2 videos…'
                      : activeLordTab === 'phub3'
                        ? 'Search PHub 3 (Eporner)…'
                        : activeLordTab === 'jav'
                          ? 'Search JAV codes, titles…'
                          : 'Titles, genres…'
                }
                value={currentQuery}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                aria-label="Search titles"
              />
              {currentQuery && (
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

      {refreshNotice && (
        <div className="phub-refresh-toast" style={{ margin: '12px 24px 0' }} role="status">
          <Sparkles size={14} />
          <span>{refreshNotice}</span>
        </div>
      )}

      {activeLordTab === 'jav' ? (
        <LordJavSection
          searchQuery={tabQueries.jav}
          continueMovies={continueJavMovies}
          savedMovies={savedJavMovies}
          onPlay={onPlay}
          onMarkWatched={onMarkWatched}
          onRemoveContinue={onRemoveContinue}
          onRemoveWatchlist={onRemoveWatchlist}
        />
      ) : activeLordTab === 'phub' ? (
        <LordPhubSection
          key="phub-1"
          serverMode="pornapi"
          searchQuery={tabQueries.phub}
          continueMovies={continuePhub1Movies}
          savedMovies={savedPhub1Movies}
          currentUser={currentUser}
          phubSeed={phubSeed}
          onOpenDetail={onOpenDetail}
          onPlay={onPlay}
          onMarkWatched={onMarkWatched}
          onRemoveContinue={onRemoveContinue}
          onRemoveWatchlist={onRemoveWatchlist}
        />
      ) : activeLordTab === 'phub2' ? (
        <LordPhubSection
          key="phub-2"
          serverMode="xvidapi"
          searchQuery={tabQueries.phub2}
          continueMovies={continuePhub2Movies}
          savedMovies={savedPhub2Movies}
          currentUser={currentUser}
          phubSeed={phubSeed}
          onOpenDetail={onOpenDetail}
          onPlay={onPlay}
          onMarkWatched={onMarkWatched}
          onRemoveContinue={onRemoveContinue}
          onRemoveWatchlist={onRemoveWatchlist}
        />
      ) : activeLordTab === 'phub3' ? (
        <LordPhubSection
          key="phub-3"
          serverMode="eporner"
          searchQuery={tabQueries.phub3}
          continueMovies={continuePhub3Movies}
          savedMovies={savedPhub3Movies}
          currentUser={currentUser}
          phubSeed={phubSeed}
          onOpenDetail={onOpenDetail}
          onPlay={onPlay}
          onMarkWatched={onMarkWatched}
          onRemoveContinue={onRemoveContinue}
          onRemoveWatchlist={onRemoveWatchlist}
        />
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
          <div className="lord-hero">
            <div className="lord-hero-backdrop-wrap">
              <img
                className="lord-hero-bg"
                src={hero.hero || hero.still || hero.poster}
                alt={hero.title}
                onError={(event) => {
                  const target = event.target as HTMLImageElement
                  if (hero.poster && target.src !== hero.poster) {
                    target.src = hero.poster
                  }
                }}
              />
              <div className="lord-hero-gradient" />
            </div>
            <div className="lord-hero-content">
              <span className="lord-hero-badge">
                <Crown size={14} /> Spotlight
              </span>
              <h1 className="lord-hero-title">{hero.title}</h1>
              <p className="lord-hero-meta">
                {hero.year} · {hero.runtime || '18+'} · {hero.genres?.join(', ') || 'Adult'}
              </p>
              <p className="lord-hero-synopsis">{hero.synopsis}</p>
              <div className="lord-hero-actions">
                <button
                  className="lord-hero-play"
                  type="button"
                  onClick={() => onPlay(hero)}
                >
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

          {savedMovies && savedMovies.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <LordRailRow
                key="lord-my-list"
                rail={{
                  title: 'My List',
                  items: savedMovies,
                }}
                onOpenDetail={onOpenDetail}
              />
            </div>
          )}

          {continueMovies.length > 0 && onMarkWatched && onRemoveContinue && onRemoveWatchlist && (
            <div style={{ marginBottom: 24 }}>
              <ContinueWatchingRail
                title="Continue Watching"
                movies={continueMovies}
                onOpenDetail={onOpenDetail}
                onMarkWatched={onMarkWatched}
                onRemoveContinue={onRemoveContinue}
                onRemoveWatchlist={onRemoveWatchlist}
                isLordSection={true}
              />
            </div>
          )}

          <div className="lord-rails-list">
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
            <span>PHub 1</span>
          </button>
          <button
            className={`lord-mobile-nav-item${activeLordTab === 'phub2' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setActiveLordTab('phub2')}
          >
            <Code size={16} />
            <span>PHub 2</span>
          </button>
          <button
            className={`lord-mobile-nav-item${activeLordTab === 'phub3' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setActiveLordTab('phub3')}
          >
            <Code size={16} />
            <span>PHub 3</span>
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
  views?: number
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

const PHUB1_CATEGORIES: { name: string; slug: string }[] = [
  { name: 'All', slug: 'all' },
  { name: 'Amateur', slug: 'amateur' },
  { name: 'Anal', slug: 'anal' },
  { name: 'Asian', slug: 'asian' },
  { name: 'Babe', slug: 'babe' },
  { name: 'BBW', slug: 'bbw' },
  { name: 'Big Dick', slug: 'big-dick' },
  { name: 'Big Tits', slug: 'big-tits' },
  { name: 'Blowjob', slug: 'blowjob' },
  { name: 'Brunette', slug: 'brunette' },
  { name: 'Blonde', slug: 'blonde' },
  { name: 'Cosplay', slug: 'cosplay' },
  { name: 'Creampie', slug: 'creampie' },
  { name: 'Cumshot', slug: 'cumshot' },
  { name: 'Ebony', slug: 'ebony' },
  { name: 'Hardcore', slug: 'hardcore' },
  { name: 'HD', slug: 'hd' },
  { name: 'Interracial', slug: 'interracial' },
  { name: 'Japanese', slug: 'japanese' },
  { name: 'Latina', slug: 'latina' },
  { name: 'Lesbian', slug: 'lesbian' },
  { name: 'Masturbation', slug: 'masturbation' },
  { name: 'Mature', slug: 'mature' },
  { name: 'MILF', slug: 'milf' },
  { name: 'POV', slug: 'pov' },
  { name: 'Redhead', slug: 'redhead' },
  { name: 'Squirt', slug: 'squirt' },
  { name: 'Teen (18+)', slug: '18-teen' },
  { name: 'Threesome', slug: 'threesome' },
  { name: 'VR', slug: 'vr' },
]

const PHUB2_CATEGORIES: { name: string; slug: string }[] = [
  { name: 'All', slug: 'all' },
  { name: 'Teen', slug: 'teen' },
  { name: 'Femdom', slug: 'femdom' },
  { name: 'Latina', slug: 'latina' },
  { name: 'Cumshot', slug: 'cumshot' },
  { name: 'Amateur', slug: 'amateur' },
  { name: 'MILF', slug: 'milf' },
  { name: 'Asian Woman', slug: 'asian-woman' },
  { name: 'ASMR', slug: 'asmr' },
  { name: 'Japanese', slug: 'japanese' },
  { name: 'Lesbian', slug: 'lesbian' },
]

const PHUB3_CATEGORIES: { name: string; slug: string }[] = [
  { name: 'All', slug: 'all' },
  { name: 'Teen', slug: 'teen' },
  { name: 'Amateur', slug: 'amateur' },
  { name: 'Anal', slug: 'anal' },
  { name: 'Asian', slug: 'asian' },
  { name: 'Blowjob', slug: 'blowjob' },
  { name: 'Brunette', slug: 'brunette' },
  { name: 'Blonde', slug: 'blonde' },
  { name: 'Cosplay', slug: 'cosplay' },
  { name: 'Creampie', slug: 'creampie' },
  { name: 'Cumshot', slug: 'cumshot' },
  { name: 'Hardcore', slug: 'hardcore' },
  { name: 'HD', slug: 'hd-1080p' },
  { name: 'Japanese', slug: 'japanese' },
  { name: 'Latina', slug: 'latina' },
  { name: 'Lesbian', slug: 'lesbian' },
  { name: 'Masturbation', slug: 'masturbation' },
  { name: 'Mature', slug: 'mature' },
  { name: 'MILF', slug: 'milf' },
  { name: 'POV', slug: 'pov' },
  { name: 'Redhead', slug: 'redhead' },
  { name: 'Squirt', slug: 'squirt' },
  { name: 'Threesome', slug: 'threesome' },
  { name: 'VR', slug: 'vr' },
]

const PHUB_PAGE_SIZE = 24

function LordPhubSection({
  searchQuery = '',
  continueMovies = [],
  savedMovies = [],
  currentUser: _currentUser,
  phubSeed: phubSeedProp,
  onOpenDetail,
  onPlay,
  onMarkWatched,
  onRemoveContinue,
  onRemoveWatchlist,
  serverMode = 'pornapi',
}: {
  searchQuery?: string
  continueMovies?: Movie[]
  savedMovies?: Movie[]
  currentUser?: UserInfo | null
  phubSeed?: number
  onOpenDetail?: (movie: Movie) => void
  onPlay: (movie: Movie) => void
  onMarkWatched?: (movie: Movie) => void
  onRemoveContinue?: (movie: Movie) => void
  onRemoveWatchlist?: (movie: Movie) => void
  serverMode?: 'pornapi' | 'xvidapi' | 'eporner'
}) {
  const isXvid = serverMode === 'xvidapi'
  const isEporner = serverMode === 'eporner'
  const activeCategories = isEporner ? PHUB3_CATEGORIES : isXvid ? PHUB2_CATEGORIES : PHUB1_CATEGORIES

  const [localPhubSeed, setLocalPhubSeed] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('lumen_phub_seed')
      return stored ? Number(stored) || 0 : 0
    } catch {
      return 0
    }
  })

  // Synchronize global PHub refresh seed across all users on mount and window focus
  useEffect(() => {
    let active = true
    async function syncSeed() {
      const remoteSeed = await fetchGlobalPhubSeed()
      if (active && typeof remoteSeed === 'number' && remoteSeed > 0) {
        setLocalPhubSeed(remoteSeed)
        try {
          localStorage.setItem('lumen_phub_seed', String(remoteSeed))
        } catch {}
      }
    }
    void syncSeed()

    const onFocus = () => {
      void syncSeed()
    }
    window.addEventListener('focus', onFocus)
    const interval = setInterval(syncSeed, 30_000)

    return () => {
      active = false
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [])

  const phubSeed = typeof phubSeedProp === 'number' && phubSeedProp > 0 ? phubSeedProp : localPhubSeed

  const getInitialMovies = useCallback((): PornApiMovieItem[] => {
    if (isEporner) {
      return EPORNER_INITIAL_VIDEOS.map((item) => {
        const thumb = item.default_thumb?.src || item.thumbs?.[0]?.src || ''
        const rawKeywords = item.keywords ? item.keywords.split(',').map((k) => k.trim()).filter(Boolean) : []
        return {
          title: item.title,
          description: item.title,
          thumbnail_url: thumb,
          poster_url: thumb,
          slug: item.id,
          duration: item.length_min || 'HD',
          quality: 'HD',
          views: item.views || 50000,
          categories: rawKeywords.slice(0, 3).map((k) => ({ name: k, slug: k.toLowerCase().replace(/\s+/g, '-') })),
          episodes: [{ name: 'Full', slug: 'full', sources: [{ server_name: 'Eporner', embed_url: item.embed || `https://www.eporner.com/embed/${item.id}/` }] }],
        }
      })
    }
    return []
  }, [isEporner])

  const [pornMovies, setPornMovies] = useState<PornApiMovieItem[]>(() => {
    if (serverMode === 'eporner') {
      return EPORNER_INITIAL_VIDEOS.map((item) => {
        const thumb = item.default_thumb?.src || item.thumbs?.[0]?.src || ''
        const rawKeywords = item.keywords ? item.keywords.split(',').map((k) => k.trim()).filter(Boolean) : []
        return {
          title: item.title,
          description: item.title,
          thumbnail_url: thumb,
          poster_url: thumb,
          slug: item.id,
          duration: item.length_min || 'HD',
          quality: 'HD',
          views: item.views || 50000,
          categories: rawKeywords.slice(0, 3).map((k) => ({ name: k, slug: k.toLowerCase().replace(/\s+/g, '-') })),
          episodes: [{ name: 'Full', slug: 'full', sources: [{ server_name: 'Eporner', embed_url: item.embed || `https://www.eporner.com/embed/${item.id}/` }] }],
        }
      })
    }
    return []
  })
  const [loading, setLoading] = useState(serverMode !== 'eporner')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [orderBy, setOrderBy] = useState<'views' | 'date' | 'duration'>('views')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalVideos, setTotalVideos] = useState(serverMode === 'eporner' ? EPORNER_INITIAL_VIDEOS.length : 0)

  useEffect(() => {
    setPage(1)
    if (serverMode === 'eporner') {
      setPornMovies(getInitialMovies())
    }
  }, [serverMode, selectedCategory, orderBy, searchQuery, getInitialMovies])

  useEffect(() => {
    let active = true
    async function loadVideos() {
      if (pornMovies.length === 0) {
        setLoading(true)
      }
      try {
        if (isEporner) {
          const q = searchQuery.trim() || (selectedCategory === 'All' ? 'all' : selectedCategory)
          const order = orderBy === 'views' ? 'most-popular' : orderBy === 'date' ? 'latest' : 'top-weekly'
          const data = await fetchEpornerApi({
            query: q,
            page,
            per_page: PHUB_PAGE_SIZE,
            thumbsize: 'big',
            order,
            gay: 0,
            lq: 1,
          })
          if (active && data) {
            if (data.total_pages) {
              setTotalPages(Math.max(1, Number(data.total_pages) || 1))
            }
            if (data.total_count) {
              setTotalVideos(Number(data.total_count) || 0)
            }
            if (Array.isArray(data.videos) && data.videos.length > 0) {
              const parsed: PornApiMovieItem[] = data.videos.map((item: EpornerVideoItem) => {
                const thumb = item.default_thumb?.src || item.thumbs?.[0]?.src || ''
                const rawKeywords = item.keywords ? item.keywords.split(',').map((k) => k.trim()).filter(Boolean) : []
                return {
                  title: item.title,
                  description: item.title,
                  thumbnail_url: thumb,
                  poster_url: thumb,
                  slug: item.id,
                  duration: item.length_min || 'HD',
                  quality: 'HD',
                  views: item.views || 50000,
                  categories: rawKeywords.slice(0, 3).map((k) => ({ name: k, slug: k.toLowerCase().replace(/\s+/g, '-') })),
                  episodes: [{ name: 'Full', slug: 'full', sources: [{ server_name: 'Eporner', embed_url: item.embed || `https://www.eporner.com/embed/${item.id}/` }] }],
                }
              })
              setPornMovies(parsed)
              return
            }
          }
        }

        if (isXvid) {
          let url = `https://xvidapi.com/api.php/provide/vod?ac=detail&at=json&pg=${page}`
          if (searchQuery.trim()) {
            url += `&wd=${encodeURIComponent(searchQuery.trim())}`
          }
          const res = await fetch(url)
          if (res.ok) {
            const data = await res.json()
            if (active && data) {
              if (data.pagecount) {
                setTotalPages(Math.max(1, Number(data.pagecount) || 1))
              }
              if (data.total) {
                setTotalVideos(Number(data.total) || 0)
              }
              if (Array.isArray(data.list) && data.list.length > 0) {
                const parsed: PornApiMovieItem[] = data.list.map((item: any, idx: number) => {
                  const norm = normalizeVideoItem(item, idx)
                  return {
                    title: norm.title,
                    description: norm.description,
                    thumbnail_url: norm.thumb,
                    poster_url: norm.poster,
                    slug: String(norm.code || norm.id),
                    duration: norm.duration,
                    quality: 'HD',
                    views: 50000,
                    categories: [{ name: norm.category, slug: norm.category.toLowerCase().replace(/\s+/g, '-') }],
                    pornstars: norm.actors?.map((a: string) => ({ name: a, slug: a.toLowerCase().replace(/\s+/g, '-') })),
                    episodes: norm.embedUrl
                      ? [{ name: 'Full', slug: 'full', sources: [{ server_name: 'Upload18', embed_url: norm.embedUrl }] }]
                      : undefined,
                  }
                })
                setPornMovies(parsed)
                return
              }
            }
          }
        }

        const catObj = activeCategories.find((c) => c.name === selectedCategory)
        const catSlug = catObj ? catObj.slug : selectedCategory.toLowerCase().replace(/\s+/g, '-')

        let endpoint = '/movies'
        const params: Record<string, string | number> = {
          page,
          limit: PHUB_PAGE_SIZE,
        }

        if (catSlug && catSlug !== 'all') {
          endpoint = `/categories/${encodeURIComponent(catSlug)}/movies`
        }

        if (searchQuery.trim()) {
          const qSlug = searchQuery.trim().toLowerCase().replace(/\s+/g, '-')
          endpoint = '/movies/filter'
          params.categories = qSlug
        }

        const json = await fetchPornApi(endpoint, params)
        const payload = json?.data || json
        const list: PornApiMovieItem[] = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : []

        if (active) {
          if (payload?.totalPages) {
            setTotalPages(Math.max(1, Number(payload.totalPages) || 1))
          }
          if (payload?.total) {
            setTotalVideos(Number(payload.total) || list.length)
          }
          if (list.length > 0) {
            setPornMovies(list)
          } else if (searchQuery.trim()) {
            setPornMovies([])
          } else if (pornMovies.length === 0) {
            if (isEporner) {
              const fallbackEporner = getInitialMovies()
              setPornMovies(fallbackEporner)
              setTotalVideos(fallbackEporner.length)
              setTotalPages(1)
            } else {
              const fallbackPorn = INITIAL_HANIME_VIDEOS.map((v) => ({
                title: v.title,
                description: v.description,
                thumbnail_url: v.thumb,
                poster_url: v.poster || v.thumb,
                slug: String(v.id),
                duration: v.duration,
                quality: '4K',
                views: v.views || 45000,
                categories: [{ name: v.category, slug: v.category.toLowerCase().replace(/\s+/g, '-') }],
                pornstars: v.actors?.map((a) => ({ name: a, slug: a.toLowerCase().replace(/\s+/g, '-') })),
              }))
              setPornMovies(fallbackPorn)
              setTotalVideos(fallbackPorn.length)
              setTotalPages(1)
            }
          }
        }
      } catch {
        if (active && pornMovies.length === 0) {
          if (isEporner) {
            const fallbackEporner = getInitialMovies()
            setPornMovies(fallbackEporner)
            setTotalVideos(fallbackEporner.length)
            setTotalPages(1)
          } else {
            const fallbackPorn = INITIAL_HANIME_VIDEOS.map((v) => ({
              title: v.title,
              description: v.description,
              thumbnail_url: v.thumb,
              poster_url: v.poster || v.thumb,
              slug: String(v.id),
              duration: v.duration,
              quality: '4K',
              views: v.views || 45000,
              categories: [{ name: v.category, slug: v.category.toLowerCase().replace(/\s+/g, '-') }],
              pornstars: v.actors?.map((a) => ({ name: a, slug: a.toLowerCase().replace(/\s+/g, '-') })),
            }))
            setPornMovies(fallbackPorn)
            setTotalVideos(fallbackPorn.length)
            setTotalPages(1)
          }
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadVideos()
    return () => {
      active = false
    }
  }, [page, serverMode, selectedCategory, orderBy, searchQuery, isEporner, isXvid, activeCategories, getInitialMovies])

  const isSearching = Boolean(searchQuery.trim())

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.trim().toLowerCase()
    return pornMovies.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q)) ||
        (v.categories &&
          Array.isArray(v.categories) &&
          v.categories.some((c) =>
            typeof c === 'string'
              ? c.toLowerCase().includes(q)
              : c?.name?.toLowerCase().includes(q),
          )) ||
        (v.pornstars &&
          Array.isArray(v.pornstars) &&
          v.pornstars.some((p) =>
            typeof p === 'string'
              ? p.toLowerCase().includes(q)
              : p?.name?.toLowerCase().includes(q),
          )),
    )
  }, [pornMovies, searchQuery])

  const rotatedVideos = useMemo(() => {
    if (isSearching) return pornMovies
    const totalOffset = (getDailySeed() % 17) + 3 + (phubSeed % 97)
    return rotateByDailySeed(pornMovies, totalOffset)
  }, [pornMovies, isSearching, phubSeed])

  const displayVideos = isSearching
    ? (searchResults.length > 0 ? searchResults : pornMovies)
    : rotatedVideos

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

  const handlePlayMovie = async (movie: Movie) => {
    if (isEporner) {
      const cleanId = movie.hentaiSlug?.replace(/^phub3-|^phub2-|^phub-/, '') || movie.id.replace(/^phub3-|^phub2-|^phub-/, '')
      const embedUrl = movie.embedUrl || `https://www.eporner.com/embed/${cleanId}/`
      onPlay({ ...movie, embedUrl })
      return
    }
    if (movie.embedUrl) {
      onPlay(movie)
      return
    }
    try {
      const slug = movie.hentaiSlug?.replace(/^phub3-|^phub2-|^phub-/, '') || movie.id.replace(/^phub3-|^phub2-|^phub-/, '')
      const detail = await fetchPornApiMovieDetail(slug)
      const embedUrl =
        detail?.episodes?.[0]?.sources?.[0]?.embed_url ||
        detail?.episodes?.[0]?.sources?.[0]?.m3u8_url
      if (embedUrl) {
        onPlay({ ...movie, embedUrl })
      } else {
        onPlay(movie)
      }
    } catch {
      onPlay(movie)
    }
  }

  const handleOpenDetailMovie = async (movie: Movie) => {
    if (!onOpenDetail) {
      void handlePlayMovie(movie)
      return
    }
    if (isEporner) {
      const cleanId = movie.hentaiSlug?.replace(/^phub3-|^phub2-|^phub-/, '') || movie.id.replace(/^phub3-|^phub2-|^phub-/, '')
      const embedUrl = movie.embedUrl || `https://www.eporner.com/embed/${cleanId}/`
      onOpenDetail({ ...movie, embedUrl })
      return
    }
    if (movie.embedUrl) {
      onOpenDetail(movie)
      return
    }
    try {
      const slug = movie.hentaiSlug?.replace(/^phub3-|^phub2-|^phub-/, '') || movie.id.replace(/^phub3-|^phub2-|^phub-/, '')
      const detail = await fetchPornApiMovieDetail(slug)
      const embedUrl =
        detail?.episodes?.[0]?.sources?.[0]?.embed_url ||
        detail?.episodes?.[0]?.sources?.[0]?.m3u8_url
      if (embedUrl) {
        onOpenDetail({ ...movie, embedUrl })
      } else {
        onOpenDetail(movie)
      }
    } catch {
      onOpenDetail(movie)
    }
  }

  const heroItem = rotatedVideos.length > 0 ? rotatedVideos[0] : null
  const heroMovie = heroItem ? pornApiToMovieHelper(heroItem, undefined, serverMode) : null
  const totalDisplayCount = totalVideos > 0 ? totalVideos : displayVideos.length
  const sectionLabel = isEporner ? 'PHub 3' : isXvid ? 'PHub 2' : 'PHub 1'
  const sectionBadge = isEporner
    ? 'PHub 3 · Eporner HD'
    : isXvid
      ? 'PHub 2 · Upload18'
      : 'PHub 1 · Under Development'

  return (
    <div className="jav-container">
      {loading ? (
        <div className="jav-loading">
          <LoaderCircle className="spin-icon" size={32} />
          <p>Loading {sectionLabel} videos...</p>
        </div>
      ) : isSearching && displayVideos.length === 0 ? (
        <div className="jav-empty">
          <Search size={40} />
          <p>No videos found matching "{searchQuery.trim()}".</p>
        </div>
      ) : (
        <>
          {serverMode === 'pornapi' && (
            <div className="phub1-dev-notice" role="status">
              <div className="phub1-dev-badge">
                <Sparkles size={13} />
                <span>Under Development</span>
              </div>
              <p className="phub1-dev-text">
                <strong>PHub 1</strong> is currently under development while high-speed 4K streaming is being optimized. You can browse titles below, or switch to <strong>PHub 2</strong>, <strong>PHub 3</strong>, or <strong>JAV</strong> for full instant playback.
              </p>
            </div>
          )}

          {!isSearching && heroMovie && (
            <div className="lord-hero" style={{ marginBottom: 28 }}>
              <div className="lord-hero-backdrop-wrap">
                <img
                  className="lord-hero-bg"
                  src={heroMovie.hero || heroMovie.still || heroMovie.poster}
                  alt={heroMovie.title}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    if (heroMovie.poster && target.src !== heroMovie.poster) {
                      target.src = heroMovie.poster
                    }
                  }}
                />
                <div className="lord-hero-gradient" />
              </div>
              <div className="lord-hero-content">
                <span className="lord-hero-badge">
                  <Play size={14} fill="currentColor" /> {sectionBadge}
                </span>
                <h1 className="lord-hero-title">{heroMovie.title}</h1>
                <p className="lord-hero-meta">
                  {heroMovie.genres[0] || sectionLabel} · {heroMovie.runtime || (isXvid ? 'HD Video' : '4K Ultra HD')}
                </p>
                <p className="lord-hero-synopsis">{heroMovie.synopsis}</p>
                <div className="lord-hero-actions">
                  <button
                    className="lord-hero-play"
                    type="button"
                    onClick={() => void handlePlayMovie(heroMovie)}
                  >
                    <Play fill="currentColor" strokeWidth={0} size={20} />
                    <span>Play</span>
                  </button>
                  {onOpenDetail && (
                    <button
                      className="lord-hero-info"
                      type="button"
                      onClick={() => void handleOpenDetailMovie(heroMovie)}
                    >
                      <Info size={20} />
                      <span>More Info</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {savedMovies && savedMovies.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <LordRailRow
                key={`${isEporner ? 'phub3' : isXvid ? 'phub2' : 'phub1'}-my-list`}
                rail={{
                  title: 'My List',
                  items: savedMovies,
                }}
                onOpenDetail={(m) => void handleOpenDetailMovie(m)}
              />
            </div>
          )}

          {continueMovies.length > 0 && onMarkWatched && onRemoveContinue && onRemoveWatchlist && (
            <div style={{ marginBottom: 24 }}>
              <ContinueWatchingRail
                title={`Continue Watching ${sectionLabel}`}
                movies={continueMovies}
                onOpenDetail={(m) => void handlePlayMovie(m)}
                onMarkWatched={onMarkWatched}
                onRemoveContinue={onRemoveContinue}
                onRemoveWatchlist={onRemoveWatchlist}
                isPhub1Section={!isEporner && !isXvid}
                isPhub2Section={isXvid}
                isPhub3Section={isEporner}
                isPhubSection={true}
              />
            </div>
          )}

          {/* Category Pills & Controls Bar */}
          <div className="jav-controls">
            <div className="jav-pills" role="tablist" aria-label={`${sectionLabel} categories`}>
              {activeCategories.map((cat) => (
                <button
                  key={cat.slug}
                  type="button"
                  className={`jav-pill${selectedCategory === cat.name ? ' is-active' : ''}`}
                  onClick={() => setSelectedCategory(cat.name)}
                >
                  {cat.name}
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
                className={`jav-sort-btn${orderBy === 'duration' ? ' is-active' : ''}`}
                onClick={() => setOrderBy('duration')}
              >
                {isXvid ? 'Top Rated' : 'Top 4K'}
              </button>
            </div>
          </div>

          <div className="jav-meta-header">
            <h2 className="lord-rail-title">
              {isSearching
                ? `Search Results for "${searchQuery.trim()}"`
                : selectedCategory === 'All'
                  ? `All ${sectionLabel} Catalog`
                  : `${selectedCategory} (${sectionLabel})`}
              <span className="jav-meta-count">
                ({totalDisplayCount.toLocaleString()} titles)
              </span>
            </h2>
          </div>

          <div className="jav-grid">
            {displayVideos.map((video, idx) => {
              const movie = pornApiToMovieHelper(video, undefined, serverMode)
              const firstCat = movie.genres[0] || 'PHub'
              return (
                <div
                  key={`phub-${video.slug || idx}`}
                  className="jav-card"
                  onClick={() => void handlePlayMovie(movie)}
                >
                  <div className="jav-thumb-container">
                    <img
                      src={video.thumbnail_url || video.poster_url || ''}
                      referrerPolicy="no-referrer"
                      alt={video.title}
                      loading="lazy"
                      onError={(event) => {
                        const target = event.target as HTMLImageElement
                        target.onerror = null
                        target.src =
                          'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=80'
                      }}
                    />
                    <span className="jav-hd-badge">{video.quality || '4K'}</span>
                    {video.duration && (
                      <span className="jav-duration-badge">{video.duration}</span>
                    )}
                    <div className="jav-play-overlay">
                      <button
                        type="button"
                        className="jav-play-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handlePlayMovie(movie)
                        }}
                        title="Play Video"
                      >
                        <Play fill="#fff" size={24} />
                      </button>
                    </div>
                  </div>
                  <div className="jav-card-body">
                    <h3 className="jav-card-title" title={video.title}>
                      {cleanHtmlEntities(video.title)}
                    </h3>
                    <div className="jav-card-footer">
                      <span className="jav-studio">{cleanHtmlEntities(firstCat)}</span>
                      {video.views ? (
                        <span className="jav-views">👁 {video.views.toLocaleString()}</span>
                      ) : null}
                    </div>
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
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
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
  embedUrl?: string
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
  continueMovies = [],
  savedMovies = [],
  onPlay,
  onMarkWatched,
  onRemoveContinue,
  onRemoveWatchlist,
}: {
  searchQuery?: string
  continueMovies?: Movie[]
  savedMovies?: Movie[]
  onPlay: (movie: Movie) => void
  onMarkWatched?: (movie: Movie) => void
  onRemoveContinue?: (movie: Movie) => void
  onRemoveWatchlist?: (movie: Movie) => void
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

  const rotatedPosts = useMemo(() => {
    if (searchQuery.trim()) return posts
    return rotateByDailySeed(posts, (getDailySeed() % 13) + 5)
  }, [posts, searchQuery])

  const heroPost = rotatedPosts.length > 0 ? rotatedPosts[0] : null
  const heroMovie = heroPost ? javToMovieHelper(heroPost) : null

  return (
    <div className="jav-container">
      {!searchQuery.trim() && heroMovie && (
        <div className="lord-hero" style={{ marginBottom: 28 }}>
          <div className="lord-hero-backdrop-wrap">
            <img
              className="lord-hero-bg"
              src={heroMovie.hero || heroMovie.still || heroMovie.poster}
              alt={heroMovie.title}
              onError={(e) => {
                const target = e.target as HTMLImageElement
                if (heroMovie.poster && target.src !== heroMovie.poster) {
                  target.src = heroMovie.poster
                }
              }}
            />
            <div className="lord-hero-gradient" />
          </div>
          <div className="lord-hero-content">
            <span className="lord-hero-badge">
              <Play size={14} fill="currentColor" /> JAV {heroPost?.is_hd ? 'HD' : 'Exclusive'}
            </span>
            <h1 className="lord-hero-title">{heroMovie.title}</h1>
            <p className="lord-hero-meta">
              {heroPost?.code ? `${heroPost.code} · ` : ''}{heroPost?.studio || 'JAV'} · {heroPost?.duration || 'Full Video'}
            </p>
            <p className="lord-hero-synopsis">{heroMovie.synopsis}</p>
            <div className="lord-hero-actions">
              <button className="lord-hero-play" type="button" onClick={() => onPlay(heroMovie)}>
                <Play fill="currentColor" strokeWidth={0} size={20} />
                <span>Play</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {savedMovies && savedMovies.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <LordRailRow
            key="jav-my-list"
            rail={{
              title: 'My List',
              items: savedMovies,
            }}
            onOpenDetail={onPlay}
          />
        </div>
      )}

      {continueMovies.length > 0 && onMarkWatched && onRemoveContinue && onRemoveWatchlist && (
        <div style={{ marginBottom: 24 }}>
          <ContinueWatchingRail
            title="Continue Watching JAV"
            movies={continueMovies}
            onOpenDetail={onPlay}
            onMarkWatched={onMarkWatched}
            onRemoveContinue={onRemoveContinue}
            onRemoveWatchlist={onRemoveWatchlist}
            isJavSection={true}
          />
        </div>
      )}
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
            {rotatedPosts.map((post) => {
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

  const profileList = Array.isArray(profiles) ? profiles : []
  const otherProfiles = profileList.filter(
    (profile) => profile && profile.name && profile.name.toLowerCase() !== (currentUser?.name ?? '').toLowerCase(),
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
              <span className="profile-menu-name">{currentUser?.name || 'Account'}</span>
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
