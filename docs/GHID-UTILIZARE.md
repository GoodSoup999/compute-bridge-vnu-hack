# Ghid de utilizare · Compute Bridge 0.7.1

**Configurație pentru demo:** un PC găzduiește serverul, unul sau două PC-uri oferă resurse, alt cont trimite lucrări. PC-urile pot fi pe rețele diferite. Același PC poate avea mai multe roluri.

## 1. Pornește serverul

Pe gazdă, instalează Node.js 24+ și Cloudflare Tunnel:

```powershell
winget install --id OpenJS.NodeJS.LTS --exact
winget install --id Cloudflare.cloudflared --exact
```

Redeschide terminalul; `node --version` trebuie să fie minimum 24. Descarcă sursele 0.7.1, extrage-le și intră în folderul cu `package.json`. Rulează:

```powershell
npm.cmd run hub:public
```

Așteaptă `Registered tunnel connection`, apoi deschide `https://ADRESA-AFIȘATĂ/health`. Trebuie să vezi `"ok":true`; `features` trebuie să includă `economy-demo-v1` pentru cumpărare/retragere. Lasă terminalul și gazda pornite, fără sleep. Gazda nu are nevoie de Docker doar pentru server.

**URL-ul Quick Tunnel se schimbă la repornire.** Nu există descoperire automată a noii adrese. Gazda și fiecare client trebuie configurate la aceeași adresă; pentru una permanentă este necesar alt deploy. Dacă tunelul nu se conectează și portul 7844 e blocat, încearcă altă rețea/hotspot pe gazdă. [Ghid hosting](HOSTING.md).

## 2. Conectează aplicațiile

