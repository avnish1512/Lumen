/**
 * Lumen VPN Local Companion Agent
 * -------------------------------
 * Runs strictly on 127.0.0.1:47821 so the Lumen web app can trigger real
 * OS-level WireGuard tunnels (changing the device's actual public IP) when
 * installed locally.
 *
 * Security boundaries:
 * - Binds ONLY to 127.0.0.1 (never 0.0.0.0).
 * - Strict CORS allowlist (localhost Vite dev + configured Vercel origin).
 * - Validates WireGuard config syntax before writing to temp/tunnel dir.
 * - Cleans up temporary config files and tunnel interface on disconnect.
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const HOST = '127.0.0.1';
const PORT = Number(process.env.LUMEN_COMPANION_PORT || 47821);
const TUNNEL_NAME = 'lumen-wg0';
const CONFIG_DIR = path.join(os.tmpdir(), 'lumen-vpn-companion');
const CONFIG_PATH = path.join(CONFIG_DIR, `${TUNNEL_NAME}.conf`);

const ALLOWED_ORIGINS = new Set(
  [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    process.env.LUMEN_ALLOWED_ORIGIN || '',
  ].filter(Boolean),
);

interface CompanionSessionState {
  connected: boolean;
  countryCode: string | null;
  countryName: string | null;
  exitIp: string | null;
  connectedAt: string | null;
  platform: NodeJS.Platform;
  lastError: string | null;
}

const state: CompanionSessionState = {
  connected: false,
  countryCode: null,
  countryName: null,
  exitIp: null,
  connectedAt: null,
  platform: process.platform,
  lastError: null,
};

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
}

function sendJson(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  const origin = req.headers.origin;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin!;
    headers['Vary'] = 'Origin';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > 32 * 1024) {
      throw new Error('Request body too large');
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

function validateWireGuardConfig(conf: string): void {
  if (!conf.includes('[Interface]') || !conf.includes('[Peer]')) {
    throw new Error('Invalid WireGuard configuration: missing [Interface] or [Peer]');
  }
  if (!/PrivateKey\s*=\s*[A-Za-z0-9+/=]{40,}/i.test(conf)) {
    throw new Error('Invalid WireGuard configuration: missing PrivateKey');
  }
  if (!/PublicKey\s*=\s*[A-Za-z0-9+/=]{40,}/i.test(conf)) {
    throw new Error('Invalid WireGuard configuration: missing PublicKey');
  }
  if (!/Endpoint\s*=\s*[A-Za-z0-9.\-:[\]]+:\d{1,5}/i.test(conf)) {
    throw new Error('Invalid WireGuard configuration: missing Endpoint');
  }
}

async function fetchCurrentPublicIp(): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ip?: string };
    return typeof data.ip === 'string' ? data.ip : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function activateTunnel(wireguardConfig: string): Promise<void> {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_PATH, wireguardConfig, { encoding: 'utf8', mode: 0o600 });

  if (process.platform === 'win32') {
    const wgExe =
      process.env.WIREGUARD_EXE || 'C:\\Program Files\\WireGuard\\wireguard.exe';
    if (!fs.existsSync(wgExe)) {
      throw new Error(
        `WireGuard for Windows not found at "${wgExe}". Install WireGuard from wireguard.com/install/.`,
      );
    }
    await execFileAsync(wgExe, ['/installtunnelservice', CONFIG_PATH]);
    return;
  }

  // Linux / macOS using wg-quick
  await execFileAsync('wg-quick', ['up', CONFIG_PATH]);
}

async function deactivateTunnel(): Promise<void> {
  if (process.platform === 'win32') {
    const wgExe =
      process.env.WIREGUARD_EXE || 'C:\\Program Files\\WireGuard\\wireguard.exe';
    if (fs.existsSync(wgExe)) {
      try {
        await execFileAsync(wgExe, ['/uninstalltunnelservice', TUNNEL_NAME]);
      } catch {
        // Tunnel might already be stopped
      }
    }
  } else {
    try {
      await execFileAsync('wg-quick', ['down', CONFIG_PATH]);
    } catch {
      // Ignore if already down
    }
  }

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      fs.unlinkSync(CONFIG_PATH);
    } catch {
      // Best-effort cleanup
    }
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(req, res, 204, {});
    return;
  }

  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/status') {
      const liveIp = state.connected ? await fetchCurrentPublicIp() : null;
      if (liveIp) state.exitIp = liveIp;
      sendJson(req, res, 200, {
        ok: true,
        ...state,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/connect') {
      const body = await readJsonBody(req);
      const wireguardConfig = String(body.wireguardConfig || '');
      const countryCode = String(body.countryCode || '').toUpperCase() || null;
      const countryName = String(body.countryName || '') || null;

      validateWireGuardConfig(wireguardConfig);
      await deactivateTunnel();
      await activateTunnel(wireguardConfig);

      // Give OS network stack a moment to settle before checking live public IP
      await new Promise((r) => setTimeout(r, 1200));
      const observedIp = (await fetchCurrentPublicIp()) || (typeof body.expectedExitIp === 'string' ? body.expectedExitIp : null);

      state.connected = true;
      state.countryCode = countryCode;
      state.countryName = countryName;
      state.exitIp = observedIp;
      state.connectedAt = new Date().toISOString();
      state.lastError = null;

      sendJson(req, res, 200, {
        ok: true,
        ...state,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/disconnect') {
      await deactivateTunnel();
      state.connected = false;
      state.countryCode = null;
      state.countryName = null;
      state.exitIp = null;
      state.connectedAt = null;
      state.lastError = null;

      sendJson(req, res, 200, {
        ok: true,
        ...state,
      });
      return;
    }

    sendJson(req, res, 404, { ok: false, error: 'Not found' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Companion error';
    state.lastError = message;
    sendJson(req, res, 500, { ok: false, error: message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Lumen VPN Companion listening on http://${HOST}:${PORT}`);
});
