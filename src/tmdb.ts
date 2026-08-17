import type { MediaCollection, Movie } from './omdb'

export type TmdbMediaType = 'movie' | 'tv'

export type TmdbMatch = {
  tmdbId: number
  mediaType: TmdbMediaType
  title?: string
}

export type StreamProvider =
  | 'filmu'
  | 'nhdapi'
  | 'yenime'
  | 'rivestream'
  | 'vidsync'
  | 'multiembed-vip'
  | 'vidking'
  | 'megaplay'
  | 'megabuzz'
  | 'oceanplay'
  | 'apijav'
  | 'phubplay'

export type StreamProviderOption = {
  id: StreamProvider
  name: string
  logo: string
  description: string
}

type TmdbResponse = {
  Response?: string
  Error?: string
  tmdbId?: number
  mediaType?: TmdbMediaType
  title?: string
}

export type TmdbWatchProvider = {
  displayPriority: number
  id: string
  link?: string
  logoPath: string
  logoUrl: string
  name: string
  type: 'flatrate' | 'free' | 'ads' | 'rent' | 'buy'
}

export type TmdbWatchAvailability = {
  link: string
  providers: TmdbWatchProvider[]
  region: string
  source?: 'TMDB' | 'Watchmode'
}

export type CastCrewMember = {
  id: string
  imageUrl: string
  name: string
  role: string
  type: 'Cast' | 'Crew'
}

export type TmdbHomeRails = {
  featuredMovies: Movie[]
  featuredTvShows: Movie[]
  movieCollection: MediaCollection
  newReleases: Movie[]
  trendingNow: Movie[]
  tvShowCollection: MediaCollection
}

type TmdbWatchResponse = {
  Response?: string
  Error?: string
  link?: string
  providers?: TmdbWatchProvider[]
  region?: string
  source?: 'TMDB' | 'Watchmode'
}

type TmdbHomeRailsResponse = {
  Response?: string
  Error?: string
  featuredMovies?: Movie[]
  featuredTvShows?: Movie[]
  movieCollection?: MediaCollection
  newReleases?: Movie[]
  trendingNow?: Movie[]
  tvShowCollection?: MediaCollection
}

type CastCrewResponse = {
  Response?: string
  Error?: string
  members?: CastCrewMember[]
}

const streamTheme = '47A8FF'
const defaultWatchRegion = 'IN'
const superEmbedVipPreferredServer = '25'

const emptyMediaCollection: MediaCollection = {
  adventure: [],
  kidsFamily: [],
  thrilling: [],
  top: [],
}

export const defaultStreamProvider: StreamProvider = 'rivestream'

export const streamProviderOptions: StreamProviderOption[] = [
  {
    id: 'filmu',
    name: 'Filmu',
    logo: 'FM',
    description: 'Movies, TV & Anime',
  },
  {
    id: 'nhdapi',
    name: 'NHD Stream',
    logo: 'NHD',
    description: 'Ad-Free · Movies, TV & Anime',
  },
  {
    id: 'yenime',
    name: 'Yenime',
    logo: 'YN',
    description: 'Anime · MAL ID',
  },
  {
    id: 'vidking',
    name: 'Vidking',
    logo: 'VK',
    description: 'HLS player · TMDB',
  },
  {
    id: 'rivestream',
    name: 'Rivestream',
    logo: 'RS',
    description: 'New server',
  },
  {
    id: 'vidsync',
    name: 'Old Server',
    logo: 'VS',
    description: 'With ads',
  },
  {
    id: 'multiembed-vip',
    name: 'VIP Server',
    logo: 'VIP',
    description: 'Local player',
  },
  {
    id: 'megaplay',
    name: 'VidNest',
    logo: 'VN',
    description: 'Anime · AniList',
  },
  {
    id: 'megabuzz',
    name: 'MegaPlay',
    logo: 'MP',
    description: 'Anime · AniList',
  },
  {
    id: 'oceanplay',
    name: 'OceanPlay',
    logo: 'OP',
    description: 'Hentai Ocean · Stream',
  },
  {
    id: 'apijav',
    name: 'apiJAV',
    logo: 'JAV',
    description: 'apiJAV Server · Stream',
  },
  {
    id: 'phubplay',
    name: 'PHub Stream',
    logo: 'PH',
    description: 'PHub Server · Stream',
  },
]

