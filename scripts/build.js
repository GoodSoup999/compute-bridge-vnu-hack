// Builds the Windows downloads into dist/:
//   ComputeBridge-<v>-windows-x64.zip   ComputeBridge.exe, a single executable with Node included
//   compute-bridge-<v>-source.zip       the source with a double-click launcher, for Windows PCs with Node.js 20+
//   manifest.json                       sizes and SHA-256, read by the NODE website's download page
// Usage (on Windows x64): node scripts/build.js [--publish <folder>]   (copies the packages and manifest there)
// The executable uses Node's single executable applications (SEA): the app is bundled into one script,
// turned into a blob and injected into this machine's official Node binary with postject.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { execFileSync, execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const VERSION = require('../lib/version');
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : null; };
const step = text => console.log(`\n· ${text}`);

// ------------------------------------------------------------------ bundle

// A small CommonJS bundler: every local module becomes a function in one file, built-ins stay require().
function bundle(entry) {
  const modules = new Map();
  const visit = file => {
    const id = path.relative(root, file).split(path.sep).join('/');
    if (modules.has(id)) return id;
    const source = fs.readFileSync(file, 'utf8');
    modules.set(id, null);
    const deps = {};
    for (const [, request] of source.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      let target = path.resolve(path.dirname(file), request);
      if (!fs.existsSync(target)) target += '.js';
      deps[request] = visit(target);
    }
    modules.set(id, { source, deps, dir: path.posix.dirname(id) });
    return id;
  };
  const main = visit(entry);
  const defs = [...modules].map(([id, m]) =>
    `${JSON.stringify(id)}: [${JSON.stringify(m.deps)}, ${JSON.stringify(m.dir)}, function (module, exports, require, __filename, __dirname) {\n${m.source}\n}]`);
  return `'use strict';
(function () {
  const path = require('node:path');
  const base = path.dirname(process.execPath);
  const defs = {\n${defs.join(',\n')}\n};
  const cache = {};
  function load(id) {
    if (cache[id]) return cache[id].exports;
    const [deps, dir, fn] = defs[id];
    const module = cache[id] = { exports: {} };
    const local = request => (request in deps ? load(deps[request]) : require(request));
    local.main = null;
    fn.call(module.exports, module, module.exports, local, path.join(base, id), path.join(base, dir));
    return module.exports;
  }
  load(${JSON.stringify(main)});
})();
`;
}

