# Lumen VPN — Architecture, Infrastructure & Deployment Guide

## 1. Existing Stack Inspection Summary

Lumen is a **React 19 + TypeScript + Vite + Vanilla CSS (`src/App.css`)** application deployed on **Vercel** with a consolidated serverless API router (`api/hub.ts` + `vercel.json` rewrites) and **Supabase REST** persistence + **HMAC-SHA256 bearer session auth** (`api/_lib/auth-token.ts`).

Lumen VPN is integrated modularly without modifying mainstream streaming, profiles, watchlists, history, or Lord adult-profile separation.

---

## 2. Folder & File Structure

| File | Responsibility |
| :--- | :--- |
| `src/VpnModal.tsx` | Single `VpnStatusButton` trigger, compact country-selection `VpnModal`, search, live duration timer, `.conf` download fallback, and `useLumenVpnState` hook. |
| `src/vpn-api.ts` | Typed client for `/api/vpn/*`, local companion (`http://127.0.0.1:47821`), and `/api/vpn-check` (`ipapi.is`). |
| `api/_lib/vpn-control-core.ts` | Server-side WireGuard X25519 keypair generation (`crypto.generateKeyPairSync('x25519')`), server selection, `.conf` builder, session tracking, and device revocation. |
| `api/hub.ts` | Unified Vercel serverless router handling `kind=vpn` (`/api/vpn/countries`, `/servers`, `/status`, `/configuration`, `/connect`, `/disconnect`, `/revoke`) and `kind=vpn-check`. |
| `vercel.json` & `vite.config.ts` | Rewrites `/api/vpn/:action` → `/api/hub?kind=vpn&action=:action` in production and local Vite dev server. |
| `supabase/migrations/20261127_lumen_vpn.sql` | PostgreSQL schema & Row-Level Security (RLS) for `vpn_countries`, `vpn_servers`, `vpn_devices`, `vpn_sessions`, `vpn_usage_counters`. |
| `infra/wireguard/setup-ubuntu-wg.sh` | Automated Ubuntu 22.04/24.04 WireGuard exit-node installer (`wg0`, UFW, NAT MASQUERADE, IPv6 leak blocking). |
| `vpn-companion/` | Local loopback companion (`127.0.0.1:47821`) enabling one-click OS WireGuard tunnel activation from the browser UI. |

---

## 3. Real VPN vs. Website Proxy (Honest Browser Limitation)

- **Browser JavaScript cannot open raw UDP sockets or create OS network interfaces.** A pure web app cannot change your device's public IP address across other apps.
- **How Lumen VPN achieves a real device-wide IP change**:
  1. **Control Plane (Vercel + Supabase)**: Authenticates the user, selects a healthy WireGuard exit server in the chosen country, generates a unique X25519 client keypair, allocates an internal tunnel IP (`10.66.x.y/32`), and builds a standard WireGuard `.conf` profile.
  2. **Data Plane (WireGuard Tunnel)**:
     - **With Lumen VPN Companion running locally (`127.0.0.1:47821`)**: Clicking **Connect** activates the OS WireGuard tunnel automatically (`wireguard.exe` on Windows, `wg-quick` on macOS/Linux) and verifies the new public exit IP via `ipapi.is`.
     - **Without Companion**: Lumen downloads the real `.conf` file so the user can import it into the official WireGuard app (Windows, macOS, iOS, Android, Linux) for full device-wide routing.
- **No Fake Countries or Fake IPs**: Countries without a healthy operational server in `VPN_SERVERS_JSON` or Supabase `vpn_servers` appear disabled (`No operational server`) and `/api/vpn/connect` returns `503`.

---

## 4. Database Schema & RLS (`supabase/migrations/20261127_lumen_vpn.sql`)

- `vpn_countries`: Country catalog (`code`, `name`, `flag`, `enabled`, `sort_order`). Public read (`SELECT`), service-role write.
- `vpn_servers`: Operational WireGuard nodes (`id`, `country_code`, `city`, `provider`, `public_ip`, `endpoint`, `public_key`, `dns_servers`, `healthy`, `capacity_score`, `latency_ms`). **Never stores server private keys.**
- `vpn_devices`: Per-user WireGuard peers (`user_email`, `device_name`, `platform`, `client_public_key`, `assigned_tunnel_ip`, `revoked_at`). RLS restricts access to `user_email`.
- `vpn_sessions`: Connection history & active state (`user_email`, `server_id`, `device_id`, `country_code`, `assigned_exit_ip`, `status`, `connected_at`, `disconnected_at`).
- `vpn_usage_counters`: Per-user daily rate/session counters.