const fallbackTmdbMatches: Record<string, TmdbMatch> = {
  tt1375666: { tmdbId: 27205, mediaType: 'movie', title: 'Inception' },
  tt0816692: { tmdbId: 157336, mediaType: 'movie', title: 'Interstellar' },
  tt0111161: {
    tmdbId: 278,
    mediaType: 'movie',
    title: 'The Shawshank Redemption',
  },
  tt0468569: { tmdbId: 155, mediaType: 'movie', title: 'The Dark Knight' },
  tt0133093: { tmdbId: 603, mediaType: 'movie', title: 'The Matrix' },
  tt0109830: { tmdbId: 13, mediaType: 'movie', title: 'Forrest Gump' },
  tt0110912: { tmdbId: 680, mediaType: 'movie', title: 'Pulp Fiction' },
  tt4154796: {
    tmdbId: 299534,
    mediaType: 'movie',
    title: 'Avengers: Endgame',
  },
  tt1745960: { tmdbId: 361743, mediaType: 'movie', title: 'Top Gun: Maverick' },
  tt0068646: { tmdbId: 238, mediaType: 'movie', title: 'The Godfather' },
  tt0944947: { tmdbId: 1399, mediaType: 'tv', title: 'Game of Thrones' },
  tt0903747: { tmdbId: 1396, mediaType: 'tv', title: 'Breaking Bad' },
  tt4574334: { tmdbId: 66732, mediaType: 'tv', title: 'Stranger Things' },
  tt1475582: { tmdbId: 19885, mediaType: 'tv', title: 'Sherlock' },
  tt0108778: { tmdbId: 1668, mediaType: 'tv', title: 'Friends' },
  tt7366338: { tmdbId: 87108, mediaType: 'tv', title: 'Chernobyl' },
  tt3032476: { tmdbId: 60059, mediaType: 'tv', title: 'Better Call Saul' },
  tt1520211: { tmdbId: 1402, mediaType: 'tv', title: 'The Walking Dead' },
  tt2861424: { tmdbId: 60625, mediaType: 'tv', title: 'Rick and Morty' },
  tt0413573: { tmdbId: 1416, mediaType: 'tv', title: "Grey's Anatomy" },
}

export async function fetchTmdbMatch(
  identifier: string,
  isTitle = false,
  mediaHint?: 'movie' | 'tv',
): Promise<TmdbMatch> {
  const params = new URLSearchParams()
  if (isTitle || (!identifier.startsWith('tt') && isNaN(Number(identifier)))) {
    params.set('title', identifier)
  } else {
    params.set('imdbId', identifier)
  }

  if (mediaHint) {
    params.set('type', mediaHint)
  }

  const fallbackMatch = fallbackTmdbMatches[identifier]

  if (fallbackMatch) {
    return fallbackMatch
  }

  try {
    const response = await fetch(`/api/tmdb?${params}`)
    const body = (await response.json()) as TmdbResponse

    if (!response.ok || body.Response === 'False') {
      if (fallbackMatch) {
        return fallbackMatch
      }

      throw new Error(body.Error ?? 'Could not resolve TMDB id.')
    }

    if (!body.tmdbId || !body.mediaType) {
      if (fallbackMatch) {
        return fallbackMatch
      }

      throw new Error('TMDB response did not include a playable id.')
    }

    return {
      tmdbId: body.tmdbId,
      mediaType: body.mediaType,
      title: body.title,
    }
  } catch (error) {
    if (fallbackMatch) {
      return fallbackMatch
    }

    throw error
  }
}

