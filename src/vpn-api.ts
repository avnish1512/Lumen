import { getSessionToken } from './accounts-api'

export type VpnConnectionState =
  | 'Disconnected'
  | 'Connecting'
  | 'Connected'
  | 'Reconnecting'
  | 'Error'

export interface VpnCountryOption {
  code: string
  name: string
  flag: string
  operational: boolean
  availableServers: number
  statusLabel: string
}

export interface VpnControlSession {
  id: string
  country_code: string
  status: string
  assigned_exit_ip: string
  assigned_tunnel_ip: string
  connected_at?: string | null
  expires_at: string
}

export interface VpnConnectResult {
  ok: boolean
  error?: string
  session?: VpnControlSession
  server?: {
    id: string
    country_code: string
    name: string
    region: string
    public_ip: string
    endpoint_host: string
    endpoint_port: number
  } | null
  wireguardConfig?: string
}

export const COMPANION_BASE_URL = 'http://127.0.0.1:47821'

export interface NativeCompanionStatus {
  available: boolean
  connected: boolean
  countryCode?: string
  exitIp?: string
  connectedAt?: string
}

export async function fetchVpnCountries(signal?: AbortSignal): Promise<VpnCountryOption[]> {
  const res = await fetch('/api/vpn/countries', { signal })
  const data = (await res.json()) as { ok?: boolean; countries?: VpnCountryOption[]; error?: string }
  if (!res.ok || !Array.isArray(data?.countries)) {
    throw new Error(data?.error || `Failed to load countries (HTTP ${res.status}).`)
  }
  return data.countries
}

export async function connectVpnControl(
  countryCode: string,
  signal?: AbortSignal,
): Promise<VpnConnectResult> {
  const token = getSessionToken()
  if (!token) {
    throw new Error('Sign in to your Lumen account to connect to Lumen VPN.')
  }
  const res = await fetch('/api/vpn/connect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ countryCode }),
    signal,
  })
  const data = (await res.json()) as VpnConnectResult
  if (!res.ok || !data.ok) {
    throw new Error(data?.error || `VPN connection failed (HTTP ${res.status}).`)
  }
  return data
}

export async function disconnectVpnControl(sessionId?: string): Promise<void> {
  const token = getSessionToken()
  if (!token) return
  await fetch('/api/vpn/disconnect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId }),
  }).catch(() => {})
}

export async function checkNativeCompanionStatus(): Promise<NativeCompanionStatus> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 900)
  try {
    const res = await fetch(`${COMPANION_BASE_URL}/status`, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return { available: false, connected: false }
    const data = (await res.json()) as Partial<NativeCompanionStatus>
    return {
      available: true,
      connected: Boolean(data.connected),
      countryCode: data.countryCode,
      exitIp: data.exitIp,
      connectedAt: data.connectedAt,
    }
  } catch {
    clearTimeout(timer)
    return { available: false, connected: false }
  }
}

export async function connectNativeCompanion(
  wireguardConfig: string,
  countryCode: string,
): Promise<{ ok: boolean; exitIp?: string; error?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${COMPANION_BASE_URL}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: wireguardConfig, countryCode }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    const data = (await res.json()) as { ok?: boolean; exitIp?: string; error?: string }
    if (!res.ok || !data.ok) {
      return { ok: false, error: data?.error || `Companion returned HTTP ${res.status}` }
    }
    return { ok: true, exitIp: data.exitIp }
  } catch {
    clearTimeout(timer)
    return { ok: false, error: 'Lumen VPN Companion is not running on this device.' }
  }
}

export async function disconnectNativeCompanion(): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    await fetch(`${COMPANION_BASE_URL}/disconnect`, {
      method: 'POST',
      signal: controller.signal,
    })
  } catch {
    // ignore if companion is not running
  } finally {
    clearTimeout(timer)
  }
}

export interface IpApiVpnInfo {
  ip?: string
  service?: string
  url?: string
  type?: 'exit_node' | 'vpn_server' | string
  last_seen?: number
  last_seen_str?: string
  exit_node_region?: string
  hostname?: string
  country_code?: string
  city_name?: string
  latitude?: number
  longitude?: number
  is_vpn?: boolean
}

export interface IpApiEgressService {
  type?: string
  provider?: string
}

export interface IpApiDatacenter {
  datacenter?: string
  domain?: string
  network?: string
  country?: string
  state?: string
  city?: string
}

export interface IpApiCompany {
  name?: string
  abuser_score?: string
  domain?: string
  type?: string
  network?: string
  netname?: string | null
}

