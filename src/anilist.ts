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

export type AniListClient = {
  id: string;
  secret: string;
  name: string;
};

export const ANILIST_CLIENTS: AniListClient[] = [
  {
    name: 'Primary (45397)',
    id: (import.meta as any).env?.ANILIST_CLIENT_ID || (import.meta as any).env?.VITE_ANILIST_CLIENT_ID || '45397',
    secret: (import.meta as any).env?.ANILIST_CLIENT_SECRET || (import.meta as any).env?.VITE_ANILIST_CLIENT_SECRET || 'sx912uXkCtWuA3wLZPP3T9IAyEfYfkC8qjxxWvHn',
  },
  {
    name: 'Secondary (49118)',
    id: (import.meta as any).env?.ANILIST_SECONDARY_CLIENT_ID || (import.meta as any).env?.VITE_ANILIST_SECONDARY_CLIENT_ID || '49118',
    secret: (import.meta as any).env?.ANILIST_SECONDARY_CLIENT_SECRET || (import.meta as any).env?.VITE_ANILIST_SECONDARY_CLIENT_SECRET || 'fjVuedrK0l2Jg6DrNE3vbKPlXp2QyQ0DANHXIorF',
  },
];

let currentClientIndex = 0;
const clientCooldownUntil: Map<number, number> = new Map();

export function getActiveAniListClient(): AniListClient {
  const idx = getNextAvailableClientIndex();
  return ANILIST_CLIENTS[idx];
}

function getNextAvailableClientIndex(): number {
  const now = Date.now();
  const currentCooldown = clientCooldownUntil.get(currentClientIndex) || 0;
  if (now > currentCooldown) {
    return currentClientIndex;
  }

  for (let i = 0; i < ANILIST_CLIENTS.length; i++) {
    const idx = (currentClientIndex + i) % ANILIST_CLIENTS.length;
    const cd = clientCooldownUntil.get(idx) || 0;
    if (now > cd) {
      currentClientIndex = idx;
      return idx;
    }
  }

  return currentClientIndex;
}

export function rotateToNextAniListClient(cooldownSeconds = 60): AniListClient {
  const now = Date.now();
  clientCooldownUntil.set(currentClientIndex, now + cooldownSeconds * 1000);
  const oldClient = ANILIST_CLIENTS[currentClientIndex];
  currentClientIndex = (currentClientIndex + 1) % ANILIST_CLIENTS.length;
  const newClient = ANILIST_CLIENTS[currentClientIndex];
  console.warn(`[AniList] Limit reached on ${oldClient.name}. Rolling over to ${newClient.name}. Cooldown: ${cooldownSeconds}s.`);
  return newClient;
}

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