export async function fetchTmdbWatchAvailability(
  movie:
    | string
    | {
        imdbId?: string
        mediaType?: TmdbMediaType
        tmdbId?: number
      },
  region = defaultWatchRegion,
): Promise<TmdbWatchAvailability> {
  const params = new URLSearchParams({ region })

  if (typeof movie === 'string') {
    params.set('imdbId', movie)
  } else {
    if (movie.imdbId) {
      params.set('imdbId', movie.imdbId)
    }

    if (movie.tmdbId && movie.mediaType) {
      params.set('tmdbId', String(movie.tmdbId))
      params.set('mediaType', movie.mediaType)
    }
  }

  try {
    const response = await fetch(`/api/tmdb-watch-providers?${params}`)
    const body = (await response.json()) as TmdbWatchResponse

    if (!response.ok || body.Response === 'False') {
      throw new Error(body.Error ?? 'Could not load TMDB watch providers.')
    }

    return {
      link: body.link ?? '',
      providers: body.providers ?? [],
      region: body.region ?? region,
      source: body.source,
    }
  } catch {
    return {
      link: '',
      providers: [],
      region,
    }
  }
}

export async function fetchWatchmodeCastCrew(
  movie: {
    imdbId?: string
    mediaType?: TmdbMediaType
    tmdbId?: number
  },
): Promise<CastCrewMember[]> {
  const params = new URLSearchParams()

  if (movie.imdbId) {
    params.set('imdbId', movie.imdbId)
  }

  if (movie.tmdbId && movie.mediaType) {
    params.set('tmdbId', String(movie.tmdbId))
    params.set('mediaType', movie.mediaType)
  }

  if (!params.size) {
    return []
  }

  try {
    const response = await fetch(`/api/watchmode-cast-crew?${params}`)
    const body = (await response.json()) as CastCrewResponse

    if (!response.ok || body.Response === 'False') {
      throw new Error(body.Error ?? 'Could not load cast and crew.')
    }

    return body.members ?? []
  } catch {
    return []
  }
}

export async function fetchTmdbHomeRails(
  region = defaultWatchRegion,
): Promise<TmdbHomeRails> {
  const params = new URLSearchParams({
    day: new Date().toISOString().slice(0, 10),
    region,
  })

  try {
    const response = await fetch(`/api/tmdb-home-rails?${params}`)
    const body = (await response.json()) as TmdbHomeRailsResponse

    if (!response.ok || body.Response === 'False') {
      throw new Error(body.Error ?? 'Could not load TMDB home rails.')
    }

    return {
      featuredMovies: body.featuredMovies ?? [],
      featuredTvShows: body.featuredTvShows ?? [],
      movieCollection: body.movieCollection ?? emptyMediaCollection,
      newReleases: body.newReleases ?? [],
      trendingNow: body.trendingNow ?? [],
      tvShowCollection: body.tvShowCollection ?? emptyMediaCollection,
    }
  } catch {
    return {
      featuredMovies: [],
      featuredTvShows: [],
      movieCollection: emptyMediaCollection,
      newReleases: [],
      trendingNow: [],
      tvShowCollection: emptyMediaCollection,
    }
  }
}

function buildVidsyncUrl(movie: Movie) {
  if (movie.tmdbType === 'tv') {
    const season = movie.streamSeason ?? 1
    const episode = movie.streamEpisode ?? 1
    const params = new URLSearchParams({
      autoPlay: 'true',
      autoNext: 'true',
      nextButton: 'true',
      theme: streamTheme,
    })

    return `https://vidsrc.pm/embed/tv/${movie.tmdbId}/${season}/${episode}?${params}`
  }

  const params = new URLSearchParams({
    autoPlay: 'true',
    theme: streamTheme,
  })

  return `https://vidsrc.pm/embed/movie/${movie.tmdbId}?${params}`
}


function buildRivestreamUrl(movie: Movie) {
  const params = new URLSearchParams({
    type: movie.tmdbType === 'tv' ? 'tv' : 'movie',
    id: String(movie.tmdbId),
  })

  if (movie.tmdbType === 'tv') {
    params.set('season', String(movie.streamSeason ?? 1))
    params.set('episode', String(movie.streamEpisode ?? 1))
  }

  return `https://www.rivestream.app/embed?${params}`
}

