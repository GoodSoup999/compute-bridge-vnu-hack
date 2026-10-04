// What this PC has: processor, memory, graphics cards and Blender. Used to pre-fill the connector.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

function run(file, args, timeout = 6000) {
  return new Promise(resolve => {
    execFile(file, args, { timeout, windowsHide: true }, (error, stdout) => resolve(error ? '' : String(stdout)));
  });
}

async function detectGpus() {
  // nvidia-smi reports the real VRAM; the Windows WMI value stops at 4 GB.
  const nvidia = await run('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits']);
  const gpus = nvidia.split(/\r?\n/).filter(Boolean).map(line => {
    const [name, mb] = line.split(',').map(s => s.trim());
    return { name, vramGb: Math.round(Number(mb) / 1024) || 0, nvidia: true };
  });
  if (gpus.length) return gpus;
  if (process.platform === 'win32') {
    const out = await run('powershell.exe', ['-NoProfile', '-Command',
      'Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name + "|" + $_.AdapterRAM }']);
    return out.split(/\r?\n/).filter(Boolean).map(line => {
      const [name, bytes] = line.split('|');
      const gb = Number(bytes) / 1073741824;
      return { name: name.trim(), vramGb: gb >= 1 ? Math.round(gb) : 0, nvidia: /nvidia/i.test(name), approximate: true };
    }).filter(g => !/basic display|remote|virtual/i.test(g.name));
  }
  if (process.platform === 'darwin') {
    const out = await run('system_profiler', ['SPDisplaysDataType']);
    return [...out.matchAll(/Chipset Model:\s*(.+)/g)].map(m => ({ name: m[1].trim(), vramGb: 0, nvidia: false }));
  }
  const out = await run('lspci', []);
  return out.split(/\r?\n/).filter(l => /VGA|3D controller/.test(l))
    .map(l => ({ name: l.replace(/^.*?: /, '').trim(), vramGb: 0, nvidia: /nvidia/i.test(l) }));
}

function findBlender(custom) {
  if (custom) return fs.existsSync(custom) ? custom : null;
  const candidates = [];
  if (process.platform === 'win32') {
    const root = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Blender Foundation');
    if (fs.existsSync(root)) {
      for (const folder of fs.readdirSync(root).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) {
        candidates.push(path.join(root, folder, 'blender.exe'));
      }
    }
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Blender.app/Contents/MacOS/Blender');
  } else {
    candidates.push('/usr/bin/blender', '/usr/local/bin/blender', '/snap/bin/blender', '/var/lib/flatpak/exports/bin/org.blender.Blender');
  }
  return candidates.find(file => fs.existsSync(file)) || null;
}

async function systemInfo() {
  const cpus = os.cpus();
  const gpus = await detectGpus();
  const blender = findBlender();
  const nvidia = gpus.find(g => g.nvidia);
  return {
    hostname: os.hostname(),
    platform: process.platform,
    cpu: (cpus[0]?.model || 'CPU').replace(/\s+/g, ' ').trim(),
    threads: cpus.length,
    ramGb: Math.round(os.totalmem() / 1073741824),
    gpus,
    blender,
    blenderVersion: blender ? (/Blender[\\/ ]+(\d+\.\d+)/i.exec(blender)?.[1] || null) : null,
    // The Blender script renders with Cycles OptiX or CUDA, so GPU frames need an NVIDIA card.
    gpuRenderReason: !blender ? 'Blender nu e instalat pe acest PC.' : !nvidia ? 'Randarea cere o placă NVIDIA (OptiX sau CUDA).' : null
  };
}

module.exports = { systemInfo, findBlender };
