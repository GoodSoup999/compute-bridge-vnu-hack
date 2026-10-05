# Proiecte proprii și adaptoare — beta 0.6

## Ce funcționează

Primul adaptor pentru fișiere proprii este **Blender pe GPU NVIDIA**. Proprietarul încarcă un `.blend`, alege primul cadru, numărul de cadre, rezoluția, mostrele și bugetul. Fiecare furnizor compatibil preia următorul cadru liber. Se folosesc camera, geometria și animația proiectului încărcat, nu scena demo. Rezultatele PNG apar în player și pot fi descărcate individual. Plata și restituirea bugetului folosesc infrastructura existentă.

## Pregătirea fișierului

1. În Blender setează camera activă și animația.
2. Folosește **File → External Data → Pack Resources** și salvează proiectul.
3. Salvează fără compresie. Limita beta este de **32 MB** per fișier, 3 proiecte / 96 MB per cont, 256 MB pe gazdă.
4. În aplicație alege **Proiect Blender · GPU**, selectează fișierul și apasă **Încarcă proiectul**.
5. După confirmarea serverului, alege intervalul de cadre și pornește lucrarea.

Proiectele persistă la restart. Ștergerea este permisă doar proprietarului, când nu există lucrări active care le folosesc. Fișierele nu sunt publice: furnizorul le poate descărca numai în timpul unei atribuiri active. Un furnizor poate păstra o copie a datelor pe care le primește; sistemul nu poate garanta ștergerea pe un PC controlat de altcineva.

## Furnizorul

Folosește aplicația curentă 0.7.1, activează oferta GPU și **Accept proiecte Blender încărcate de utilizatori**. Folosește versiuni Blender compatibile cu proiectele încărcate. Furnizorii vechi și cei fără această opțiune primesc în continuare doar sarcini demo. Descărcarea este verificată prin SHA-256 și mărime; proiectul este reutilizat pentru cadrele următoare, într-un cache temporar limitat la trei fișiere, curățat la oprirea agentului.

## Limite reale ale execuției

Această beta este pentru proiecte de încredere. Blender rulează local ca proces, **fără izolare completă într-un container sau VM**. Directorul temporar nu constituie o barieră de securitate. Se folosește `--disable-autoexec`, iar fișierele care cer scripturi automate sunt refuzate. [Documentația Blender](https://docs.blender.org/manual/en/5.3/advanced/scripting/security.html) descrie acest control. Nu sunt acceptate comenzi arbitrare, addon-uri sau programe Python încărcate.

Se folosește Cycles GPU. Compositorul și sequencerul sunt dezactivate; resursele externe neîmpachetate și bibliotecile externe sunt refuzate, cu excepția resurselor standard din instalarea Blender. Simulările cu cache-uri externe și rig-urile care cer Python nu sunt suportate în această etapă. Randarea are un timeout de 4 minute per cadru, maximum 48 cadre și maximum 30 milioane de pixeli per lucrare. Cerințele RAM/VRAM rămân estimări conservatoare; un fișier mic poate descrie o scenă care consumă multă memorie. Corectitudinea GPU este verificată ca format, nu prin recalculare independentă.

## Extensibilitate

`lib/task-adapters.js` separă execuția de transferuri, distribuire și credite. Pe lângă fractal, ray tracing și Blender, versiunea curentă include adaptoare Docker pentru video, Python, AI CPU, compilare C/C++ și simulări; [ghid separat](TEST-WORKLOADS.md). Fiecare adaptor nou cere validare, un mediu potrivit, rezultate și teste. Nu există execuție universală de programe sau însumarea RAM/VRAM între PC-uri.

## Gazda

Actualizează sursele pe gazdă la 0.6, păstrează `data`, apoi repornește serviciul. `/health` trebuie să includă `blender-projects-v1` în `features`. Clientul detectează gazdele vechi și explică necesitatea actualizării, fără să simuleze o încărcare reușită. Dacă tunelul temporar primește o adresă nouă, configurația clientului trebuie actualizată.

## Verificare

```powershell
npm run test:projects
$env:TEST_GPU = '1'
npm run test:projects
```

Testul GPU creează un proiect animat propriu, îl încarcă, randează cadrele 7 și 8 prin agentul real, verifică transferul creditelor, cache-ul și persistența proiectului la restart. Testele desktop și UI verifică încărcarea binară, lista privată de proiecte și controalele formularului. Aceste teste folosesc procese locale; validarea pe laptopuri fizice rămâne necesară după actualizarea gazdei.
