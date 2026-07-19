export type AniListAnime = {
  id: number;
  idMal?: number;
  title: {
    romaji?: string;
    english?: string;
    native?: string;
    userPreferred?: string;
  };
  coverImage?: {
    extraLarge?: string;
    large?: string;
    medium?: string;
    color?: string;
  };
  bannerImage?: string;
  description?: string;
  genres?: string[];
  seasonYear?: number;
  episodes?: number;
  duration?: number;
  nextAiringEpisode?: {
    episode?: number;
    airingAt?: number;
  };
  streamingEpisodes?: {
    title?: string;
    thumbnail?: string;
    url?: string;
    site?: string;
  }[];
  format?: string;
  status?: string;
  synonyms?: string[];
  averageScore?: number;
  studios?: {
    nodes?: { name: string }[];
  };
  trailer?: {
    id?: string;
    site?: string;
    thumbnail?: string;
  };
};

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

async function queryAniList(query: string, variables: Record<string, any>) {
  const response = await fetch(ANILIST_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.errors?.[0]?.message || 'AniList query failed');
  }

  return json.data;
}

export async function searchAnime(query: string, page = 1, perPage = 20): Promise<{
  results: AniListAnime[];
  hasNextPage: boolean;
}> {
  const searchQuery = `
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          hasNextPage
        }
        media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
          id
          idMal
          title {
            romaji
            english
            native
            userPreferred
          }
          coverImage {
            large
          }
          bannerImage
          description
          genres
          seasonYear
          episodes
          duration
          nextAiringEpisode {
            episode
          }
          format
          status
        }
      }
    }
  `;

  const data = await queryAniList(searchQuery, { search: query, page, perPage });
  return {
    results: data?.Page?.media || [],
    hasNextPage: !!data?.Page?.pageInfo?.hasNextPage,
  };
}

export async function getAnimeDetails(id: number): Promise<AniListAnime> {
  const detailsQuery = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        idMal
        title {
          romaji
          english
          native
          userPreferred
        }
        coverImage {
          extraLarge
          large
        }
        bannerImage
        description
        genres
        seasonYear
        episodes
        duration
        nextAiringEpisode {
          episode
          airingAt
        }
        streamingEpisodes {
          title
          thumbnail
          url
          site
        }
        format
        status
        synonyms
        averageScore
        studios(isMain: true) {
          nodes {
            name
          }
        }
        trailer {
          id
          site
          thumbnail
        }
      }
    }
  `;

  const data = await queryAniList(detailsQuery, { id });
  return data?.Media;
}

export async function syncAnimeProgressToAniList(
  token: string,
  mediaId: number,
  progress: number,
  status: 'CURRENT' | 'COMPLETED' | 'PLANNING' | 'DROPPED' | 'PAUSED' = 'CURRENT'
): Promise<any> {
  const mutation = `
    mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int) {
      SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress) {
        id
        status
        progress
      }
    }
  `;

  const response = await fetch(ANILIST_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: mutation,
      variables: { mediaId, status, progress },
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.errors?.[0]?.message || 'Failed to sync progress to AniList');
  }

  return json.data?.SaveMediaListEntry;
}

export async function fetchAnimeByOptions({
  genre,
  sort,
  perPage = 10,
}: {
  genre?: string;
  sort?: string[];
  perPage?: number;
}): Promise<AniListAnime[]> {
  const query = `
    query ($genre: String, $sort: [MediaSort], $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(genre: $genre, sort: $sort, type: ANIME) {
          id
          idMal
          title {
            romaji
            english
            native
            userPreferred
          }
          coverImage {
            extraLarge
            large
          }
          bannerImage
          description
          genres
          seasonYear
          episodes
          duration
          nextAiringEpisode {
            episode
          }
          format
          status
          averageScore
          trailer {
            id
            site
            thumbnail
          }
        }
      }
    }
  `;

  const variables: Record<string, any> = { perPage };
  if (genre) variables.genre = genre;
  if (sort) variables.sort = sort;

  try {
    const data = await queryAniList(query, variables);
    return data?.Page?.media || [];
  } catch (e) {
    console.error('Failed to fetch anime by options', e);
    return [];
  }
}

export async function fetchAnimeListByIds(ids: number[]): Promise<AniListAnime[]> {
  const query = `
    query ($ids: [Int]) {
      Page(page: 1, perPage: 50) {
        media(id_in: $ids, type: ANIME) {
          id
          idMal
          title {
            romaji
            english
            native
            userPreferred
          }
          coverImage {
            extraLarge
            large
          }
          bannerImage
          description
          genres
          seasonYear
          episodes
          duration
          nextAiringEpisode {
            episode
          }
          format
          status
          averageScore
        }
      }
    }
  `;

  try {
    const data = await queryAniList(query, { ids });
    return data?.Page?.media || [];
  } catch (e) {
    console.error('Failed to fetch anime by IDs', e);
    return [];
  }
}
