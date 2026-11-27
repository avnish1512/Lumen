import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_IPAPI_IS_KEY,
  extractClientPublicIp,
  resolveIpApiKey,
} from '../api/_lib/ipapi-core'
import {
  generateWireGuardKeyPair,
  listVpnCountries,
  provisionVpnConfiguration,
  revokeUserVpnDevice,
} from '../api/_lib/vpn-control-core'
import { setSessionToken } from './accounts-api'
import { assessNetworkPrivacy } from './vpn-api'
import { useLumenVpnState, VpnModal, VpnStatusButton } from './VpnModal'

function VpnTestHarness() {
  const [open, setOpen] = useState(false)
  const [vpnState, setVpnState] = useLumenVpnState()
  return (
    <div>
      <VpnStatusButton
        state={vpnState.connectionState}
        countryCode={vpnState.selectedCountry?.code}
        onClick={() => setOpen(true)}
      />
      <VpnModal
        open={open}
        onClose={() => setOpen(false)}
        vpnState={vpnState}
        setVpnState={setVpnState}
      />
    </div>
  )
}

const SAMPLE_WG_SERVER_ENV = {
  VPN_SERVERS_JSON: JSON.stringify([
    {
      id: 'srv-in-mum-1',
      country_code: 'IN',
      name: 'Mumbai Node 1',
      region: 'ap-mumbai-1',
      public_ip: '140.238.165.42',
      endpoint_host: '140.238.165.42',
      endpoint_port: 51820,
      wg_public_key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      subnet_cidr: '10.66.0.0/24',
      dns_servers: '1.1.1.1, 9.9.9.9',
      max_peers: 100,
      active_peers: 2,
      status: 'healthy',
    },
  ]),
}

