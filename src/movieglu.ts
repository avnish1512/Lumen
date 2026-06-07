import type { Movie } from './omdb'

export type TrailerClip = {
  duration: string
  id: string
  image: string
  quality: string
  title: string
  url: string
}

type TrailerResponse = {
  Error?: string
  Response?: string
  trailers?: TrailerClip[]
}

export async function fetchMovieGluTrailers(movie: Pick<Movie, 'id' | 'title'>) {
  const params = new URLSearchParams({
    imdbId: movie.id,
    title: movie.title,
  })
  const response = await fetch(`/api/movieglu-trailers?${params}`)
  const body = (await response.json()) as TrailerResponse

  if (!response.ok || body.Response === 'False') {
    throw new Error(body.Error ?? 'MovieGlu did not return trailers.')
  }

  return body.trailers ?? []
}
