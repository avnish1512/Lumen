export type OmdbRating = {
  Source: string
  Value: string
}

export type OmdbSearchItem = {
  Title: string
  Year: string
  imdbID: string
  Type: string
  Poster: string
}

export type OmdbDetail = OmdbSearchItem & {
  Rated?: string
  Released?: string
  Runtime?: string
  Genre?: string
  Director?: string
  Writer?: string
  Actors?: string
  Plot?: string
  Language?: string
  Country?: string
  Awards?: string
  Ratings?: OmdbRating[]
  Metascore?: string
  imdbRating?: string
  imdbVotes?: string
  BoxOffice?: string
  Response?: string
  Error?: string
}

type OmdbSearchResponse = {
  Search?: OmdbSearchItem[]
  totalResults?: string
  Response: string
  Error?: string
}

type OmdbIdsResponse = {
  Response: string
  results?: OmdbDetail[]
  Error?: string
}

export type MediaCollection = {
  top: Movie[]
  thrilling: Movie[]
  adventure: Movie[]
  kidsFamily: Movie[]
}

export type Movie = {
  id: string
  tmdbId?: number
  tmdbType?: 'movie' | 'tv'
  streamSeason?: number
  streamEpisode?: number
  streamLanguage?: 'sub' | 'dub'
  anilistId?: number
  malId?: number
  isAnime?: boolean
  animeFormat?: string
  episodeCount?: number
  trailerYoutubeId?: string
  rank: number
  title: string
  logoTitle: string
  label: string
  type: string
  genres: string[]
  year: string
  runtime: string
  rating: string
  maturity: string
  progress: number
  hero: string
  poster: string
  still: string
  synopsis: string
  cast: string[]
  director: string
  awards: string
  boxOffice: string
  ratings: OmdbRating[]
  badges?: string[]
  isFull?: boolean
}

export const featuredMovieIds = [
  'tt1375666',
  'tt0816692',
  'tt0111161',
  'tt0468569',
  'tt0133093',
  'tt0109830',
  'tt0110912',
  'tt4154796',
  'tt1745960',
  'tt0068646',
]

export const featuredTvShowIds = [
  'tt0944947',
  'tt0903747',
  'tt4574334',
  'tt1475582',
  'tt0108778',
  'tt7366338',
  'tt3032476',
  'tt1520211',
  'tt2861424',
  'tt0413573',
]

const movieCollectionIds = {
  top: featuredMovieIds,
  thrilling: [
    'tt0102926',
    'tt0114369',
    'tt0209144',
    'tt1130884',
    'tt2267998',
    'tt1392214',
    'tt0443706',
    'tt0477348',
    'tt0482571',
    'tt2872718',
  ],
  adventure: [
    'tt0082971',
    'tt0107290',
    'tt0120737',
    'tt0325980',
    'tt1392190',
    'tt0816692',
    'tt1160419',
    'tt0454876',
    'tt1663202',
    'tt0088763',
  ],
  kidsFamily: [
    'tt0114709',
    'tt0266543',
    'tt0110357',
    'tt0198781',
    'tt0126029',
    'tt4468740',
    'tt2096673',
    'tt2380307',
    'tt0317705',
    'tt0245429',
  ],
}

const tvShowCollectionIds = {
  top: featuredTvShowIds,
  thrilling: [
    'tt5753856',
    'tt5290382',
    'tt2356777',
    'tt2085059',
    'tt2401256',
    'tt2243973',
    'tt2802850',
    'tt5071412',
    'tt1796960',
    'tt6048596',
  ],
  adventure: [
    'tt0417299',
    'tt0411008',
    'tt8111088',
    'tt11737520',
    'tt0436992',
    'tt5180504',
    'tt5607976',
    'tt3581920',
    'tt2306299',
    'tt1199099',
  ],
  kidsFamily: [
    'tt7678620',
    'tt0206512',
    'tt1305826',
    'tt1865718',
    'tt0168366',
    'tt0852863',
    'tt5531466',
    'tt8688814',
    'tt3061046',
    'tt0983983',
  ],
}

