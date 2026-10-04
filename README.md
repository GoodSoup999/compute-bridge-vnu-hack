# Compute Bridge — prototip VNU Hack

Două PC-uri furnizoare calculează în paralel, iar al treilea rulează coordonatorul și interfața web. Modul **Animație 3D cu Blender GPU** distribuie cadre între cele două laptopuri și le randează cu Cycles pe NVIDIA OptiX sau CUDA. Modurile **Randare 3D cu ray tracing** și **Imagine fractală** distribuie bucăți din imagine pe CPU. Sarcinile stau într-o coadă comună: PC-ul care termină primul preia imediat următorul cadru sau următoarea bucată. VRAM-ul celor două GPU-uri nu este combinat: fiecare GPU procesează separat cadrele pe care le primește.

## Ce trebuie instalat

- Node.js 20 sau mai nou pe toate cele trei PC-uri. Pe Arch Linux, verificați cu `node --version`; dacă lipsește, instalați cu `sudo pacman -Syu nodejs`. `npm` nu este necesar.
- Blender instalat pe fiecare PC furnizor care participă la randarea GPU. Dacă nu este în `C:\Program Files\Blender Foundation\Blender ...\blender.exe`, indicați executabilul prin `--blender "C:\cale\blender.exe"`. Coordonatorul nu are nevoie de Blender.
- Toate PC-urile în aceeași rețea locală. Permiteți accesul la portul TCP 3000 pe PC-ul coordonator, dacă firewall-ul este activ. Pe Windows, acceptați accesul pe rețeaua privată.
- Copiați acest folder pe fiecare PC. Nu este necesar `npm install`.

**Pe fiecare PC furnizor, rulați comanda din folderul care conține `provider.js`.** Dacă ați descărcat arhiva de pe GitHub și ați extras-o în Downloads, în PowerShell:

```powershell
cd "$env:USERPROFILE\Downloads\compute-bridge-vnu-hack-main"
Test-Path .\provider.js
```

Comanda `Test-Path` trebuie să afișeze `True`. Dacă afișează `False`, localizați folderul în care ați extras arhiva și intrați în el cu `cd`. Nu rulați `node provider.js` din `C:\Windows\System32`: Node caută fișierul în folderul curent.

## 1. PC-ul care folosește resursele

În terminal, din folderul proiectului, pe Windows, Arch Linux sau alt sistem cu Node.js:

```powershell
node server.js
```

Terminalul afișează un **cod de acces**. Păstrați terminalul deschis. Aflați adresa IPv4 a PC-ului cu `ipconfig` pe Windows sau `ip -4 addr` pe Arch Linux. Deschideți `http://localhost:3000` în browser și introduceți codul.

## 2. PC-ul 1 — RTX 3050

Înlocuiți `192.168.1.10` cu adresa IPv4 a PC-ului coordonator, chiar dacă acesta rulează Arch Linux, și `COD` cu codul afișat de server:

```powershell
node provider.js --server http://192.168.1.10:3000 --token COD --name PC-3050 --slots 4 --ram 16 --gpu "RTX 3050 Laptop" --vram 4 --watts 120 --rate 2
```

## 3. PC-ul 2 — RTX 5060

```powershell
node provider.js --server http://192.168.1.10:3000 --token COD --name PC-5060 --slots 6 --ram 16 --gpu "RTX 5060 Laptop" --vram 8 --watts 160 --rate 3
```

Valorile `--slots`, `--watts` și `--rate` sunt configurabile. `slots` este numărul de lucrători CPU simultani; fiecare PC poate executa un cadru GPU simultan. `watts` și `rate` sunt **ipoteze de demo**, nu măsurători sau prețuri reale. La conectare, terminalul furnizorului trebuie să afișeze calea Blender după `randare Blender GPU:`. Dacă arată `indisponibilă`, verificați instalarea Blender și parametrul `--vram`.

Pe un PC Windows cu Blender și NVIDIA puteți rula `node test/gpu-smoke.js` din folderul proiectului. Testul pornește temporar două procese furnizor pe același GPU, verifică distribuția a două cadre și apoi verifică modul CPU. Acest test nu confirmă performanța celor două laptopuri fizice.
Testul `node test/scheduling.js` verifică separat că un furnizor rapid poate prelua mai multe cadre și bucăți CPU din coada comună.

## Dacă furnizorul afișează `fetch failed`

Înseamnă că PC-ul furnizor nu poate deschide conexiunea către server. Verificați în această ordine:

1. Pe PC-ul coordonator, `node server.js` trebuie să rămână pornit și să afișeze adresa locală și codul de acces. Pe Arch Linux, rulați în alt terminal `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/`; rezultatul așteptat este `200`.
2. Pe Arch Linux, `ss -lntp | grep ':3000'` trebuie să arate că Node ascultă pe `0.0.0.0:3000`. Confirmați adresa IPv4 actuală cu `ip -4 addr`.
3. Pe Windows, rulați `Test-NetConnection ADRESA_IP -Port 3000`. Dacă `PingSucceeded` este `True`, dar `TcpTestSucceeded` este `False`, verificați firewall-ul de pe PC-ul coordonator și regulile rețelei pentru portul TCP 3000. Nu dezactivați firewall-ul integral.
4. După ce `TcpTestSucceeded` este `True`, porniți din nou `provider.js` folosind adresa și codul de acces actuale.

