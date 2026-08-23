import { describe, expect, it } from 'vitest'
import { buildMegaVidUrl, buildStreamUrl, streamProviderOptions } from './tmdb'
import type { Movie } from './omdb'

describe('MegaVid anime & drama server integration', () => {
  it('includes MegaVid in streamProviderOptions', () => {
    const megavidOption = streamProviderOptions.find((p) => p.id === 'megavid')
    expect(megavidOption).toBeDefined()
    expect(megavidOption?.name).toBe('MegaVid')
    expect(megavidOption?.logo).toBe('MV')
  })

  it('builds valid MegaVid AniList embed URL with sub audio by default', () => {
    const anime: Movie = {
      id: 'al-21',
      anilistId: 21,
      isAnime: true,
      rank: 1,
      title: 'One Piece',
      logoTitle: 'One Piece',
      label: 'Anime Series',
      type: 'Series',
      genres: ['Action', 'Adventure'],
      year: '1999',
      runtime: '24 min',
      rating: '8.9',
      maturity: 'TV-14',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'Straw Hat Pirates',
      cast: [],
      director: '',
      awards: '',
      boxOffice: '',
      ratings: [],
      streamEpisode: 1,
      streamLanguage: 'sub',
    }

    const url = buildStreamUrl(anime, 'megavid')
    expect(url).toBe('https://megavid.buzz/ani/21/1/sub?color=%2347A8FF&autoplay=true')
  })

  it('builds valid MegaVid AniList embed URL with dub audio', () => {
    const anime: Movie = {
      id: 'al-21',
      anilistId: 21,
      isAnime: true,
      rank: 1,
      title: 'One Piece',
      logoTitle: 'One Piece',
      label: 'Anime Series',
      type: 'Series',
      genres: ['Action', 'Adventure'],
      year: '1999',
      runtime: '24 min',
      rating: '8.9',
      maturity: 'TV-14',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'Straw Hat Pirates',
      cast: [],
      director: '',
      awards: '',
      boxOffice: '',
      ratings: [],
      streamEpisode: 1,
      streamLanguage: 'dub',
    }

    const url = buildMegaVidUrl(anime)
    expect(url).toBe('https://megavid.buzz/ani/21/1/dub?color=%2347A8FF&autoplay=true')
  })

  it('builds valid MegaVid MAL embed URL when only malId is available', () => {
    const anime: Movie = {
      id: 'mal-21',
      malId: 21,
      isAnime: true,
      rank: 1,
      title: 'One Piece',
      logoTitle: 'One Piece',
      label: 'Anime Series',
      type: 'Series',
      genres: ['Action', 'Adventure'],
      year: '1999',
      runtime: '24 min',
      rating: '8.9',
      maturity: 'TV-14',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'Straw Hat Pirates',
      cast: [],
      director: '',
      awards: '',
      boxOffice: '',
      ratings: [],
      streamEpisode: 1,
      streamLanguage: 'sub',
    }

    const url = buildMegaVidUrl(anime)
    expect(url).toBe('https://megavid.buzz/mal/21/1/sub?color=%2347A8FF&autoplay=true')
  })

  it('builds valid MegaVid KissKH embed URL for kisskh items', () => {
    const drama: Movie = {
      id: 'kisskh-129692',
      rank: 1,
      title: 'Sample Drama',
      logoTitle: 'Sample Drama',
      label: 'Drama Series',
      type: 'Series',
      genres: ['Drama'],
      year: '2024',
      runtime: '45 min',
      rating: '8.0',
      maturity: 'TV-14',
      progress: 0,
      hero: '',
      poster: '',
      still: '',
      synopsis: 'Sample drama synopsis',
      cast: [],
      director: '',
      awards: '',
      boxOffice: '',
      ratings: [],
    }

    const url = buildMegaVidUrl(drama)
    expect(url).toBe('https://megavid.buzz/kisskh/129692?color=%2347A8FF&autoplay=true')
  })

  it('returns empty string when no identifiers are present', () => {
    const movie: Movie = {
      id: 'custom-item',
      rank: 1,
      title: 'Unknown Title',
      logoTitle: 'Unknown Title',
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

    const url = buildMegaVidUrl(movie)
    expect(url).toBe('')
  })
})