const animeCollectionIds = {
  top: [
    'tt2560140', // Attack on Titan
    'tt0877057', // Death Note
    'tt1438016', // Fullmetal Alchemist: Brotherhood
    'tt8333036', // Demon Slayer
    'tt0988824', // Naruto: Shippuden
    'tt12343534', // Jujutsu Kaisen
    'tt0280280', // One Piece
    'tt5626028', // My Hero Academia
    'tt2005611', // Hunter x Hunter
    'tt1910272', // Steins;Gate
  ],
  thrilling: [
    'tt0877057', // Death Note
    'tt2560140', // Attack on Titan
    'tt12343534', // Jujutsu Kaisen
    'tt8333036', // Demon Slayer
    'tt3006802', // Tokyo Ghoul
    'tt4609130', // One Punch Man
    'tt13610562', // Chainsaw Man
  ],
  adventure: [
    'tt0280280', // One Piece
    'tt2005611', // Hunter x Hunter
    'tt0988824', // Naruto: Shippuden
    'tt5626028', // My Hero Academia
    'tt15410188', // Frieren: Beyond Journey's End
    'tt6074184', // Black Clover
    'tt0388562', // Bleach
  ],
  kidsFamily: [
    'tt0245429', // Spirited Away
    'tt5311514', // Your Name.
    'tt0119698', // Princess Mononoke
    'tt0096283', // My Neighbor Totoro
    'tt0347149', // Howl's Moving Castle
    'tt16508614', // Suzume
  ],
}



const fallbackHeroImages = [
  'https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
  'https://image.tmdb.org/t/p/original/pbrkL804c8yAv3zBZR4QPEafpAR.jpg',
  'https://image.tmdb.org/t/p/original/kXfqcdQKsToO0OUXHcrrNCHDBzO.jpg',
  'https://image.tmdb.org/t/p/original/hkBaDkMWbLaf8B1lsWsKX7Ew3Xq.jpg',
  'https://image.tmdb.org/t/p/original/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
  'https://image.tmdb.org/t/p/original/3h1JZGDhZ8nzxdgvkxha0qBqi05.jpg',
]

const fallbackStillImages = [
  'https://image.tmdb.org/t/p/w1280/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
  'https://image.tmdb.org/t/p/w1280/pbrkL804c8yAv3zBZR4QPEafpAR.jpg',
  'https://image.tmdb.org/t/p/w1280/kXfqcdQKsToO0OUXHcrrNCHDBzO.jpg',
  'https://image.tmdb.org/t/p/w1280/hkBaDkMWbLaf8B1lsWsKX7Ew3Xq.jpg',
  'https://image.tmdb.org/t/p/w1280/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
  'https://image.tmdb.org/t/p/w1280/3h1JZGDhZ8nzxdgvkxha0qBqi05.jpg',
]

type FallbackMedia = {
  title: string
  type: 'movie' | 'series'
  genres: string[]
  year: string
  runtime: string
  maturity: string
  synopsis: string
  cast: string[]
  director: string
  poster?: string
  hero?: string
  still?: string
}