1. Din [release 0.7.1](https://github.com/GoodSoup999/compute-bridge-vnu-hack/releases/tag/v0.7.1-beta.1), descarcă ZIP-ul **desktop**, nu ZIP-ul surselor.
2. Extrage întregul folder. **Arhiva desktop 0.7.1 include adresa serverului echipei: pentru demo, jurații nu trebuie să editeze configurația.** Dacă pornești propria gazdă sau tunelul echipei își schimbă adresa, actualizează `resources/app/desktop/config.json`:

   ```json
   {"hubUrl":"https://ADRESA-AFIȘATĂ.trycloudflare.com"}
   ```

3. Pornește `ComputeBridge.exe`. Dacă era deja deschis, închide complet și redeschide. Nu muta numai executabilul; clientul nu cere Node separat.
4. Când apare **Conectat la server**, creează contul: email și parolă de minimum 12 caractere. Primești 100 credite de test.

## 3. Pregătește furnizorul

### Pentru Blender GPU

Instalează Blender compatibil cu proiectele trimise, un driver NVIDIA potrivit și redeschide Compute Bridge. Activează **Ofer și GPU-ul pentru Blender** și **Accept proiecte Blender încărcate de utilizatori**. Nu trebuie Docker pentru această randare.

### Pentru video, Python, AI, compilare și simulări

În PowerShell **ca administrator**, instalează WSL și Docker:

```powershell
winget install --id Microsoft.WSL --exact
wsl --install --no-distribution
winget install --id Docker.DockerDesktop --exact
```

Repornește Windows dacă instalarea o cere. Deschide Docker Desktop, cu WSL 2 și containere **Linux**. Dintr-un terminal nou:

```powershell
docker run --rm hello-world
```

După verificarea reușită, deschide **Pregateste mediul.cmd** din pachetul aplicației. Așteaptă finalizarea; prima pregătire descarcă un mediu mare. Alternativa din surse este `npm.cmd run runtime:prepare`; nu trebuie folosite ambele. Runtime-ul 0.7.0 rămâne compatibil cu aplicația 0.7.1. Redeschide aplicația pentru detectare.

### Activează oferta

În **Oferă PC-ul meu**, pentru primul demo:

- Interval: **1 oră**; fire CPU: **2**; ritm: **50%**.
- RAM: **4 GB**; tarif: **1 credit/unitate**. Pentru Blender declară VRAM disponibilă.
- Activează tipurile de lucru pentru care ai pregătit mediul.
- Apasă **Oferă PC-ul** și verifică apariția PC-ului în marketplace pe celălalt cont.

Lasă aplicația, Docker dacă este necesar și PC-ul pornite. Nu este suficient doar să intri în cont. Nu primești credite dacă nu se execută sarcini acceptate. Pentru oprire normală, folosește **Termin lucrul și opresc oferta**. Oprirea imediată poate pierde garanția sarcinii active.

## 4. Prima lucrare: Python

Pe client, **din alt cont** decât proprietarul furnizorului:

1. Descarcă și extrage [kitul de teste pe lucrări](https://github.com/GoodSoup999/compute-bridge-vnu-hack/releases/tag/v0.7.1-test-kit.1), compatibil cu 0.7.0 și 0.7.1.
2. Alege PC-ul furnizor și **Python**.
3. Deschide **Încarcă un pachet pregătit (.cbtask)**, alege `Python/Program/python.cbtask` din kit și apasă **Încarcă pachetul**.
4. Selectează pachetul, **Doar PC-uri remote**, buget **20 credite** și **Pornește lucrarea**.
5. În **Lucrările mele**, așteaptă finalizarea și descarcă `statistics.json`: **count=10, sum=55, mean=5.5**.
6. Verifică soldurile: furnizorul câștigă costul acceptat, clientul îl consumă, restul bugetului revine.

Clientul care trimite lucrarea remote nu are nevoie de Docker. [Celelalte exemple și rezultatele lor](TEST-WORKLOADS.md). Șterge pachetele nefolosite între teste: maximum trei proiecte/pachete per cont.

## 5. Propriile fișiere și mai multe PC-uri

**Video/cod:** în **Încarcă fișierele tale direct**, selectează împreună programul și datele, alege fișierul de pornire și argumentele ca listă JSON (`[]` dacă nu sunt necesare). Pentru video alegi rezoluția/formatul; pentru C/C++ ținta Windows/Linux. Încarcă și pornește. Programul citește din `/inputs`, scrie în `/outputs`; fără fișiere rezultate, lucrarea eșuează. Foldere complexe: [formatul `.cbtask`](TEST-WORKLOADS.md#pachetele-tale).

**Blender:** setează camera/animația, folosește **File → External Data → Pack Resources**, salvează `.blend` fără compresie, încarcă-l și alege cadrele/rezoluția/mostrele. [Condiții Blender](PROJECTS.md).

**Mai multe PC-uri simultan:** pornește două oferte GPU compatibile, selectează **Automat**, Blender și o animație cu mai multe cadre. Fiecare PC preia următorul cadru disponibil; cardul lucrării arată contribuțiile. Fractalul și ray tracing-ul se distribuie similar pe bucăți. Pachetele generale rulează pe un furnizor, iar RAM/VRAM nu se unesc.

## 6. Economia demo

În **Credite**, apasă **Simulează cumpărarea** pentru 500 credite: soldul crește cu 500, echivalent demo 5 EUR. Simulează retragerea a 100 credite: soldul scade cu 100. Verifică istoricul. **Nu se încasează și nu se trimit bani; nu sunt necesare carduri sau IBAN.** Creditele rezervate în lucrări nu sunt retragibile. Dacă butoanele sunt dezactivate, gazda trebuie actualizată la 0.7.1.

## Dacă nu merge

- **Serverul nu răspunde:** deschide `/health` pe PC-ul afectat, verifică linkul actual și configurația copiei de aplicație pe care o deschizi; repornește aplicația după modificare.
- **Nu există furnizor:** verifică oferta, checkbox-ul tipului de lucru, memoria și mediul; folosește alt cont pe client.
- **Docker nu răspunde:** pornește Docker Desktop, verifică motorul Linux / `hello-world`, repetă pregătirea, redeschide aplicația.
- **Parola nu merge:** verifică pe gazdă `npm.cmd run hub:admin -- list`. O bază resetată sau alt folder de server înseamnă alte conturi; nu există recuperare automată a parolei.

Pentru actualizare, oprește lucrările și gazda, păstrează folderul `data`, apoi actualizează sursele și aplicațiile. Pornirea din surse noi fără `data` produce o bază nouă. GitHub nu actualizează automat pachetele deja descărcate. [Administrare și backup](HOSTING.md).
