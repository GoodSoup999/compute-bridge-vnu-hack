# Compute Bridge

Prototip VNU Hack pentru împărțirea lucrului de calcul între PC-uri cu Windows din aceeași rețea locală. Versiunea **0.2.0**.

Un PC rulează **coordonatorul**: primește o lucrare, o taie în sarcini și le ține într-o singură coadă. Celelalte PC-uri rulează **conectorul** și oferă procesorul și, dacă au, placa video. Fiecare slot liber cere următoarea sarcină imediat ce o termină pe cea curentă, așa că PC-ul mai rapid preia mai multe. Coordonatorul poate oferi și el putere în același timp.

Fiecare PC calculează separat: procesoarele și VRAM-ul plăcilor video nu se adună. Fiecare GPU randează cadre întregi, iar fiecare slot CPU calculează benzi întregi din imagine.

Site și download: **https://node-compute.vercel.app**

## Descarcă și pornește

Pe [pagina de download](https://node-compute.vercel.app/download) sunt două pachete, ambele pentru **Windows 10 și 11, x64**:

| Pachet | Ce conține |
| --- | --- |
| `ComputeBridge-0.2.0-windows-x64.zip` | `ComputeBridge.exe`, cu Node.js inclus. Nu trebuie instalat nimic. |
| `compute-bridge-0.2.0-source.zip` | Codul sursă și lansatorul `Compute Bridge.cmd`, pentru PC-uri cu Node.js 20+. E aceeași aplicație, utilă dacă antivirusul blochează `.exe`-ul. |

**Prima pornire:**

1. Dezarhivează și dă dublu-clic pe `ComputeBridge.exe`.
2. Dacă Windows afișează „Windows protected your PC”, apasă *More info*, apoi *Run anyway*. Aplicația nu e semnată digital.
3. Când firewall-ul cere acces, permite-l în **rețelele private**. Fără asta, celelalte PC-uri nu ajung la coordonator (TCP 3000) și nu îl găsesc în rețea (UDP 39871).
4. Se deschide o fereastră de consolă. Las-o deschisă: dacă o închizi, aplicația se oprește.
5. Aplicația se deschide în browser, la `http://127.0.0.1:3210` sau la următorul port liber. Dacă nu se deschide singură, copiază adresa afișată în consolă.

Interfața aplicației e în română și folosește designul NODE.

## Coordonatorul: PC-ul care trimite lucrări

1. În aplicație alege **Folosesc puterea altor PC-uri**, apoi **Pornește coordonatorul**.
2. Ecranul arată:
   - **codul de acces**: 24 de caractere în grupuri de câte 4, cu butoane *Ascunde* și *Copiază*;
   - **adresa în rețea**, de exemplu `192.168.1.10:3000`;
   - **PC-urile conectate**, actualizate în timp real.
3. **Deschide panoul de lucru** duce la panoul coordonatorului. Acolo alegi și pornești lucrarea și vezi:
   - fiecare PC, legat printr-un fir care se aprinde cât are o sarcină;
   - sarcinile care pleacă și rezultatele care se întorc, ca puncte luminoase pe fire;
   - coada, colorată pe PC-uri;
   - imaginea care se compune bandă cu bandă (sau grila de cadre care se umple);
   - jurnalul;
   - timpul, ritmul, costul simulat și energia estimată.
4. **Oferă și puterea acestui PC** conectează și coordonatorul ca furnizor, cu codul deja completat.

Coordonatorul ascultă pe portul TCP 3000. Dacă portul e ocupat, aplicația încearcă porturile până la 3009.

## Conectorul: PC-urile care oferă putere

În aplicație alege **Ofer putere de calcul** și parcurge trei pași:

1. **Alege coordonatorul.** Coordonatorii din aceeași rețea apar singuri în listă: fiecare trimite la 2 secunde un mesaj UDP pe portul 39871, cu numele și portul lui, niciodată cu codul. Dacă nu apare, scrie adresa afișată pe coordonator.
2. **Scrie codul de acces.**
3. **Alege ce oferă acest PC:**
   - numele PC-ului;
   - câte sloturi CPU (între 1 și 12, cel mult câte fire are procesorul);
   - dacă randează cadre Blender pe placa video;
   - placa video și memoria ei;
   - două ipoteze de demo, folosite doar pentru costul simulat: tariful în RON pe oră și puterea în W.

**Randarea pe GPU** se poate activa doar dacă aplicația găsește Blender (în `C:\Program Files\Blender Foundation`) și o placă NVIDIA. Scriptul de randare folosește Cycles cu OptiX sau CUDA.

**Detectarea hardware-ului.** Aplicația citește singură procesorul, memoria și plăcile video, cu `nvidia-smi` pe NVIDIA. Pentru alte plăci, Windows raportează cel mult 4 GB de VRAM, așa că aplicația te roagă să corectezi valoarea.

**Cât PC-ul lucrează,** vezi fiecare slot cu sarcina lui, sarcinile terminate, timpul de calcul, media pe sarcină și un jurnal.

**Oprirea:** *Oprește partajarea* face ca PC-ul să apară imediat offline pe coordonator, iar sarcinile la care lucra revin în coadă pentru celelalte PC-uri. Dacă un PC dispare fără să se oprească din aplicație, sarcinile lui revin în coadă după 2 minute (CPU) sau 5 minute (GPU). Un PC apare offline după 15 secunde fără contact.

**Dacă repornește coordonatorul:** din aplicație primește un cod nou, deci fiecare PC trebuie reconectat cu noul cod. Doar un coordonator repornit cu același cod (`node server.js` cu `BRIDGE_TOKEN` fixat) e regăsit automat de conectori.

## Lucrările

Sunt doar trei lucrări incluse, iar coordonatorul acceptă o singură lucrare activă odată.

| Lucrare | Unde rulează | Limite | Se împarte în |
| --- | --- | --- | --- |
| Animație 3D cu Blender | GPU NVIDIA (Cycles cu OptiX sau CUDA), cu Blender instalat pe fiecare PC care randează | 2–96 cadre, 200–1600 × 200–1000 px, 8–512 mostre per cadru, cel mult 80 de milioane de pixeli în toată animația | cadre întregi |
| Randare 3D cu ray tracing | CPU | 200–1600 × 200–1000 px, 1–1024 mostre per pixel | benzi de 16 rânduri |
| Imagine fractală | CPU | 200–3000 × 200–2000 px, 100–10.000 iterații | benzi de 32 de rânduri |

**Scena Blender** e procedurală și identică pe fiecare PC. Are o sferă de sticlă cu miez coral pe o bază cromată, inele aurii și de neon, 20 de coloane cu lumini în vârf, 18 sfere care orbitează, trei lumini și o cameră care se rotește în jurul scenei, cu profunzime de câmp. Nu se pot trimite fișiere `.blend` proprii.

**Erori pe GPU:** dacă Blender eșuează la un cadru, lucrarea se oprește și afișează eroarea PC-ului respectiv. Un cadru e anulat după 4 minute.

**La final** primești:
- pentru CPU: imaginea PNG, cu buton de descărcare;
- pentru GPU: un player de animație, cu viteza reglabilă între 1 și 30 de cadre pe secundă.

**Exemplu măsurat**, ca orientare, nu ca benchmark: pe un singur PC (i5-12400F) cu doi conectori, PC-1 cu 2 sloturi și PC-2 cu 4 sloturi, care își împart același procesor:

| Lucrare | Timp total | Benzi calculate |
| --- | --- | --- |
| Ray tracing 1600 × 900, 320 de mostre (57 de benzi) | 28,8 s | PC-2: 39, PC-1: 18 |
| Fractal 2400 × 1600, 100 de iterații (50 de benzi) | 1,3 s | PC-2: 31, PC-1: 19 |

## Demo pentru juriu

1. **Pe PC-ul coordonator:** pornește aplicația, alege *Folosesc puterea altor PC-uri*, apoi *Pornește coordonatorul*.
2. **Pe fiecare laptop cu NVIDIA și Blender:**
   1. Pornește aplicația și alege *Ofer putere de calcul*.
   2. Alege coordonatorul din listă și scrie codul.
   3. Lasă activă opțiunea *Randează cadre Blender pe placa video*, apoi apasă *Conectează acest PC*.
3. **Pe coordonator:** apasă *Deschide panoul de lucru*, alege *Animație GPU* și una dintre setările rapide:

   | Setare rapidă | Cadre | Rezoluție | Mostre |
   | --- | --- | --- | --- |
   | Demo scurt | 16 | 640 × 360 | 32 |
   | Implicit | 48 | 960 × 540 | 96 |
   | Test greu | 64 | 1280 × 720 | 128 |

   Primul cadru poate dura mai mult, din cauza inițializării Blender și OptiX.
4. **Arată în panou:**
   - firele aprinse spre PC-urile care lucrează;
   - grila de cadre care se umple, colorată după PC-ul care a randat fiecare cadru;
   - câte cadre a făcut fiecare PC. Distribuția nu e fixă: PC-ul mai rapid ia mai multe cadre.
5. **La final:** arată animația, timpul, costul simulat și energia estimată. Apoi demonstrează modul CPU (ray tracing sau fractal), pentru comparație.
6. **Pentru o comparație de timp:** oprește un PC din aplicația lui (*Oprește partajarea*), pornește aceeași lucrare și compară. Fă comparația înainte de prezentare și notează rezultatele reale.

## Costul și energia (simulate)

Formulele:
- **Pentru CPU:** costul este `suma(timp pe slot × tariful orar al PC-ului ÷ numărul de sloturi)`.
- **Pentru GPU:** costul este `suma(timp de randare × tariful orar al PC-ului)`.
- **Energia** folosește aceleași durate și puterea introdusă.

Tariful și puterea sunt **ipoteze introduse de utilizator**, nu măsurători sau prețuri reale. Nu există plăți.

Un produs real ar avea nevoie de măsurarea consumului, plăți, izolarea sarcinilor, verificarea rezultatelor și protecția datelor.

## Linia de comandă (fără aplicație)

Din codul sursă, cu Node.js 20+, fără `npm install`. Comenzile se rulează în PowerShell, din folderul care conține `server.js`:

```powershell
cd "$env:USERPROFILE\Downloads\compute-bridge-vnu-hack-main"
Test-Path .\provider.js
```

`Test-Path` trebuie să afișeze `True`. Nu rula comenzile din `C:\Windows\System32`: Node caută fișierele în folderul curent.

**Coordonatorul:**

```powershell
node server.js
```

Comanda afișează adresa și **codul de acces**. Adresa IPv4 a PC-ului o afli cu `ipconfig`. Panoul live e la `http://localhost:3000/node`, iar pagina simplă inițială la `http://localhost:3000`. Opțional, variabilele de mediu `PORT` și `BRIDGE_TOKEN` fixează portul și codul.

**Furnizorii**, de exemplu laptopurile cu RTX 3050 și RTX 5060. Înlocuiește `192.168.1.10` cu adresa coordonatorului și `COD` cu codul lui:

```powershell
node provider.js --server http://192.168.1.10:3000 --token COD --name PC-3050 --slots 4 --ram 16 --gpu "RTX 3050 Laptop" --vram 4 --watts 120 --rate 2
node provider.js --server http://192.168.1.10:3000 --token COD --name PC-5060 --slots 6 --ram 16 --gpu "RTX 5060 Laptop" --vram 8 --watts 160 --rate 3
```

**Opțiunile `provider.js`:**
- `--slots` este numărul de lucrători CPU simultani. Fiecare PC randează câte un singur cadru GPU odată.
- `--watts` și `--rate` sunt ipoteze de demo.
- **Cadrele GPU** cer Blender și `--vram` mai mare ca 0. Dacă Blender nu e în `C:\Program Files\Blender Foundation`, indică-l cu `--blender "C:\cale\blender.exe"`. La conectare, terminalul afișează calea Blender după `randare Blender GPU:`; dacă scrie `indisponibilă`, verifică Blender și `--vram`.
- **Ctrl+C** oprește furnizorul, iar coordonatorul îl vede imediat offline.

**Alte moduri de pornire:**
- `node app.js` pornește aplicația din sursă.
- `node scripts/local.js` pornește un coordonator și doi furnizori pe același PC, pentru test, și afișează linkul spre panou.

## Dacă un PC nu se poate conecta

1. **Pe coordonator,** aplicația (sau `node server.js`) trebuie să ruleze și să afișeze codul și adresa.
2. **Ambele PC-uri trebuie să fie în aceeași rețea** (același router sau Wi-Fi).
3. **Pe PC-ul furnizor**, în PowerShell: `Test-NetConnection ADRESA_IP -Port 3000`. Dacă `PingSucceeded` este `True`, dar `TcpTestSucceeded` este `False`, verifică firewall-ul de pe coordonator: aplicația trebuie permisă în rețelele private. Nu dezactiva firewall-ul complet.
4. **Dacă aplicația spune că acel cod nu e corect,** copiază-l din nou de pe coordonator. Codul se schimbă la fiecare pornire.
5. **Dacă opțiunea GPU e dezactivată,** aplicația scrie motivul: Blender nu e instalat sau placa nu e NVIDIA.

## Pentru dezvoltatori

| Fișier | Rol |
| --- | --- |
| `app.js` | Aplicația desktop: server local pe 127.0.0.1, care răspunde doar cu o cheie generată la fiecare pornire. Pornește coordonatorul și conectorul și deschide fereastra în browser. |
| `public/app.html` | Interfața aplicației: start, coordonator, conector. |
| `server.js` | Coordonatorul. Exportă `startServer()`; rulat direct, se comportă ca înainte. Trimite semnalul de descoperire. |
| `public/node.html` | Panoul live al coordonatorului (`/node`). |
| `public/index.html` | Pagina simplă inițială (`/`). |
| `public/ui.css` | Designul comun, după sistemul NODE. Fonturile din `public/fonts` sunt sub SIL Open Font License. |
| `lib/connector.js` | Logica furnizorului, folosită de `provider.js` și de aplicație. |
| `provider.js` | Furnizorul din linia de comandă. |
| `lib/discovery.js` | Descoperirea în rețea (UDP 39871). |
| `lib/system.js` | Detectarea procesorului, plăcilor video și a Blender. |
| `lib/assets.js` | Fișierele aplicației, citite de pe disc sau din executabil. |
| `lib/blender_gpu.py` | Scena Blender. |
| `lib/raytrace.js` | Lucrarea de ray tracing pe CPU. |
| `lib/fractal.js` | Lucrarea fractal pe CPU. |
| `lib/png.js` | Codificarea imaginilor PNG. |

**API-ul coordonatorului.** Toate rutele `/api/*` cer antetul `x-bridge-token` cu codul de acces.

- **Rutele panoului:**
  - `GET /api/state`: furnizorii, lucrarea curentă cu starea și PC-ul fiecărei sarcini, plus numele și adresele coordonatorului, fără cod;
  - `POST /api/job` cu `{ mode: "blender" | "raytrace" | "fractal", width, height, samples | iterations, frames }`;
  - `POST /api/cancel`;
  - `GET /api/image`: imaginea CPU finală;
  - `GET /api/frame/:i`: un cadru GPU;
  - `GET /api/preview`: imaginea CPU parțială, cel mult 960 px lățime.
- **Rutele furnizorilor:**
  - `POST /api/register` (protocolul 3);
  - `GET /api/task?provider=ID&kind=cpu|gpu`;
  - `POST /api/result`;
  - `POST /api/failure`;
  - `POST /api/leave`.

**Teste:** `npm test` rulează:
- `test/scheduling.js`: coada comună dă mai multe sarcini PC-ului mai rapid;
- `test/error-report.js`: o eroare GPU rămâne vizibilă;
- `test/connector.js`: conectorul aplicației lucrează, se oprește curat și explică erorile.

Pe un PC cu Blender și NVIDIA există și `node test/gpu-smoke.js`, care verifică două cadre GPU pe doi furnizori și apoi modul CPU.

**Build:** `node scripts/build.js` creează cele două pachete și `manifest.json` (mărimi și SHA-256) în `dist/`; se rulează pe Windows x64.
- Aplicația e strânsă într-un singur script, transformată în blob [Node SEA](https://nodejs.org/api/single-executable-applications.html) și injectată cu `postject` în binarul Node.js al PC-ului care face build-ul.
- Cu `--publish <folder>`, pachetele se copiază acolo. Pentru site: `node scripts/build.js --publish ../apps/web/public/downloads`, apoi, din repo-ul site-ului, `npm run deploy -w apps/web`.

**După o actualizare,** pune aceeași versiune pe toate PC-urile: aplicația nouă, sau `git pull` pentru linia de comandă. Un furnizor cu protocol vechi primește mesajul să se actualizeze.

## Limitele prototipului

- **O singură lucrare activă odată.** Rezultatul precedent rămâne vizibil până pornește una nouă.
- **Rulează doar cele trei lucrări incluse.** Nu execută cod sau fișiere trimise de utilizatori, iar modul GPU nu primește fișiere Blender proprii.
- **Randarea pe GPU cere NVIDIA.** VRAM-ul nu se combină între PC-uri: fiecare GPU randează separat cadrele lui.
- **Modul GPU are limite:** cel mult 80 de milioane de pixeli pe animație, ca să încapă în memoria coordonatorului. O lucrare mare poate dura minute.
- **„Oprește lucrarea” nu întrerupe sarcinile deja pornite.** Oprește doar distribuirea sarcinilor noi; o sarcină în curs se poate termina.
- **Nimic nu se păstrează după oprirea coordonatorului.** Lucrările și rezultatele stau doar în memoria lui.
- **Fără conturi, plăți sau desktop la distanță.** Funcționează doar în rețeaua locală.
- **Codul de acces e potrivit doar pentru o rețea locală de încredere.** Nu expune portul pe internet. Dacă apare într-o captură de ecran publică, repornește coordonatorul ca să primești alt cod.
- **Executabilul nu e semnat digital.** Doar pentru Windows 10 și 11, x64.
