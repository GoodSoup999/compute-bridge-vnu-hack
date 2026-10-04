// Command-line provider. The desktop app (app.js) offers the same thing with a window.
const os = require('node:os');
const { Connector } = require('./lib/connector');
const { findBlender } = require('./lib/system');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const token = String(arg('token', process.env.BRIDGE_TOKEN || ''));
if (!token) {
  console.error('Lipsește --token. Folosește codul afișat de server.');
  process.exit(1);
}
const blenderPath = findBlender(arg('blender', null));
const vramGb = Number(arg('vram', 0));
const connector = new Connector({
  server: arg('server', 'http://localhost:3000'),
  token,
  name: arg('name', os.hostname()),
  cpu: arg('cpu', os.cpus()[0]?.model || 'CPU'),
  ramGb: Number(arg('ram', Math.round(os.totalmem() / 1073741824))),
  gpu: arg('gpu', 'Nespecificat'),
  vramGb,
  watts: Number(arg('watts', 0)),
  rateRon: Number(arg('rate', 0)),
  slots: Number(arg('slots', 4)) || 4,
  blenderPath,
  gpuRender: Boolean(blenderPath && vramGb > 0)
});

connector.on('log', ({ text, level }) => (level === 'error' ? console.error : console.log)(text));
connector.on('status', ({ state, message }) => {
  if (state === 'reconnecting' && message) console.error(message);
});
connector.on('task', task => {
  if (task.phase !== 'done') return;
  if (task.kind === 'gpu') console.log(`GPU ${task.backend}: cadrul ${task.frame + 1}/${task.frames} în ${task.durationMs} ms`);
  else console.log(`Slot ${task.slot}: rândurile ${task.y}–${task.y + task.rows - 1} în ${task.durationMs} ms`);
});

const stop = () => connector.stop().finally(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

connector.start().catch(error => { console.error(error.message); process.exit(1); });
