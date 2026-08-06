const SUPEREMBED_BASE_URL = 'https://getsuperembed.link/'
const superEmbedRequestTimeoutMs = 7000

const superEmbedPreferredServers = new Set([
  '0',
  '7',
  '11',
  '12',
  '17',
  '18',
  '21',
  '25',
  '26',
  '29',
  '33',
])

// Keep this section aligned with the PLAYER SETTINGS block in se_player.php.
const superEmbedSettings = {
  player_font: 'Poppins',
  player_bg_color: '000000',
  player_font_color: 'ffffff',
  player_primary_color: '34cfeb',
  player_secondary_color: '6900e0',
  player_loader: '1',
  preferred_server: '0',
  player_sources_toggle_type: '2',
}

export type SuperEmbedPlayerOptions = {
  episode?: string
  preferredServer?: string
  season?: string
  tmdb?: string
  videoId: string
}

function normalizePreferredServer(value?: string) {
  const server = value?.trim() ?? ''

  return superEmbedPreferredServers.has(server)
    ? server
    : superEmbedSettings.preferred_server
}

export function superEmbedOptionsFromParams(params: URLSearchParams) {
  const videoId = params.get('video_id')?.trim() ?? ''
  const season =
    params.get('season')?.trim() || params.get('s')?.trim() || undefined
  const episode =
    params.get('episode')?.trim() || params.get('e')?.trim() || undefined
  const preferredServer = params.get('preferred_server')?.trim() || undefined

  if (!videoId) {
    return null
  }

  return {
    episode,
    preferredServer,
    season,
    tmdb: params.get('tmdb')?.trim() || undefined,
    videoId,
  } satisfies SuperEmbedPlayerOptions
}

export function buildSuperEmbedRequestUrl(options: SuperEmbedPlayerOptions) {
  const params = new URLSearchParams()

  params.set('video_id', options.videoId)
  params.set('tmdb', options.tmdb ?? '0')
  params.set('season', options.season ?? '0')
  params.set('episode', options.episode ?? '0')
  params.set('player_font', superEmbedSettings.player_font)
  params.set('player_bg_color', superEmbedSettings.player_bg_color)
  params.set('player_font_color', superEmbedSettings.player_font_color)
  params.set('player_primary_color', superEmbedSettings.player_primary_color)
  params.set(
    'player_secondary_color',
    superEmbedSettings.player_secondary_color,
  )
  params.set('player_loader', superEmbedSettings.player_loader)
  params.set(
    'preferred_server',
    normalizePreferredServer(options.preferredServer),
  )
  params.set(
    'player_sources_toggle_type',
    superEmbedSettings.player_sources_toggle_type,
  )

  return `${SUPEREMBED_BASE_URL}?${params}`
}

export async function resolveSuperEmbedPlayerUrl(
  options: SuperEmbedPlayerOptions,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, superEmbedRequestTimeoutMs)

  try {
    const response = await fetch(buildSuperEmbedRequestUrl(options), {
      redirect: 'follow',
      signal: controller.signal,
    })
    const body = (await response.text()).trim()

    if (!response.ok) {
      throw new Error(body || `SuperEmbed returned ${response.status}.`)
    }

    return body
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error("Request server didn't respond", { cause: error })
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export function isSuperEmbedRedirectUrl(value: string) {
  return value.trim().startsWith('https://')
}

