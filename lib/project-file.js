const MAX_PROJECT_BYTES = 32 * 1024 * 1024;
async function readProject(req) {
  const parts = []; let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > MAX_PROJECT_BYTES) throw Object.assign(new Error('Proiectul depășește limita de 32 MB'), { status: 413 });
    parts.push(part);
  }
  const bytes = Buffer.concat(parts);
  if (bytes.length < 12 || bytes.subarray(0, 7).toString() !== 'BLENDER') throw Object.assign(new Error('Alege un fișier .blend necomprimat'), { status: 400 });
  return bytes;
}
module.exports = { MAX_PROJECT_BYTES, readProject };
