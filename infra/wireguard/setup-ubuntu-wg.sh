#!/usr/bin/env bash
# Lumen VPN — Ubuntu 22.04 / 24.04 WireGuard Exit Node Setup Script
# Usage: sudo bash setup-ubuntu-wg.sh [--port 51820] [--subnet 10.66.0.1/24] [--iface eth0]
#
# Configures:
#   - WireGuard (wg0) on 10.66.0.1/24 (UDP 51820)
#   - IPv4 forwarding + NAT MASQUERADE on outbound NIC
#   - IPv6 forwarding disabled / leak-safe default sysctl
#   - UFW firewall allowing SSH (22/tcp) and WireGuard (51820/udp)
#   - Unattended security upgrades
#   - Peer registration helper (/usr/local/bin/lumen-wg-add-peer) and healthcheck (/usr/local/bin/lumen-wg-health)

set -euo pipefail

WG_IFACE="wg0"
WG_PORT="51820"
WG_SUBNET="10.66.0.1/24"
WAN_IFACE="$(ip route show default | awk '/default/ {print $5; exit}')"
DNS_SERVERS="1.1.1.1, 9.9.9.9"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      WG_PORT="$2"
      shift 2
      ;;
    --subnet)
      WG_SUBNET="$2"
      shift 2
      ;;
    --iface)
      WAN_IFACE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root (sudo bash $0)" >&2
  exit 1
fi

if [[ -z "${WAN_IFACE}" ]]; then
  echo "Could not auto-detect default WAN interface. Pass --iface <nic>." >&2
  exit 1
fi

echo "==> [1/6] Installing WireGuard, UFW, qrencode, and unattended-upgrades..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq wireguard wireguard-tools ufw iptables qrencode unattended-upgrades curl jq

echo "==> [2/6] Generating WireGuard server keys..."
mkdir -p /etc/wireguard
chmod 700 /etc/wireguard

if [[ ! -f /etc/wireguard/server_private.key ]]; then
  umask 077
  wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
fi

SERVER_PRIVKEY="$(cat /etc/wireguard/server_private.key)"
SERVER_PUBKEY="$(cat /etc/wireguard/server_public.key)"

echo "==> [3/6] Writing /etc/wireguard/${WG_IFACE}.conf..."
cat > "/etc/wireguard/${WG_IFACE}.conf" <<EOF
[Interface]
Address = ${WG_SUBNET}
ListenPort = ${WG_PORT}
PrivateKey = ${SERVER_PRIVKEY}
SaveConfig = false

# NAT masquerade & MSS clamping for clean MTU over LTE/cloud links
PostUp = sysctl -w net.ipv4.ip_forward=1
PostUp = iptables -A FORWARD -i %i -j ACCEPT
PostUp = iptables -A FORWARD -o %i -j ACCEPT
PostUp = iptables -t nat -A POSTROUTING -o ${WAN_IFACE} -j MASQUERADE
PostUp = iptables -t mangle -A POSTROUTING -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu

# Block IPv6 forwarding leaks while tunnel is IPv4-only
PostUp = ip6tables -P FORWARD DROP || true

PostDown = iptables -D FORWARD -i %i -j ACCEPT
PostDown = iptables -D FORWARD -o %i -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -o ${WAN_IFACE} -j MASQUERADE
PostDown = iptables -t mangle -D POSTROUTING -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
EOF
chmod 600 "/etc/wireguard/${WG_IFACE}.conf"

echo "==> [4/6] Configuring kernel sysctl for IPv4 forwarding & IPv6 leak hardening..."
cat > /etc/sysctl.d/99-lumen-wireguard.conf <<EOF
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 0
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
EOF
sysctl --system >/dev/null

echo "==> [5/6] Configuring UFW firewall (SSH 22/tcp + WireGuard ${WG_PORT}/udp)..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow "${WG_PORT}/udp" comment 'Lumen WireGuard'
ufw --force enable

echo "==> [6/6] Enabling wg-quick@${WG_IFACE} and installing helper commands..."
systemctl enable "wg-quick@${WG_IFACE}"
systemctl restart "wg-quick@${WG_IFACE}"

cat > /usr/local/bin/lumen-wg-add-peer <<'EOF'
#!/usr/bin/env bash
# Usage: sudo lumen-wg-add-peer <client_public_key> <client_tunnel_ip_cidr>
set -euo pipefail
PUBKEY="${1:-}"
CLIENT_IP="${2:-}"
if [[ -z "${PUBKEY}" || -z "${CLIENT_IP}" ]]; then
  echo "Usage: $0 <client_public_key> <client_ip/32>" >&2
  exit 1
fi
wg set wg0 peer "${PUBKEY}" allowed-ips "${CLIENT_IP}"
cat >> /etc/wireguard/wg0.conf <<PEER

[Peer]
PublicKey = ${PUBKEY}
AllowedIPs = ${CLIENT_IP}
PEER
echo "Added peer ${PUBKEY} (${CLIENT_IP})"
EOF
chmod +x /usr/local/bin/lumen-wg-add-peer

cat > /usr/local/bin/lumen-wg-health <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
PUBLIC_IP="$(curl -fsS --max-time 4 https://api.ipify.org || echo unknown)"
PEERS="$(wg show wg0 peers | wc -l | tr -d ' ')"
echo "{\"ok\":true,\"interface\":\"wg0\",\"publicIp\":\"${PUBLIC_IP}\",\"peers\":${PEERS}}"
EOF
chmod +x /usr/local/bin/lumen-wg-health

dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true

PUBLIC_IP="$(curl -fsS --max-time 4 https://api.ipify.org || echo '<SERVER_PUBLIC_IP>')"

echo ""
echo "============================================================"
echo "Lumen WireGuard Exit Server Ready"
echo "============================================================"
echo "Public Endpoint : ${PUBLIC_IP}:${WG_PORT}"
echo "Server PubKey   : ${SERVER_PUBKEY}"
echo "Tunnel Subnet   : ${WG_SUBNET}"
echo "Recommended DNS : ${DNS_SERVERS}"
echo ""
echo "Add this server entry to VPN_SERVERS_JSON or Supabase vpn_servers:"
echo "{\"id\":\"srv-in-1\",\"countryCode\":\"IN\",\"countryName\":\"India\",\"city\":\"Mumbai\",\"region\":\"Maharashtra\",\"provider\":\"oracle-cloud\",\"publicIp\":\"${PUBLIC_IP}\",\"endpoint\":\"${PUBLIC_IP}:${WG_PORT}\",\"publicKey\":\"${SERVER_PUBKEY}\",\"dnsServers\":[\"1.1.1.1\",\"9.9.9.9\"],\"healthy\":true,\"capacityScore\":95,\"latencyMs\":42}"
echo "============================================================"
