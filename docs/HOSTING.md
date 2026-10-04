# Găzduire pe PC-ul echipei

Hub-ul este un proces Node.js 24. PC-ul gazdă trebuie să rămână pornit, conectat la internet și să nu intre în sleep. El coordonează lucrările și păstrează conturi, credite și rezultate. Calculul este executat de agenți, nu automat de gazdă.

## Pornire Windows

Din folderul proiectului, cu Node.js 24 instalat:

```powershell
npm run hub
```

Hub-ul ascultă pe `127.0.0.1:8787`. Pentru un test pe același PC, introdu `http://127.0.0.1:8787` în aplicația desktop. Pentru PC-uri din rețele diferite folosește un tunel HTTPS.

### Tunel temporar pentru demo

Instalează [cloudflared din sursa oficială](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/), apoi repornește terminalul dacă PATH s-a schimbat. Pe Windows:

```powershell
winget install --id Cloudflare.cloudflared --exact
npm run hub:public
```

Nu porni și `npm run hub` separat pe același port. `hub:public` pornește hub-ul și tunelul. Copiază adresa `https://...trycloudflare.com` afișată în terminal în aplicațiile tuturor participanților. Nu sunt necesare port forwarding sau IP-uri locale ale furnizorilor. Aplicațiile fac conexiuni HTTPS către această adresă.

Un [Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) este pentru testare: adresa se schimbă la repornirea tunelului, nu are garanție de disponibilitate și acceptă cel mult 200 de cereri simultane. Pentru o adresă permanentă folosește un Cloudflare Tunnel asociat unui domeniu al echipei. `--allowed-mail` nu este potrivit pentru agenții automați; autentificarea acestora este gestionată de hub.

Pe Arch, instalează Node.js 24+ și cloudflared prin managerul de pachete, apoi rulează aceleași comenzi npm. Aplicațiile furnizoare rămân Windows.

## Primele conturi, credite și dispozitive

1. Utilizatorii creează conturi în aplicația desktop, folosind adresa hub-ului.
2. Soldul inițial este **zero**. Party-urile și contribuția proprie sunt gratuite.
3. Administratorul acordă credite interne de test dintr-un al doilea terminal, pe gazdă:

```powershell
npm run hub:admin -- list
npm run hub:admin -- credit prieten@example.com 100
```

4. Furnizorii selectează „Marketplace” în aplicație. Administratorul aprobă explicit dispozitivele de încredere:

```powershell
npm run hub:admin -- approve ID_DISPOZITIV
```

Administrarea funcționează în timp ce hub-ul rulează, printr-un port separat exclusiv localhost și o cheie locală. Portul administrativ nu este publicat de tunel. Nu distribui folderul `data`.

Pentru o beta privată poți limita crearea conturilor înainte de pornire:

```powershell
$env:HUB_ALLOWED_EMAILS = 'tu@example.com,prieten@example.com'
npm run hub:public
```

Această listă restricționează înregistrarea, dar nu verifică proprietatea adresei de email. Nu este implementată recuperarea parolei sau confirmarea emailului în această beta; coordonați înregistrarea cu participanții cunoscuți.

## Party cu un prieten

1. Creează un party și invită emailul contului prietenului. Invitația apare în aplicație, nu se trimite email.
2. Prietenul acceptă invitația.
3. Pe PC-ul lui, în „Ofer resurse”, selectează party-ul și persoanele autorizate sau „toți membrii”. Configurează resursele și intervalul și pornește agentul.
4. Din contul tău pornește o lucrare cu resurse din party. Accesul nu devine reciproc automat. Fiecare proprietar trebuie să autorizeze propriul PC separat.

Revocarea disponibilității sau eliminarea unui membru retrage sarcinile nefinalizate; rezultatele deja acceptate rămân la client. Party-urile nu au penalizări în credite.

## Persistență și repornire

`data/hub.sqlite` este sursa de adevăr pentru conturi, solduri, tranzacții, permisiuni, lucrări și rezultate. SQLite folosește WAL și tranzacții. O singură instanță de hub poate utiliza fișierul. Oprește hub-ul înainte de a face o copie a folderului `data` pentru backup.

La repornire, sarcinile neterminate sunt puse înapoi în coadă, iar garanțiile se restituie fără penalizare. Agenții conectați la aceeași adresă reîncearcă automat. Dacă adresa Quick Tunnel s-a schimbat, utilizatorii trebuie să se reconecteze la noua adresă. Rezultatele se păstrează 7 zile; există o limită totală de 250 milioane de pixeli pentru lucrările păstrate.

Variabile: `HUB_PORT` (8787), `HUB_BIND` (127.0.0.1), `HUB_DB` (fișierul SQLite), `HUB_ALLOWED_EMAILS` (opțional), `CLOUDFLARED_PATH` (opțional).

Pentru a distribui clienți cu adresa deja completată:

```powershell
$env:CB_HUB_URL = 'https://hub.exemplu.ro'
npm run build
```

Folosește o adresă permanentă pentru pachetele distribuite pe termen lung. Nu publica puntea desktop de pe portul 3210; numai hub-ul de pe 8787 se expune prin tunel.
