const { parentPort } = require('node:worker_threads');
const fractal = require('./fractal');
const raytrace = require('./raytrace');
parentPort.on('message', task => {
  const start = performance.now();
  const pixels = task.mode === 'raytrace' ? raytrace.renderTile(task) : fractal.renderTile(task);
  parentPort.postMessage({ task, pixels: pixels.toString('base64'), durationMs: Math.round(performance.now() - start) });
});