function buildSuperEmbedPlayerUrl(movie: Movie, preferredServer = '0') {
  const params = new URLSearchParams()

  if (movie.tmdbId) {
    params.set('video_id', String(movie.tmdbId))
    params.set('tmdb', '1')
  } else if (movie.id.startsWith('tt')) {
    params.set('video_id', movie.id)
  } else {
    return ''
  }

  if (movie.tmdbType === 'tv') {
    params.set('s', String(movie.streamSeason ?? 1))
    params.set('e', String(movie.streamEpisode ?? 1))
  }

  params.set('preferred_server', preferredServer)

  return `/se_player.php?${params}`
}

export const DEFAULT_NHD_API_KEYS: string[] = [
  '0199408580445829daf06ffd9a18837d0ea05f3f1ba3e04b',
  '5aff87af6a0fb36e538cf65695f9e044f1130a7cf1234401',
  'b3ee52b1b9fc1fa964fd93a1ce448323bc79dd79b57aecf3',
  '82430d4ced4d3231dceff831d8a84dcb370f2ccdd2deecf0',
  'b4e96a06d05f6913e34da245f56ae80943b76fb902219797',
  '06f9331a602e176c56a3adc7b634d93954bed52798627895',
  '52a1db710752fa558f4d7b3bd97d54ca618247079f3ea6f1',
  'e43ef3e1a91882ff6060185c5255949f7bca24d4b12f81bd',
  '44999a0868d7b24a08c156bcef9760d48acb000edec16d65',
  '23355ed9a4fd13f8bfca53f87846fa1b3b1b457f595ee2ca',
  '6441039ee184801c162d113d965f1a6f90b247613365d36a',
  'b0f2397f0dde59f58ee5b9a25ecea1da7fb7c0ec8929677d',
  '04f927103a8a7730a5a0ca2d1450a750769fd613e5f4f9b6',
]

let nhdKeyIndex = 0

export function getNhdApiKey(): string {
  const envKeysRaw =
    (typeof import.meta !== 'undefined' &&
      (import.meta.env?.VITE_NHD_API_KEYS ||
        import.meta.env?.VITE_NHD_API_KEY ||
        import.meta.env?.NHD_API_KEYS ||
        import.meta.env?.NHD_API_KEY)) ||
    ''

  const envKeys = envKeysRaw
    ? envKeysRaw
        .split(',')
        .map((k: string) => k.trim())
        .filter(Boolean)
    : []

  const pool = envKeys.length > 0 ? envKeys : DEFAULT_NHD_API_KEYS
  const key = pool[nhdKeyIndex % pool.length]
  nhdKeyIndex = (nhdKeyIndex + 1) % pool.length
  return key
}

export const NHD_API_KEY = DEFAULT_NHD_API_KEYS[0]

function buildNhdUrl(movie: Movie): string {
  const apiKey = getNhdApiKey()
  const keyParam = apiKey ? `?key=${encodeURIComponent(apiKey)}` : ''

  // 1. Anime with AniList ID
  if (movie.anilistId) {
    const episode = movie.streamEpisode ?? 1
    return `https://nhdapi.com/anime/${encodeURIComponent(movie.anilistId)}/${episode}${keyParam}`
  }

  // 2. TV Show (TMDB / IMDb)
  const isTv =
    movie.tmdbType === 'tv' ||
    movie.type === 'series' ||
    Boolean(movie.streamSeason && movie.streamSeason > 0)
  const mediaId = movie.tmdbId
    ? String(movie.tmdbId)
    : movie.id && movie.id.startsWith('tt')
      ? movie.id
      : ''

  if (isTv && mediaId) {
    const season = movie.streamSeason ?? 1
    const episode = movie.streamEpisode ?? 1
    return `https://nhdapi.com/tv/${encodeURIComponent(mediaId)}/${season}/${episode}${keyParam}`
  }

  // 3. Movie (TMDB / IMDb)
  if (mediaId) {
    return `https://nhdapi.com/movie/${encodeURIComponent(mediaId)}${keyParam}`
  }

  return ''
}

function buildYenimeUrl(movie: Movie): string {
  const malId = movie.malId || (movie.anilistId ? movie.anilistId : '')
  if (!malId) return ''
  const episode = movie.streamEpisode ?? 1
  return `https://api.yenime.net/anime/${encodeURIComponent(malId)}/${episode}?autoplay=true&color=e50914`
}

