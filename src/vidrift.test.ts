import { describe, expect, it } from 'vitest'
import { buildStreamUrl, buildVidRiftUrl, streamProviderOptions } from './tmdb'
import type { Movie } from './omdb'

describe('VidRift server integration', () => {
  it('includes VidRift in streamProviderOptions', () => {
    const vidriftOption = streamProviderOptions.find((p) => p.id === 'vidrift')
    expect(vidriftOption).toBeDefined()
    expect(vidriftOption?.name).toBe('VidRift')
    expect(vidriftOption?.logo).toBe('VR')
  })

  it('builds valid VidRift embed URL for a movie with branding', () => {
    const movie: Movie = {
      id: 'movie-550',
      tmdbId: 550,
      tmdbType: 'movie',
      rank: 1,
      title: 'Fight Club',
      logoTitle: 'Fight Club',
      label: 'Feature Film',
      type: 'Movie',
      genres: ['Drama'],
      year: '1999',
      runtime: '139 min',
      rating: '8.8',
      maturity: 'R',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'An insomniac office worker and a devil-may-care soap maker.',
      cast: [],
      director: 'David Fincher',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildStreamUrl(movie, 'vidrift')
    expect(url).toBe(
      'https://embed.vidrift.in/embed/movie/550?title=Fight%20Club&brand=Lumen&brandColor=%2347A8FF',
    )
  })

  it('builds valid VidRift embed URL for a TV show with season and episode', () => {
    const tvShow: Movie = {
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
      synopsis: 'A chemistry teacher diagnosed with lung cancer.',
      cast: [],
      director: 'Vince Gilligan',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildVidRiftUrl(tvShow)
    expect(url).toBe(
      'https://embed.vidrift.in/embed/tv/1396/1/1?title=Breaking%20Bad&brand=Lumen&brandColor=%2347A8FF',
    )
  })

  it('builds valid VidRift embed URL for Anime using TMDB TV ID', () => {
    const anime: Movie = {
      id: 'tv-37854',
      tmdbId: 37854,
      tmdbType: 'tv',
      isAnime: true,
      streamSeason: 2,
      streamEpisode: 5,
      rank: 1,
      title: 'One Punch Man',
      logoTitle: 'One Punch Man',
      label: 'Anime Series',
      type: 'Series',
      genres: ['Action', 'Comedy'],
      year: '2015',
      runtime: '24 min',
      rating: '8.7',
      maturity: 'TV-14',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'A hero who can defeat any opponent with a single punch.',
      cast: [],
      director: '',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildVidRiftUrl(anime)
    expect(url).toBe(
      'https://embed.vidrift.in/embed/tv/37854/2/5?title=One%20Punch%20Man&brand=Lumen&brandColor=%2347A8FF',
    )
  })

  it('returns empty string if tmdbId is missing', () => {
    const movie: Movie = {
      id: 'custom-id',
      rank: 1,
      title: 'Unknown Movie',
      logoTitle: 'Unknown Movie',
      label: 'Movie',
      type: 'Movie',
      genres: [],
      year: '2024',
      runtime: '90 min',
      rating: '7.0',
      maturity: 'PG',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: '',
      cast: [],
      director: '',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildVidRiftUrl(movie)
    expect(url).toBe('')
  })
})
