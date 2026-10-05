const fs = require('node:fs');
const path = require('node:path');
const { validateBundle } = require('../lib/workload-bundle');
function pack(directory, destination) {
  const root = path.resolve(directory);
  const output = path.resolve(destination);
  if (output === root || output.startsWith(root + path.sep)) throw new Error('Salvează pachetul în afara folderului de intrare');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'task.json')));
  const files = [];
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Pachetul nu poate conține linkuri simbolice');
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (path.relative(root, file) !== 'task.json') files.push({ path: path.relative(root, file).split(path.sep).join('/'), data: fs.readFileSync(file).toString('base64') });
    }
  }
  walk(root);
  const value = Buffer.from(JSON.stringify({ version: 1, ...manifest, files }));
  validateBundle(value);
  if (value.length > 32 * 1024 * 1024) throw new Error('Pachetul depășește 32 MB');
  fs.mkdirSync(path.dirname(path.resolve(destination)), { recursive: true }); fs.writeFileSync(destination, value);
  console.log('Pachet: ' + path.resolve(destination)); return value;
}
module.exports = { pack };
if (require.main === module) {
  try { if (!process.argv[2] || !process.argv[3]) throw new Error('node scripts/pack-task.js FOLDER OUTPUT.cbtask'); pack(process.argv[2], process.argv[3]); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
