# Compute Bridge — prototip VNU Hack

Două PC-uri furnizoare calculează în paralel bucăți dintr-o imagine fractală. Al treilea PC rulează coordonatorul și interfața web. Acesta este un demo de **calcul distribuit pe CPU**. GPU-urile apar în inventar, dar sarcina demonstrativă nu le folosește; VRAM-ul lor nu este combinat.

## Ce trebuie instalat

- Node.js 20 sau mai nou pe toate cele trei PC-uri. Pe Arch Linux, verificați cu `node --version`; dacă lipsește, instalați cu `sudo pacman -Syu nodejs`. `npm` nu este necesar.
- Toate PC-urile în aceeași rețea locală. Permiteți accesul la portul TCP 3000 pe PC-ul coordonator, dacă firewall-ul este activ. Pe Windows, acceptați accesul pe rețeaua privată.
- Copiați acest folder pe fiecare PC. Nu este necesar `npm install`.

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

## Demo pentru juriu

1. Arătați cele două PC-uri conectate și resursele lor în interfață.
2. Porniți o lucrare de 2400 × 1600, complexitate 5000.
3. Arătați progresul și câte bucăți a procesat fiecare PC.
4. La final, arătați imaginea, timpul, costul simulat și energia estimată.
5. Pentru comparație, opriți un furnizor, așteptați să apară offline (aproximativ 15 secunde), apoi porniți aceeași lucrare și comparați timpul. Faceți această comparație înainte de prezentare și notați rezultatele reale.

Estimarea costului este `suma(timp CPU pe slot × preț orar al PC-ului / număr de sloturi)`. Estimarea energiei folosește aceeași alocare de timp și puterea introdusă manual. Un produs real ar avea nevoie de măsurare de consum, plăți, izolare a sarcinilor, verificarea rezultatelor și protecția datelor.

## Limitele prototipului

- Acceptă o singură lucrare activă. Rezultatul precedent rămâne vizibil până pornește o lucrare nouă.
- Rulează numai lucrarea fractală inclusă, nu execută cod arbitrar trimis de utilizatori.
- Nu are plăți reale și nu oferă desktop la distanță.
- Codul de acces este potrivit doar pentru un demo pe o rețea locală de încredere. Nu publicați portul pe internet.
