# Compute Bridge — prototip VNU Hack

Două PC-uri furnizoare calculează în paralel bucăți dintr-o imagine. Al treilea PC rulează coordonatorul și interfața web. Puteți alege între o imagine fractală și o **randare 3D prin ray tracing**, cu iluminare, umbre și reflexii. Ambele sunt demo-uri de **calcul distribuit pe CPU**. GPU-urile apar în inventar, dar aceste sarcini nu le folosesc; VRAM-ul lor nu este combinat.

## Ce trebuie instalat

- Node.js 20 sau mai nou pe toate cele trei PC-uri. Pe Arch Linux, verificați cu `node --version`; dacă lipsește, instalați cu `sudo pacman -Syu nodejs`. `npm` nu este necesar.
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

Valorile `--slots`, `--watts` și `--rate` sunt configurabile. `slots` este numărul de lucrători CPU simultani. `watts` și `rate` sunt **ipoteze de demo**, nu măsurători sau prețuri reale.

## Dacă furnizorul afișează `fetch failed`

Înseamnă că PC-ul furnizor nu poate deschide conexiunea către server. Verificați în această ordine:

1. Pe PC-ul coordonator, `node server.js` trebuie să rămână pornit și să afișeze adresa locală și codul de acces. Pe Arch Linux, rulați în alt terminal `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/`; rezultatul așteptat este `200`.
2. Pe Arch Linux, `ss -lntp | grep ':3000'` trebuie să arate că Node ascultă pe `0.0.0.0:3000`. Confirmați adresa IPv4 actuală cu `ip -4 addr`.
3. Pe Windows, rulați `Test-NetConnection ADRESA_IP -Port 3000`. Dacă `PingSucceeded` este `True`, dar `TcpTestSucceeded` este `False`, verificați firewall-ul de pe PC-ul coordonator și regulile rețelei pentru portul TCP 3000. Nu dezactivați firewall-ul integral.
4. După ce `TcpTestSucceeded` este `True`, porniți din nou `provider.js` folosind adresa și codul de acces actuale.

## Demo pentru juriu

1. Arătați cele două PC-uri conectate și resursele lor în interfață.
2. Selectați „Randare 3D cu ray tracing” și porniți o lucrare de 1600 × 900, 512 mostre per pixel. Pentru o demonstrație mai scurtă, reduceți la 128 mostre per pixel.
3. Arătați progresul și câte bucăți a procesat fiecare PC.
4. La final, arătați imaginea, timpul, costul simulat și energia estimată.
5. Pentru comparație, opriți un furnizor, așteptați să apară offline (aproximativ 15 secunde), apoi porniți aceeași lucrare și comparați timpul. Faceți această comparație înainte de prezentare și notați rezultatele reale.

Estimarea costului este `suma(timp CPU pe slot × preț orar al PC-ului / număr de sloturi)`. Estimarea energiei folosește aceeași alocare de timp și puterea introdusă manual. Un produs real ar avea nevoie de măsurare de consum, plăți, izolare a sarcinilor, verificarea rezultatelor și protecția datelor.

**După actualizarea proiectului:** opriți `server.js` și ambele procese `provider.js`, faceți `git pull` pe toate cele trei PC-uri (sau descărcați din nou arhiva ZIP), apoi porniți serverul și furnizorii cu noul cod de acces. Versiunile vechi ale `provider.js` nu pot executa randarea 3D și vor primi un mesaj de actualizare.

## Limitele prototipului

- Acceptă o singură lucrare activă. Rezultatul precedent rămâne vizibil până pornește o lucrare nouă.
- Rulează numai cele două lucrări incluse, nu execută cod arbitrar trimis de utilizatori.
- Nu are plăți reale și nu oferă desktop la distanță.
- Codul de acces este potrivit doar pentru un demo pe o rețea locală de încredere. Nu publicați portul pe internet.
- Dacă un cod de acces apare într-o captură de ecran distribuită, opriți și reporniți `server.js` pentru a genera un cod nou; actualizați codul în browser și pe ambele PC-uri furnizoare.
