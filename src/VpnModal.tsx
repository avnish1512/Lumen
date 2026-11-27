import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  LoaderCircle,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'
import {
  checkNativeCompanionStatus,
  connectNativeCompanion,
  connectVpnControl,
  disconnectNativeCompanion,
  disconnectVpnControl,
  fetchVpnCountries,
  fetchVpnNetworkStatus,
  type VpnConnectionState,
  type VpnCountryOption,
} from './vpn-api'

interface VpnManagerState {
  connectionState: VpnConnectionState
  selectedCountry: VpnCountryOption | null
  assignedExitIp: string | null
  connectedAtMs: number | null
  sessionId: string | null
  wireguardConfig: string | null
  companionAvailable: boolean
  errorMessage: string
  browserNotice: string
}

const initialState: VpnManagerState = {
  connectionState: 'Disconnected',
  selectedCountry: null,
  assignedExitIp: null,
  connectedAtMs: null,
  sessionId: null,
  wireguardConfig: null,
  companionAvailable: false,
  errorMessage: '',
  browserNotice: '',
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const hrs = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`
}

export function VpnStatusButton({
  state,
  countryCode,
  onClick,
}: {
  state: VpnConnectionState
  countryCode?: string | null
  onClick: () => void
}) {
  const isConnected = state === 'Connected'
  const isBusy = state === 'Connecting' || state === 'Reconnecting'
  const isError = state === 'Error'

  return (
    <button
      type="button"
      className={`lumen-vpn-trigger is-${state.toLowerCase()}`}
      onClick={onClick}
      aria-label={`Lumen VPN: ${state}${countryCode && isConnected ? ` (${countryCode})` : ''}`}
      title="Lumen VPN"
    >
      {isBusy ? (
        <LoaderCircle size={15} className="spin-icon" />
      ) : isConnected ? (
        <ShieldCheck size={15} />
      ) : isError ? (
        <ShieldAlert size={15} />
      ) : (
        <Shield size={15} />
      )}
      <span className="lumen-vpn-trigger-label">
        {isConnected && countryCode ? `VPN · ${countryCode}` : state === 'Disconnected' ? 'VPN' : state}
      </span>
    </button>
  )
}

export function VpnModal({
  open,
  onClose,
  vpnState,
  setVpnState,
}: {
  open: boolean
  onClose: () => void
  vpnState: VpnManagerState
  setVpnState: React.Dispatch<React.SetStateAction<VpnManagerState>>
}) {
  const [countries, setCountries] = useState<VpnCountryOption[]>([])
  const [loadingCountries, setLoadingCountries] = useState(false)
  const [countriesError, setCountriesError] = useState('')
  const [search, setSearch] = useState('')
  const [pickedCode, setPickedCode] = useState<string>('')
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoadingCountries(true)
    setCountriesError('')

    void Promise.all([
      fetchVpnCountries(controller.signal),
      checkNativeCompanionStatus(),
    ])
      .then(([list, companion]) => {
        if (controller.signal.aborted) return
        setCountries(list)
        setPickedCode((prev) => {
          if (prev && list.some((c) => c.code === prev)) return prev
          const firstOperational = list.find((c) => c.operational)
          return firstOperational?.code || list[0]?.code || ''
        })
        setVpnState((prev) => ({
          ...prev,
          companionAvailable: companion.available,
          ...(companion.connected && companion.exitIp
            ? {
                connectionState: 'Connected',
                assignedExitIp: companion.exitIp,
                connectedAtMs: companion.connectedAt ? Date.parse(companion.connectedAt) || Date.now() : prev.connectedAtMs || Date.now(),
              }
            : {}),
        }))
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setCountriesError(err instanceof Error ? err.message : 'Failed to load VPN countries.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCountries(false)
      })

    return () => controller.abort()
  }, [open, setVpnState])

  useEffect(() => {
    if (!open || vpnState.connectionState !== 'Connected' || !vpnState.connectedAtMs) return
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [open, vpnState.connectionState, vpnState.connectedAtMs])

  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return countries
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    )
  }, [countries, search])

  const selectedOption = countries.find((c) => c.code === pickedCode) || null

  const handleConnect = async () => {
    if (!selectedOption || !selectedOption.operational) return
    setVpnState((prev) => ({
      ...prev,
      connectionState: 'Connecting',
      selectedCountry: selectedOption,
      errorMessage: '',
      browserNotice: '',
    }))

    try {
      const provisioned = await connectVpnControl(selectedOption.code)
      if (!provisioned.wireguardConfig || !provisioned.server) {
        throw new Error('Server did not return a valid WireGuard configuration.')
      }

      // Attempt real OS-level WireGuard tunnel via local Lumen Companion
      const companionRes = await connectNativeCompanion(
        provisioned.wireguardConfig,
        selectedOption.code,
      )

      if (companionRes.ok) {
        // Verify public exit IP via ipapi.is before claiming Connected
        let verifiedIp = companionRes.exitIp || provisioned.server.public_ip
        try {
          const ipCheck = await fetchVpnNetworkStatus()
          if (ipCheck.ip) verifiedIp = ipCheck.ip
        } catch {
          // keep companion-reported exit IP
        }

        setVpnState((prev) => ({
          ...prev,
          connectionState: 'Connected',
          selectedCountry: selectedOption,
          assignedExitIp: verifiedIp,
          connectedAtMs: Date.now(),
          sessionId: provisioned.session?.id || null,
          wireguardConfig: provisioned.wireguardConfig || null,
          companionAvailable: true,
          errorMessage: '',
          browserNotice: '',
        }))
        return
      }

      // Honest browser limitation: cannot establish OS WireGuard tunnel in browser JS alone
      setVpnState((prev) => ({
        ...prev,
        connectionState: 'Disconnected',
        selectedCountry: selectedOption,
        assignedExitIp: null,
        connectedAtMs: null,
        sessionId: provisioned.session?.id || null,
        wireguardConfig: provisioned.wireguardConfig || null,
        companionAvailable: false,
        errorMessage: '',
        browserNotice:
          'Browsers cannot create system-wide WireGuard tunnels directly. Your WireGuard configuration is ready below — import it into WireGuard or run Lumen VPN Companion to change your device IP.',
      }))
    } catch (err) {
      setVpnState((prev) => ({
        ...prev,
        connectionState: 'Error',
        errorMessage: err instanceof Error ? err.message : 'VPN connection failed.',
      }))
    }
  }

  const handleDisconnect = async () => {
    await disconnectNativeCompanion()
    await disconnectVpnControl(vpnState.sessionId || undefined)
    setVpnState((prev) => ({
      ...prev,
      connectionState: 'Disconnected',
      assignedExitIp: null,
      connectedAtMs: null,
      sessionId: null,
      errorMessage: '',
      browserNotice: '',
    }))
  }

  const handleDownloadConfig = () => {
    if (!vpnState.wireguardConfig) return
    const code = (vpnState.selectedCountry?.code || 'lumen').toLowerCase()
    const blob = new Blob([vpnState.wireguardConfig], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lumen-vpn-${code}.conf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  if (!open) return null

  const isConnected = vpnState.connectionState === 'Connected'
  const isConnecting =
    vpnState.connectionState === 'Connecting' || vpnState.connectionState === 'Reconnecting'

  return (
    <div className="lumen-vpn-overlay" role="dialog" aria-modal="true" aria-label="Lumen VPN">
      <div className="lumen-vpn-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="lumen-vpn-modal">
        <header className="lumen-vpn-modal-head">
          <div className="lumen-vpn-modal-brand">
            <Shield size={18} />
            <div>
              <h3>Lumen VPN</h3>
              <span className={`lumen-vpn-state-pill is-${vpnState.connectionState.toLowerCase()}`}>
                {vpnState.connectionState}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="lumen-vpn-close-btn"
            onClick={onClose}
            aria-label="Close VPN popup"
          >
            <X size={18} />
          </button>
        </header>

        {isConnected && vpnState.selectedCountry ? (
          <div className="lumen-vpn-connected-box">
            <div className="lumen-vpn-connected-row">
              <CheckCircle2 size={20} className="lumen-vpn-ok-icon" />
              <div>
                <div className="lumen-vpn-connected-country">
                  {vpnState.selectedCountry.flag} {vpnState.selectedCountry.name}
                </div>
                <div className="lumen-vpn-connected-meta">
                  Exit IP: <strong>{vpnState.assignedExitIp}</strong> · Duration:{' '}
                  <strong>
                    {vpnState.connectedAtMs ? formatDuration(nowMs - vpnState.connectedAtMs) : '00:00'}
                  </strong>
                </div>
              </div>
            </div>
            <button type="button" className="lumen-vpn-disconnect-btn" onClick={() => void handleDisconnect()}>
              Disconnect
            </button>
          </div>
        ) : (
          <>
            <div className="lumen-vpn-search-wrap">
              <Search size={15} className="lumen-vpn-search-icon" />
              <input
                type="text"
                className="lumen-vpn-search-input"
                placeholder="Search countries…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search VPN countries"
              />
            </div>

            {countriesError && (
              <div className="lumen-vpn-msg is-error" role="alert">
                <AlertCircle size={16} />
                <span>{countriesError}</span>
              </div>
            )}

            <div className="lumen-vpn-country-list" role="listbox" aria-label="VPN countries">
              {loadingCountries ? (
                <div className="lumen-vpn-loading">
                  <LoaderCircle size={20} className="spin-icon" />
                  <span>Checking operational servers…</span>
                </div>
              ) : filteredCountries.length === 0 ? (
                <div className="lumen-vpn-empty">No matching countries found.</div>
              ) : (
                filteredCountries.map((country) => {
                  const isPicked = pickedCode === country.code
                  return (
                    <button
                      key={country.code}
                      type="button"
                      role="option"
                      aria-selected={isPicked}
                      disabled={!country.operational}
                      className={`lumen-vpn-country-item${isPicked ? ' is-selected' : ''}${
                        !country.operational ? ' is-unavailable' : ''
                      }`}
                      onClick={() => setPickedCode(country.code)}
                    >
                      <span className="lumen-vpn-country-left">
                        <span className="lumen-vpn-flag-emoji" aria-hidden="true">
                          {country.flag}
                        </span>
                        <span className="lumen-vpn-country-name">{country.name}</span>
                      </span>
                      <span
                        className={`lumen-vpn-avail${country.operational ? ' is-online' : ' is-offline'}`}
                      >
                        {country.statusLabel}
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            {vpnState.errorMessage && (
              <div className="lumen-vpn-msg is-error" role="alert">
                <AlertCircle size={16} />
                <span>{vpnState.errorMessage}</span>
              </div>
            )}

            {vpnState.browserNotice && (
              <div className="lumen-vpn-msg is-info" role="status">
                <AlertCircle size={16} />
                <div className="lumen-vpn-notice-body">
                  <span>{vpnState.browserNotice}</span>
                  {vpnState.wireguardConfig && (
                    <button
                      type="button"
                      className="lumen-vpn-dl-conf-btn"
                      onClick={handleDownloadConfig}
                    >
                      <Download size={14} />
                      <span>Download WireGuard Config (.conf)</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              className="lumen-vpn-connect-btn"
              disabled={!selectedOption || !selectedOption.operational || isConnecting}
              onClick={() => void handleConnect()}
            >
              {isConnecting ? (
                <>
                  <LoaderCircle size={16} className="spin-icon" />
                  <span>Connecting…</span>
                </>
              ) : selectedOption && !selectedOption.operational ? (
                <span>No Operational Server in {selectedOption.name}</span>
              ) : (
                <span>
                  Connect{selectedOption ? ` to ${selectedOption.name}` : ''}
                </span>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function useLumenVpnState() {
  return useState<VpnManagerState>(initialState)
}