const fallbackMedia: Record<string, FallbackMedia> = {
  tt1375666: {
    title: 'Inception',
    type: 'movie',
    genres: ['Action', 'Adventure', 'Sci-Fi'],
    year: '2010',
    runtime: '148 min',
    maturity: 'PG-13',
    synopsis:
      'A skilled thief enters dreams to steal secrets, then takes one last job that could change everything.',
    cast: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Elliot Page'],
    director: 'Christopher Nolan',
    poster: 'https://image.tmdb.org/t/p/w780/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
    hero: 'https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
  },
  tt0816692: {
    title: 'Interstellar',
    type: 'movie',
    genres: ['Adventure', 'Drama', 'Sci-Fi'],
    year: '2014',
    runtime: '169 min',
    maturity: 'PG-13',
    synopsis:
      'Explorers travel through a wormhole to find humanity a new home beyond Earth.',
    cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain'],
    director: 'Christopher Nolan',
    poster: 'https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    hero: 'https://image.tmdb.org/t/p/original/pbrkL804c8yAv3zBZR4QPEafpAR.jpg',
  },
  tt0111161: {
    title: 'The Shawshank Redemption',
    type: 'movie',
    genres: ['Drama'],
    year: '1994',
    runtime: '142 min',
    maturity: 'R',
    synopsis:
      'A banker sentenced to prison finds hope and friendship across decades behind bars.',
    cast: ['Tim Robbins', 'Morgan Freeman', 'Bob Gunton'],
    director: 'Frank Darabont',
    poster: 'https://image.tmdb.org/t/p/w780/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg',
    hero: 'https://image.tmdb.org/t/p/original/kXfqcdQKsToO0OUXHcrrNCHDBzO.jpg',
  },
  tt0468569: {
    title: 'The Dark Knight',
    type: 'movie',
    genres: ['Action', 'Crime', 'Drama'],
    year: '2008',
    runtime: '152 min',
    maturity: 'PG-13',
    synopsis:
      'Batman faces a criminal mastermind whose chaos pushes Gotham to the edge.',
    cast: ['Christian Bale', 'Heath Ledger', 'Aaron Eckhart'],
    director: 'Christopher Nolan',
    poster: 'https://image.tmdb.org/t/p/w780/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    hero: 'https://image.tmdb.org/t/p/original/hkBaDkMWbLaf8B1lsWsKX7Ew3Xq.jpg',
  },
  tt0133093: {
    title: 'The Matrix',
    type: 'movie',
    genres: ['Action', 'Sci-Fi'],
    year: '1999',
    runtime: '136 min',
    maturity: 'R',
    synopsis:
      'A hacker discovers reality is a simulated prison and joins the fight to free humanity.',
    cast: ['Keanu Reeves', 'Laurence Fishburne', 'Carrie-Anne Moss'],
    director: 'The Wachowskis',
    poster: 'https://image.tmdb.org/t/p/w780/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
    hero: 'https://image.tmdb.org/t/p/original/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
  },
  tt0109830: {
    title: 'Forrest Gump',
    type: 'movie',
    genres: ['Drama', 'Romance'],
    year: '1994',
    runtime: '142 min',
    maturity: 'PG-13',
    synopsis:
      'A kind-hearted man moves through pivotal moments in American history with unforgettable optimism.',
    cast: ['Tom Hanks', 'Robin Wright', 'Gary Sinise'],
    director: 'Robert Zemeckis',
    poster: 'https://image.tmdb.org/t/p/w780/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg',
    hero: 'https://image.tmdb.org/t/p/original/3h1JZGDhZ8nzxdgvkxha0qBqi05.jpg',
  },
  tt0944947: {
    title: 'Game of Thrones',
    type: 'series',
    genres: ['Adventure', 'Drama', 'Fantasy'],
    year: '2011-2019',
    runtime: '57 min',
    maturity: 'TV-MA',
    synopsis:
      'Noble families battle for power while an ancient threat rises beyond the wall.',
    cast: ['Emilia Clarke', 'Kit Harington', 'Peter Dinklage'],
    director: 'David Benioff',
    poster: 'https://image.tmdb.org/t/p/w780/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg',
    hero: 'https://image.tmdb.org/t/p/original/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg',
  },
  tt0903747: {
    title: 'Breaking Bad',
    type: 'series',
    genres: ['Crime', 'Drama', 'Thriller'],
    year: '2008-2013',
    runtime: '49 min',
    maturity: 'TV-MA',
    synopsis:
      'A chemistry teacher turns to crime, building a dangerous empire from desperation.',
    cast: ['Bryan Cranston', 'Aaron Paul', 'Anna Gunn'],
    director: 'Vince Gilligan',
    poster: 'https://image.tmdb.org/t/p/w780/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    hero: 'https://image.tmdb.org/t/p/original/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
  },
  tt4574334: {
    title: 'Stranger Things',
    type: 'series',
    genres: ['Drama', 'Fantasy', 'Horror'],
    year: '2016-2025',
    runtime: '51 min',
    maturity: 'TV-14',
    synopsis:
      'Friends in a small town uncover secret experiments and a terrifying alternate world.',
    cast: ['Millie Bobby Brown', 'Finn Wolfhard', 'David Harbour'],
    director: 'The Duffer Brothers',
    poster: 'https://image.tmdb.org/t/p/w780/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
    hero: 'https://image.tmdb.org/t/p/original/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
  },
  tt1475582: {
    title: 'Sherlock',
    type: 'series',
    genres: ['Crime', 'Drama', 'Mystery'],
    year: '2010-2017',
    runtime: '88 min',
    maturity: 'TV-14',
    synopsis:
      'A modern detective and his partner solve brilliant crimes across London.',
    cast: ['Benedict Cumberbatch', 'Martin Freeman', 'Una Stubbs'],
    director: 'Mark Gatiss',
    poster: 'https://image.tmdb.org/t/p/w780/7WTsnHkbA0FaG6R9twfFde0I9hl.jpg',
    hero: 'https://image.tmdb.org/t/p/original/5vBmBTcU5JpH2RsqZuaZZLc4Owl.jpg',
  },
  tt0108778: {
    title: 'Friends',
    type: 'series',
    genres: ['Comedy', 'Romance'],
    year: '1994-2004',
    runtime: '22 min',
    maturity: 'TV-14',
    synopsis:
      'Six friends navigate love, careers, and daily life together in New York City.',
    cast: ['Jennifer Aniston', 'Courteney Cox', 'Matthew Perry'],
    director: 'David Crane',
    poster: 'https://image.tmdb.org/t/p/w780/f496cm9enuEsZkSPzCwnTESEK5s.jpg',
    hero: 'https://image.tmdb.org/t/p/original/l0qVZIpXtIo7km9u5Yqh0nKPOr5.jpg',
  },
}

