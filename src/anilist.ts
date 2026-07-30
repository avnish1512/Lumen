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

export async function getAnimeDetails(id: number): Promise<AniListAnime | null> {
  if (!id || isNaN(id)) {
    return null;
  }

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

  try {
    const data = await queryAniList(detailsQuery, { id });
    return data?.Media || null;
  } catch (e) {
    console.error(`getAnimeDetails failed for id ${id}:`, e);
    return null;
  }
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
  page = 1,
}: {
  genre?: string;
  sort?: string[];
  perPage?: number;
  page?: number;
}): Promise<AniListAnime[]> {
  const query = `
    query ($genre: String, $sort: [MediaSort], $perPage: Int, $page: Int) {
      Page(page: $page, perPage: $perPage) {
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

  const variables: Record<string, any> = { perPage, page };
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

export type AnimeSeasonInfo = {
  season: number;
  anilistId: number;
  title: string;
  episodeCount: number;
  seasonYear?: number;
  status?: string;
  nextEpisode?: { number: number; airingAt?: number };
  animeEpisodes?: { title: string; thumbnail: string }[];
};

const animeSeasonsCache = new Map<number, AnimeSeasonInfo[]>();

export async function fetchAniListSeasons(anilistId: number): Promise<AnimeSeasonInfo[]> {
  if (!anilistId || isNaN(anilistId)) {
    return [];
  }

  if (animeSeasonsCache.has(anilistId)) {
    return animeSeasonsCache.get(anilistId)!;
  }

  const idQuery = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        relations {
          edges {
            relationType
            node {
              id
              relations {
                edges {
                  relationType
                  node {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const batchQuery = `
    query ($ids: [Int]) {
      Page(perPage: 50) {
        media(id_in: $ids, type: ANIME) {
          id
          title { english romaji userPreferred }
          episodes
          format
          status
          seasonYear
          coverImage { extraLarge large }
          streamingEpisodes { title thumbnail }
          nextAiringEpisode { episode airingAt }
          relations {
            edges {
              relationType
              node {
                id
              }
            }
          }
        }
      }
    }
  `;

  const relTypes = ['PREQUEL', 'SEQUEL', 'PARENT'];

  const isMainTvSeason = (m: any) => {
    if (!m) return false;
    if (m.format !== 'TV' && m.format !== 'TV_SHORT' && m.format !== 'ONA') return false;
    const titleLower = (m.title?.english || m.title?.romaji || m.title?.userPreferred || '').toLowerCase();
    if (
      titleLower.includes('ova') ||
      titleLower.includes('special') ||
      titleLower.includes('picture drama') ||
      titleLower.includes('chibi')
    ) {
      return false;
    }
    return true;
  };

  try {
    const idData = await queryAniList(idQuery, { id: anilistId });
    const root = idData?.Media;
    if (!root) {
      return [];
    }

    const foundIds = new Set<number>();
    foundIds.add(root.id);

    const collectIds = (node: any) => {
      if (!node) return;
      foundIds.add(node.id);
      for (const e1 of node.relations?.edges || []) {
        if (relTypes.includes(e1.relationType)) {
          foundIds.add(e1.node.id);
          for (const e2 of e1.node?.relations?.edges || []) {
            if (relTypes.includes(e2.relationType)) {
              foundIds.add(e2.node.id);
            }
          }
        }
      }
    };

    collectIds(root);

    const batch1Data = await queryAniList(batchQuery, { ids: Array.from(foundIds) });
    const mediaList1: any[] = batch1Data?.Page?.media || [];

    const missingIds = new Set<number>();
    for (const m of mediaList1) {
      for (const edge of m.relations?.edges || []) {
        if (relTypes.includes(edge.relationType) && !foundIds.has(edge.node.id)) {
          missingIds.add(edge.node.id);
        }
      }
    }

    let finalMediaList = mediaList1;
    if (missingIds.size > 0) {
      try {
        const batch2Data = await queryAniList(batchQuery, { ids: Array.from(missingIds) });
        const mediaList2: any[] = batch2Data?.Page?.media || [];
        finalMediaList = [...mediaList1, ...mediaList2];
      } catch {
        // Keep mediaList1 if second batch fails
      }
    }

    const sortedMedia = finalMediaList.filter(isMainTvSeason).sort((a, b) => {
      const yearA = a.seasonYear || 9999;
      const yearB = b.seasonYear || 9999;
      if (yearA !== yearB) return yearA - yearB;
      return a.id - b.id;
    });

    const seasons: AnimeSeasonInfo[] = sortedMedia.map((m, index) => {
      const displayTitle = m.title?.english || m.title?.romaji || m.title?.userPreferred || `Season ${index + 1}`;
      return {
        season: index + 1,
        anilistId: m.id,
        title: displayTitle,
        episodeCount: m.episodes && m.episodes > 0 ? m.episodes : 12,
        seasonYear: m.seasonYear,
        status: m.status,
        nextEpisode: m.nextAiringEpisode
          ? { number: m.nextAiringEpisode.episode, airingAt: m.nextAiringEpisode.airingAt }
          : undefined,
        animeEpisodes: (m.streamingEpisodes || []).map((ep: any) => ({
          title: ep.title || '',
          thumbnail: ep.thumbnail || '',
        })),
      };
    });

    for (const s of seasons) {
      animeSeasonsCache.set(s.anilistId, seasons);
    }

    return seasons;
  } catch (e) {
    console.error('Failed to fetch anime seasons from AniList', e);
    return [];
  }
}

