// Package the existing Compute Bridge sources as a portable Windows desktop app.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { packager } = require('@electron/packager');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist', 'desktop');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'compute-bridge-desktop-stage-'));
const safeStage = path.resolve(stage).startsWith(path.resolve(os.tmpdir()) + path.sep);
if (!safeStage) throw new Error('Folderul temporar nu este în directorul temporar al sistemului.');

async function main() {
  try {
    for (const file of ['app.js', 'server.js', 'provider.js']) {
      fs.copyFileSync(path.join(root, file), path.join(stage, file));
    }
    for (const dir of ['lib', 'public', 'desktop']) {
      fs.cpSync(path.join(root, dir), path.join(stage, dir), { recursive: true });
    }
    fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
      name: 'compute-bridge-desktop',
      productName: 'Compute Bridge',
      version: require('../package.json').version,
      main: 'desktop/main.js'
    }, null, 2));

    const folders = await packager({
      dir: stage,
      name: 'Compute Bridge',
      platform: 'win32',
      arch: 'x64',
      out: output,
      overwrite: true,
      asar: false,
      executableName: 'ComputeBridge',
      electronVersion: require('electron/package.json').version,
      prune: true
    });
    // Keep the original Electron executable byte-for-byte. Some Windows App Control
    // configurations reject the executable after Packager edits its metadata.
    fs.copyFileSync(
      require('electron'),
      path.join(folders[0], 'ComputeBridge.exe')
    );
    console.log(`Aplicația desktop Windows: ${path.join(folders[0], 'ComputeBridge.exe')}`);
    console.log('Distribuie întregul folder; executabilul folosește fișierele de lângă el.');
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
