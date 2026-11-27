import crypto from 'node:crypto'
import type { SupabaseConfig } from './supabase-core.js'

export type VpnConnectionState =
  | 'Disconnected'
  | 'Connecting'
  | 'Connected'
  | 'Reconnecting'
  | 'Error'

export interface VpnCountryCatalogEntry {
  code: string
  name: string
  flag: string
  operational: boolean
  availableServers: number
  statusLabel: string
}

export interface VpnServerRecord {
  id: string
  country_code: string
  name: string
  region: string
  public_ip: string
  endpoint_host: string
  endpoint_port: number
  wg_public_key: string
  subnet_cidr: string
  dns_servers: string
  max_peers: number
  active_peers: number
  status: 'healthy' | 'degraded' | 'offline'
  last_heartbeat_at?: string | null
}

export interface VpnDeviceRecord {
  id: string
  user_email: string
  device_name: string
  platform: 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'web'
  wg_public_key: string
  assigned_ip: string
  is_revoked: boolean
  created_at: string
  last_seen_at: string
}

export interface VpnSessionRecord {
  id: string
  user_email: string
  device_id?: string | null
  server_id: string
  country_code: string
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'
  assigned_exit_ip: string
  assigned_tunnel_ip: string
  connected_at?: string | null
  disconnected_at?: string | null
  expires_at: string
  created_at: string
}

export interface WireGuardKeyPair {
  privateKey: string
  publicKey: string
}

export const BASE_VPN_COUNTRIES: Array<{ code: string; name: string; flag: string }> = [
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
]

// In-memory fallback store used when Supabase is not configured in local dev/tests.
const memoryDevices = new Map<string, VpnDeviceRecord>()
const memorySessions = new Map<string, VpnSessionRecord>()

function restHeaders(config: SupabaseConfig) {
  return {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Generates a real Curve25519 WireGuard keypair using Node's native X25519 support.
 * Extracts the raw 32-byte keys from PKCS8/SPKI DER envelopes as 44-char base64 strings.
 */
export function generateWireGuardKeyPair(): WireGuardKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519')
  const privDer = privateKey.export({ format: 'der', type: 'pkcs8' })
  const pubDer = publicKey.export({ format: 'der', type: 'spki' })
  const rawPriv = privDer.subarray(privDer.length - 32)
  const rawPub = pubDer.subarray(pubDer.length - 32)
  return {
    privateKey: rawPriv.toString('base64'),
    publicKey: rawPub.toString('base64'),
  }
}

/**
 * Reads operational WireGuard servers from `VPN_SERVERS_JSON` env (for quick Oracle Cloud
 * single-server deployment without DB seeding) or Supabase `vpn_servers`.
 * Never fabricates fake servers.
 */
export async function listOperationalVpnServers(
  config: SupabaseConfig | null,
  env?: Record<string, string | undefined>,
): Promise<VpnServerRecord[]> {
  const envServers: VpnServerRecord[] = []
  const rawJson = (env?.VPN_SERVERS_JSON || '').trim()
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (
            item &&
            typeof item.country_code === 'string' &&
            typeof item.endpoint_host === 'string' &&
            typeof item.wg_public_key === 'string' &&
            typeof item.public_ip === 'string'
          ) {
            envServers.push({
              id: String(item.id || `env-${item.country_code.toLowerCase()}`),
              country_code: item.country_code.toUpperCase(),
              name: String(item.name || `${item.country_code.toUpperCase()} WireGuard`),
              region: String(item.region || item.country_code.toUpperCase()),
              public_ip: String(item.public_ip),
              endpoint_host: String(item.endpoint_host),
              endpoint_port: Number(item.endpoint_port) || 51820,
              wg_public_key: String(item.wg_public_key),
              subnet_cidr: String(item.subnet_cidr || '10.66.0.0/24'),
              dns_servers: String(item.dns_servers || '1.1.1.1, 9.9.9.9'),
              max_peers: Number(item.max_peers) || 50,
              active_peers: Number(item.active_peers) || 0,
              status: item.status === 'degraded' || item.status === 'offline' ? item.status : 'healthy',
              last_heartbeat_at: item.last_heartbeat_at || new Date().toISOString(),
            })
          }
        }
      }
    } catch {
      // ignore malformed env JSON
    }
  }

  if (!config) {
    return envServers
  }

  try {
    const url = `${config.url}/rest/v1/vpn_servers?select=id,country_code,name,region,public_ip,endpoint_host,endpoint_port,wg_public_key,subnet_cidr,dns_servers,max_peers,active_peers,status,last_heartbeat_at`
    const res = await fetch(url, { headers: restHeaders(config) })
    if (!res.ok) return envServers
    const dbRows = (await res.json()) as VpnServerRecord[]
    const seen = new Set(dbRows.map((r) => r.id))
    return [...dbRows, ...envServers.filter((s) => !seen.has(s.id))]
  } catch {
    return envServers
  }
}

