const SUPEREMBED_BASE_URL = 'https://getsuperembed.link/'

const superEmbedSettings = {
  player_bg_color: '000000',
  player_font: 'Poppins',
  player_font_color: 'ffffff',
  player_loader: '1',
  player_primary_color: '34cfeb',
  player_secondary_color: '6900e0',
  player_sources_toggle_type: '2',
  preferred_server: '0',
}

export type SuperEmbedPlayerOptions = {
  episode?: string
  season?: string
  tmdb?: string
  videoId: string
}

export function superEmbedOptionsFromParams(params: URLSearchParams) {
  const videoId = params.get('video_id')?.trim() ?? ''
  const season =
    params.get('season')?.trim() || params.get('s')?.trim() || undefined
  const episode =
    params.get('episode')?.trim() || params.get('e')?.trim() || undefined

  if (!videoId) {
    return null
  }

  return {
    episode,
    season,
    tmdb: params.get('tmdb')?.trim() || undefined,
    videoId,
  } satisfies SuperEmbedPlayerOptions
}

export function buildSuperEmbedRequestUrl(options: SuperEmbedPlayerOptions) {
  const params = new URLSearchParams({
    ...superEmbedSettings,
    episode: options.episode ?? '0',
    season: options.season ?? '0',
    tmdb: options.tmdb ?? '0',
    video_id: options.videoId,
  })

  return `${SUPEREMBED_BASE_URL}?${params}`
}

export async function resolveSuperEmbedPlayerUrl(
  options: SuperEmbedPlayerOptions,
) {
  const response = await fetch(buildSuperEmbedRequestUrl(options), {
    redirect: 'follow',
  })
  const body = (await response.text()).trim()

  if (!response.ok) {
    throw new Error(body || `SuperEmbed returned ${response.status}.`)
  }

  return body
}

export function isSuperEmbedRedirectUrl(value: string) {
  return value.startsWith('https://') || value.startsWith('http://')
}
