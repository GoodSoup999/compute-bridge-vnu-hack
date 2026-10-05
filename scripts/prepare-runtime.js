const path = require('node:path');
const { spawn } = require('node:child_process');
const { IMAGE, command } = require('../lib/container-runtime');
(async () => {
  const os = (await command(['version', '--format', '{{.Server.Os}}'])).trim();
  if (os !== 'linux') throw new Error('Pornește Docker Desktop în modul containere Linux.');
  console.log('Pregătesc Python, NumPy, scikit-learn, PyTorch CPU, FFmpeg și compilatoarele Linux/Windows. Prima descărcare poate dura câteva minute.');
  const child = spawn(process.platform === 'win32' && require('fs').existsSync(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker/Docker/resources/bin/docker.exe')) ? path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker/Docker/resources/bin/docker.exe') : 'docker', ['build', '-t', IMAGE, path.resolve(__dirname, '../runtime')], { stdio: 'inherit', windowsHide: true });
  await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('Docker build a eșuat: ' + code))); });
  console.log('Mediul este pregătit. Redeschide Compute Bridge pentru a-l detecta.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
