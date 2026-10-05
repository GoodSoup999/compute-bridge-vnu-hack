# Credite și oferte — beta 0.7.1

## Credite

Fiecare cont primește 100 de credite de test o singură dată. Autentificarea sau restart-ul nu acordă bonusul din nou. Conturile vechi fără bonus îl primesc la actualizare. Creditele nu au valoare monetară. În 0.7.1, tabul Credite permite cumpărare și retragere simulate: 100 credite = 1 EUR demonstrativ, fără plată sau transfer bancar. Cumpărarea adaugă credite, retragerea scade soldul disponibil, istoricul persistă; nu se pot retrage creditele rezervate. Operațiile sunt marcate DEMO și nu cer card/IBAN.

La trimiterea lucrării, serverul verifică dacă există un PC remote conectat, oferit și compatibil cu tipul lucrării și memoria necesară. Pentru un PC selectat, alte PC-uri nu pot prelua sarcinile acestuia. Alternativ, modul automat distribuie sarcini între ofertele compatibile.

Bugetul maxim este rezervat din sold. Prețul fiecărei sarcini se fixează la atribuire. Clientul consumă acele credite numai când rezultatul este acceptat, iar furnizorul primește aceeași sumă. O retransmitere nu generează o a doua plată. Bugetul nefolosit revine la finalizare, anulare sau expirare. Poți suplimenta o lucrare activă.

Unitățile de demo:

- Fractal: 10 milioane `lățime × rânduri × iterații`.
- Ray tracing: 125.000 `lățime × rânduri × mostre`.
- Blender: 20 milioane `lățime × înălțime × mostre` per cadru.
- Pachete generale: tariful furnizorului ×1 pentru Python/simulare, ×2 pentru video/compilare, ×4 pentru AI, per execuție acceptată.

Prețul = unități × tariful ofertei, rotunjit în sus la 0,001 credite, minimum 0,01. Durata raportată de furnizor nu determină plata. Contribuția laptopului clientului în modul mixt este gratuită. Aceste unități sunt convenții de demo, nu un benchmark comparabil între tipurile de lucrări.

## Oferta PC-ului

Conectarea în cont nu oferă automat PC-ul. Proprietarul apasă **Oferă PC-ul**, alege 1–24 de ore și resursele disponibile. Oferta apare numai după confirmarea agentului prin server. Nu există aprobare manuală.

Oferta dispare când este oprită, intervalul expiră sau nu mai există contact în ultimele 20 de secunde. Dacă un PC pierde conexiunea, sarcinile nefinalizate pot reveni în coadă după 60 de secunde. Alegerea automată poate folosi alt furnizor; alegerea unui PC anume așteaptă acel PC sau anularea clientului.

**Termin lucrul și opresc oferta** ascunde oferta și nu mai primește sarcini, dar permite finalizarea celor active. La expirarea intervalului, sarcinile deja atribuite pot termina în limita de execuție. **Oprește imediat** întrerupe lucrul curent.

O sarcină activă rezervă o garanție de 10% din preț, minimum 0,01, maximum 1 credit. Rezultatul acceptat o restituie. Oprirea forțată o transferă clientului. Deconectarea peste 60 s poate transfera garanția dacă alte dispozitive sunt încă online; o întrerupere generală ambiguă nu este taxată. Restart-ul serverului și anularea clientului nu penalizează furnizorul. Simplul timp disponibil fără lucru nu este plătit și nu este penalizat.

## Resurse și limite

La crearea lucrării, cerințele sunt calculate automat pentru scenele incluse: CPU 2 GB RAM, Blender 4 GB RAM / 4 GB VRAM, respectiv 6 GB RAM peste un milion de pixeli per cadru. Aceste profiluri conservatoare nu garantează consumul exact. Cadrele rulează succesiv pe fiecare GPU; numărul lor nu multiplică memoria necesară simultan. Clientul nou transmite profilul și gazdelor 0.5.0; gazda actualizată calculează profilul independent și ignoră câmpurile manuale ale clienților vechi.

Maximum 12 sarcini CPU și una GPU simultan per dispozitiv, în limitele configurate. PC-ul cu loc liber preia următoarea sarcină. Profilul CPU introduce pauze între sarcini; memoria liberă sub 1 GB oprește temporar atribuirea locală. RAM/VRAM declarate sunt criterii de admitere, nu cote hardware stricte. Memoria nu se cumulează între PC-uri. GPU-ul poate fi solicitat intens.

Se execută fractal/ray tracing demo, scene Blender incluse sau proiecte proprii acceptate de furnizor și pachete video, Python, AI CPU, compilare C/C++ și simulări. Pachetele proprii rulează într-un container Docker limitat, pe un furnizor per pachet; nu există terminal remote sau acces general la fișierele furnizorului. Blender rulează local fără aceeași izolare. CPU demo: se recalculează un rând aleator din rezultat. GPU: se verifică PNG, dimensiunile și mărimea. Pachete: se validează structura și limitele rezultatului, fără dovada corectitudinii unui calcul arbitrar. [Limite și pregătire](TEST-WORKLOADS.md).

Conexiunile remote folosesc HTTPS. Parolele folosesc scrypt cu salt; tokenurile sunt stocate ca hash-uri pe server și rămân în procesul local al aplicației, fără a ajunge în interfață. Există limitări de încercări de autentificare și de lucrări active. Nu există încă verificare email, recuperare parolă sau protecție completă împotriva conturilor multiple și rezultatelor GPU frauduloase. Folosește beta cu participanți cunoscuți și credite de test.