const fallbackTitlesById: Record<
  string,
  { title: string; type: 'movie' | 'series'; genres?: string[] }
> = {
  tt0110912: { title: 'Pulp Fiction', type: 'movie', genres: ['Crime', 'Drama'] },
  tt4154796: { title: 'Avengers: Endgame', type: 'movie', genres: ['Action', 'Adventure'] },
  tt1745960: { title: 'Top Gun: Maverick', type: 'movie', genres: ['Action', 'Drama'] },
  tt0068646: { title: 'The Godfather', type: 'movie', genres: ['Crime', 'Drama'] },
  tt0102926: { title: 'The Silence of the Lambs', type: 'movie', genres: ['Crime', 'Thriller'] },
  tt0114369: { title: 'Se7en', type: 'movie', genres: ['Crime', 'Mystery'] },
  tt0209144: { title: 'Memento', type: 'movie', genres: ['Mystery', 'Thriller'] },
  tt1130884: { title: 'Shutter Island', type: 'movie', genres: ['Mystery', 'Thriller'] },
  tt2267998: { title: 'Gone Girl', type: 'movie', genres: ['Drama', 'Thriller'] },
  tt1392214: { title: 'Prisoners', type: 'movie', genres: ['Crime', 'Drama'] },
  tt0443706: { title: 'Zodiac', type: 'movie', genres: ['Crime', 'Mystery'] },
  tt0477348: { title: 'No Country for Old Men', type: 'movie', genres: ['Crime', 'Drama'] },
  tt0482571: { title: 'The Prestige', type: 'movie', genres: ['Drama', 'Mystery'] },
  tt2872718: { title: 'Nightcrawler', type: 'movie', genres: ['Crime', 'Thriller'] },
  tt0082971: { title: 'Raiders of the Lost Ark', type: 'movie', genres: ['Action', 'Adventure'] },
  tt0107290: { title: 'Jurassic Park', type: 'movie', genres: ['Adventure', 'Sci-Fi'] },
  tt0120737: { title: 'The Lord of the Rings', type: 'movie', genres: ['Adventure', 'Fantasy'] },
  tt0325980: { title: 'Pirates of the Caribbean', type: 'movie', genres: ['Action', 'Adventure'] },
  tt1392190: { title: 'Mad Max: Fury Road', type: 'movie', genres: ['Action', 'Adventure'] },
  tt1160419: { title: 'Dune', type: 'movie', genres: ['Adventure', 'Sci-Fi'] },
  tt0454876: { title: 'Life of Pi', type: 'movie', genres: ['Adventure', 'Drama'] },
  tt1663202: { title: 'The Revenant', type: 'movie', genres: ['Adventure', 'Drama'] },
  tt0088763: { title: 'Back to the Future', type: 'movie', genres: ['Adventure', 'Comedy'] },
  tt0114709: { title: 'Toy Story', type: 'movie', genres: ['Animation', 'Family'] },
  tt0266543: { title: 'Finding Nemo', type: 'movie', genres: ['Animation', 'Family'] },
  tt0110357: { title: 'The Lion King', type: 'movie', genres: ['Animation', 'Family'] },
  tt0198781: { title: 'Monsters, Inc.', type: 'movie', genres: ['Animation', 'Family'] },
  tt0126029: { title: 'Shrek', type: 'movie', genres: ['Animation', 'Comedy'] },
  tt4468740: { title: 'Kubo and the Two Strings', type: 'movie', genres: ['Animation', 'Adventure'] },
  tt2096673: { title: 'Inside Out', type: 'movie', genres: ['Animation', 'Family'] },
  tt2380307: { title: 'Coco', type: 'movie', genres: ['Animation', 'Family'] },
  tt0317705: { title: 'The Incredibles', type: 'movie', genres: ['Animation', 'Action'] },
  tt0245429: { title: 'Spirited Away', type: 'movie', genres: ['Animation', 'Fantasy'] },
  tt7366338: { title: 'Chernobyl', type: 'series', genres: ['Drama', 'History'] },
  tt3032476: { title: 'Better Call Saul', type: 'series', genres: ['Crime', 'Drama'] },
  tt1520211: { title: 'The Walking Dead', type: 'series', genres: ['Drama', 'Horror'] },
  tt2861424: { title: 'Rick and Morty', type: 'series', genres: ['Animation', 'Comedy'] },
  tt0413573: { title: 'Grey\'s Anatomy', type: 'series', genres: ['Drama', 'Romance'] },
  tt5753856: { title: 'Dark', type: 'series', genres: ['Mystery', 'Sci-Fi'] },
  tt5290382: { title: 'Mindhunter', type: 'series', genres: ['Crime', 'Thriller'] },
  tt2356777: { title: 'True Detective', type: 'series', genres: ['Crime', 'Drama'] },
  tt2085059: { title: 'Black Mirror', type: 'series', genres: ['Drama', 'Sci-Fi'] },
  tt2401256: { title: 'The Night Manager', type: 'series', genres: ['Drama', 'Thriller'] },
  tt2243973: { title: 'Hannibal', type: 'series', genres: ['Crime', 'Horror'] },
  tt2802850: { title: 'Fargo', type: 'series', genres: ['Crime', 'Drama'] },
  tt5071412: { title: 'Ozark', type: 'series', genres: ['Crime', 'Drama'] },
  tt1796960: { title: 'Homeland', type: 'series', genres: ['Drama', 'Thriller'] },
  tt6048596: { title: 'The Sinner', type: 'series', genres: ['Crime', 'Mystery'] },
  tt0417299: { title: 'Avatar: The Last Airbender', type: 'series', genres: ['Animation', 'Adventure'] },
  tt0411008: { title: 'Lost', type: 'series', genres: ['Adventure', 'Drama'] },
  tt8111088: { title: 'The Mandalorian', type: 'series', genres: ['Action', 'Adventure'] },
  tt11737520: { title: 'Sweet Tooth', type: 'series', genres: ['Adventure', 'Fantasy'] },
  tt0436992: { title: 'Doctor Who', type: 'series', genres: ['Adventure', 'Sci-Fi'] },
  tt5180504: { title: 'The Witcher', type: 'series', genres: ['Action', 'Adventure'] },
  tt5607976: { title: 'The Orville', type: 'series', genres: ['Adventure', 'Comedy'] },
  tt3581920: { title: 'The Last of Us', type: 'series', genres: ['Drama', 'Thriller'] },
  tt2306299: { title: 'Vikings', type: 'series', genres: ['Action', 'Drama'] },
  tt1199099: { title: 'Adventure Series', type: 'series', genres: ['Adventure', 'Drama'] },
  tt7678620: { title: 'Bluey', type: 'series', genres: ['Animation', 'Family'] },
  tt0206512: { title: 'SpongeBob SquarePants', type: 'series', genres: ['Animation', 'Comedy'] },
  tt1305826: { title: 'Adventure Time', type: 'series', genres: ['Animation', 'Adventure'] },
  tt1865718: { title: 'Gravity Falls', type: 'series', genres: ['Animation', 'Mystery'] },
  tt0168366: { title: 'The Powerpuff Girls', type: 'series', genres: ['Animation', 'Action'] },
  tt0852863: { title: 'Phineas and Ferb', type: 'series', genres: ['Animation', 'Comedy'] },
  tt5531466: { title: 'DuckTales', type: 'series', genres: ['Animation', 'Adventure'] },
  tt8688814: { title: 'Carmen Sandiego', type: 'series', genres: ['Animation', 'Adventure'] },
  tt3061046: { title: 'Miraculous: Tales of Ladybug & Cat Noir', type: 'series', genres: ['Animation', 'Action'] },
  tt0983983: { title: 'WordGirl', type: 'series', genres: ['Animation', 'Family'] },
  tt2560140: { title: 'Attack on Titan', type: 'series', genres: ['Animation', 'Action', 'Fantasy'] },
  tt0877057: { title: 'Death Note', type: 'series', genres: ['Animation', 'Crime', 'Drama'] },
  tt1438016: { title: 'Fullmetal Alchemist: Brotherhood', type: 'series', genres: ['Animation', 'Action', 'Adventure'] },
  tt8333036: { title: 'Demon Slayer', type: 'series', genres: ['Animation', 'Action', 'Adventure'] },
  tt0988824: { title: 'Naruto: Shippuden', type: 'series', genres: ['Animation', 'Action', 'Adventure'] },
  tt12343534: { title: 'Jujutsu Kaisen', type: 'series', genres: ['Animation', 'Action', 'Fantasy'] },
  tt0280280: { title: 'One Piece', type: 'series', genres: ['Animation', 'Action', 'Adventure'] },
  tt5626028: { title: 'My Hero Academia', type: 'series', genres: ['Animation', 'Action', 'Adventure'] },
  tt2005611: { title: 'Hunter x Hunter', type: 'series', genres: ['Animation', 'Action', 'Adventure'] },
  tt1910272: { title: 'Steins;Gate', type: 'series', genres: ['Animation', 'Drama', 'Sci-Fi'] },
  tt3006802: { title: 'Tokyo Ghoul', type: 'series', genres: ['Animation', 'Action', 'Drama'] },
  tt4609130: { title: 'One Punch Man', type: 'series', genres: ['Animation', 'Action', 'Comedy'] },
  tt13610562: { title: 'Chainsaw Man', type: 'series', genres: ['Animation', 'Action', 'Fantasy'] },
  tt15410188: { title: "Frieren: Beyond Journey's End", type: 'series', genres: ['Animation', 'Adventure', 'Drama'] },
  tt6074184: { title: 'Black Clover', type: 'series', genres: ['Animation', 'Action', 'Adventure'] },
  tt0388562: { title: 'Bleach', type: 'series', genres: ['Animation', 'Action', 'Adventure'] },
  tt5311514: { title: 'Your Name.', type: 'movie', genres: ['Animation', 'Drama', 'Fantasy'] },
  tt0119698: { title: 'Princess Mononoke', type: 'movie', genres: ['Animation', 'Adventure', 'Fantasy'] },
  tt0096283: { title: 'My Neighbor Totoro', type: 'movie', genres: ['Animation', 'Family', 'Fantasy'] },
  tt0347149: { title: "Howl's Moving Castle", type: 'movie', genres: ['Animation', 'Adventure', 'Family'] },
  tt16508614: { title: 'Suzume', type: 'movie', genres: ['Animation', 'Action', 'Adventure'] },
}

