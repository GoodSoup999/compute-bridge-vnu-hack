const { parentPort } = require('node:worker_threads');
const { renderTile } = require('./fractal');
parentPort.on('message', task => {
  const start = performance.now();
  const pixels = renderTile(task);
  parentPort.postMessage({ task, pixels: pixels.toString('base64'), durationMs: Math.round(performance.now() - start) });
});
