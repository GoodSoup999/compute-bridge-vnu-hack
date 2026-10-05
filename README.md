# NODE · Compute Bridge

### Oferă putere de calcul. Folosește putere de calcul.

**Site-ul proiectului: [node-compute.vercel.app](https://node-compute.vercel.app/)**

> [!WARNING]
> **NU DESCĂRCAȚI APLICAȚIA DE PE SITE — versiunea oferită acolo este învechită (0.7.0).** Descărcați versiunea actuală **0.7.1 doar din [GitHub Releases](https://github.com/GoodSoup999/compute-bridge-vnu-hack/releases/tag/v0.7.1-beta.1)**.
>
> Site-ul este pentru prezentarea proiectului și consultarea manualului, ca să înțelegeți aplicația. Pentru instrucțiunile actualizate de instalare și utilizare, urmați [ghidul pentru jurați din acest repository](docs/GHID-UTILIZARE.md).

**Compute Bridge transformă PC-urile personale disponibile într-un marketplace de calcul.** Dintr-o aplicație Windows, îți oferi resursele pentru un interval ales sau trimiți propriile fișiere către PC-uri compatibile. Primești rezultate, urmărești progresul și plătești în credite; furnizorul câștigă acele credite pentru sarcinile acceptate.

Creat pentru **VNU Hack · Be The Middle Man**. Intermediem resursele, lucrările, fișierele și creditarea între oameni care au hardware disponibil și oameni care au nevoie de el.

**[Descarcă aplicația 0.7.1](https://github.com/GoodSoup999/compute-bridge-vnu-hack/releases/tag/v0.7.1-beta.1)** · **[Ghid de utilizare pentru jurați](docs/GHID-UTILIZARE.md)** · [Kit de teste pe lucrări](https://github.com/GoodSoup999/compute-bridge-vnu-hack/releases/tag/v0.7.1-test-kit.1)

> Beta funcțională. Calculul și transferul creditelor sunt reale în aplicație. Cumpărarea și retragerea în bani sunt **simulări marcate DEMO**, fără încasări sau transferuri bancare.

> [!IMPORTANT]
> **Setup-ul actual este dificil și cere mai mulți pași și descărcări, mai ales pe PC-urile furnizoare.** Știm că aceasta este o barieră de utilizare. Prototipul a fost construit în cele **24 de ore disponibile la hackathon**, cu prioritate pe funcționarea fluxului complet: ofertă → calcul → rezultat → credite. Instalarea actuală nu reprezintă experiența finală pe care o urmărim.
>
> **Îmbunătățire propusă, încă neimplementată:** un asistent de instalare integrat, pornit din „Pregătește PC-ul meu”, care detectează hardware-ul și componentele existente, explică ce este necesar pentru lucrările alese, instalează cu acordul utilizatorului doar componentele lipsă din surse oficiale și pregătește mediul de calcul. Ar afișa progresul, ar relua pregătirea după un eventual restart și ar rula o lucrare de verificare înainte de ofertare. O adresă permanentă a serverului ar elimina și schimbarea manuală a linkului. Obiectivul este **o singură instalare ghidată**, fără comenzi copiate în terminal; utilizatorul care doar trimite lucrări remote ar păstra instalarea simplă a aplicației.

## Problema pe care o rezolvăm

Un student sau creator poate ajunge la limita laptopului când randează o animație, rulează o simulare sau procesează date. Are nevoie de mai multă putere de calcul **pentru un proiect sau un interval scurt**, dar cumpărarea unui PC mai puternic poate fi prea costisitoare pentru acea nevoie temporară.

În același timp, alte calculatoare au resurse disponibile. **Nevoia și capacitatea există, dar accesul la ele presupune găsirea unui furnizor, verificarea compatibilității, transferul fișierelor și urmărirea rezultatelor.** Compute Bridge reunește acești pași într-o aplicație: conectează utilizatorii cu PC-uri disponibile, gestionează lucrările și recompensează furnizorii în credite. Scopul este accesul la capacitate suplimentară fără un upgrade imediat; avantajul de cost față de alternative trebuie încă măsurat.

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
2. Verifică **Conectat la server** și creează un cont, cu parolă de minimum 12 caractere. **Serverul echipei este deja pornit, iar două laptopuri furnizoare sunt pregătite pentru demo.**
3. În **PC-uri disponibile**, alege un furnizor sau **Automat**. Pentru un prim test fără fișiere, selectează **Fractal · CPU**, 640 × 360, 1000 iterații, **Doar PC-uri remote**, buget 20 credite, apoi pornește lucrarea.
4. Pentru un test cu fișiere, descarcă kitul, alege **Python**, încarcă și selectează `Python/Program/python.cbtask`, buget 20 credite și **Doar PC-uri remote**.
5. În **Lucrările mele**, descarcă `statistics.json`: rezultatul așteptat este **`count=10`, `sum=55`, `mean=5.5`**. Verifică și creditele câștigate pe furnizor.
6. În **Credite**, simulează o cumpărare de 500 credite, apoi o retragere. Pentru mai multe PC-uri simultan, folosește **Automat** la fractal/ray tracing sau încarcă o animație Blender compatibilă.

Echipa menține gazda și furnizorii porniți pe durata demo-ului. **Ca jurat care trimite lucrări remote, ai nevoie doar de aplicație și, pentru exemplele cu fișiere, de kitul de teste; nu trebuie să instalezi Node, Docker, WSL, Python sau Blender.** [Ghidul pentru jurați](docs/GHID-UTILIZARE.md) explică fiecare pas.

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
