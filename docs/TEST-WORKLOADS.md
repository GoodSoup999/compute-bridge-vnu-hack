# Teste video, Python, AI, compilare și simulări — 0.7

## Instalare pe furnizorul Windows

1. Instalează Docker Desktop și WSL 2. În PowerShell ca administrator:

```powershell
winget install --id Microsoft.WSL --exact
wsl --install --no-distribution
winget install --id Docker.DockerDesktop --exact
```

2. Repornește dacă instalarea o cere. Deschide Docker Desktop, folosește containere Linux și verifică într-un terminal nou:

```powershell
docker run --rm hello-world
```

[Instrucțiuni oficiale Docker](https://docs.docker.com/desktop/setup/install/windows-install/).

Alternativ, din surse, în PowerShell ca administrator: `powershell -ExecutionPolicy Bypass -File scripts/install-workload-runtime.ps1`. Scriptul este inclus și în `resources/app/scripts` din pachetul desktop. Nu repornește automat Windows.

3. Din folderul surselor Compute Bridge, cu Node.js 24 instalat, rulează:

```powershell
npm run runtime:prepare
```

Prima pregătire descarcă un mediu de dimensiune mare și poate dura câteva minute. Include Python 3.12, NumPy, scikit-learn, PyTorch CPU, FFmpeg, GCC și MinGW pentru executabile Windows. Mediul este comun celor cinci adaptoare. În pachetul desktop există și **Pregateste mediul.cmd**, care nu necesită Node separat.

4. Redeschide aplicația, intră la **Oferă PC-ul meu**, oferă minimum un fir CPU și minimum 4 GB RAM și activează **Accept video, Python, AI, compilare și simulări în mediu izolat**. Lasă Docker și aplicația pornite.

5. Gazda trebuie actualizată la 0.7, păstrând `data`. Dacă adresa tunelului se schimbă, actualizează configurația clienților. Laptopul cumpărător nu are nevoie de Docker.

## Test manual din aplicație

Descarcă și extrage arhiva test-kit. În **Lucrările mele**, alege tipul, deschide **Încarcă un pachet pregătit (.cbtask)** și încarcă exemplul, selectează un furnizor compatibil și pornește cu buget 20 de credite. După finalizare descarcă fișierele de pe cardul lucrării. Pentru propriile fișiere folosește formularul **Încarcă fișierele tale direct**.

| Pachet | Ce se execută | Rezultatul de verificat |
|---|---|---|
| `video.cbtask` | FFmpeg convertește un AVI de 2 secunde în MP4 128×128 | `converted.mp4`, care se poate reda |
| `python.cbtask` | Cod Python prelucrează CSV-ul încărcat | `statistics.json`: count=10, sum=55, mean=5.5 |
| `ai-inference.cbtask` | PyTorch aplică modelul încărcat la date | `predictions.json`: [1,3,5,11] |
| `ai-training.cbtask` | PyTorch antrenează un model liniar pe datele încărcate | `trained-model.json`: weight≈2, bias≈1, loss<0.0001; `weights.pt` |
| `compile.cbtask` | MinGW compilează sursa C++ încărcată | `program.exe`; rularea lui pe Windows afișează {"sum":55} |
| `simulation.cbtask` | Codul încărcat simulează un oscilator din configurație | `trajectory.csv`, `summary.json`: position≈−0.839, energy≈0.5 |

Există maximum 3 proiecte/pachete încărcate per cont. Șterge pachetele nefolosite din **Fișierele și pachetele încărcate** între teste. Nu șterge un pachet folosit de o lucrare activă. Creditul furnizorului trebuie să crească exact cu suma consumată de cumpărător; restul bugetului revine la finalizare sau anulare.

## Test automat complet

Din sursele actualizate, după pregătirea Docker:

```powershell
npm run test:workloads
```

Acest test folosește serverul și agentul real, încarcă toate cele șase pachete, verifică rezultatele numerice, transferurile de credite, descărcarea privată și limitele de execuție. Fără Docker pregătit testul eșuează explicit; nu raportează o verificare reușită fictivă. GitHub Actions execută aceeași suită pe un furnizor Linux și verifică separat pe Windows executabilul generat. Testul cu laptopuri fizice în rețele diferite rămâne distinct de verificarea CI.

```powershell
npm run test:workloads -- --protocol
```

Varianta `--protocol` verifică numai transferul, validarea, atribuirea și contabilitatea fără Docker; nu execută programele utilizatorului și nu dovedește funcționarea containerelor.

## Pachetele tale

Într-un folder pune fișierele de intrare și un `task.json`:

```json
{"kind":"python","entry":"main.py","args":["/inputs/data.csv"]}
```

Programul citește din `/inputs` și scrie rezultatele în folderul curent `/outputs`. Pot fi incluse module Python, date și modele. Nu include parole sau chei. Împachetează folderul:

Pentru fișiere aflate într-un singur folder poți folosi direct **Încarcă fișierele tale direct** din aplicație: selectezi toate fișierele împreună, alegi programul de pornire și parametrii ca listă JSON. Pentru video alegi și dimensiunile/formatul; pentru compilare alegi Windows sau Linux. După încărcare pornești lucrarea. Nu este necesar Node.js pe cumpărător.

```powershell
node scripts/pack-task.js C:\proiect C:\proiect.cbtask
```

Tipurile: `video`, `python`, `ai`, `compile`, `simulation`. Pentru compilare, `config.target` poate fi `windows` sau `linux`. Pentru video, `entry` este fișierul video și `config` conține `width`, `height`, `format` (`mp4`/`webm`). Exemplele complete sunt în `examples`.

## Limite și comportament

Un pachet general rulează integral pe un furnizor. Codul obișnuit nu se împarte automat între PC-uri. AI este CPU în această versiune; GPU-ul Blender continuă să funcționeze separat. Dependențele sunt cele incluse în imagine; descărcările pip în timpul lucrării sunt dezactivate odată cu accesul la rețea.

Maximum 32 MB pachet JSON / 24 MB fișiere de intrare, 64 fișiere, 5 minute execuție, 64 KB mesaje și 6 MB rezultate. Video: maximum 120 secunde, până la 1920×1080. Execuția are un sistem de fișiere de bază doar pentru citire, intrări doar pentru citire, rezultate în memorie (16 MB), fără internet, fără privilegii suplimentare și cu limite CPU/RAM/procese. Nu este o garanție de protecție împotriva oricărei vulnerabilități Docker/kernel; folosește Docker actualizat și participanți cunoscuți în beta.

Costuri de test per execuție acceptată: tariful furnizorului × 1 pentru Python/simulări, ×2 pentru video/compilare, ×4 pentru AI. Sunt convenții beta, nu facturare după durata reală. Se validează formatul și mărimea rezultatului, nu corectitudinea oricărui program arbitrar. La eșec nu se plătește un rezultat; sarcina poate fi reîncercată de maximum 5 ori, apoi bugetul rămas se restituie.
