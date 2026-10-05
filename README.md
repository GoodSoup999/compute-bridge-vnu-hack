# NODE · Compute Bridge

### Oferă putere de calcul. Folosește putere de calcul.

**Compute Bridge transformă PC-urile personale disponibile într-un marketplace de calcul.** Dintr-o aplicație Windows, îți oferi resursele pentru un interval ales sau trimiți propriile fișiere către PC-uri compatibile. Primești rezultate, urmărești progresul și plătești în credite; furnizorul câștigă acele credite pentru sarcinile acceptate.

Creat pentru **VNU Hack · Be The Middle Man**. Intermediem resursele, lucrările, fișierele și creditarea între oameni care au hardware disponibil și oameni care au nevoie de el.

**[Descarcă aplicația 0.7.1](https://github.com/GoodSoup999/compute-bridge-vnu-hack/releases/tag/v0.7.1-beta.1)** · **[Ghid de utilizare pentru jurați](docs/GHID-UTILIZARE.md)** · [Kit de teste pe lucrări](https://github.com/GoodSoup999/compute-bridge-vnu-hack/releases/tag/v0.7.1-test-kit.1)

> Beta funcțională. Calculul și transferul creditelor sunt reale în aplicație. Cumpărarea și retragerea în bani sunt **simulări marcate DEMO**, fără încasări sau transferuri bancare.

## Ce face aplicația

| Lucrare | Intrare → rezultat |
| --- | --- |
| **Blender GPU** | Propriul `.blend` și intervalul de cadre → PNG-uri și player cu viteză ajustabilă |
| **Video** | Videoclip + rezoluție/format → MP4 sau WebM convertit |
| **Python** | Cod + date + argumente → fișiere rezultate și loguri |
| **AI pe CPU** | Cod + model/date → predicții sau model antrenat, în limitele mediului |
| **Compilare C/C++** | Sursă + headers → executabil Windows x64 sau Linux x64 |
| **Simulări Python** | Cod + configurație → rezultate CSV/JSON sau alte fișiere |
| **Fractal / ray tracing** | Parametri → imagine calculată; două motoare demo incluse |

**Nu ești limitat la exemplele noastre:** încarci propriile fișiere direct sau un pachet `.cbtask`. Codul folosește bibliotecile incluse în mediu; nu executăm orice program Windows arbitrar.

## Cum funcționează

**Client → server central → furnizori → rezultate.** Gazda gestionează conturile, ofertele, atribuirea și creditele. Agenții furnizorilor contactează gazda prin HTTPS: PC-urile pot fi pe **rețele diferite**, fără acces direct între ele.

**Aceeași lucrare poate folosi mai multe PC-uri simultan:** Blender distribuie cadre, iar fractalul/ray tracing-ul distribuie bucăți de imagine. Atribuirea este dinamică: PC-ul care termină preia următoarea bucată; cel rapid poate face mai mult lucru. Poți include și laptopul clientului pentru aceste lucrări.

Pachetele video/Python/AI/compilare/simulare rulează acum pe **un furnizor per pachet**. RAM și VRAM nu se adună între PC-uri. Accelerarea depinde de cât se poate împărți lucrarea și de transferuri.

## De ce contează și ce ne diferențiază

Vrem să facem util hardware-ul deja deținut: un student poate oferi PC-ul când este disponibil și poate folosi creditele câștigate pentru un proiect care cere alte resurse. Un creator poate distribui cadrele unei animații fără să cumpere imediat un PC nou. Beneficiul urmărit este accesul flexibil la capacitate suplimentară; prețul mai mic și economiile de energie trebuie încă măsurate.

Există deja piețe de calcul: [Vast.ai](https://github.com/vast-ai/docs/blob/main/guides/pricing.mdx), [Golem](https://docs.golem.network/docs/golem/overview) și [Render Network](https://know.rendernetwork.com/). **Diferența noastră de produs este combinația**:

- **Client și furnizor în aceeași aplicație Windows**, cu același sold.
- **Oferte de 1–24 ore**, cu fire CPU, ritm, memorie declarată și tarif alese de proprietar.
- **Mai multe PC-uri pentru o lucrare divizibilă**, cu distribuire dinamică și contribuție locală opțională.
- **Fișiere proprii → rezultate**, pentru mai multe tipuri de lucru, fără sesiuni desktop remote.
- **Buget rezervat, plată la rezultat acceptat, restituire și garanție**, în același flux.

Nu pretindem că suntem prima piață de calcul sau că funcțiile sunt exclusiv ale noastre. Punctul nostru forte este fluxul integrat, construit și testat pentru acest demo.

## Economie demonstrabilă

Începi cu **100 de credite de test**. Când trimiți o lucrare, bugetul se rezervă. Furnizorul primește costul sarcinilor acceptate, iar restul revine clientului. Nu există comision implementat.

În **Credite**, poți **cumpăra sau retrage credite în simulare**. Soldul și istoricul se actualizează și persistă. Cursul demonstrativ este **100 credite = 1 EUR**, fără valoare monetară reală. Nu cerem card sau IBAN. Creditele rezervate unei lucrări nu pot fi retrase.

O sarcină activă are o garanție de **10%**, minimum **0,01**, maximum **1 credit**. Oprirea forțată o poate transfera clientului. Disponibilitatea fără lucru nu este plătită sau penalizată. [Reguli și formule](docs/MARKETPLACE.md).

## Pentru jurați: pornește și încearcă

1. Descarcă arhiva desktop, extrage **întregul folder**, pornește `ComputeBridge.exe`. Nu cere Node sau browser separat.
2. Verifică **Conectat la server** și creează un cont, cu parolă de minimum 12 caractere. Dacă gazda echipei nu este disponibilă, urmează [pornirea serverului](docs/GHID-UTILIZARE.md#1-pornește-serverul).
3. **Pe furnizor:** instalează Blender pentru GPU sau pregătește Docker pentru video/cod. În **Oferă PC-ul meu**, alege intervalul și resursele, activează tipurile acceptate, apoi **Oferă PC-ul**. [Pregătirea completă](docs/GHID-UTILIZARE.md#3-pregătește-furnizorul).
4. **Pe client, din alt cont:** alege furnizorul sau **Automat**, tipul lucrării, fișierele și bugetul. Pentru primul test folosește `python.cbtask` din kit, buget 20 credite și **Doar PC-uri remote**.
5. În **Lucrările mele**, descarcă `statistics.json`: rezultatul așteptat este **`count=10`, `sum=55`, `mean=5.5`**. Verifică și creditele câștigate pe furnizor.
6. În **Credite**, simulează o cumpărare de 500 credite, apoi o retragere. Pentru mai multe PC-uri simultan, oferă două GPU-uri și rulează Blender în **Automat**.

Gazda, aplicațiile furnizoare și mediul lor de execuție trebuie să rămână pornite. Clientul care doar trimite lucrări remote nu are nevoie de Docker. Ghidul separat explică instalarea, fișierele proprii și erorile uzuale, pas cu pas.

**Electricitate estimată:** furnizorul poate introduce puterea medie a PC-ului în W și tariful în lei/kWh. Aplicația afișează energia și costul sesiunii din timpul cu sarcini în execuție, inclusiv pregătirea lor, fără dublare pentru sarcini simultane. Nu este măsurare la priză sau măsurarea consumului suplimentar; nu include timpul fără lucru și se resetează la o nouă pornire a agentului.

## Cifre pe care le putem susține

- **8 opțiuni de lucru** în interfață; AI are exemple atât de predicție, cât și de antrenare.
- **10 cazuri de execuție reală verificate în Docker** pentru adaptoarele 0.7.0, plus anulare și eșec; executabilele C/C++ generate au fost rulate și pe Windows. [Rezultatele CI](https://github.com/GoodSoup999/compute-bridge-vnu-hack/actions/runs/37247880754).
- **Test marketplace cu trei punți desktop și agenți**, plus teste pentru conturi, contabilitate, persistență, UI și proiect Blender real pe NVIDIA.
- Economia demo are teste pentru cereri repetate, sold insuficient, buget rezervat, izolarea istoricului între utilizatori și persistență la restart.

Aceste verificări nu sunt benchmark-uri de viteză sau rentabilitate. Nu avem încă procente măsurate de economisire sau accelerare. [Cum rulezi testele](docs/TEST-WORKLOADS.md).

## Potențial și pași următori

**Potențialul pe care îl urmărim este mare:** o interfață comună pentru capacitatea de calcul deja existentă în locuințe, echipe, comunități și laboratoare, folosită pentru proiecte creative și tehnice. Extinderea presupune fiabilitate, securitate și costuri validate, nu doar mai mulți furnizori.

**Party — idee neimplementată:** grupezi PC-urile tale și, cu acordul lor, PC-urile prietenilor de încredere; trimiți lucrări de pe unul singur către grup. Ar reuni capacitatea pentru sarcini divizibile, nu memoria într-un singur PC. Am prioritizat marketplace-ul de bază; Party nu este disponibil în aplicația actuală.

Alte direcții **viitoare**: adresă permanentă și actualizări automate, video pe segmente, AI pe loturi/GPU, simulări pe scenarii, reputație și verificarea rezultatelor, lucrări mai mari, plăți și retrageri reale. Arhitectura separă adaptoarele de transferuri și credite, dar fiecare extensie cere validare și teste.

## Limite beta

Pachete generale: **24 MB intrări / 32 MB JSON, 5 minute per încercare, 6 MB rezultate**; RAM Docker **2 GB**, AI **4 GB**. Blender: maximum **48 cadre**, proiect ≤32 MB. Dependențele sunt fixe, AI rulează pe CPU. Estimarea RAM/VRAM nu garantează că orice proiect încape.

Docker limitează execuția și dezactivează internetul; Blender rulează local fără aceeași izolare. Furnizorul primește fișierele necesare și poate păstra o copie. Beta este pentru participanți și proiecte de încredere, fără SLA, verificare email sau recuperare automată a parolei. Cumpărarea/retragerea sunt numai demo.

## Surse și dezvoltare

Node.js **24+** pentru gazdă/dezvoltare. Windows x64 pentru build desktop:

```powershell
npm.cmd ci
npm.cmd run hub
# În alt terminal:
$env:CB_HUB_URL = 'http://127.0.0.1:8787'
npm.cmd run desktop
```

Build: `npm.cmd run desktop:build`. Teste economie: `node test/economy.js`. [Găzduire și administrare](docs/HOSTING.md) · [Blender](docs/PROJECTS.md) · [Runtime și teste](docs/TEST-WORKLOADS.md) · [Codul LAN anterior](docs/LEGACY-LAN.md).
