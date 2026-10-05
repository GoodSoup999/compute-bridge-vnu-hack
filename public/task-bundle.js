async function createTaskBundle(files, options) {
  if (!files.length || files.length > 64) throw new Error('Alege 1–64 de fișiere');
  if (files.reduce((sum, file) => sum + file.size, 0) > 24 * 1048576) throw new Error('Maximum 24 MB de fișiere de intrare');
  const names = new Set(); const packed = [];
  for (const file of files) {
    if (names.has(file.name.toLowerCase()) || file.name.toLowerCase() === 'task.json') throw new Error('Nume duplicate sau rezervate: ' + file.name);
    names.add(file.name.toLowerCase());
    const bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
    for (let offset=0;offset<bytes.length;offset+=8192) binary += String.fromCharCode(...bytes.subarray(offset,offset+8192));
    packed.push({path:file.name,data:btoa(binary)});
  }
  const bundle = {version:1,kind:options.kind,entry:options.entry,args:options.args || [],config:options.config || {},files:packed};
  if (!packed.some(file=>file.path===bundle.entry)) throw new Error('Alege fișierul de pornire');
  if (!Array.isArray(bundle.args) || bundle.args.some(value=>typeof value!=='string')) throw new Error('Parametrii trebuie să fie o listă JSON de texte');
  return new Blob([JSON.stringify(bundle)],{type:'application/octet-stream'});
}
if(typeof module!=='undefined')module.exports={createTaskBundle};