describe('Lumen VPN — Control Plane, ipapi.is & Modal UI', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setSessionToken(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps ipapi.is key server-side and extracts public client IP safely', () => {
    expect(resolveIpApiKey()).toBe(DEFAULT_IPAPI_IS_KEY)
    expect(resolveIpApiKey({ IPAPI_IS_KEY: 'custom-server-key' })).toBe('custom-server-key')

    expect(extractClientPublicIp({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' })).toBe('203.0.113.5')
    expect(extractClientPublicIp({ 'x-forwarded-for': '127.0.0.1' }, '192.168.1.10')).toBeUndefined()
  })

  it('assesses VPN, proxy relay, and direct ISP privacy levels accurately', () => {
    expect(
      assessNetworkPrivacy({
        ip: '140.238.165.42',
        is_vpn: true,
        is_proxy: false,
        is_tor: false,
        is_datacenter: true,
        is_abuser: false,
        is_mobile: false,
        asn: { asn: 31898, org: 'Oracle Cloud' },
        company: { name: 'Oracle Cloud' },
      }).level,
    ).toBe('protected')

    expect(
      assessNetworkPrivacy({
        ip: '49.36.10.2',
        is_vpn: false,
        is_proxy: false,
        is_tor: false,
        is_datacenter: false,
        is_abuser: false,
        is_mobile: true,
        asn: { asn: 55836, org: 'Reliance Jio' },
        company: { name: 'Reliance Jio' },
      }).level,
    ).toBe('exposed')
  })

  it('generates real X25519 WireGuard keypairs (44-char base64)', () => {
    const pair = generateWireGuardKeyPair()
    expect(pair.privateKey).toMatch(/^[A-Za-z0-9+/]{43}=$/)
    expect(pair.publicKey).toMatch(/^[A-Za-z0-9+/]{43}=$/)
    expect(pair.privateKey).not.toBe(pair.publicKey)
  })

  it('reports countries as non-operational when no real exit servers exist, and operational when provisioned', async () => {
    const emptyCountries = await listVpnCountries(null, {})
    expect(emptyCountries.length).toBeGreaterThanOrEqual(10)
    expect(emptyCountries.every((c) => c.operational === false)).toBe(true)

    const withIndia = await listVpnCountries(null, SAMPLE_WG_SERVER_ENV)
    const india = withIndia.find((c) => c.code === 'IN')
    const us = withIndia.find((c) => c.code === 'US')
    expect(india?.operational).toBe(true)
    expect(india?.availableServers).toBe(1)
    expect(us?.operational).toBe(false)
  })

  it('returns 503 when provisioning an unavailable country and valid WireGuard .conf when operational', async () => {
    const unavailable = await provisionVpnConfiguration({
      config: null,
      env: SAMPLE_WG_SERVER_ENV,
      userEmail: 'alice@example.com',
      countryCode: 'US',
    })
    expect(unavailable.ok).toBe(false)
    expect(unavailable.status).toBe(503)

    const provisioned = await provisionVpnConfiguration({
      config: null,
      env: SAMPLE_WG_SERVER_ENV,
      userEmail: 'alice@example.com',
      countryCode: 'IN',
      deviceName: 'Alice Laptop',
      platform: 'windows',
    })
    expect(provisioned.ok).toBe(true)
    expect(provisioned.status).toBe(200)
    expect(provisioned.server?.public_ip).toBe('140.238.165.42')
    expect(provisioned.wireguardConfig).toContain('[Interface]')
    expect(provisioned.wireguardConfig).toContain('[Peer]')
    expect(provisioned.wireguardConfig).toContain('Endpoint = 140.238.165.42:51820')

    // Cross-user revocation must return 403
    const forbidden = await revokeUserVpnDevice({
      config: null,
      userEmail: 'bob@example.com',
      deviceId: provisioned.device!.id,
    })
    expect(forbidden.ok).toBe(false)
    expect(forbidden.status).toBe(403)
  })

  it('renders a single VPN button, searches countries, disables unavailable ones, and shows honest browser notice without companion', async () => {
    setSessionToken('valid-test-token')

    const countriesPayload = [
      { code: 'IN', name: 'India', flag: '🇮🇳', operational: true, availableServers: 1, statusLabel: '1 server online' },
      { code: 'US', name: 'United States', flag: '🇺🇸', operational: false, availableServers: 0, statusLabel: 'No server deployed' },
    ]

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/vpn/countries')) {
        return new Response(JSON.stringify({ ok: true, countries: countriesPayload }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.startsWith('http://127.0.0.1:47821/')) {
        throw new Error('Connection refused')
      }
      if (url.includes('/api/vpn/connect')) {
        return new Response(
          JSON.stringify({
            ok: true,
            server: {
              id: 'srv-in-mum-1',
              country_code: 'IN',
              name: 'Mumbai Node 1',
              region: 'ap-mumbai-1',
              public_ip: '140.238.165.42',
              endpoint_host: '140.238.165.42',
              endpoint_port: 51820,
            },
            session: {
              id: 'sess-1',
              country_code: 'IN',
              status: 'connecting',
              assigned_exit_ip: '140.238.165.42',
              assigned_tunnel_ip: '10.66.0.2/32',
              expires_at: new Date(Date.now() + 3600_000).toISOString(),
            },
            wireguardConfig: '[Interface]\nPrivateKey = AAAA\n[Peer]\nPublicKey = BBBB\nEndpoint = 140.238.165.42:51820\n',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    render(<VpnTestHarness />)

    const trigger = screen.getByRole('button', { name: /Lumen VPN: Disconnected/i })
    expect(trigger).toBeTruthy()
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('India')).toBeTruthy()
      expect(screen.getByText('United States')).toBeTruthy()
    })

    const usOption = screen.getByRole('option', { name: /United States/i }) as HTMLButtonElement
    expect(usOption.disabled).toBe(true)

    const searchInput = screen.getByLabelText('Search VPN countries')
    fireEvent.change(searchInput, { target: { value: 'India' } })
    expect(screen.queryByText('United States')).toBeNull()

    const connectBtn = screen.getByRole('button', { name: /Connect to India/i })
    fireEvent.click(connectBtn)

    await waitFor(() => {
      expect(screen.getByText(/Browsers cannot create system-wide WireGuard tunnels directly/i)).toBeTruthy()
      expect(screen.getByRole('button', { name: /Download WireGuard Config/i })).toBeTruthy()
    })
  })

  it('shows Connected state, verified exit IP, and Disconnect button when companion activates the tunnel', async () => {
    setSessionToken('valid-test-token')

    const countriesPayload = [
      { code: 'IN', name: 'India', flag: '🇮🇳', operational: true, availableServers: 1, statusLabel: '1 server online' },
    ]

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/vpn/countries')) {
        return new Response(JSON.stringify({ ok: true, countries: countriesPayload }), { status: 200 })
      }
      if (url === 'http://127.0.0.1:47821/status') {
        return new Response(JSON.stringify({ ok: true, connected: false }), { status: 200 })
      }
      if (url === 'http://127.0.0.1:47821/connect') {
        return new Response(
          JSON.stringify({ ok: true, connected: true, countryCode: 'IN', exitIp: '140.238.165.42' }),
          { status: 200 },
        )
      }
      if (url === 'http://127.0.0.1:47821/disconnect') {
        return new Response(JSON.stringify({ ok: true, connected: false }), { status: 200 })
      }
      if (url.includes('/api/vpn/connect')) {
        return new Response(
          JSON.stringify({
            ok: true,
            server: {
              id: 'srv-in-mum-1',
              country_code: 'IN',
              name: 'Mumbai Node 1',
              region: 'ap-mumbai-1',
              public_ip: '140.238.165.42',
              endpoint_host: '140.238.165.42',
              endpoint_port: 51820,
            },
            session: {
              id: 'sess-1',
              country_code: 'IN',
              status: 'connecting',
              assigned_exit_ip: '140.238.165.42',
              assigned_tunnel_ip: '10.66.0.2/32',
              expires_at: new Date(Date.now() + 3600_000).toISOString(),
            },
            wireguardConfig: '[Interface]\nPrivateKey = AAAA\n[Peer]\nPublicKey = BBBB\nEndpoint = 140.238.165.42:51820\n',
          }),
          { status: 200 },
        )
      }
      if (url.includes('/api/vpn-check')) {
        return new Response(JSON.stringify({ ok: true, ip: '140.238.165.42', isVpn: true }), { status: 200 })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    render(<VpnTestHarness />)
    fireEvent.click(screen.getByRole('button', { name: /Lumen VPN: Disconnected/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Connect to India/i })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /Connect to India/i }))

    await waitFor(() => {
      expect(screen.getByText('140.238.165.42')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Lumen VPN: Disconnected/i })).toBeTruthy()
    })
  })
})
