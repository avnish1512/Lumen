// Real device-session store (Supabase). Each account keeps a list of the
// devices that have actually signed in, so the "Manage Devices" screen reflects
// real sessions instead of hard-coded samples.
//
// Table (run once in the Supabase SQL editor):
//
//   create table if not exists account_devices (
//     email      text primary key,
//     devices    jsonb not null default '[]'::jsonb,
//     updated_at timestamptz not null default now()
//   );
//   alter table account_devices enable row level security;

import type { SupabaseConfig } from './supabase-core.js'

export type DeviceType = 'tv' | 'mobile' | 'tablet' | 'desktop'

export type DeviceRecord = {
  id: string
  name: string
  type: DeviceType
  lastActive: number
}

function headers(config: SupabaseConfig, extra: Record<string, string> = {}) {
  return {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

const REST = (config: SupabaseConfig) => `${config.url}/rest/v1/account_devices`

function sanitize(devices: unknown): DeviceRecord[] {
  if (!Array.isArray(devices)) {
    return []
  }
  return devices
    .filter((d): d is DeviceRecord => Boolean(d) && typeof (d as DeviceRecord).id === 'string')
    .map((d) => ({
      id: String(d.id),
      name: String(d.name ?? 'Unknown device'),
      type: (['tv', 'mobile', 'tablet', 'desktop'].includes(d.type) ? d.type : 'desktop') as DeviceType,
      lastActive: Number(d.lastActive) || Date.now(),
    }))
}

export async function fetchDevices(
  config: SupabaseConfig,
  email: string,
): Promise<DeviceRecord[]> {
  const url = `${REST(config)}?email=eq.${encodeURIComponent(email)}&select=devices`
  const response = await fetch(url, { headers: headers(config) })
  if (!response.ok) {
    return []
  }
  const rows = (await response.json()) as Array<{ devices?: unknown }>
  return rows.length ? sanitize(rows[0].devices) : []
}

async function saveDevices(
  config: SupabaseConfig,
  email: string,
  devices: DeviceRecord[],
): Promise<void> {
  const response = await fetch(`${REST(config)}?on_conflict=email`, {
    method: 'POST',
    headers: headers(config, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify([{ email, devices, updated_at: new Date().toISOString() }]),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Devices save failed (${response.status}). ${detail}`.trim())
  }
}

/** Upserts the given device (by id), refreshing its lastActive, most-recent first. */
export async function registerDevice(
  config: SupabaseConfig,
  email: string,
  device: DeviceRecord,
): Promise<DeviceRecord[]> {
  // Fast path: Atomic Postgres RPC (single HTTP request, atomic array upsert)
  try {
    const rpcUrl = `${config.url}/rest/v1/rpc/upsert_device`
    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify({ p_email: email, p_device: device }),
    })
    if (rpcResponse.ok) {
      const data = (await rpcResponse.json()) as unknown
      return sanitize(data)
    }
  } catch {
    // Fallback below if RPC fails or is unavailable
  }

  // Fallback path: Read-filter-save
  const existing = await fetchDevices(config, email)
  const others = existing.filter((d) => d.id !== device.id)
  const next = [device, ...others]
  await saveDevices(config, email, next)
  return next
}

export async function removeDevice(
  config: SupabaseConfig,
  email: string,
  id: string,
): Promise<DeviceRecord[]> {
  const existing = await fetchDevices(config, email)
  const next = existing.filter((d) => d.id !== id)
  await saveDevices(config, email, next)
  return next
}

export async function removeOtherDevices(
  config: SupabaseConfig,
  email: string,
  keepId: string,
): Promise<DeviceRecord[]> {
  const existing = await fetchDevices(config, email)
  const next = existing.filter((d) => d.id === keepId)
  await saveDevices(config, email, next)
  return next
}