function safeText(value: string | undefined, fallback = 'N/A') {
  if (!value || value === 'N/A') {
    return fallback
  }

  return value
}

function fallbackPoster(_rank: number) {
  return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
}

function fallbackHero(rank: number) {
  return fallbackHeroImages[(rank - 1) % fallbackHeroImages.length]
}

function fallbackStill(rank: number) {
  return fallbackStillImages[(rank - 1) % fallbackStillImages.length]
}

function fallbackMovieFromId(id: string, rank = 1): Movie {
  const knownFallback = fallbackTitlesById[id]
  const fallback = fallbackMedia[id] ?? {
    title:
      knownFallback?.title ??
      `Curated ${knownFallback?.type === 'series' ? 'Series' : 'Movie'} ${rank}`,
    type: knownFallback?.type ?? ('movie' as const),
    genres:
      knownFallback?.genres ??
      (knownFallback?.type === 'series' ? ['Drama', 'Series'] : ['Drama', 'Movie']),
    year: '2024',
    runtime: knownFallback?.type === 'series' ? '45 min' : '110 min',
    maturity: 'NR',
    synopsis:
      `${knownFallback?.title ?? 'This title'} is available while the movie data finishes loading.`,
    cast: ['Cast unavailable'],
    director: 'Director unavailable',
  }

  return {
    id,
    rank,
    title: fallback.title,
    logoTitle: logoTitle(fallback.title),
    label: rank === 1 ? 'Featured' : 'Fresh Pick',
    type: fallback.type === 'series' ? 'Series' : 'Movie',
    genres: fallback.genres,
    year: fallback.year,
    runtime: fallback.runtime,
    rating: 'N/A',
    maturity: fallback.maturity,
    progress: progressFor(id),
    hero: fallback.hero ?? fallbackHero(rank),
    poster: fallback.poster ?? fallbackPoster(rank),
    still: fallback.still ?? fallback.hero ?? fallbackStill(rank),
    synopsis: fallback.synopsis,
    cast: fallback.cast,
    director: fallback.director,
    awards: 'Awards unavailable',
    boxOffice: 'Box office unavailable',
    ratings: [],
    badges: ['HD'],
    isFull: false,
  }
}

