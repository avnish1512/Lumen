import { describe, expect, it } from 'vitest'
import {
  buildAutoEmbedUrl,
  buildEmbedWaveUrl,
  buildStreamUrl,
  buildVidCoreUrl,
  buildVidSrcBuzzUrl,
  buildVSEmbedUrl,
  isStreamProvider,
  streamProviderOptions,
} from './tmdb'
import type { Movie } from './omdb'

describe('New streaming servers integration (VidCore, AutoEmbed, VSEmbed, VidSrc Buzz)', () => {
  const sampleMovie: Movie = {
    id: 'movie-359410',
    tmdbId: 359410,
    tmdbType: 'movie',
    rank: 1,
    title: 'Road House',
    logoTitle: 'Road House',
    label: 'Feature Film',
    type: 'Movie',
    genres: ['Action', 'Thriller'],
    year: '2024',
    runtime: '121 min',
    rating: '6.2',
    maturity: 'R',
    progress: 0,
    hero: '',
    poster: '',
    still: '',
    synopsis: 'Ex-UFC fighter Dalton takes a job as a bouncer.',
    cast: [],
    director: 'Doug Liman',
    awards: '',
    boxOffice: '',
    ratings: [],
  }

  const imdbMovie: Movie = {
    id: 'tt3359350',
    tmdbType: 'movie',
    rank: 2,
    title: 'The Meg',
    logoTitle: 'The Meg',
    label: 'Feature Film',
    type: 'Movie',
    genres: ['Action', 'Sci-Fi'],
    year: '2018',
    runtime: '113 min',
    rating: '5.7',
    maturity: 'PG-13',
    progress: 0,
    hero: '',
    poster: '',
    still: '',
    synopsis: 'A deep-sea submersible is attacked by a massive creature.',
    cast: [],
    director: 'Jon Turteltaub',
    awards: '',
    boxOffice: '',
    ratings: [],
  }

  const sampleTvShow: Movie = {
    id: 'tv-1396',
    tmdbId: 1396,
    tmdbType: 'tv',
    streamSeason: 1,
    streamEpisode: 1,
    rank: 1,
    title: 'Breaking Bad',
    logoTitle: 'Breaking Bad',
    label: 'TV Series',
    type: 'Series',
    genres: ['Crime', 'Drama'],
    year: '2008',
    runtime: '45 min',
    rating: '9.5',
    maturity: 'TV-MA',
    progress: 0,
    hero: '',
    poster: '',
    still: '',
    synopsis: 'A chemistry teacher turns to manufacturing methamphetamine.',
    cast: [],
    director: 'Vince Gilligan',
    awards: '',
    boxOffice: '',
    ratings: [],
  }

  const imdbTvShow: Movie = {
    id: 'tt0903747',
    streamSeason: 1,
    streamEpisode: 1,
    rank: 2,
    title: 'Breaking Bad',
    logoTitle: 'Breaking Bad',
    label: 'TV Series',
    type: 'Series',
    genres: ['Crime', 'Drama'],
    year: '2008',
    runtime: '45 min',
    rating: '9.5',
    maturity: 'TV-MA',
    progress: 0,
    hero: '',
    poster: '',
    still: '',
    synopsis: 'A chemistry teacher diagnosed with lung cancer.',
    cast: [],
    director: 'Vince Gilligan',
    awards: '',
    boxOffice: '',
    ratings: [],
  }

  it('includes VidCore in streamProviderOptions', () => {
    const vidcoreOption = streamProviderOptions.find((p) => p.id === 'vidcore')
    expect(vidcoreOption).toBeDefined()
    expect(vidcoreOption?.name).toBe('VidCore')
    expect(vidcoreOption?.logo).toBe('VC')
  })

  it('includes AutoEmbed in streamProviderOptions', () => {
    const autoembedOption = streamProviderOptions.find((p) => p.id === 'autoembed')
    expect(autoembedOption).toBeDefined()
    expect(autoembedOption?.name).toBe('AutoEmbed')
    expect(autoembedOption?.logo).toBe('AE')
  })

  it('includes VSEmbed in streamProviderOptions', () => {
    const vsembedOption = streamProviderOptions.find((p) => p.id === 'vsembed')
    expect(vsembedOption).toBeDefined()
    expect(vsembedOption?.name).toBe('VSEmbed')
    expect(vsembedOption?.logo).toBe('VSE')
  })

  it('includes VidSrc Buzz in streamProviderOptions', () => {
    const vidsrcbuzzOption = streamProviderOptions.find((p) => p.id === 'vidsrcbuzz')
    expect(vidsrcbuzzOption).toBeDefined()
    expect(vidsrcbuzzOption?.name).toBe('VidSrc Buzz')
    expect(vidsrcbuzzOption?.logo).toBe('VB')
  })

  it('includes EmbedWave in streamProviderOptions', () => {
    const embedwaveOption = streamProviderOptions.find((p) => p.id === 'embedwave')
    expect(embedwaveOption).toBeDefined()
    expect(embedwaveOption?.name).toBe('EmbedWave')
    expect(embedwaveOption?.logo).toBe('EW')
  })

  it('validates isStreamProvider for all new providers', () => {
    expect(isStreamProvider('vidcore')).toBe(true)
    expect(isStreamProvider('autoembed')).toBe(true)
    expect(isStreamProvider('vsembed')).toBe(true)
    expect(isStreamProvider('vidsrcbuzz')).toBe(true)
    expect(isStreamProvider('embedwave')).toBe(true)
  })

  it('builds valid VidCore embed URL for a movie', () => {
    const url = buildVidCoreUrl(sampleMovie)
    expect(url).toBe('https://vidcore.org/embed/movie/359410')
    expect(buildStreamUrl(sampleMovie, 'vidcore')).toBe('https://vidcore.org/embed/movie/359410')
  })

  it('builds valid VidCore embed URL for a TV show', () => {
    const url = buildVidCoreUrl(sampleTvShow)
    expect(url).toBe('https://vidcore.org/embed/tv/1396/1/1')
    expect(buildStreamUrl(sampleTvShow, 'vidcore')).toBe('https://vidcore.org/embed/tv/1396/1/1')
  })

  it('builds valid AutoEmbed embed URL for a movie with TMDB id', () => {
    const url = buildAutoEmbedUrl(sampleMovie)
    expect(url).toBe('https://player.autoembed.cc/embed/movie/359410')
    expect(buildStreamUrl(sampleMovie, 'autoembed')).toBe('https://player.autoembed.cc/embed/movie/359410')
  })

  it('builds valid AutoEmbed embed URL for a movie with IMDB id', () => {
    const url = buildAutoEmbedUrl(imdbMovie)
    expect(url).toBe('https://player.autoembed.cc/embed/movie/tt3359350')
    expect(buildStreamUrl(imdbMovie, 'autoembed')).toBe('https://player.autoembed.cc/embed/movie/tt3359350')
  })

  it('builds valid AutoEmbed embed URL for a TV show with TMDB id', () => {
    const url = buildAutoEmbedUrl(sampleTvShow)
    expect(url).toBe('https://player.autoembed.cc/embed/tv/1396/1/1')
    expect(buildStreamUrl(sampleTvShow, 'autoembed')).toBe('https://player.autoembed.cc/embed/tv/1396/1/1')
  })

  it('builds valid AutoEmbed embed URL for a TV show with IMDB id', () => {
    const url = buildAutoEmbedUrl(imdbTvShow)
    expect(url).toBe('https://player.autoembed.cc/embed/tv/tt0903747/1/1')
    expect(buildStreamUrl(imdbTvShow, 'autoembed')).toBe('https://player.autoembed.cc/embed/tv/tt0903747/1/1')
  })

  it('builds valid VSEmbed embed URL for a movie with IMDB id', () => {
    const movie: Movie = { ...imdbMovie, id: 'tt1300854' }
    const url = buildVSEmbedUrl(movie)
    expect(url).toBe('https://vsembed.ru/embed/movie/tt1300854')
    expect(buildStreamUrl(movie, 'vsembed')).toBe('https://vsembed.ru/embed/movie/tt1300854')
  })

  it('builds valid VSEmbed embed URL for a TV show with TMDB id', () => {
    const tv: Movie = { ...sampleTvShow, tmdbId: 1399, streamSeason: 1, streamEpisode: 1 }
    const url = buildVSEmbedUrl(tv)
    expect(url).toBe('https://vsembed.ru/embed/tv/1399/1/1')
    expect(buildStreamUrl(tv, 'vsembed')).toBe('https://vsembed.ru/embed/tv/1399/1/1')
  })

  it('builds valid VidSrc Buzz embed URL for a movie with IMDB id', () => {
    const movie: Movie = { ...imdbMovie, id: 'tt1375666' }
    const url = buildVidSrcBuzzUrl(movie)
    expect(url).toBe('https://vidsrc.buzz/embed/movie/tt1375666')
    expect(buildStreamUrl(movie, 'vidsrcbuzz')).toBe('https://vidsrc.buzz/embed/movie/tt1375666')
  })

  it('builds valid VidSrc Buzz embed URL for a TV show with IMDB id', () => {
    const tv: Movie = { ...imdbTvShow, id: 'tt3107288', streamSeason: 1, streamEpisode: 1 }
    const url = buildVidSrcBuzzUrl(tv)
    expect(url).toBe('https://vidsrc.buzz/embed/tv/tt3107288/1/1')
    expect(buildStreamUrl(tv, 'vidsrcbuzz')).toBe('https://vidsrc.buzz/embed/tv/tt3107288/1/1')
  })

  it('builds valid EmbedWave embed URL for a movie with TMDB id', () => {
    const url = buildEmbedWaveUrl(sampleMovie)
    expect(url).toBe('https://embedwave.cc/embed/movie/359410')
    expect(buildStreamUrl(sampleMovie, 'embedwave')).toBe('https://embedwave.cc/embed/movie/359410')
  })

  it('builds valid EmbedWave embed URL for a TV show with TMDB id', () => {
    const url = buildEmbedWaveUrl(sampleTvShow)
    expect(url).toBe('https://embedwave.cc/embed/tv/1396/1/1')
    expect(buildStreamUrl(sampleTvShow, 'embedwave')).toBe('https://embedwave.cc/embed/tv/1396/1/1')
  })
})