export interface IpApiAbuse {
  name?: string
  address?: string
  email?: string
  phone?: string
}

export interface IpApiAsn {
  asn?: number
  abuser_score?: string
  route?: string
  descr?: string
  country?: string
  active?: boolean
  org?: string
  domain?: string
  abuse?: string
  type?: string
  created?: string
  updated?: string
  rir?: string
  prefixes?: string[]
  prefixesIPv6?: string[]
}

export interface IpApiLocation {
  is_eu_member?: boolean
  calling_code?: string
  currency_code?: string
  continent?: string
  country?: string
  country_code?: string
  state?: string
  city?: string
  latitude?: number
  longitude?: number
  zip?: string
  timezone?: string
  local_time?: string
  local_time_unix?: number
  is_dst?: boolean
  utcoffset?: string
  accuracy?: string | null
}

export interface IpApiResponse {
  ip?: string
  rir?: string | null
  is_bogon?: boolean
  is_mobile?: boolean
  is_satellite?: boolean
  is_anycast?: boolean
  is_crawler?: false | string
  is_datacenter?: boolean
  is_tor?: boolean
  is_proxy?: boolean
  is_vpn?: boolean | unknown
  is_abuser?: boolean
  vpn?: IpApiVpnInfo
  egress_service?: IpApiEgressService
  datacenter?: IpApiDatacenter
  abuser?: { source_count?: number; total_sources?: number }
  company?: IpApiCompany | null
  abuse?: IpApiAbuse
  asn?: IpApiAsn
  location?: IpApiLocation | null
  elapsed_ms?: number
  error?: string
  error_code?: string
  // ASN top-level fields when querying ASxxxx
  org?: string
  descr?: string
  country?: string
  prefixes?: string[]
}

const LORD_PROXY_STORAGE_KEY = 'lumen_lord_vpn_proxy_v1'
const CACHE_TTL_MS = 60_000
const lookupCache = new Map<string, { data: IpApiResponse; at: number }>()

export function readLordProxyEnabled(): boolean {
  try {
    return window.localStorage.getItem(LORD_PROXY_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeLordProxyEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(LORD_PROXY_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // ignore storage errors
  }
}

export async function fetchVpnNetworkStatus(
  query?: string,
  signal?: AbortSignal,
): Promise<IpApiResponse> {
  const key = (query || '__self__').trim()
  const cached = lookupCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data
  }

  const endpoint = query?.trim()
    ? `/api/vpn-check?q=${encodeURIComponent(query.trim())}`
    : '/api/vpn-check'

  const res = await fetch(endpoint, { signal })
  const data = (await res.json()) as IpApiResponse
  if (!res.ok || data?.error) {
    throw new Error(data?.error || `Network check failed (HTTP ${res.status}).`)
  }
  lookupCache.set(key, { data, at: Date.now() })
  return data
}

export function assessNetworkPrivacy(
  data: IpApiResponse | null,
  inAppProxyEnabled = false,
): {
  level: 'protected' | 'relay' | 'exposed'
  label: string
  summary: string
} {
  if (!data) {
    return inAppProxyEnabled
      ? {
          level: 'relay',
          label: 'In-App Edge Proxy Active',
          summary: 'Lord API traffic routes through Lumen edge servers.',
        }
      : {
          level: 'exposed',
          label: 'Checking Network…',
          summary: 'Inspecting your IP and VPN/proxy status via ipapi.is.',
        }
  }

  if (data.is_vpn || data.is_tor) {
    const provider = data.vpn?.service || (data.is_tor ? 'Tor Network' : 'VPN Tunnel')
    return {
      level: 'protected',
      label: `VPN Protected (${provider})`,
      summary: `Your traffic is masked behind ${provider}${data.location?.country ? ` (${data.location.city ? `${data.location.city}, ` : ''}${data.location.country})` : ''}.`,
    }
  }

  if (data.is_proxy || data.egress_service?.provider || inAppProxyEnabled) {
    const relayName =
      data.egress_service?.provider || (inAppProxyEnabled ? 'Lumen Edge Proxy' : 'Proxy Relay')
    return {
      level: 'relay',
      label: `Protected via ${relayName}`,
      summary: inAppProxyEnabled
        ? 'Lumen in-app server proxy routing is enabled alongside your network connection.'
        : `Traffic exits through ${relayName}.`,
    }
  }

  return {
    level: 'exposed',
    label: 'Direct ISP Connection',
    summary:
      'No external VPN tunnel detected on your public IP. Enable Lumen Edge Proxy below or connect an OS VPN for full-device privacy.',
  }
}