function posterFor(movie: Pick<OmdbSearchItem, 'Poster'>, rank: number) {
  return movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : fallbackPoster(rank)
}

function splitList(value: string | undefined, fallback: string[]) {
  if (!value || value === 'N/A') {
    return fallback
  }

  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function logoTitle(title: string) {
  const words = title.toUpperCase().split(/\s+/).filter(Boolean)

  if (words.length <= 1 || title.length < 13) {
    return words.join(' ')
  }

  const midpoint = Math.ceil(words.length / 2)
  return `${words.slice(0, midpoint).join(' ')}\n${words
    .slice(midpoint)
    .join(' ')}`
}

function progressFor(id: string) {
  const total = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return 12 + (total % 72)
}

function badgesFor(detail: Partial<OmdbDetail>) {
  const badges = ['HD']

  if (safeText(detail.imdbRating, '') !== '') {
    badges.push(`IMDb ${detail.imdbRating}`)
  }

  if (safeText(detail.Metascore, '') !== '') {
    badges.push(`META ${detail.Metascore}`)
  }

  return badges
}

export function movieFromDetail(detail: OmdbDetail, rank = 1): Movie {
  const fallback = fallbackMedia[detail.imdbID]
  const poster = fallback?.poster ?? posterFor(detail, rank)
  const genres = splitList(detail.Genre, ['Movie'])

  return {
    id: detail.imdbID,
    rank,
    title: safeText(detail.Title, 'Untitled'),
    logoTitle: logoTitle(safeText(detail.Title, 'Untitled')),
    label: rank === 1 ? 'Featured' : detail.Released ? 'Movie Info' : 'Fresh Pick',
    type: safeText(detail.Type, 'movie').replace(/^\w/, (letter) =>
      letter.toUpperCase(),
    ),
    genres,
    year: safeText(detail.Year, 'Unknown'),
    runtime: safeText(detail.Runtime, 'Runtime unavailable'),
    rating: safeText(detail.imdbRating, 'N/A'),
    maturity: safeText(detail.Rated, 'NR'),
    progress: progressFor(detail.imdbID),
    hero: fallback?.hero ?? poster,
    poster,
    still: fallback?.still ?? fallback?.hero ?? poster,
    synopsis: safeText(detail.Plot, 'No plot summary is available for this movie.'),
    cast: splitList(detail.Actors, ['Cast unavailable']).slice(0, 6),
    director: safeText(detail.Director, 'Director unavailable'),
    awards: safeText(detail.Awards, 'Awards unavailable'),
    boxOffice: safeText(detail.BoxOffice, 'Box office unavailable'),
    ratings: detail.Ratings ?? [],
    badges: badgesFor(detail),
    isFull: true,
  }
}

export function movieFromSearch(item: OmdbSearchItem, rank = 1): Movie {
  const fallback = fallbackMedia[item.imdbID]
  const poster = fallback?.poster ?? posterFor(item, rank)

  return {
    id: item.imdbID,
    rank,
    title: safeText(item.Title, 'Untitled'),
    logoTitle: logoTitle(safeText(item.Title, 'Untitled')),
    label: 'Search Result',
    type: safeText(item.Type, 'movie').replace(/^\w/, (letter) =>
      letter.toUpperCase(),
    ),
    genres: ['Movie'],
    year: safeText(item.Year, 'Unknown'),
    runtime: 'Open for runtime',
    rating: 'N/A',
    maturity: 'NR',
    progress: progressFor(item.imdbID),
    hero: fallback?.hero ?? poster,
    poster,
    still: fallback?.still ?? fallback?.hero ?? poster,
    synopsis: 'Open this movie to load its full OMDb plot, cast, ratings, and release details.',
    cast: ['Open for cast'],
    director: 'Open for director',
    awards: 'Open for awards',
    boxOffice: 'Open for box office',
    ratings: [],
    badges: ['OMDb'],
    isFull: false,
  }
}

async function requestOmdb<T>(path: string): Promise<T> {
  const response = await fetch(path)
  const body = (await response.json()) as T & { Response?: string; Error?: string }

  if (!response.ok) {
    throw new Error(body.Error ?? 'Could not reach OMDb.')
  }

  if (body.Response === 'False') {
    throw new Error(body.Error ?? 'OMDb did not return results.')
  }

  return body
}

async function fetchFeaturedByIds(ids: string[]) {
  const params = new URLSearchParams({
    ids: ids.join(','),
  })
  const data = await requestOmdb<OmdbIdsResponse>(`/api/omdb?${params}`)
  const resultsById = new Map(
    (data.results ?? [])
      .filter((item) => item.Response !== 'False')
      .map((item) => [item.imdbID, item]),
  )

  return ids.map((id, index) => {
    const result = resultsById.get(id)
    return result
      ? movieFromDetail(result, index + 1)
      : fallbackMovieFromId(id, index + 1)
  })
}

async function fetchCollectionByIds(ids: string[]) {
  try {
    return await fetchFeaturedByIds(ids)
  } catch {
    return ids.map((id, index) => fallbackMovieFromId(id, index + 1))
  }
}

function fillCollection(collection: MediaCollection) {
  const fallback = collection.top

  return {
    top: collection.top,
    thrilling: collection.thrilling.length > 0 ? collection.thrilling : fallback,
    adventure: collection.adventure.length > 0 ? collection.adventure : fallback,
    kidsFamily:
      collection.kidsFamily.length > 0 ? collection.kidsFamily : fallback,
  }
}

async function fetchMediaCollection(
  collectionIds: typeof movieCollectionIds,
): Promise<MediaCollection> {
  const [top, thrilling, adventure, kidsFamily] = await Promise.all([
    fetchCollectionByIds(collectionIds.top),
    fetchCollectionByIds(collectionIds.thrilling),
    fetchCollectionByIds(collectionIds.adventure),
    fetchCollectionByIds(collectionIds.kidsFamily),
  ])

  if (top.length === 0) {
    throw new Error('OMDb did not return the top rail.')
  }

  return fillCollection({
    top,
    thrilling,
    adventure,
    kidsFamily,
  })
}

export async function fetchFeaturedMovies() {
  return fetchFeaturedByIds(featuredMovieIds)
}

export async function fetchFeaturedTvShows() {
  return fetchFeaturedByIds(featuredTvShowIds)
}

export async function fetchMovieCollection() {
  return fetchMediaCollection(movieCollectionIds)
}

export async function fetchTvShowCollection() {
  return fetchMediaCollection(tvShowCollectionIds)
}

export async function fetchAnimeCollection() {
  return fetchMediaCollection(animeCollectionIds)
}

export async function fetchMovieById(id: string, rank = 1) {
  const params = new URLSearchParams({ id })
  const data = await requestOmdb<OmdbDetail>(`/api/omdb?${params}`)
  return movieFromDetail(data, rank)
}

export async function searchMovies(query: string, page = 1) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
  })
  const data = await requestOmdb<OmdbSearchResponse>(`/api/omdb?${params}`)

  return (data.Search ?? []).map((item, index) =>
    movieFromSearch(item, index + 1),
  )
}
