// Client for real per-account device sessions (backed by Supabase via
// /api/devices). Devices are recorded on sign-in and listed/removed in the
// "Manage Devices" screen. When the backend is not configured, every call
// resolves to an empty list and the UI falls back to showing just the current
// device it can detect locally.

export type DeviceType = 'tv' | 'mobile' | 'tablet' | 'desktop'

export type DeviceRecord = {
  id: string
  name: string
  type: DeviceType
  lastActive: number
}

type DevicesResponse = { ok?: boolean; configured?: boolean; devices?: DeviceRecord[] }

export async function fetchDevices(email: string): Promise<DeviceRecord[]> {
  try {
    const response = await fetch(`/api/devices?action=list&email=${encodeURIComponent(email)}`)
    const data = (await response.json()) as DevicesResponse
    return response.ok && Array.isArray(data.devices) ? data.devices : []
  } catch {
    return []
  }
}

export async function registerDevice(
  email: string,
  device: DeviceRecord,
): Promise<DeviceRecord[]> {
  try {
    const response = await fetch('/api/devices?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, device }),
    })
    const data = (await response.json()) as DevicesResponse
    return response.ok && Array.isArray(data.devices) ? data.devices : []
  } catch {
    return []
  }
}

export async function removeDevice(email: string, id: string): Promise<DeviceRecord[]> {
  try {
    const response = await fetch('/api/devices?action=remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, id }),
    })
    const data = (await response.json()) as DevicesResponse
    return response.ok && Array.isArray(data.devices) ? data.devices : []
  } catch {
    return []
  }
}

export async function removeOtherDevices(
  email: string,
  keepId: string,
): Promise<DeviceRecord[]> {
  try {
    const response = await fetch('/api/devices?action=removeOthers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, keepId }),
    })
    const data = (await response.json()) as DevicesResponse
    return response.ok && Array.isArray(data.devices) ? data.devices : []
  } catch {
    return []
  }
}
