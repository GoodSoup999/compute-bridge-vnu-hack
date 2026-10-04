# Compute Bridge 0.6 — proiecte proprii și marketplace

Aplicație Windows pentru a oferi puterea PC-ului și a folosi PC-uri disponibile prin internet. Serverul echipei este inclus în configurația aplicației: utilizatorii nu introduc linkuri sau coduri.

[Descarcă aplicația Windows 0.5](https://github.com/GoodSoup999/compute-bridge-vnu-hack/releases/tag/v0.5.3-beta.1). Dezarhivează întregul folder și pornește **ComputeBridge.exe**. Clientul nu cere Node.js. Pentru GPU sunt necesare Blender și o placă NVIDIA.

## Fluxul principal

**Nou în sursele 0.6:** încărcare de proiecte Blender proprii, cadre din animația utilizatorului, transfer verificat către furnizori care acceptă proiecte și rezultate PNG. [Ghidul proiectelor](docs/PROJECTS.md). Gazda și furnizorii trebuie actualizați pentru această funcție. Programele arbitrare și izolarea completă nu sunt încă implementate.

1. Deschizi aplicația și creezi un cont. Primești **100 de credite de test**, o singură dată.
2. În **Oferă PC-ul meu**, alegi intervalul în ore, resursele și pornești oferta. PC-ul apare în marketplace după confirmarea conexiunii agentului. Nu cere aprobare manuală.
3. Un alt utilizator vede PC-ul în **PC-uri disponibile**, apasă **Folosește acest PC**, alege lucrarea și o pornește.
4. Agentul furnizor execută sarcinile și trimite rezultatele prin server. Cumpărătorul consumă credite, iar furnizorul primește aceeași sumă pentru sarcinile acceptate.
5. Restul bugetului revine în sold la finalizare sau anulare. Ofertele expirate, oprite sau deconectate dispar din lista disponibilă.

Poți selecta un PC anume sau distribuirea automată între PC-urile compatibile. Lucrările disponibile sunt fractal CPU, ray tracing CPU și animație Blender GPU. Același cont poate oferi un PC și trimite lucrări. Pentru trimitere poți folosi doar resurse remote sau contribui și cu laptopul curent.

## Serverul echipei

Cerințele RAM și VRAM se estimează automat pentru scenele incluse, fără completare manuală. CPU: 2 GB RAM; Blender: 4 GB RAM și 4 GB VRAM, cu 6 GB RAM peste un milion de pixeli per cadru. Sunt profiluri conservatoare de compatibilitate, nu măsurători exacte. Numărul de cadre și mostre mărește durata, fără multiplicarea memoriei per cadru. Lista lucrărilor actualizează progresul periodic și anularea după confirmarea serverului, păstrând bugetele în curs de editare.

[Ghid de găzduire și actualizare](docs/HOSTING.md). Serverul se găzduiește pe PC-ul echipei, cu Node.js 24+ și un tunel HTTPS. Gazda trebuie să rămână pornită.

```powershell
npm run hub:public
```

Adresa este configurată de administrator în `desktop/config.json`, apoi inclusă în pachetul distribuit. Un Quick Tunnel își schimbă adresa la repornire: utilizatorii nu completează adresa, însă administratorul trebuie să actualizeze configurația pachetului dacă tunelul se schimbă. O adresă permanentă elimină această etapă.

Site de prezentare: [node-compute.vercel.app](https://node-compute.vercel.app). Publicarea aici nu actualizează automat download-ul site-ului separat.

## Credite și disponibilitate

Creditele sunt interne aplicației, fără cumpărare sau retragere în bani. Conturile existente care nu au primit bonusul de început primesc și ele 100 de credite o singură dată la actualizarea serverului. Soldurile și rezultatele existente se păstrează.

O ofertă durează 1–24 de ore. PC-ul trebuie să rămână conectat cu aplicația deschisă. Sarcinile active au o garanție de 10% din preț, minimum 0,01 și maximum 1 credit. Garanția revine furnizorului la finalizare; o întrerupere forțată o poate transfera clientului. Nu se aplică penalizări pentru simpla disponibilitate fără lucru. [Regulile complete](docs/MARKETPLACE.md).

## Dezvoltare și verificări

```powershell
npm ci
npm run hub
```

În alt terminal, pentru test pe același PC:

```powershell
$env:CB_HUB_URL = 'http://127.0.0.1:8787'
npm run desktop
```

```powershell
npm test
npm run test:hub
npm run test:marketplace
npm run desktop:smoke
npm run desktop:build
```

Testul marketplace pornește trei instanțe ale punții folosite de aplicația desktop și agenți reali: înregistrare, ofertă, vizibilitate, alegerea PC-ului, calcul, transfer de credite, oprirea și repornirea ofertei. `TEST_GPU=1` activează și proba Blender pe un PC cu NVIDIA.

## Limite beta

CPU și GPU execută sarcini predefinite; nu există încă rulare de programe sau fișiere arbitrare. RAM și VRAM nu se adună între calculatoare. Valorile de memorie sunt criterii de alocare, nu cote hardware stricte. Profilul CPU folosește fire și pauze între sarcini. GPU-ul poate fi solicitat intens.

CPU: serverul recalculează un rând aleator din fiecare rezultat. GPU: serverul verifică formatul PNG și dimensiunile, fără dovadă completă a corectitudinii. Beta este pentru testul cu participanți cunoscuți. Bonusul de început nu este protejat încă prin verificare email sau identitate; nu se folosesc bani reali. Nu există recuperare automată a parolelor.

Codul LAN și motoarele de calcul anterioare sunt păstrate. [Documentația fluxului LAN](docs/LEGACY-LAN.md).
