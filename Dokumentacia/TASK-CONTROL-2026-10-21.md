# Overiteľné riadenie úloh

Stop sa už nespolieha iba na AbortController prehliadača. Pri zadaní čaká na ID úlohy a odošle samostatnú požiadavku na zrušenie, aj keď používateľ stlačil Stop pred prijatím ID. Opakované kliknutie zdieľa jednu požiadavku. Úloha sa označí ako zastavená až po potvrdení servera. Prerušenie streamu je označené iba ako prerušenie zobrazovania.

Server najprv žiada ukončenie Workflow a potom podmienene zmení queued/running na cancelled. Ak medzitým úloha skončila, vráti skutočný stav completed/failed. Workflow nesmie prepísať cancelled úspešným výsledkom a nesmie zapísať completed event pre zrušenú úlohu. Zastavenie nevracia už dokončené externé akcie.

V chate je priebežný stav a počet krokov. Po uplynutí časového okna sledovania sa zobrazí informácia, že práca pokračuje na serveri, a tlačidlo Obnoviť stav úlohy; nevytvára novú úlohu.

Pridané testy: Stop pred ID, jedna cancellation pri opakovanom kliknutí, chyba servera, súbeh dokončenia a zrušenia, priebežný stav. Úplný build a browser overenie treba potvrdiť po obnovení runtime/CI. Tento krok netvrdí, že sú opravené všetky obmedzenia multi-user izolácie existujúceho jadra.
