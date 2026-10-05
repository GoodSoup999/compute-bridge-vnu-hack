# Găzduirea marketplace-ului pe PC-ul echipei

Gazda trebuie să aibă Node.js 24+ și să rămână pornită, conectată la internet, fără sleep. Ea păstrează conturile, creditele, lucrările și rezultatele; PC-urile furnizoare fac calculul.

## Pornire Windows

Din folderul proiectului:

```powershell
winget install --id Cloudflare.cloudflared --exact
```

Redeschide terminalul după instalare, apoi:

```powershell
npm run hub:public
```

Comanda pornește serverul pe `127.0.0.1:8787` și tunelul HTTPS. Expune numai API-ul central, nu puntea desktop sau administrarea locală. Nu este necesar port forwarding.

Sursa oficială: [cloudflared](https://developers.cloudflare.com/tunnel/downloads/). [Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) oferă o adresă temporară, fără garanție de disponibilitate. Adresa se schimbă când tunelul repornește. Pentru utilizare continuă folosește un tunel permanent cu domeniu.

Pe Arch instalează Node.js 24+ și cloudflared, apoi folosește aceleași comenzi npm. Clienții sunt Windows.

## Conectare automată în aplicații

Utilizatorii nu introduc linkuri. Administratorul setează `hubUrl` în `desktop/config.json` și construiește aplicația:

```powershell
$env:CB_HUB_URL = 'https://adresa-serverului'
npm run desktop:build
```

Configurația se include în arhivă. Toate PC-urile care folosesc acel pachet contactează același server. Dacă folosești un tunel temporar și adresa se schimbă, reconstruiește și redistribuie pachetul sau actualizează `resources/app/desktop/config.json` din pachetul distribuit. Pentru o adresă permanentă, aplicațiile continuă să se reconecteze fără această schimbare.

## Actualizare la versiunea 0.7

1. Oprește ofertele și așteaptă finalizarea lucrărilor active.
2. Oprește serverul și tunelul cu Ctrl+C.
3. Din proiectul de pe gazdă rulează `git pull`, apoi `npm run hub:public`.
4. Configurează pachetul desktop pentru noua adresă a tunelului. Toți participanții folosesc aplicația 0.7. Furnizorii care acceptă video/cod au nevoie de Docker și mediul Compute Bridge: [instalare și verificări](TEST-WORKLOADS.md).

Nu șterge folderul `data`. Serverul păstrează conturile, soldurile și rezultatele. Configurațiile grupurilor vechi sunt eliminate; lucrările active ale acelor grupuri sunt anulate cu restituirea bugetului și fără penalizări. Bonusul de început se acordă o singură dată conturilor care nu l-au primit deja.

## Credite și administrare

Conturile noi primesc automat 100 de credite. PC-urile sunt disponibile automat după pornirea ofertei și confirmarea agentului; nu există pas de aprobare.

Administratorul poate consulta conturile sau adăuga credite de test, dintr-un al doilea terminal pe gazdă:

```powershell
npm run hub:admin -- list
npm run hub:admin -- credit utilizator@example.com 100
```

Administrarea folosește un port separat exclusiv localhost, cu o cheie locală. Nu distribui folderul `data`.

Opțional, limitează înregistrările la participanții echipei înainte de pornire:

```powershell
$env:HUB_ALLOWED_EMAILS = 'tu@example.com,prieten@example.com'
npm run hub:public
```

Lista nu dovedește proprietatea emailului. Creditele sunt de test și nu au valoare monetară.

## Persistență

`data/hub.sqlite` păstrează conturi, tranzacții, oferte, lucrări și rezultate. SQLite folosește WAL și tranzacții; o singură instanță poate folosi fișierul. Oprește serverul înainte de backup-ul folderului `data`.

La restart, sarcinile neterminate revin în coadă și garanțiile se restituie fără penalizare. Agenții de la aceeași adresă reîncearcă automat. Rezultatele se păstrează 7 zile. Variabile: `HUB_PORT`, `HUB_BIND`, `HUB_DB`, `HUB_ALLOWED_EMAILS`, `CLOUDFLARED_PATH`.