function buildFilmuUrl(movie: Movie): string {
  // 1. Anime with AniList ID
  if (movie.anilistId) {
    const season = movie.streamSeason ?? 1
    const episode = movie.streamEpisode ?? 1
    return `https://embed.filmu.in/anime/${encodeURIComponent(movie.anilistId)}/${season}/${episode}`
  }

  // 2. TV Show (TMDB / IMDb)
  const isTv =
    movie.tmdbType === 'tv' ||
    movie.type === 'series' ||
    Boolean(movie.streamSeason && movie.streamSeason > 0)
  const mediaId = movie.tmdbId
    ? String(movie.tmdbId)
    : movie.id && movie.id.startsWith('tt')
      ? movie.id
      : ''

  if (isTv && mediaId) {
    const season = movie.streamSeason ?? 1
    const episode = movie.streamEpisode ?? 1
    return `https://embed.filmu.in/tv/${encodeURIComponent(mediaId)}/${season}/${episode}`
  }

  // 3. Movie (TMDB / IMDb)
  if (mediaId) {
    return `https://embed.filmu.in/movie/${encodeURIComponent(mediaId)}`
  }

  return ''
}

export type SeasonEpisode = {
  number: number
  name: string
  overview: string
  still: string
  runtime: string
  airDate?: string
}

export async function fetchSeasonEpisodes(
  tmdbId: number,
  season: number,
): Promise<SeasonEpisode[]> {
  try {
    const response = await fetch(`/api/tmdb-episodes?tmdbId=${tmdbId}&season=${season}`)
    const body = (await response.json()) as { Response?: string; episodes?: SeasonEpisode[] }

    if (!response.ok || body.Response === 'False') {
      return []
    }

    return body.episodes ?? []
  } catch {
    return []
  }
}

export type TvSeasonInfo = {
  season: number
  episodeCount: number
}

/** Accurate season list for a TV id (from TMDB) so the season dropdown and
 * per-season episode counts are real, not guessed. */
export async function fetchTvSeasons(tmdbId: number): Promise<TvSeasonInfo[]> {
  try {
    const response = await fetch(`/api/tmdb-episodes?action=seasons&tmdbId=${tmdbId}`)
    const body = (await response.json()) as {
      Response?: string
      seasons?: TvSeasonInfo[]
    }

    if (!response.ok || body.Response === 'False') {
      return []
    }

    return body.seasons ?? []
  } catch {
    return []
  }
}

export type DramaRails = {
  kDrama: Movie[]
  cDrama: Movie[]
  newReleases: Movie[]
  romCom: Movie[]
}

const emptyDramaRails: DramaRails = {
  kDrama: [],
  cDrama: [],
  newReleases: [],
  romCom: [],
}

// Full-catalog TMDB title search (movies + TV). Results carry a tmdbId (no
// AniList id), so they play through the TMDB player.
export async function searchTmdb(query: string): Promise<Movie[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }
  try {
    const response = await fetch(
      `/api/tmdb-drama?action=search&query=${encodeURIComponent(trimmed)}`,
    )
    const body = (await response.json()) as { Response?: string; results?: Movie[] }
    if (!response.ok || body.Response === 'False') {
      return []
    }
    return body.results ?? []
  } catch {
    return []
  }
}

// Content for the PIN-locked "Lord" profile — a mature ADULT-ANIMATION theme
// (non-explicit) built from TMDB's animation catalog. Returns a hero-friendly
// flat list plus categorized rails.
export type LordRail = { title: string; items: Movie[] }

export async function fetchMatureCollection(): Promise<{
  movies: Movie[]
  rails: LordRail[]
}> {
  try {
    const response = await fetch('/api/tmdb-drama?action=mature')
    const body = (await response.json()) as {
      Response?: string
      results?: Movie[]
      rails?: LordRail[]
    }
    if (!response.ok || body.Response === 'False') {
      return { movies: [], rails: [] }
    }
    // Guard against a non-array rails shape (e.g. the drama endpoint's object).
    const rails = Array.isArray(body.rails) ? body.rails : []
    return { movies: body.results ?? [], rails }
  } catch {
    return { movies: [], rails: [] }
  }
}

