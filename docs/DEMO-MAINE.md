# Demo 0.7: ce pregătim și ce verificăm

## Înainte de demo

1. **Gazda:** oprește lucrările active, actualizează sursele cu `git pull`, păstrează folderul `data`, apoi repornește serverul. Gazda trebuie să ruleze **0.7.0**. Adresa configurată în aplicație este `https://klein-limiting-beads-tired.trycloudflare.com`; la ultima verificare aceasta răspundea cu **0.5.0**, care nu acceptă noile pachete.
2. Dacă repornești și tunelul, adresa se poate schimba. Modifică `hubUrl` în `resources/app/desktop/config.json` pe **toate** aplicațiile distribuite. Serverul și tunelul trebuie să rămână pornite. Pentru a păstra tunelul existent, repornește doar procesul serverului, dacă este lansat separat de tunel.
3. **Furnizor:** aplicația 0.7, Docker Desktop pornit în modul Linux, mediul pregătit prin **Pregateste mediul.cmd**. Activează acceptarea video/cod, oferă 2 fire CPU și 4 GB RAM, interval 1 oră. Folosește un cont diferit de cumpărător.
4. **Acest laptop:** Docker Desktop a fost instalat. Instalarea WSL a fost refuzată fără drepturi de administrator. Deschide PowerShell ca administrator și rulează `powershell -ExecutionPolicy Bypass -File scripts/install-workload-runtime.ps1` din sursele proiectului. Repornește dacă Windows o cere; apoi deschide Docker și pregătește mediul. Nu este suficient ca Docker să fie doar instalat.
5. **Cumpărător:** aplicația 0.7, alt cont, minimum 20 credite. Nu are nevoie de Docker. Extrage arhiva cu exemplele de test.

## Ordine recomandată

1. Arată furnizorul în marketplace. Cardul trebuie să spună că acceptă video, Python, AI CPU, compilare și simulări.
2. Alege acel PC și trimite **python.cbtask**, buget 20. Descarcă `statistics.json`: suma trebuie să fie **55**.
3. Arată tranzacțiile: cumpărătorul pierde exact cât primește furnizorul. Bugetul neconsumat revine în sold.
4. **video.cbtask:** descarcă și redă MP4-ul de două secunde.
5. Șterge pachetele terminate nefolosite când ajungi la limita de trei. Rulează exemplele AI, compilare și simulare conform tabelului din [ghid](TEST-WORKLOADS.md).
6. Pentru fișiere proprii: alege Python, deschide **Încarcă fișierele tale direct**, selectează `main.py` și `numbers.csv` din exemple, alege `main.py`, parametri `["/inputs/numbers.csv"]`, încarcă și pornește. Nu este nevoie de comandă de împachetare.
7. Pentru Blender folosește un furnizor cu Blender actualizat și NVIDIA, cu acceptarea proiectelor proprii activă. Cadrele se distribuie dinamic; un furnizor mai rapid preia mai multe cadre.

## Dacă ceva nu pornește

| Mesaj/situație | Ce verifici |
|---|---|
| Gazda trebuie actualizată | `/health` trebuie să raporteze 0.7 și funcția `workload-bundles-v1` |
| Acceptarea video/cod este dezactivată | Docker pornit, pregătirea mediului terminată cu succes, apoi aplicația redeschisă |
| Niciun PC compatibil | Alt cont furnizor, ofertă activă, acceptare pachete, 2 GB RAM sau 4 GB pentru AI |
| Fetch failed/serverul nu răspunde | Gazda/tunelul pornite și aceeași adresă HTTPS în toate configurațiile |
| Rezultat prea mare | Maximum 6 MB rezultate; micșorează fișierele generate |
| Codul termină cu eroare | Deschide eroarea lucrării, verifică fișierele și dependențele incluse |

## Ce poți afirma la prezentare

Marketplace cu conturi și credite, transfer de fișiere prin serviciul HTTPS, execuție pe alt PC și rezultate proprii. Video, Python, AI CPU, C/C++ și simulări sunt adaptoare funcționale; programele utilizatorului rulează în containere limitate. Un pachet general rulează pe un singur furnizor, iar cadrele Blender se distribuie între furnizori. RAM/VRAM nu se unesc. Nu promite antrenarea modelelor mari sau rularea oricărui software fără pregătirea mediului.

Verificările automate și pe acest laptop nu înlocuiesc proba finală cu furnizorii și gazda voastră actualizată. Faceți prima lucrare Python înainte de prezentare.
