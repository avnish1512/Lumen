import type { Movie } from './omdb'

export type TmdbMediaType = 'movie' | 'tv'

export type TmdbMatch = {
  tmdbId: number
  mediaType: TmdbMediaType
  title?: string
}

export type StreamProvider = 'rivestream' | 'vidsync'

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

const streamTheme = '47A8FF'

export const defaultStreamProvider: StreamProvider = 'rivestream'

export const streamProviderOptions: StreamProviderOption[] = [
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

export async function fetchTmdbMatch(imdbId: string): Promise<TmdbMatch> {
  const params = new URLSearchParams({ imdbId })
  const fallbackMatch = fallbackTmdbMatches[imdbId]

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

    return `https://vidsync.xyz/embed/tv/${movie.tmdbId}/${season}/${episode}?${params}`
  }

  const params = new URLSearchParams({
    autoPlay: 'true',
    theme: streamTheme,
  })

  return `https://vidsync.xyz/embed/movie/${movie.tmdbId}?${params}`
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

export function buildStreamUrl(
  movie: Movie,
  provider: StreamProvider = defaultStreamProvider,
) {
  if (!movie.tmdbId) {
    return ''
  }

  if (provider === 'vidsync') {
    return buildVidsyncUrl(movie)
  }

  return buildRivestreamUrl(movie)
}
