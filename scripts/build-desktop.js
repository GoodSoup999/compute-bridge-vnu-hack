// Package the existing Compute Bridge sources as a portable Windows desktop app.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { packager } = require('@electron/packager');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist', 'desktop');
const version = require('../lib/version');
const publishIndex = process.argv.indexOf('--publish');
const publish = publishIndex < 0 ? null : process.argv[publishIndex + 1];
if (publishIndex >= 0 && (!publish || publish.startsWith('--'))) throw new Error('--publish cere un folder destinație.');
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Pachetul desktop se construiește pe Windows x64.');
if (require('../package.json').version !== version) throw new Error('Versiunile din package.json și lib/version.js diferă.');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'compute-bridge-desktop-stage-'));
const safeStage = path.resolve(stage).startsWith(path.resolve(os.tmpdir()) + path.sep);
if (!safeStage) throw new Error('Folderul temporar nu este în directorul temporar al sistemului.');

async function main() {
  try {
    for (const file of ['hub-app.js', 'app.js', 'server.js', 'provider.js']) {
      fs.copyFileSync(path.join(root, file), path.join(stage, file));
    }
    for (const dir of ['lib', 'public', 'desktop', 'runtime']) {
      fs.cpSync(path.join(root, dir), path.join(stage, dir), { recursive: true, filter: source => !source.split(path.sep).includes('__pycache__') && !source.endsWith('.pyc') });
    }
    fs.mkdirSync(path.join(stage, 'scripts'), { recursive: true });
    fs.copyFileSync(path.join(root, 'scripts/prepare-runtime.js'), path.join(stage, 'scripts/prepare-runtime.js'));
    fs.copyFileSync(path.join(root, 'scripts/install-workload-runtime.ps1'), path.join(stage, 'scripts/install-workload-runtime.ps1'));
    if (process.env.CB_HUB_URL) fs.writeFileSync(path.join(stage, 'desktop/config.json'), JSON.stringify({ hubUrl: require('../lib/remote-agent').hubUrl(process.env.CB_HUB_URL) }));
    fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
      name: 'compute-bridge-desktop',
      productName: 'Compute Bridge',
      version,
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
    fs.writeFileSync(path.join(folders[0], 'Pregateste mediul.cmd'), '@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"%~dp0ComputeBridge.exe" "%~dp0resources\\app\\scripts\\prepare-runtime.js"\r\nif errorlevel 1 (echo Pregatirea a esuat.)\r\npause\r\n');
    fs.writeFileSync(path.join(folders[0], 'Citeste-ma.txt'),
      `Compute Bridge ${version} - aplicație desktop Windows\r\n\r\n` +
      'Dezarhivează întregul folder și pornește ComputeBridge.exe.\r\n' +
      'Păstrează toate fișierele lângă executabil, inclusiv resources.\r\n' +
      'Aplicația se deschide în propria fereastră; nu cere Node.js sau browser instalat.\r\n' +
      'Blender și o placă NVIDIA sunt necesare pentru randarea GPU.\r\n' +
      'Pentru video, Python, AI CPU, compilare și simulări: instalează Docker Desktop, pornește-l, apoi deschide Pregateste mediul.cmd.\r\n' +
      'Serverul echipei este configurat automat. Creează un cont; primești 100 credite.\r\n' +
      'Oferă PC-ul pentru lucru sau folosește un PC disponibil în marketplace.\r\n' +
      'La închiderea aplicației se oprește agentul acestui PC.\r\n');
    const file = `ComputeBridge-${version}-desktop-windows-x64.zip`;
    const archive = path.join(output, file);
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$ErrorActionPreference = "Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; ' +
      'if ([System.IO.File]::Exists($env:CB_ARCHIVE_PATH)) { [System.IO.File]::Delete($env:CB_ARCHIVE_PATH) }; ' +
      '[System.IO.Compression.ZipFile]::CreateFromDirectory($env:CB_PACKAGE_DIR, $env:CB_ARCHIVE_PATH, [System.IO.Compression.CompressionLevel]::Optimal, $true)'], {
      env: { ...process.env, CB_PACKAGE_DIR: folders[0], CB_ARCHIVE_PATH: archive },
      windowsHide: true, stdio: 'inherit'
    });
    const bytes = fs.readFileSync(archive);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const manifest = {
      app: 'Compute Bridge', version, builtAt: new Date().toISOString(),
      files: [{ id: 'windows-x64', os: 'windows',
        label: 'Windows 10 and 11, x64 — desktop window',
        file, needsNode: false, ui: 'desktop', bytes: bytes.length, sha256 }]
    };
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), `${sha256}  ${file}\n`);
    if (publish) {
      const destination = path.resolve(publish);
      if (destination !== output) {
        fs.mkdirSync(destination, { recursive: true });
        for (const item of [file, 'manifest.json', 'SHA256SUMS.txt']) {
          fs.copyFileSync(path.join(output, item), path.join(destination, item));
        }
      }
      console.log(`Pachet și manifest publicate în: ${destination}`);
    }
    console.log(`Aplicația desktop Windows: ${path.join(folders[0], 'ComputeBridge.exe')}`);
    console.log(`Arhivă: ${archive}`);
    console.log('Distribuie întregul folder; executabilul folosește fișierele de lângă el.');
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