export async function fetchKoreanChineseDramas(): Promise<{
  list: Movie[]
  rails: DramaRails
}> {
  try {
    const response = await fetch('/api/tmdb-drama')
    const body = (await response.json()) as {
      Response?: string
      results?: Movie[]
      rails?: DramaRails
    }

    if (!response.ok || body.Response === 'False') {
      return { list: [], rails: emptyDramaRails }
    }

    return { list: body.results ?? [], rails: body.rails ?? emptyDramaRails }
  } catch {
    return { list: [], rails: emptyDramaRails }
  }
}

export function buildStreamUrl(
  movie: Movie,
  provider: StreamProvider = defaultStreamProvider,
) {
  if (movie.isHentaiOcean || movie.hentaiSlug || movie.embedUrl) {
    let rawUrl = ''
    if (movie.hentaiEpisodes && movie.hentaiEpisodes.length > 0) {
      const targetEpNum = movie.streamEpisode ?? 1
      const targetEp =
        movie.hentaiEpisodes.find((ep) => ep.episodeNumber === targetEpNum) ||
        movie.hentaiEpisodes[0]
      if (targetEp?.embedUrl) {
        rawUrl = targetEp.embedUrl
      }
    }
    if (!rawUrl && movie.embedUrl) {
      rawUrl = movie.embedUrl
    }
    if (!rawUrl) {
      const slug = movie.hentaiSlug || movie.id.replace(/^hentaiocean-/, '')
      rawUrl = `https://hentaiocean.com/embed/${slug}?la=1`
    }

    if (movie.isJav || rawUrl.includes('apijav.com')) {
      return rawUrl
    }

    const laValue = movie.streamLanguage === 'dub' ? '2' : '1'
    if (rawUrl.includes('la=')) {
      return rawUrl.replace(/la=[^&]+/, `la=${laValue}`)
    }
    const separator = rawUrl.includes('?') ? '&' : '?'
    return `${rawUrl}${separator}la=${laValue}`
  }

  if (provider === 'megaplay' || provider === 'megabuzz') {
    // AniList-native anime servers (the app carries no HiAnime/TMDB id for
    // anime), both sub/dub aware and keyed by the AniList id + episode:
    //   MegaPlay -> https://vidnest.fun/anime/{anilistId}/{ep}/{sub|dub}
    //   MegaBuzz -> https://megaplay.buzz/stream/ani/{anilistId}/{ep}/{sub|dub}
    // MegaBuzz needs a referer (see the iframe's referrerPolicy in WatchScreen).
    if (!movie.anilistId) {
      return ''
    }
    const ep = movie.streamEpisode ?? 1
    const language = movie.streamLanguage === 'dub' ? 'dub' : 'sub'
    return provider === 'megabuzz'
      ? `https://megaplay.buzz/stream/ani/${movie.anilistId}/${ep}/${language}`
      : `https://vidnest.fun/anime/${movie.anilistId}/${ep}/${language}`
  }

  if (provider === 'filmu') {
    return buildFilmuUrl(movie)
  }

  if (provider === 'nhdapi') {
    return buildNhdUrl(movie)
  }

  if (provider === 'yenime') {
    return buildYenimeUrl(movie)
  }

  if (!movie.tmdbId) {
    return ''
  }

  if (provider === 'vidking') {
    // Vidking uses the TMDB id (resolved via the TMDB proxy) for both movies
    // and series. Anime that matches a TMDB tv/movie entry plays here too.
    const color = 'e50914'

    if (movie.tmdbType === 'tv') {
      const season = movie.streamSeason ?? 1
      const episode = movie.streamEpisode ?? 1
      return `https://www.vidking.net/embed/tv/${movie.tmdbId}/${season}/${episode}?color=${color}&autoPlay=true&nextEpisode=true&episodeSelector=true`
    }

    return `https://www.vidking.net/embed/movie/${movie.tmdbId}?color=${color}&autoPlay=true`
  }

  if (provider === 'multiembed-vip') {
    return buildSuperEmbedPlayerUrl(movie, superEmbedVipPreferredServer)
  }

  if (provider === 'vidsync') {
    return buildVidsyncUrl(movie)
  }

  return buildRivestreamUrl(movie)
}
