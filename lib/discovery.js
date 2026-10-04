// Finds coordinators on the local network. A coordinator broadcasts a small UDP beacon every two
// seconds (its name and port, never the access code); the connector listens and lists what it hears.
const dgram = require('node:dgram');
const os = require('node:os');

const DISCOVERY_PORT = 39871;
const APP = 'compute-bridge';

function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const item of list || []) {
      if (item.family !== 'IPv4' || item.internal) continue;
      if (/^169\.254\./.test(item.address)) continue; // link-local, no DHCP
      out.push({ name, address: item.address, netmask: item.netmask });
    }
  }
  // Real network cards first; virtual adapters (WSL, Hyper-V, VirtualBox, Docker) last.
  const virtual = n => /vEthernet|WSL|Hyper-V|VirtualBox|VMware|docker|br-|veth|Loopback|Tailscale|ZeroTier/i.test(n);
  const rank = a => (virtual(a.name) ? 2 : 0) + (/^192\.168\./.test(a.address) ? 0 : /^10\./.test(a.address) ? 0.5 : 1);
  return out.sort((a, b) => rank(a) - rank(b));
}

function broadcastAddresses() {
  const set = new Set(['255.255.255.255']);
  for (const { address, netmask } of lanAddresses()) {
    const a = address.split('.').map(Number), m = netmask.split('.').map(Number);
    set.add(a.map((part, i) => (part | (~m[i] & 255)) & 255).join('.'));
  }
  return [...set];
}

function startBeacon({ port, name }) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  let timer = null;
  socket.on('error', () => {}); // a blocked broadcast must never stop the coordinator
  socket.bind(() => {
    try { socket.setBroadcast(true); } catch {}
    const send = () => {
      const message = Buffer.from(JSON.stringify({ app: APP, v: 1, name, port }));
      for (const target of broadcastAddresses()) socket.send(message, DISCOVERY_PORT, target, () => {});
    };
    send();
    timer = setInterval(send, 2000);
  });
  return () => { clearInterval(timer); try { socket.close(); } catch {} };
}

function startListener(onFound) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  socket.on('error', () => {});
  socket.on('message', (buffer, info) => {
    try {
      const beacon = JSON.parse(String(buffer));
      if (beacon.app !== APP || !Number.isInteger(beacon.port)) return;
      onFound({ name: String(beacon.name || info.address).slice(0, 60), address: info.address, port: beacon.port, seenAt: Date.now() });
    } catch {}
  });
  socket.bind(DISCOVERY_PORT);
  return () => { try { socket.close(); } catch {} };
}

// Lower is better: home and office LANs first, VPN overlays (Tailscale, ZeroTier) last.
function rankAddress(address) {
  if (/^192\.168\./.test(address)) return 0;
  if (/^10\./.test(address)) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) return 2;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(address)) return 4;
  return 3;
}

module.exports = { startBeacon, startListener, lanAddresses, rankAddress, DISCOVERY_PORT };