export async function listVpnCountries(
  config: SupabaseConfig | null,
  env?: Record<string, string | undefined>,
): Promise<VpnCountryCatalogEntry[]> {
  const servers = await listOperationalVpnServers(config, env)

  return BASE_VPN_COUNTRIES.map((country) => {
    const healthyForCountry = servers.filter(
      (s) =>
        s.country_code.toUpperCase() === country.code &&
        s.status === 'healthy' &&
        s.active_peers < s.max_peers,
    )
    const operational = healthyForCountry.length > 0
    return {
      code: country.code,
      name: country.name,
      flag: country.flag,
      operational,
      availableServers: healthyForCountry.length,
      statusLabel: operational
        ? `${healthyForCountry.length} operational`
        : 'No server deployed',
    }
  })
}

function allocateTunnelIp(subnetCidr: string, seedString: string): string {
  const baseMatch = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}/.exec(subnetCidr)
  const prefix = baseMatch ? baseMatch[1] : '10.66.0'
  const hash = crypto.createHash('sha256').update(seedString).digest()
  // Host octet in 2..250 (1 is server gateway)
  const octet = 2 + (hash[0] % 249)
  return `${prefix}.${octet}/32`
}

export function buildWireGuardClientConfig(params: {
  clientPrivateKey: string
  assignedTunnelIp: string
  dnsServers: string
  serverPublicKey: string
  endpointHost: string
  endpointPort: number
  blockIpv6Leaks?: boolean
}): string {
  const allowedIps = params.blockIpv6Leaks === false ? '0.0.0.0/0, ::/0' : '0.0.0.0/0'
  return [
    '[Interface]',
    `PrivateKey = ${params.clientPrivateKey}`,
    `Address = ${params.assignedTunnelIp}`,
    `DNS = ${params.dnsServers}`,
    'MTU = 1420',
    '',
    '[Peer]',
    `PublicKey = ${params.serverPublicKey}`,
    `Endpoint = ${params.endpointHost}:${params.endpointPort}`,
    `AllowedIPs = ${allowedIps}`,
    'PersistentKeepalive = 25',
    '',
  ].join('\n')
}

export async function provisionVpnConfiguration(params: {
  config: SupabaseConfig | null
  env?: Record<string, string | undefined>
  userEmail: string
  countryCode: string
  deviceName?: string
  platform?: VpnDeviceRecord['platform']
}): Promise<{
  ok: boolean
  status: number
  error?: string
  server?: Omit<VpnServerRecord, 'wg_public_key'> & { wg_public_key: string }
  device?: VpnDeviceRecord
  session?: VpnSessionRecord
  wireguardConfig?: string
}> {
  const cleanCountry = (params.countryCode || '').trim().toUpperCase()
  const knownCountry = BASE_VPN_COUNTRIES.find((c) => c.code === cleanCountry)
  if (!knownCountry) {
    return { ok: false, status: 400, error: `Invalid country code "${params.countryCode}".` }
  }

  const servers = await listOperationalVpnServers(params.config, params.env)
  const healthy = servers
    .filter(
      (s) =>
        s.country_code.toUpperCase() === cleanCountry &&
        s.status === 'healthy' &&
        s.active_peers < s.max_peers,
    )
    .sort((a, b) => a.active_peers - b.active_peers)

  if (healthy.length === 0) {
    return {
      ok: false,
      status: 503,
      error: `No operational WireGuard server is currently deployed in ${knownCountry.name}.`,
    }
  }

  const chosenServer = healthy[0]
  const keyPair = generateWireGuardKeyPair()
  const nowIso = new Date().toISOString()
  const deviceId = crypto.randomUUID()
  const assignedTunnelIp = allocateTunnelIp(
    chosenServer.subnet_cidr,
    `${params.userEmail}:${deviceId}`,
  )

  const device: VpnDeviceRecord = {
    id: deviceId,
    user_email: params.userEmail,
    device_name: (params.deviceName || 'Lumen Client').slice(0, 64),
    platform: params.platform || 'windows',
    wg_public_key: keyPair.publicKey,
    assigned_ip: assignedTunnelIp,
    is_revoked: false,
    created_at: nowIso,
    last_seen_at: nowIso,
  }

  const session: VpnSessionRecord = {
    id: crypto.randomUUID(),
    user_email: params.userEmail,
    device_id: device.id,
    server_id: chosenServer.id,
    country_code: cleanCountry,
    status: 'connecting',
    assigned_exit_ip: chosenServer.public_ip,
    assigned_tunnel_ip: assignedTunnelIp,
    connected_at: null,
    disconnected_at: null,
    expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    created_at: nowIso,
  }

  if (params.config) {
    try {
      await fetch(`${params.config.url}/rest/v1/vpn_devices`, {
        method: 'POST',
        headers: restHeaders(params.config),
        body: JSON.stringify(device),
      })
      await fetch(`${params.config.url}/rest/v1/vpn_sessions`, {
        method: 'POST',
        headers: restHeaders(params.config),
        body: JSON.stringify(session),
      })
    } catch {
      // keep memory fallback in sync
    }
  }

  memoryDevices.set(device.id, device)
  memorySessions.set(session.id, session)

  const wireguardConfig = buildWireGuardClientConfig({
    clientPrivateKey: keyPair.privateKey,
    assignedTunnelIp,
    dnsServers: chosenServer.dns_servers,
    serverPublicKey: chosenServer.wg_public_key,
    endpointHost: chosenServer.endpoint_host,
    endpointPort: chosenServer.endpoint_port,
    blockIpv6Leaks: true,
  })

  return {
    ok: true,
    status: 200,
    server: chosenServer,
    device,
    session,
    wireguardConfig,
  }
}

