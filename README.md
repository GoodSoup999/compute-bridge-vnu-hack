# Compute Bridge 0.4 — beta

Aplicație Windows pentru calcul distribuit prin internet: marketplace cu credite și party-uri cu PC-urile tale sau ale prietenilor de încredere. Interfața se deschide în propria fereastră.

## Descărcare

Descarcă pachetul **ComputeBridge-0.4.0-desktop-windows-x64.zip** din [GitHub Releases](https://github.com/GoodSoup999/compute-bridge-vnu-hack/releases/tag/v0.4.0-beta.1), dezarhivează întregul folder și pornește **ComputeBridge.exe**. Ai nevoie de acces la repository-ul privat. Clientul nu cere Node.js. Randarea GPU cere Blender compatibil și GPU NVIDIA.

Site de prezentare: [node-compute.vercel.app](https://node-compute.vercel.app). Actualizarea recentă a echipei indică desktop 0.3.0 pe site; beta 0.4 se descarcă separat din release-ul de mai sus. Publicarea în acest repository nu actualizează automat site-ul.

## Ce poți face

- Creezi un cont pe hub-ul echipei, fără coduri de conectare între PC-uri.
- Rulezi lucrări folosind **PC-uri remote** sau **acest laptop + PC-uri remote**.
- Creezi party-uri și inviți prieteni. Fiecare proprietar decide ce dispozitiv oferă și cine îl poate folosi.
- Oferi resurse pentru 1–24 de ore, cu număr de fire CPU, pauze între sarcini, GPU opțional și cerințe de memorie pentru alocare.
- Folosești marketplace-ul cu buget rezervat, tranzacții persistente, restituirea creditelor nefolosite și suplimentarea bugetului.
- PC-urile preiau dinamic următoarea sarcină disponibilă. Cadrele nu se împart fix în pare/impare.
- Redai animația rezultată cu viteză reglabilă, 1–30 FPS.

Lucrările disponibile sunt fractal CPU, ray tracing CPU și animație procedurală Blender GPU. Aplicația nu rulează încă orice program încărcat de utilizator.

## Hub pe PC-ul vostru

Un PC central trebuie să rămână pornit și conectat la internet. Instalează **Node.js 24+** și `cloudflared`, apoi urmează [ghidul de găzduire](docs/HOSTING.md).

```powershell
npm run hub:public
```

Comanda pornește hub-ul și un tunel HTTPS temporar. Introduceți aceeași adresă HTTPS în aplicațiile voastre. Adresa temporară se schimbă la repornire; pentru o adresă stabilă configurați un tunel permanent cu domeniu. Nu este necesară expunerea portului 3000 în router.

Conturile pornesc cu **zero credite**. Administratorul acordă credite și aprobă dispozitivele pentru marketplace. Party-urile sunt gratuite. [Regulile creditelor, penalizărilor și limitările beta](docs/MARKETPLACE.md).

## Dezvoltare

```powershell
npm ci
npm run hub
npm run desktop
```

Pentru test local, adresa serviciului este `http://127.0.0.1:8787`. Pentru alte calculatoare este necesar HTTPS.

```powershell
npm run desktop:build
```

Pachetul este generat în `dist/desktop`. Pentru a include adresa stabilă a echipei în aplicație, setează `CB_HUB_URL` înainte de build. Opțiunea `--publish FOLDER` copiază artefactele într-un folder; nu publică automat un site.

### Verificări

```powershell
npm test
npm run test:hub
npm run desktop:smoke
```

Testele hub-ului verifică permisiunile, randarea CPU cu un agent real, izolarea rezultatelor, rezervarea creditelor, plata unică, penalizările, anularea și recuperarea după restart.

## Structură

| Componentă | Fișier |
|---|---|
| Fereastră Windows | `desktop/main.js` |
| Legătura locală cu contul și agentul | `hub-app.js` |
| Interfață marketplace / party | `public/hub.*` |
| API central | `cloud/server.js` |
| Coada de sarcini și credite | `cloud/service.js` |
| Persistență SQLite | `cloud/store.js` |
| Agent remote | `lib/remote-agent.js` |
| Hosting și administrare | `scripts/host.js`, `scripts/hub-admin.js` |

## Limite ale versiunii beta

RAM și VRAM nu se adună într-o singură memorie. Un cadru GPU trebuie să încapă pe un singur dispozitiv. Limitele de memorie sunt criterii de alocare, nu partiții hardware; reglajul CPU folosește fire și pauze între sarcini, nu o limită strictă impusă de sistem.

Marketplace-ul este pentru furnizori aprobați de administrator. Verificarea CPU recalculează un rând aleator; verificarea GPU controlează formatul și dimensiunile, fără a demonstra corectitudinea imaginii. Nu există încă verificare email, recuperare parole, plăți în bani sau retrageri de credite. Pentru testul echipei folosiți lista de emailuri permisă descrisă în ghid.

## Codul anterior

Implementarea LAN și motoarele de calcul sunt păstrate. Comenzile `npm start`, `npm run app`, `npm run provider` și `npm run build:browser` rămân disponibile pentru vechiul flux. [Documentația LAN anterioară](docs/LEGACY-LAN.md).
