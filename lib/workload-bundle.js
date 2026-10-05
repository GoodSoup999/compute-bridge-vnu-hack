const { types } = require('../public/workload-types');
const MAX_OUTPUT_BYTES = 6 * 1024 * 1024;
function problem(message) { throw Object.assign(new Error(message), { status: 400 }); }
function safePath(value) {
  return typeof value === 'string' && value.length <= 180 && /^[a-zA-Z0-9_. -]+(?:\/[a-zA-Z0-9_. -]+)*$/.test(value) && value.split('/').every(part => part !== '.' && part !== '..' && !/[. ]$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
function files(value, limit) {
  if (!Array.isArray(value) || !value.length || value.length > 64) problem('Pachetul trebuie să conțină 1–64 de fișiere');
  let total = 0; const names = new Set();
  return value.map(file => {
    if (!file || typeof file !== 'object') problem('Descriere de fișier invalidă');
    if (!safePath(file.path) || names.has(file.path.toLowerCase())) problem('Nume de fișier invalid sau duplicat');
    names.add(file.path.toLowerCase());
    if (typeof file.data !== 'string' || file.data.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) problem('Conținut base64 invalid');
    const bytes = Buffer.from(file.data, 'base64'); if (bytes.toString('base64') !== file.data) problem('Conținut base64 invalid'); total += bytes.length; if (total > limit) problem('Fișierele depășesc limita de mărime');
    return { path: file.path, data: file.data };
  });
}
function validateBundle(bytes) {
  let b; try { b = JSON.parse(bytes.toString()); } catch { problem('Pachet .cbtask JSON invalid'); }
  if (!b || b.version !== 1 || typeof b.kind !== 'string' || !types[b.kind]) problem('Tip de lucrare nesuportat');
  const input = files(b.files, 24 * 1024 * 1024);
  if (input.some(file => file.path.toLowerCase() === 'task.json')) problem('Numele task.json este rezervat');
  if (!safePath(b.entry) || !input.some(file => file.path === b.entry)) problem('Fișierul de intrare lipsește din pachet');
  if (!Array.isArray(b.args || []) || (b.args || []).length > 32 || (b.args || []).some(v => typeof v !== 'string' || v.length > 512 || /\x00/.test(v))) problem('Parametri invalizi');
  const config = {};
  if (b.kind === 'compile') { config.target = b.config?.target || 'windows'; if (!['windows', 'linux'].includes(config.target)) problem('Țintă de compilare invalidă'); }
  if (b.kind === 'video') {
    config.width = Number(b.config?.width || 640); config.height = Number(b.config?.height || 360);
    if (!Number.isInteger(config.width) || !Number.isInteger(config.height) || config.width < 64 || config.width > 1920 || config.height < 64 || config.height > 1080 || config.width % 2 || config.height % 2) problem('Rezoluție video invalidă');
    config.format = b.config?.format || 'mp4'; if (!['mp4', 'webm'].includes(config.format)) problem('Format video invalid');
  }
  if (['python', 'ai', 'simulation'].includes(b.kind) && !b.entry.endsWith('.py')) problem('Alege un script Python ca intrare');
  if (b.kind === 'compile' && !/\.(c|cpp|cc)$/i.test(b.entry)) problem('Alege un fișier C/C++ ca intrare');
  return { version: 1, kind: b.kind, entry: b.entry, args: b.args || [], config, files: input };
}
function validateOutput(value) {
  if (!value || value.version !== 1 || value.exitCode !== 0) problem('Rezultat de execuție invalid');
  return { version: 1, exitCode: 0, logs: String(value.logs || '').slice(-65536), files: files(value.files, MAX_OUTPUT_BYTES) };
}
module.exports = { validateBundle, validateOutput, safePath, MAX_OUTPUT_BYTES };
