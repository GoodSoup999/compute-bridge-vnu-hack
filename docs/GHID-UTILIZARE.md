# Ghid pentru jurați · Compute Bridge 0.7.1

> [!IMPORTANT]
> **Serverul este deja pornit de echipa noastră, iar două laptopuri furnizoare sunt pregătite pentru demo.** Descarci aplicația, intri în cont și trimiți lucrări către un PC disponibil. Ai nevoie de **Windows x64 și internet**; poți fi pe altă rețea.

> [!WARNING]
> **Nu descărca aplicația de pe site-ul de prezentare: versiunea de acolo este învechită.** Folosește descărcările GitHub de mai jos.

## 1. Descarcă și deschide aplicația

1. Deschide [release-ul aplicației 0.7.1](https://github.com/GoodSoup999/compute-bridge-vnu-hack/releases/tag/v0.7.1-beta.1).
2. În **Assets**, descarcă **`ComputeBridge-0.7.1-desktop-windows-x64.zip`**. Nu alege `Source code`.
3. Click dreapta pe ZIP → **Extract All / Extrage tot**. Păstrează toate fișierele împreună; nu muta numai executabilul și nu îl porni din arhivă.
4. În folderul extras, deschide **`ComputeBridge.exe`**.
5. Așteaptă **Conectat la server**. Adresa serverului echipei este deja inclusă în această descărcare.

**Pentru lucrări remote, nu trebuie să instalezi Node.js, Docker, WSL, Python sau Blender. Nu trebuie să rulezi `Pregateste mediul.cmd` și nici să pornești un server.** Mediul de execuție este pregătit pe furnizori.

## 2. Creează contul și găsește un PC

1. Completează numele, emailul și o parolă de **minimum 12 caractere**, apoi apasă **Creează cont**. Pentru un cont existent pe acest server, folosește **Intră în cont**.
2. Un cont nou primește **100 de credite de test**.
3. În **PC-uri disponibile**, vezi ofertele laptopurilor noastre. Alege **Folosește acest PC** sau lasă **Automat · toate PC-urile compatibile**.

Oferta trebuie să fie activă și compatibilă cu lucrarea. Dacă nu apare niciun PC, anunță echipa; noi verificăm furnizorii. Nu trebuie să activezi **Oferă PC-ul meu** pentru a testa lucrări remote.

## 3. Primul test, fără fișiere: Fractal

1. La **Lucrare**, selectează **Fractal · CPU**.
2. La PC folosit, alege **Automat · toate PC-urile compatibile**.
3. La **Execuție**, alege **Doar PC-uri remote**.
4. Buget: **20 credite**. Setări: **640 × 360**, **1000 iterații**.
5. Apasă **Pornește lucrarea**.
6. Deschide **Lucrările mele**: urmărește progresul și contribuțiile PC-urilor, apoi vizualizează sau descarcă imaginea finală.

Acest test poate împărți imaginea între cele două laptopuri. Bugetul se rezervă la pornire; plătești sarcinile acceptate, iar restul revine în sold la finalizare sau anulare.

## 4. Test cu fișiere: Python

1. Deschide [release-ul kitului de teste](https://github.com/GoodSoup999/compute-bridge-vnu-hack/releases/tag/v0.7.1-test-kit.1), descarcă **`ComputeBridge-0.7.1-test-kit.zip`** din **Assets** și extrage-l.
2. În aplicație, selectează **Python** și un furnizor compatibil sau **Automat**.
3. În **Încarcă un pachet pregătit (.cbtask)**, selectează **`Python/Program/python.cbtask`** din kit și apasă **Încarcă pachetul**.
4. Selectează pachetul încărcat, **Doar PC-uri remote**, buget **20 credite**, apoi **Pornește lucrarea**.
5. În **Lucrările mele**, așteaptă finalizarea și descarcă **`statistics.json`**. Rezultatul așteptat: **`count=10`, `sum=55`, `mean=5.5`**.

Fișierele din **Rezultate așteptate** sunt pentru comparație; nu le încărca drept intrări. Maximum trei proiecte/pachete per cont: șterge-le pe cele nefolosite înainte de alte teste.

## 5. Încearcă și celelalte lucrări

Pentru pachetele de mai jos, repeți pașii testului Python: alegi tipul corespunzător, încarci `.cbtask`, selectezi pachetul, **Doar PC-uri remote**, apoi pornești. Fiecare variantă are un **CITESTE-MA.md** și un folder **Rezultate așteptate**.

| Lucrare | Unde găsești exemplele în kit |
| --- | --- |
| Procesare video | `Procesare video` → `MP4` sau `WebM` |
| Python | `Python` → `Program` |
| AI · CPU | `AI · CPU` → `Predicție` sau `Antrenare` |
| Compilare C/C++ | `Compilare C-C++` → variante pentru Windows sau Linux |
| Simulări Python | `Simulări Python` → `Oscilator` |
| Ray tracing · CPU | Fără pachet: alege motorul din aplicație, 640 × 360, 8 mostre |
| Proiect Blender · GPU | Încarcă propriul `.blend`; vezi pașii de mai jos |

**Propriile fișiere:** poți folosi **Încarcă fișierele tale direct** în loc de pachetele noastre. Selectează programul și datele, fișierul de pornire și argumentele ca listă JSON (`[]` dacă nu sunt necesare). Codul citește din `/inputs` și scrie rezultatele în `/outputs`; bibliotecile disponibile și limitele sunt descrise în [documentația lucrărilor](TEST-WORKLOADS.md).

**Blender:** pregătește camera și animația, folosește **File → External Data → Pack Resources**, salvează `.blend` fără compresie, apoi încarcă-l. Alege cadrele, rezoluția și mostrele, cu **Automat** și **Doar PC-uri remote**. Fiecare laptop compatibil preia următorul cadru disponibil. La final, vezi PNG-urile și redarea cu viteză ajustabilă. Kitul nu include un proiect `.blend`; poți folosi unul propriu compatibil sau cere echipei proiectul de demo. [Condiții Blender](PROJECTS.md).

**Mai multe PC-uri simultan:** Blender distribuie cadre; fractalul și ray tracing-ul distribuie bucăți de imagine. Pachetele video/Python/AI/compilare/simulare rulează pe un furnizor per pachet. RAM și VRAM nu se unesc.

## 6. Verifică economia demo

În **Credite**, simulează cumpărarea a **500 credite**: soldul crește, echivalentul demonstrativ fiind **5 EUR**. Simulează retragerea a **100 credite**: soldul scade. Verifică istoricul.

**Nu se încasează și nu se trimit bani; nu sunt necesare carduri sau IBAN.** Creditele rezervate în lucrări nu pot fi retrase. Transferul creditelor interne de la client către furnizor se face pentru sarcinile acceptate.

## Dacă întâmpini o problemă

- **Serverul nu răspunde:** verifică internetul, închide complet aplicația și redeschide-o. Dacă mesajul persistă, anunță echipa: serverul/tunelul sunt administrate de noi, iar adresa se poate schimba la repornire.
- **Nu există PC compatibil:** încearcă Fractal pentru primul test sau cere echipei să verifice oferta și mediul pentru tipul ales.
- **Email sau parolă incorecte:** folosește contul creat pe serverul demo actual; dacă nu reușești, cere ajutor echipei. Nu există recuperare automată a parolei în beta.
- **Lucrarea eșuează:** deschide logurile lucrării și arată mesajul echipei. Pentru test, folosește pachetul `.cbtask` complet din kit.

Instrucțiunile pentru găzduirea propriului server sau pregătirea unui PC furnizor sunt separate: [găzduire](HOSTING.md) · [mediu de execuție](TEST-WORKLOADS.md) · [Blender](PROJECTS.md). **Nu sunt necesare pentru testarea demo-ului ca utilizator.**