---

## 5. Control Plane API Endpoints

All routes are served via `/api/vpn/<action>` (rewritten to `/api/hub?kind=vpn&action=<action>`):

| Method & Path | Auth | Purpose |
| :--- | :--- | :--- |
| `GET /api/vpn/countries` | Public | Lists countries with real `operational` boolean and `serverCount` from healthy nodes. |
| `GET /api/vpn/servers` | Public | Lists healthy operational WireGuard servers (public metadata only). |
| `GET /api/vpn/status` | Bearer | Returns the authenticated user's active VPN session. |
| `POST /api/vpn/configuration` | Bearer | Provisions a WireGuard client keypair + `.conf` for an operational country (`503` if unavailable). |
| `POST /api/vpn/connect` | Bearer | Rate-limited provisioning + active session record creation. |
| `POST /api/vpn/disconnect` | Bearer | Marks active session disconnected. |
| `POST /api/vpn/revoke` | Bearer | Revokes a user-owned WireGuard device (`403` on cross-user access). |

---

## 6. Oracle Cloud Always Free & Multi-Region Cost Guide

### India Region (Mumbai / Hyderabad)
1. Create an Oracle Cloud account with **Home Region = India West (Mumbai)** or **India South (Hyderabad)**.
2. Provision an **Always Free** VM:
   - **VM.Standard.E2.1.Micro** (1 OCPU, 1 GB RAM) — **$0/month**, up to 10 TB/month outbound data transfer included.
   - Or **VM.Standard.A1.Flex** (Ampere ARM, up to 4 OCPUs / 24 GB RAM Always Free across tenancy).
3. In OCI VCN Security List / NSG, allow **Ingress UDP `51820`** from `0.0.0.0/0` (and SSH `22/tcp` from your admin IP).
4. SSH into Ubuntu 22.04/24.04 and run:
   ```bash
   sudo bash infra/wireguard/setup-ubuntu-wg.sh --port 51820
   ```
5. Copy the printed JSON object into Vercel's `VPN_SERVERS_JSON` environment variable (or insert into Supabase `vpn_servers`).

### Expanding Beyond India
- Oracle Cloud Always Free resources apply to **one Home Region**. Additional countries (US, UK, Germany, Singapore, Japan, etc.) require either:
  - Paid OCI Pay-As-You-Go instances (~$5–$10/month for small compute + bandwidth), or
  - Low-cost VPS providers (Hetzner €3.79/mo for DE/US/FI, Vultr/DigitalOcean $5–$6/mo for SG/JP/UK/CA/AU).

---

## 7. Security Checklist

- [x] Server WireGuard private keys never leave the exit node (`/etc/wireguard/server_private.key`, mode `0600`).
- [x] Supabase `SUPABASE_SERVICE_ROLE_KEY`, `VPN_SERVERS_JSON`, and `IPAPI_IS_KEY` stay strictly server-side.
- [x] All mutating `/api/vpn/*` endpoints require valid Lumen HMAC session token (`verifySessionToken`) and enforce per-user ownership.
- [x] Rate limiting (`checkRateLimit`) protects `/api/vpn/connect` and `/api/vpn/configuration`.
- [x] Companion binds strictly to `127.0.0.1:47821` with explicit CORS allowlist and `.conf` validation.
- [x] IPv6 forwarding disabled on WireGuard exit nodes (`net.ipv6.conf.all.forwarding = 0`) to prevent IPv6 leaks.

---

## 8. Running Companion & Verification Tests

```bash
# Optional: start local OS WireGuard companion (Node >= 22.6)
cd vpn-companion
npm start

# Run build & test suite (Windows)
cmd.exe /c "cd /d F:\Lumen && npm run build"
cmd.exe /c "cd /d F:\Lumen && npm test"
```
