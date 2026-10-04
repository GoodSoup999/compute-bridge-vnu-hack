// Files the app ships with (pages, fonts, the Blender script). From source they are read from disk;
// inside the single-file executable they are embedded and read with node:sea.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let sea = null;
try {
  const candidate = require('node:sea');
  if (candidate.isSea()) sea = candidate;
} catch {}

const root = path.join(__dirname, '..');

function readAsset(name) {
  return sea ? Buffer.from(sea.getAsset(name)) : fs.readFileSync(path.join(root, name));
}

function hasAsset(name) {
  try { readAsset(name); return true; } catch { return false; }
}

// A real path on disk, for files another program must open (Blender runs lib/blender_gpu.py).
function assetFile(name) {
  if (!sea) return path.join(root, name);
  const target = path.join(os.tmpdir(), 'compute-bridge', name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, readAsset(name));
  return target;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

// Serves /ui.css and /fonts/<name>.woff2 for both local servers. Returns true when it answered.
function serveShared(req, res) {
  if (req.method !== 'GET') return false;
  const match = /^\/(ui\.css|fonts\/[a-z0-9-]+\.woff2)$/.exec(req.url);
  if (!match || !hasAsset(`public/${match[1]}`)) return false;
  res.writeHead(200, { 'content-type': TYPES[path.extname(match[1])], 'cache-control': 'public, max-age=3600' });
  res.end(readAsset(`public/${match[1]}`));
  return true;
}

module.exports = { readAsset, hasAsset, assetFile, serveShared, isSea: Boolean(sea), TYPES };
