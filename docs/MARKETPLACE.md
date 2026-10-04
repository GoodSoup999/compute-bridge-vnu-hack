# Credite și oferte — beta 0.5

## Credite

Fiecare cont primește 100 de credite de test o singură dată. Autentificarea sau restart-ul nu acordă bonusul din nou. Conturile vechi fără bonus îl primesc la actualizare. Creditele nu au valoare monetară, cumpărare sau retragere.

La trimiterea lucrării, serverul verifică dacă există un PC remote conectat, oferit și compatibil cu tipul lucrării și memoria necesară. Pentru un PC selectat, alte PC-uri nu pot prelua sarcinile acestuia. Alternativ, modul automat distribuie sarcini între ofertele compatibile.

Bugetul maxim este rezervat din sold. Prețul fiecărei sarcini se fixează la atribuire. Clientul consumă acele credite numai când rezultatul este acceptat, iar furnizorul primește aceeași sumă. O retransmitere nu generează o a doua plată. Bugetul nefolosit revine la finalizare, anulare sau expirare. Poți suplimenta o lucrare activă.

Unitățile de demo:

- Fractal: 10 milioane `lățime × rânduri × iterații`.
- Ray tracing: 125.000 `lățime × rânduri × mostre`.
- Blender: 20 milioane `lățime × înălțime × mostre` per cadru.

Prețul = unități × tariful ofertei, rotunjit în sus la 0,001 credite, minimum 0,01. Durata raportată de furnizor nu determină plata. Contribuția laptopului clientului în modul mixt este gratuită. Aceste unități sunt convenții de demo, nu un benchmark comparabil între tipurile de lucrări.

## Oferta PC-ului

Conectarea în cont nu oferă automat PC-ul. Proprietarul apasă **Oferă PC-ul**, alege 1–24 de ore și resursele disponibile. Oferta apare numai după confirmarea agentului prin server. Nu există aprobare manuală.

Oferta dispare când este oprită, intervalul expiră sau nu mai există contact în ultimele 20 de secunde. Dacă un PC pierde conexiunea, sarcinile nefinalizate pot reveni în coadă după 60 de secunde. Alegerea automată poate folosi alt furnizor; alegerea unui PC anume așteaptă acel PC sau anularea clientului.

**Termin lucrul și opresc oferta** ascunde oferta și nu mai primește sarcini, dar permite finalizarea celor active. La expirarea intervalului, sarcinile deja atribuite pot termina în limita de execuție. **Oprește imediat** întrerupe lucrul curent.

O sarcină activă rezervă o garanție de 10% din preț, minimum 0,01, maximum 1 credit. Rezultatul acceptat o restituie. Oprirea forțată o transferă clientului. Deconectarea peste 60 s poate transfera garanția dacă alte dispozitive sunt încă online; o întrerupere generală ambiguă nu este taxată. Restart-ul serverului și anularea clientului nu penalizează furnizorul. Simplul timp disponibil fără lucru nu este plătit și nu este penalizat.

## Resurse și limite

La crearea lucrării, cerințele sunt calculate automat pentru scenele incluse: CPU 2 GB RAM, Blender 4 GB RAM / 4 GB VRAM, respectiv 6 GB RAM peste un milion de pixeli per cadru. Aceste profiluri conservatoare nu garantează consumul exact. Cadrele rulează succesiv pe fiecare GPU; numărul lor nu multiplică memoria necesară simultan. Clientul nou transmite profilul și gazdelor 0.5.0; gazda actualizată calculează profilul independent și ignoră câmpurile manuale ale clienților vechi.

Maximum 12 sarcini CPU și una GPU simultan per dispozitiv, în limitele configurate. PC-ul cu loc liber preia următoarea sarcină. Profilul CPU introduce pauze între sarcini; memoria liberă sub 1 GB oprește temporar atribuirea locală. RAM/VRAM declarate sunt criterii de admitere, nu cote hardware stricte. Memoria nu se cumulează între PC-uri. GPU-ul poate fi solicitat intens.

Se execută numai fractal CPU, ray tracing CPU și animația procedurală Blender inclusă. Nu există scripturi încărcate, fișiere `.blend` arbitrare, terminal remote sau acces general la fișierele altui PC. CPU: se recalculează un rând aleator din rezultat. GPU: se verifică semnătura PNG, dimensiunile și mărimea; corectitudinea randării nu este dovedită independent.

Conexiunile remote folosesc HTTPS. Parolele folosesc scrypt cu salt; tokenurile sunt stocate ca hash-uri pe server și rămân în procesul local al aplicației, fără a ajunge în interfață. Există limitări de încercări de autentificare și de lucrări active. Nu există încă verificare email, recuperare parolă sau protecție completă împotriva conturilor multiple și rezultatelor GPU frauduloase. Folosește beta cu participanți cunoscuți și credite de test.