async function queryAniList(query: string, variables: Record<string, any>, retryCount = 0): Promise<any> {
  const maxRetries = ANILIST_CLIENTS.length;
  getNextAvailableClientIndex();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    const response = await fetch(ANILIST_GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    const remaining = response.headers.get('X-RateLimit-Remaining');
    const retryAfter = response.headers.get('Retry-After') || response.headers.get('X-RateLimit-Reset');

    if (response.status === 429 || (remaining !== null && Number(remaining) === 0)) {
      const waitTime = retryAfter ? Math.max(10, parseInt(retryAfter, 10)) : 60;
      rotateToNextAniListClient(waitTime);

      if (retryCount < maxRetries) {
        return queryAniList(query, variables, retryCount + 1);
      }
    }

    const json = await response.json();

    if (!response.ok || (Array.isArray(json.errors) && json.errors.length > 0)) {
      const errorMsg = json.errors?.[0]?.message || 'AniList query failed';
      const status = json.errors?.[0]?.status || response.status;
      if (
        status === 429 ||
        errorMsg.toLowerCase().includes('rate limit') ||
        errorMsg.toLowerCase().includes('too many requests')
      ) {
        rotateToNextAniListClient(60);
        if (retryCount < maxRetries) {
          return queryAniList(query, variables, retryCount + 1);
        }
      }
      if (!response.ok) {
        throw new Error(errorMsg);
      }
    }

    return json.data;
  } catch (err: any) {
    if (
      err?.message &&
      (err.message.toLowerCase().includes('rate limit') || err.message.toLowerCase().includes('too many requests')) &&
      retryCount < maxRetries
    ) {
      rotateToNextAniListClient(60);
      return queryAniList(query, variables, retryCount + 1);
    }
    throw err;
  }
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
    // Walk the full prequel/sequel/parent chain breadth-first so every related
    // season AniList links together is discovered — no matter how far it sits
    // from the entry the user opened. Each entry stays a separate season, just
    // like AniList presents them.
    const knownMedia = new Map<number, any>();
    let frontier: number[] = [anilistId];
    let guard = 0;

    while (frontier.length > 0 && knownMedia.size < 60 && guard < 10) {
      guard++;
      const batchData = await queryAniList(batchQuery, { ids: frontier });
      const media: any[] = batchData?.Page?.media || [];
      const nextIds = new Set<number>();
      for (const m of media) {
        if (!knownMedia.has(m.id)) {
          knownMedia.set(m.id, m);
        }
        for (const edge of m.relations?.edges || []) {
          if (relTypes.includes(edge.relationType) && !knownMedia.has(edge.node.id)) {
            nextIds.add(edge.node.id);
          }
        }
      }
      frontier = Array.from(nextIds).filter((id) => !knownMedia.has(id));
    }

    if (knownMedia.size === 0) {
      return [];
    }

    const finalMediaList: any[] = Array.from(knownMedia.values());

    const sortedMedia = finalMediaList.filter(isMainTvSeason).sort((a, b) => {
      const yearA = a.seasonYear || 9999;
      const yearB = b.seasonYear || 9999;
      if (yearA !== yearB) return yearA - yearB;
      return a.id - b.id;
    });

    const seasons: AnimeSeasonInfo[] = sortedMedia.map((m, index) => {
      const displayTitle = m.title?.english || m.title?.romaji || m.title?.userPreferred || `Season ${index + 1}`;
      // AniList reports `episodes: null` while a series is still airing (e.g.
      // long-running shows like One Piece). In that case the already-aired
      // count is `nextAiringEpisode.episode - 1`; only fall back to 12 when
      // neither the total nor an airing schedule is known.
      const airedSoFar =
        typeof m.nextAiringEpisode?.episode === 'number'
          ? Math.max(0, m.nextAiringEpisode.episode - 1)
          : 0;
      const resolvedEpisodeCount =
        m.episodes && m.episodes > 0 ? m.episodes : airedSoFar > 0 ? airedSoFar : 12;
      return {
        season: index + 1,
        anilistId: m.id,
        title: displayTitle,
        episodeCount: resolvedEpisodeCount,
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

export async function fetchAnimeRelationsAndRecommendations(anilistId: number): Promise<any[]> {
  if (!anilistId || isNaN(anilistId)) {
    return [];
  }

  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        relations {
          edges {
            relationType
            node {
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
                medium
              }
              bannerImage
              description
              genres
              seasonYear
              episodes
              duration
              format
              status
              averageScore
            }
          }
        }
        recommendations(sort: RATING_DESC, perPage: 16) {
          nodes {
            mediaRecommendation {
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
                medium
              }
              bannerImage
              description
              genres
              seasonYear
              episodes
              duration
              format
              status
              averageScore
            }
          }
        }
      }
    }
  `;

  try {
    const data = await queryAniList(query, { id: anilistId });
    const rawRelations = data?.Media?.relations?.edges || [];
    const relationPriority: Record<string, number> = {
      SEQUEL: 1,
      PREQUEL: 2,
      SIDE_STORY: 3,
      PARENT: 4,
      ALTERNATIVE: 5,
      SPIN_OFF: 6,
      SUMMARY: 7,
      OTHER: 8,
    };

    const formatRelationLabel = (relType: string) => {
      switch (relType) {
        case 'SEQUEL': return 'Next Season / Sequel';
        case 'PREQUEL': return 'Prequel';
        case 'SIDE_STORY': return 'Side Story';
        case 'ALTERNATIVE': return 'Alternative';
        case 'PARENT': return 'Main Series';
        case 'SUMMARY': return 'Movie / Recap';
        case 'SPIN_OFF': return 'Spin-off';
        default: return 'Related';
      }
    };

    const seenIds = new Set<number>([anilistId]);
    const results: any[] = [];

    // 1. Direct Relations (Sequels, Prequels, Next Seasons, Side Stories)
    const sortedEdges = [...rawRelations].sort((a: any, b: any) => {
      const pA = relationPriority[a?.relationType] || 99;
      const pB = relationPriority[b?.relationType] || 99;
      return pA - pB;
    });

    for (const edge of sortedEdges) {
      const node = edge?.node;
      if (!node?.id || seenIds.has(node.id)) continue;
      seenIds.add(node.id);

      const title = node.title?.english || node.title?.userPreferred || node.title?.romaji || 'Anime';
      results.push({
        id: `al-${node.id}`,
        anilistId: node.id,
        title,
        logoTitle: title,
        poster: node.coverImage?.extraLarge || node.coverImage?.large || '',
        hero: node.bannerImage || node.coverImage?.extraLarge || '',
        still: node.bannerImage || node.coverImage?.extraLarge || '',
        genres: node.genres || ['Anime'],
        synopsis: (node.description || '').replace(/<[^>]*>?/gm, ''),
        year: String(node.seasonYear || ''),
        type: node.format === 'MOVIE' ? 'Movie' : 'Anime',
        isAnime: true,
        rating: node.averageScore ? (node.averageScore / 10).toFixed(1) : '8.5',
        label: formatRelationLabel(edge.relationType),
        duration: node.duration ? `${node.duration}m` : undefined,
        runtime: node.duration ? `${node.duration}m` : 'Anime',
        maturity: 'TV-14',
        progress: 0,
        cast: [],
        director: 'Director unavailable',
        awards: 'N/A',
        boxOffice: 'N/A',
        ratings: [],
        badges: ['Anime'],
        rank: 1,
      });
    }

    // 2. High-rated recommendations
    const rawRecs = data?.Media?.recommendations?.nodes || [];
    for (const rec of rawRecs) {
      const node = rec?.mediaRecommendation;
      if (!node?.id || seenIds.has(node.id)) continue;
      seenIds.add(node.id);

      const title = node.title?.english || node.title?.userPreferred || node.title?.romaji || 'Anime';
      results.push({
        id: `al-${node.id}`,
        anilistId: node.id,
        title,
        logoTitle: title,
        poster: node.coverImage?.extraLarge || node.coverImage?.large || '',
        hero: node.bannerImage || node.coverImage?.extraLarge || '',
        still: node.bannerImage || node.coverImage?.extraLarge || '',
        genres: node.genres || ['Anime'],
        synopsis: (node.description || '').replace(/<[^>]*>?/gm, ''),
        year: String(node.seasonYear || ''),
        type: node.format === 'MOVIE' ? 'Movie' : 'Anime',
        isAnime: true,
        rating: node.averageScore ? (node.averageScore / 10).toFixed(1) : '8.2',
        label: 'Recommended',
        duration: node.duration ? `${node.duration}m` : undefined,
        runtime: node.duration ? `${node.duration}m` : 'Anime',
        maturity: 'TV-14',
        progress: 0,
        cast: [],
        director: 'Director unavailable',
        awards: 'N/A',
        boxOffice: 'N/A',
        ratings: [],
        badges: ['Anime'],
        rank: 1,
      });
    }

    return results;
  } catch (err) {
    console.error('fetchAnimeRelationsAndRecommendations error:', err);
    return [];
  }
}


