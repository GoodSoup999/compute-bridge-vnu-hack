// Reorganize an already verified kit without changing the execution inputs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { validateBundle } = require('../lib/workload-bundle');
const groups = [
  {name:'Procesare video',kind:'video',cases:[['video','MP4'],['video-webm','WebM']]},
  {name:'Python',kind:'python',cases:[['python','Program'],['isolation','Izolare']]},
  {name:'AI · CPU',kind:'ai',cases:[['ai-inference','Predicție'],['ai-training','Antrenare']]},
  {name:'Compilare C-C++',kind:'compile',cases:[['compile','C++ - Windows'],['compile-c','C - Windows'],['compile-linux','C - Linux']]},
  {name:'Simulări Python',kind:'simulation',cases:[['simulation','Oscilator']]}
];
function build(source, destination, archive) {
  source=path.resolve(source);destination=path.resolve(destination);archive=path.resolve(archive);
  if(fs.existsSync(destination))throw Error('Folderul destinație trebuie să fie nou, pentru a evita fișiere vechi.');
  const report=JSON.parse(fs.readFileSync(path.join(source,'workload-verification.json')));
  if(report.verification!=='real-docker'||report.cases.length!==10||report.cases.some(c=>!c.passed))throw Error('Kitul sursă trebuie să includă raportul celor 10 teste reale.');
  const cases=[];
  // Validate every input before writing anything.
  for(const group of groups)for(const [name,variant] of group.cases){
    const input=fs.readFileSync(path.join(source,name+'.cbtask'));
    const bundle=validateBundle(input);if(bundle.kind!==group.kind)throw Error('Tip nepotrivit: '+name);
    const verified=report.cases.find(c=>c.name===name);if(!verified?.passed)throw Error('Test neverificat: '+name);
    const results=path.join(source,'expected-results',name);
    for(const file of verified.files)if(!fs.existsSync(path.join(results,file)))throw Error('Rezultat absent: '+file);
    cases.push({group,name,variant,input,bundle,results,verified});
  }
  fs.mkdirSync(destination,{recursive:true});
  const manifest={format:2,compatibleApp:'0.7.x',verification:report.ci,cases:[]};
  for(const {group,name,variant,input,bundle,results,verified} of cases){
    const folder=path.join(destination,group.name,variant);fs.mkdirSync(path.join(folder,'Intrări'),{recursive:true});
    fs.writeFileSync(path.join(folder,name+'.cbtask'),input);
    for(const file of bundle.files){const target=path.join(folder,'Intrări',...file.path.split('/'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(file.data,'base64'));}
    fs.cpSync(results,path.join(folder,'Rezultate așteptate'),{recursive:true});
    const notes=group.kind==='compile'?'Nu încarci executabilul din Rezultate așteptate. Acesta este rezultatul verificat; fișierul .cbtask conține sursa de compilat.':name==='isolation'?'Acesta este un test suplimentar de izolare, executat ca lucrare Python.':'Fișierele din Rezultate așteptate sunt referințe verificate, nu fișiere de intrare.';
    fs.writeFileSync(path.join(folder,'CITESTE-MA.md'),`# ${group.name} · ${variant}\n\n1. Pe furnizor: Docker Desktop Linux pornit, Pregateste mediul.cmd terminat, ofertă cu minimum 4 GB RAM și Accept video/cod activat.\n2. Pe client, din alt cont: selectează **${group.kind==='compile'?'Compilare C/C++':group.name}** și furnizorul.\n3. În Încarcă un pachet pregătit (.cbtask), alege **${name}.cbtask**, încarcă și selectează pachetul.\n4. Execuție: Doar PC-uri remote. Buget: 20 credite (tarif furnizor recomandat: 1). Pornește lucrarea.\n5. Descarcă ${verified.files.map(f=>'`'+f+'`').join(', ')} și compară cu folderul Rezultate așteptate.\n\n${notes}\n\nIntrări conține fișierele decodate din pachet, pentru inspectare sau încărcare directă. Programul citește din /inputs și scrie în /outputs. Testul se execută pe un singur furnizor. Șterge pachetele nefolosite între teste: maximum trei per cont.\n`);
    manifest.cases.push({name,workload:group.name,folder:path.relative(destination,folder).split(path.sep).join('/'),package:name+'.cbtask',kind:bundle.kind,sha256:crypto.createHash('sha256').update(input).digest('hex')});
  }
  for(const [name,mode]of [['Fractal · CPU','Fractal · CPU'],['Ray tracing · CPU','Ray tracing · CPU']]){
    const folder=path.join(destination,name);fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder,'CITESTE-MA.md'),`# ${name}\n\nAcest motor demo este inclus în aplicație și nu cere fișier .cbtask.\n\n1. Pornește o ofertă CPU pe un alt cont. Docker nu este necesar pentru acest motor.\n2. Pe client, alege **${mode}**, Automat și Doar PC-uri remote.\n3. Pentru primul test: rezoluție 640×360, buget 20 credite; pentru fractal 1000 iterații, pentru ray tracing 8 mostre.\n4. Pornește lucrarea și deschide rezultatul.\n5. Pentru mai multe PC-uri simultan, activează două oferte CPU și urmărește contribuțiile în cardul lucrării.\n\nNu includem un rezultat numeric CI în acest folder; este un ghid de test manual al motorului inclus.\n`);
  }
  const blender=path.join(destination,'Proiect Blender · GPU');fs.mkdirSync(blender);
  fs.writeFileSync(path.join(blender,'CITESTE-MA.md'),'# Proiect Blender · GPU\n\nNu includem un .blend în această arhivă. Poți testa scena demo inclusă sau propriul proiect.\n\n1. Pe furnizor: Blender compatibil și GPU NVIDIA; activează Ofer și GPU-ul pentru Blender. Pentru fișiere proprii activează și Accept proiecte Blender încărcate de utilizatori.\n2. Pe client: alege Proiect Blender · GPU și Scena demo inclusă, 4 cadre, 320×180, 8 mostre, buget 20 credite, Doar PC-uri remote.\n3. Pentru două GPU-uri simultan: două oferte compatibile, furnizor Automat. Urmărește contribuțiile și deschide playerul rezultatului.\n4. Pentru propriul .blend: camera și animația setate, File → External Data → Pack Resources, salvează fără compresie; maximum 32 MB. Încarcă și alege proiectul și intervalul de cadre.\n\nBlender rulează local, fără aceeași izolare Docker; folosește proiecte de încredere. Acesta este un ghid de test manual, nu un rezultat Blender nou verificat pentru acest release al kitului.\n');
  fs.copyFileSync(path.join(__dirname,'../docs/GHID-UTILIZARE.md'),path.join(destination,'GHID-UTILIZARE.md'));
  for(const name of ['HOSTING.md','PROJECTS.md','TEST-WORKLOADS.md'])fs.copyFileSync(path.join(__dirname,'../docs',name),path.join(destination,name));
  fs.writeFileSync(path.join(destination,'workload-verification.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2));
  fs.writeFileSync(path.join(destination,'CITESTE-MA.md'),'# Compute Bridge · Kit de teste organizat după lucrări\n\nCompatibil cu aplicația 0.7.0 / 0.7.1. Pentru economie demo folosește 0.7.1.\n\nDeschide folderul cu numele lucrării din aplicație, apoi varianta dorită și CITESTE-MA.md. Acolo găsești pachetul .cbtask, Intrări și Rezultate așteptate.\n\n| Lucrare în aplicație | Folder |\n| --- | --- |\n| Proiect Blender · GPU | Proiect Blender · GPU |\n| Procesare video | Procesare video |\n| Python | Python |\n| AI · CPU | AI · CPU |\n| Compilare C/C++ | Compilare C-C++ |\n| Simulări Python | Simulări Python |\n| Fractal · CPU | Fractal · CPU |\n| Ray tracing · CPU | Ray tracing · CPU |\n\nWindows nu permite / în numele folderelor, de aceea Compilare C/C++ devine Compilare C-C++.\n\nPentru primul test: Python → Program → python.cbtask. Rezultatul: statistics.json cu count=10, sum=55, mean=5.5. Ai nevoie de un furnizor pregătit și de un alt cont client. Nu încărca rezultatele de referință ca intrări. Maximum trei pachete per cont; șterge cele nefolosite între teste.\n\nRaportul inclus păstrează data și commitul verificării reale Docker originale; acest release reorganizează fișierele, nu pretinde o nouă execuție a tuturor programelor. Blender, fractal și ray tracing au instrucțiuni pentru motoarele incluse, fără pachete noi. Pentru server/instalare, citește GHID-UTILIZARE.md; linkurile relative ale ghidului indică documentația din repository.\n');
  fs.mkdirSync(path.dirname(archive),{recursive:true});
  if(fs.existsSync(archive))throw Error('Arhiva destinație există deja.');
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:CB_KIT_SOURCE,$env:CB_KIT_ZIP)'],{env:{...process.env,CB_KIT_SOURCE:destination,CB_KIT_ZIP:archive},windowsHide:true});
  fs.writeFileSync(archive+'.sha256',crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex')+'  '+path.basename(archive)+'\n');
  console.log('Kit: '+archive+'; '+cases.length+' pachete originale validate în 8 foldere de lucrări.');
}
module.exports={build};
if(require.main===module){try{if(process.argv.length!==5)throw Error('node scripts/package-test-kit.js KIT_VERIFICAT FOLDER_NOU ARHIVA.zip');build(...process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
