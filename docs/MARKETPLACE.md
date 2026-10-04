# Reguli pentru beta 0.4

## Credite

Creditele sunt interne, fără valoare monetară, cumpărare sau retragere. Nu se emit credite automat la înregistrare sau pentru simpla conectare. Numai administratorul alocă solduri inițiale. Disponibilitatea nefolosită nu este remunerată.

La pornire, bugetul marketplace este debitat din soldul disponibil și păstrat în contul lucrării. Fiecare sarcină primește un preț fix la atribuire, calculat din dimensiunea lucrării și tariful furnizorului. Durata raportată de furnizor nu determină plata. O sarcină acceptată este plătită o singură dată, chiar dacă rezultatul este retrimis. Bugetul nefolosit se restituie la finalizare, anulare sau expirare. Se poate adăuga buget unei lucrări active.

O unitate de lucru înseamnă:

- Fractal: 10 milioane `lățime × rânduri × iterații`.
- Ray tracing: 125.000 `lățime × rânduri × mostre`.
- Blender: 20 milioane `lățime × înălțime × mostre` per cadru.

Prețul unei sarcini = unități × tariful furnizorului, rotunjit în sus la 0,001 credite, minimum 0,01 credite. Aceste unități sunt convenții de demo, nu un benchmark comparabil între lucrări. CPU și GPU nu au aceeași unitate fizică. Sarcinile pe PC-uri proprii sau pe PC-uri autorizate în party nu generează transfer de credite.

## Disponibilitate și penalizări

Un dispozitiv poate oferi resurse pentru maximum 24 de ore per sesiune. Modul flexibil nu cere garanție. Modul rezervat reține la atribuirea fiecărei sarcini marketplace o garanție de 10% din preț, minimum 0,01 și maximum 1 credit. Nu se rezervă un PC întreg și nu există în această beta rezervări viitoare plătite: angajamentul este pentru sarcinile acceptate în intervalul declarat.

- Rezultatul acceptat restituie garanția și plătește sarcina.
- Oprirea imediată în timpul unei sarcini marketplace rezervate transferă garanția clientului.
- După 60 s fără contact, lucrarea este redistribuită. Garanția este transferată doar dacă hub-ul vede în continuare alte dispozitive online. O întrerupere generală ambiguă nu este taxată.
- Repornirea hub-ului, anularea clientului, revocarea unei permisiuni de party sau expirarea timpului de execuție nu generează penalizare financiară.
- „Termin sarcinile curente și opresc” nu mai acceptă sarcini, dar lasă rezultatele curente să se finalizeze.
- Expirarea disponibilității oprește atribuirea de sarcini noi. Sarcinile acceptate pot termina în limita lor de execuție.

Nu există penalizări pentru party sau pentru disponibilitate fără sarcini active. Pierderea unei conexiuni poate fi ambiguă; acest model este intenționat conservator. Nu există mecanism de contestații sau garanții comerciale în beta.

## Matching și limite

Se verifică permisiunea, tipul CPU/GPU, memoria declarată, intervalul disponibil, numărul de sloturi, soldul pentru garanție și bugetul clientului. Dispozitivele marketplace trebuie aprobate de administrator. Agentul cere sarcini când are loc liber; serverul preferă oferte compatibile cu cost și istoric mai bune. PC-urile rapide preiau mai multe bucăți. Nu este implementat un benchmark hardware independent sau o predicție garantată a duratei.

Aceeași capacitate este contabilizată o singură dată pentru party, marketplace și lucrări proprii. Sunt permise maximum 12 sarcini CPU și una GPU simultan per dispozitiv, în limitele configurate. Agentul aplică pauze între sarcinile CPU pentru profilul de utilizare și nu pornește sarcini când memoria liberă este sub 1 GB. Acestea nu sunt cote stricte de CPU/RAM/VRAM impuse de sistemul de operare. GPU-ul poate ajunge la utilizare mare; VRAM-ul este criteriu de admitere și nu se combină între calculatoare.

## Securitate și validare

Conexiunile remote cer HTTPS; HTTP este permis numai pentru test pe loopback. Conturile folosesc scrypt cu salt aleator, sesiunile expiră după 7 zile, iar serverul stochează hash-uri pentru tokenuri. Agentul are un token separat pentru dispozitiv. Nu poate crea lucrări sau administra contul. Tokenurile contului și dispozitivului rămân în procesul local, nu sunt trimise interfeței. La ieșire trebuie făcută din nou autentificarea.

Se execută numai sarcini predefinite din aplicație. Nu există încărcare de scripturi, fișiere `.blend` arbitrare, terminal remote sau acces general la fișiere. CPU: serverul recalculează un rând aleator din fiecare rezultat înainte de acceptare. Este o verificare prin eșantionare, nu o dovadă completă. GPU: se verifică semnătura PNG, dimensiunile și mărimea; corectitudinea randării nu este dovedită independent. De aceea marketplace-ul beta este pentru dispozitive aprobate și participanți cunoscuți.

Nu există izolare prin mașini virtuale, attestation, criptare a datelor în timpul calculului, verificare de identitate sau protecție completă împotriva coluziunii între conturi. Beta nu este potrivită pentru documente confidențiale, bani reali sau furnizori anonimi ostili.