// --------------------------------------------------------------- archives

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buffer) { let c = 0xffffffff; for (const byte of buffer) c = CRC[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

// entries: [{ name, data, mode }]. Deflate where it helps, store otherwise.
function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const { name, data, mode = 0o644 } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const stored = deflated.length >= data.length;
    const body = stored ? data : deflated;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(stored ? 0 : 8, 8); local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE((3 << 8) | 20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(stored ? 0 : 8, 10); central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(((0o100000 | mode) << 16) >>> 0, 38); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, body);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const centralSize = centrals.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

function inject(binary, blob) {
  execSync(`npx --yes postject@1.0.0-alpha.6 "${binary}" NODE_SEA_BLOB "${blob}" --sentinel-fuse ${FUSE}`, { stdio: 'inherit' });
}

// ----------------------------------------------------------------- texts

const README_WIN = `Compute Bridge ${VERSION}

Pornește: dublu-clic pe ComputeBridge.exe. Se deschide o fereastră neagră (lasă-o deschisă,
închiderea ei oprește aplicația) și aplicația în browser.

Prima dată Windows poate afișa „Windows protected your PC”: apasă More info, apoi Run anyway.
Aplicația nu e semnată digital (versiune de hackathon). Când Windows întreabă despre firewall,
permite accesul în rețelele private.

Un PC alege „Folosesc puterea altor PC-uri” (coordonatorul). Celelalte aleg „Ofer putere de calcul”,
îl găsesc în rețea și scriu codul de acces afișat de el.
`;
const README_SOURCE = `Compute Bridge ${VERSION}, pachetul sursă pentru Windows

Varianta pentru PC-uri care au Node.js 20 sau mai nou (https://nodejs.org), de exemplu dacă
antivirusul nu lasă ComputeBridge.exe să pornească. Face exact același lucru.

Pornește: dublu-clic pe „Compute Bridge.cmd” (sau, în PowerShell, din acest folder: node app.js).
Linia de comandă merge în continuare: node server.js și node provider.js (vezi README.md).
`;
const LAUNCH_CMD = `@echo off\r
title Compute Bridge\r
cd /d "%~dp0"\r
where node >nul 2>nul\r
if errorlevel 1 (\r
  echo Compute Bridge are nevoie de Node.js 20 sau mai nou: https://nodejs.org\r
  start "" https://nodejs.org/\r
  pause\r
  exit /b 1\r
)\r
node app.js %*\r
if errorlevel 1 pause\r
`;
// ------------------------------------------------------------------ build

(async () => {
  fs.mkdirSync(dist, { recursive: true });
  const work = path.join(dist, 'work');
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });

  step('Bundle');
  const worker = bundle(path.join(root, 'lib', 'render-worker.js'));
  const app = `globalThis.__CB_WORKER_SOURCE__ = ${JSON.stringify(worker)};\nprocess.title = 'Compute Bridge';\n${bundle(path.join(root, 'app.js'))}`;
  fs.writeFileSync(path.join(work, 'bundle.cjs'), app);

  step('Blob SEA');
  const fonts = fs.readdirSync(path.join(root, 'public', 'fonts')).filter(f => f.endsWith('.woff2')).map(f => `public/fonts/${f}`);
  const assets = ['public/app.html', 'public/node.html', 'public/index.html', 'public/ui.css', 'lib/blender_gpu.py', ...fonts];
  const seaConfig = {
    main: path.join(work, 'bundle.cjs'), output: path.join(work, 'sea.blob'),
    disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false, // portable across platforms
    assets: Object.fromEntries(assets.map(a => [a, path.join(root, a)]))
  };
  fs.writeFileSync(path.join(work, 'sea-config.json'), JSON.stringify(seaConfig, null, 2));
  execFileSync(process.execPath, ['--experimental-sea-config', path.join(work, 'sea-config.json')], { stdio: 'inherit' });
  const blob = path.join(work, 'sea.blob');

  const outputs = [];

  step('Windows x64');
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Executabilul de Windows se construiește pe Windows x64.');
  const exe = path.join(work, 'ComputeBridge.exe');
  fs.copyFileSync(process.execPath, exe);
  inject(exe, blob);
  const winZip = `ComputeBridge-${VERSION}-windows-x64.zip`;
  fs.writeFileSync(path.join(dist, winZip), zip([
    { name: 'Compute Bridge/ComputeBridge.exe', data: fs.readFileSync(exe), mode: 0o755 },
    { name: 'Compute Bridge/Citeste-ma.txt', data: Buffer.from(README_WIN.replace(/\n/g, '\r\n')) }
  ]));
  outputs.push({ id: 'windows-x64', os: 'windows', label: 'Windows 10 and 11, x64', file: winZip, needsNode: false });

  step('Pachet sursă');
  const portableDir = `compute-bridge-${VERSION}-source`;
  const files = ['app.js', 'server.js', 'provider.js', 'package.json', 'README.md', 'scripts/local.js',
    ...fs.readdirSync(path.join(root, 'lib')).map(f => `lib/${f}`),
    ...fs.readdirSync(path.join(root, 'public'), { recursive: true }).map(f => `public/${String(f).split(path.sep).join('/')}`)
      .filter(f => fs.statSync(path.join(root, f)).isFile())];
  const portableZip = `${portableDir}.zip`;
  fs.writeFileSync(path.join(dist, portableZip), zip([
    ...files.map(f => ({ name: `${portableDir}/${f}`, data: fs.readFileSync(path.join(root, f)) })),
    { name: `${portableDir}/Compute Bridge.cmd`, data: Buffer.from(LAUNCH_CMD) },
    { name: `${portableDir}/Citeste-ma.txt`, data: Buffer.from(README_SOURCE.replace(/\n/g, '\r\n')) }
  ]));
  outputs.push({ id: 'windows-source', os: 'windows', label: 'Windows, source package (needs Node.js 20+)', file: portableZip, needsNode: true });

  step('Manifest');
  const manifest = {
    app: 'Compute Bridge', version: VERSION, builtAt: new Date().toISOString(),
    files: outputs.map(o => {
      const data = fs.readFileSync(path.join(dist, o.file));
      return { ...o, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') };
    })
  };
  fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
  for (const f of manifest.files) console.log(`  ${f.file}  ${(f.bytes / 1048576).toFixed(1)} MB`);

  const publish = arg('publish');
  if (publish) {
    step(`Public în ${publish}`);
    fs.mkdirSync(publish, { recursive: true });
    for (const old of fs.readdirSync(publish)) if (/^(ComputeBridge|compute-bridge)-.*\.(zip|tar\.gz)$/.test(old)) fs.rmSync(path.join(publish, old));
    for (const f of manifest.files) fs.copyFileSync(path.join(dist, f.file), path.join(publish, f.file));
    fs.copyFileSync(path.join(dist, 'manifest.json'), path.join(publish, 'manifest.json'));
  }
  fs.rmSync(work, { recursive: true, force: true });
  console.log('\nGata.');
})().catch(error => { console.error(`\nBuild eșuat: ${error.message}`); process.exit(1); });
