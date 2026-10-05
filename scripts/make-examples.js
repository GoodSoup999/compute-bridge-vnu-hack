const fs = require('node:fs');
const path = require('node:path');
const { pack } = require('./pack-task');
function chunk(name, bytes) { const size = Buffer.alloc(4); size.writeUInt32LE(bytes.length); return Buffer.concat([Buffer.from(name), size, bytes, bytes.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]); }
function list(type, bytes) { return chunk('LIST', Buffer.concat([Buffer.from(type), bytes])); }
function avi() {
  const avih = Buffer.alloc(56); [100000,122880,0,0,20,0,1,12288,64,64].forEach((n,i)=>avih.writeUInt32LE(n,i*4));
  const strh = Buffer.alloc(56); strh.write('vids',0);strh.write('DIB ',4);strh.writeUInt32LE(1,20);strh.writeUInt32LE(10,24);strh.writeUInt32LE(20,32);strh.writeUInt32LE(12288,36);strh.writeUInt32LE(0xffffffff,40);strh.writeInt16LE(64,52);strh.writeInt16LE(64,54);
  const strf = Buffer.alloc(40);strf.writeUInt32LE(40,0);strf.writeInt32LE(64,4);strf.writeInt32LE(64,8);strf.writeUInt16LE(1,12);strf.writeUInt16LE(24,14);strf.writeUInt32LE(12288,20);
  const frames = [];
  for(let frame=0;frame<20;frame++){const pixels=Buffer.alloc(12288);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*3;pixels[i]=x*4;pixels[i+1]=y*4;pixels[i+2]=frame*12;}frames.push(chunk('00db',pixels));}
  return chunk('RIFF',Buffer.concat([Buffer.from('AVI '),list('hdrl',Buffer.concat([chunk('avih',avih),list('strl',Buffer.concat([chunk('strh',strh),chunk('strf',strf)]))])),list('movi',Buffer.concat(frames))]));
}
function make(destination = path.resolve(__dirname, '../test-kit')) {
  fs.mkdirSync(path.join(destination, 'inputs'), { recursive: true });
  fs.writeFileSync(path.join(destination, 'inputs/sample.avi'), avi());
  for (const name of ['python', 'ai-inference', 'ai-training', 'compile', 'simulation']) pack(path.join(__dirname, '../examples', name), path.join(destination, name + '.cbtask'));
  const video = { version: 1, kind: 'video', entry: 'sample.avi', config: { width:128,height:128,format:'mp4' }, files:[{path:'sample.avi',data:avi().toString('base64')}] };
  require('../lib/workload-bundle').validateBundle(Buffer.from(JSON.stringify(video)));
  fs.writeFileSync(path.join(destination,'video.cbtask'),JSON.stringify(video));
  fs.copyFileSync(path.join(__dirname, '../docs/TEST-WORKLOADS.md'), path.join(destination,'CITESTE-MA.md'));
  fs.copyFileSync(path.join(__dirname, '../docs/TEST-WORKLOADS.md'), path.join(destination,'TEST-WORKLOADS.md'));
  fs.copyFileSync(path.join(__dirname, '../docs/DEMO-MAINE.md'), path.join(destination,'DEMO-MAINE.md'));
  fs.cpSync(path.join(__dirname, '../examples'),path.join(destination,'sources'),{recursive:true,filter:file=>!file.endsWith('.pyc')&&!file.split(path.sep).includes('__pycache__')});
  return destination;
}
module.exports = { make, avi };
if(require.main===module) console.log('Exemple pregătite în: '+make(process.argv[2]));