export async function getUserActiveVpnSession(
  config: SupabaseConfig | null,
  userEmail: string,
): Promise<VpnSessionRecord | null> {
  const norm = userEmail.trim().toLowerCase()
  if (config) {
    try {
      const url = `${config.url}/rest/v1/vpn_sessions?user_email=eq.${encodeURIComponent(
        norm,
      )}&status=in.(connecting,connected,reconnecting)&order=created_at.desc&limit=1`
      const res = await fetch(url, { headers: restHeaders(config) })
      if (res.ok) {
        const rows = (await res.json()) as VpnSessionRecord[]
        if (rows.length > 0) return rows[0]
      }
    } catch {
      // fall through to memory store
    }
  }

  const mem = Array.from(memorySessions.values())
    .filter(
      (s) =>
        s.user_email.toLowerCase() === norm &&
        (s.status === 'connecting' || s.status === 'connected' || s.status === 'reconnecting'),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  return mem[0] || null
}

export async function markVpnSessionDisconnected(params: {
  config: SupabaseConfig | null
  userEmail: string
  sessionId?: string
}): Promise<{ ok: boolean; disconnectedCount: number }> {
  const norm = params.userEmail.trim().toLowerCase()
  const nowIso = new Date().toISOString()
  let count = 0

  for (const [id, sess] of memorySessions.entries()) {
    if (
      sess.user_email.toLowerCase() === norm &&
      (!params.sessionId || sess.id === params.sessionId) &&
      sess.status !== 'disconnected'
    ) {
      memorySessions.set(id, { ...sess, status: 'disconnected', disconnected_at: nowIso })
      count += 1
    }
  }

  if (params.config) {
    try {
      const filter = params.sessionId
        ? `id=eq.${encodeURIComponent(params.sessionId)}&user_email=eq.${encodeURIComponent(norm)}`
        : `user_email=eq.${encodeURIComponent(norm)}&status=in.(connecting,connected,reconnecting)`
      await fetch(`${params.config.url}/rest/v1/vpn_sessions?${filter}`, {
        method: 'PATCH',
        headers: restHeaders(params.config),
        body: JSON.stringify({ status: 'disconnected', disconnected_at: nowIso }),
      })
    } catch {
      // ignore
    }
  }

  return { ok: true, disconnectedCount: count }
}

export async function revokeUserVpnDevice(params: {
  config: SupabaseConfig | null
  userEmail: string
  deviceId: string
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const norm = params.userEmail.trim().toLowerCase()
  const cleanDeviceId = (params.deviceId || '').trim()
  if (!cleanDeviceId) {
    return { ok: false, status: 400, error: 'Missing deviceId.' }
  }

  const mem = memoryDevices.get(cleanDeviceId)
  if (mem) {
    if (mem.user_email.toLowerCase() !== norm) {
      return { ok: false, status: 403, error: 'Cannot revoke another user device.' }
    }
    memoryDevices.set(cleanDeviceId, { ...mem, is_revoked: true })
  }

  if (params.config) {
    try {
      const checkRes = await fetch(
        `${params.config.url}/rest/v1/vpn_devices?id=eq.${encodeURIComponent(cleanDeviceId)}&select=id,user_email`,
        { headers: restHeaders(params.config) },
      )
      if (checkRes.ok) {
        const rows = (await checkRes.json()) as Array<{ id: string; user_email: string }>
        if (rows.length > 0 && rows[0].user_email.toLowerCase() !== norm) {
          return { ok: false, status: 403, error: 'Cannot revoke another user device.' }
        }
        await fetch(
          `${params.config.url}/rest/v1/vpn_devices?id=eq.${encodeURIComponent(cleanDeviceId)}&user_email=eq.${encodeURIComponent(norm)}`,
          {
            method: 'PATCH',
            headers: restHeaders(params.config),
            body: JSON.stringify({ is_revoked: true }),
          },
        )
      }
    } catch {
      // ignore
    }
  }

  await markVpnSessionDisconnected({ config: params.config, userEmail: norm })
  return { ok: true, status: 200 }
}