## Demo pentru juriu

1. Arătați cele două PC-uri conectate și resursele lor în interfață.
2. Selectați „Animație 3D cu Blender GPU”. Valorile implicite sunt acum **48 de cadre, 960 × 540 și 96 de mostre per cadru**. Scena conține sticlă, suprafețe metalice, reflexii, lumini colorate, 20 de coloane și obiecte animate. Pentru un demo scurt, folosiți 16 cadre, 640 × 360 și 32 de mostre; pentru un test mai greu, 64 de cadre, 1280 × 720 și 128 de mostre. Primul cadru poate dura mai mult din cauza inițializării Blender/OptiX.
3. Arătați progresul și câte cadre a randat fiecare PC. PC-ul mai rapid poate prelua mai multe cadre; distribuția nu este fixată la cadre pare/impare. Terminalele furnizorilor arată `GPU OPTIX:...` sau `GPU CUDA:...` după fiecare cadru.
4. La final, arătați animația, timpul, costul simulat și energia estimată. Reglați viteza de redare cu cursorul de sub rezultat, între 1 și 30 cadre/secundă. Demonstrați apoi și modul CPU pentru comparație.
5. Pentru comparație, opriți un furnizor, așteptați să apară offline (aproximativ 15 secunde), apoi porniți aceeași lucrare și comparați timpul. Faceți această comparație înainte de prezentare și notați rezultatele reale.

Pentru CPU, estimarea costului este `suma(timp pe slot × preț orar al PC-ului / număr de sloturi)`. Pentru GPU, este `suma(timp de randare × preț orar al PC-ului)`. Energia folosește aceleași durate și puterea introdusă manual. Un produs real ar avea nevoie de măsurare de consum, plăți, izolare a sarcinilor, verificarea rezultatelor și protecția datelor.

**După actualizarea proiectului:** opriți `server.js` și ambele procese `provider.js`, faceți `git pull` pe toate cele trei PC-uri (sau descărcați din nou arhiva ZIP), apoi porniți serverul și furnizorii cu noul cod de acces. Versiunile vechi ale `provider.js` vor primi un mesaj de actualizare.

## Interfața NODE (test)

Pe lângă interfața originală de la `http://localhost:3000`, serverul oferă și `http://localhost:3000/node`. E aceeași funcționalitate, în designul NODE (prună și piersică), construită ca un editor de noduri: lucrarea, coordonatorul și fiecare PC furnizor sunt blocuri legate prin fire. Firul spre un PC se aprinde cât timp acesta are o sarcină. Sarcinile care pleacă și rezultatele care se întorc circulă pe fire ca puncte luminoase. Imaginea se compune bandă cu bandă (sau cadru cu cadru), colorată după PC-ul care a calculat-o, iar jurnalul înregistrează fiecare eveniment. Codul de acces se introduce la fel ca în interfața originală.

Pentru test pe un singur calculator, fără rețea:

```powershell
node scripts/local.js
```

Comanda pornește coordonatorul și două PC-uri furnizoare locale pe CPU, apoi afișează linkul de deschis, care conține deja codul de acces. Cu `--gpu`, al doilea PC poate randa și cadre Blender, dacă PC-ul are Blender și o placă NVIDIA. `--port 3001` schimbă portul. Ambele procese folosesc același procesor, deci timpii nu reflectă două PC-uri reale.

Pentru interfața nouă, `/api/state` trimite acum și `job.tiles`: starea fiecărei sarcini și PC-ul care o are. `/api/preview` întoarce imaginea parțială în modurile CPU. Fonturile sunt în `public/fonts`, sub licența SIL Open Font License.

## Limitele prototipului

- Acceptă o singură lucrare activă. Rezultatul precedent rămâne vizibil până pornește o lucrare nouă.
- Rulează numai cele trei lucrări incluse, nu execută cod arbitrar trimis de utilizatori.
- Modul GPU creează aceeași scenă procedurală pe fiecare furnizor și distribuie cadrele animației; nu trimite fișiere Blender personalizate.
- Modul GPU permite 2–96 de cadre și 8–512 mostre per cadru, cu maximum 80 milioane pixeli în toată animația pentru a limita memoria necesară pe coordonator. O lucrare cu multe cadre poate dura câteva minute sau mai mult, în funcție de GPU și setări.
- Butonul „Oprește lucrarea” oprește distribuirea cadrelor noi. Un cadru deja pornit pe un furnizor se poate termina înainte ca acel PC să accepte altă lucrare.
- Nu are plăți reale și nu oferă desktop la distanță.
- Codul de acces este potrivit doar pentru un demo pe o rețea locală de încredere. Nu publicați portul pe internet.
- Dacă un cod de acces apare într-o captură de ecran distribuită, opriți și reporniți `server.js` pentru a genera un cod nou; actualizați codul în browser și pe ambele PC-uri furnizoare.
