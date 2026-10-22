# Obchodné nástroje v bežnom rozhovore

Tento krok prepája existujúcu owner evidenciu zákazníkov a ponúk s vykonávaním nástrojov v chate.

## Vykonateľné požiadavky
- „Ulož túto firmu medzi potenciálnych zákazníkov; zdroj je https://example.com a potrebuje prezentačný web.“ -> sales_lead_save.
- „Ukáž uložené ponuky a potenciálnych zákazníkov.“ -> sales_pipeline.
- „Priprav a ulož ponuku na firemný web za 250 EUR s týmto platobným odkazom z Revolut Pro.“ -> sales_offer_create; model musí mať konkrétny odkaz, cenu aj rozsah služby.

Trinity si názvy nástrojov vyberie sama. Uloženie má ID a potvrdenie z D1. Neznamená odoslanie ponuky, získanie klienta alebo pripísanú platbu. Bez chýbajúcej ceny či odkazu sa nevymyslí faktúra ani bankové prepojenie.

## Identita
createJob prijíma dôveryhodný tretí parameter zo serverovej autentifikácie. Principal sa prenáša cez Workflow payload, nie cez používateľovu správu. jobSchema nepovoľuje commerce_principal ani executionContext. Owner role, účet a admin režim musia byť potvrdené serverom. Bežný user ani admin bez owner identity nemajú tieto nástroje v prompt-e a pri priamom volaní sú odmietnutí.

Telegram používa tieto nástroje až pri výslovne zapnutom TELEGRAM_ADMIN_ENABLED=true a nakonfigurovanom TRINITY_OWNER_EMAIL. Predvolene sú vypnuté.

## Testy a nasadenie
Nové testy odmietajú podvrhnutú identitu a overujú scoping pipeline na účet vlastníka. Syntax je možné overiť oddelene, ale plný build a testy musí potvrdiť Node/Worker prostredie alebo GitHub CI. Predchádzajúce GitHub joby skončili bez runnera a bez vykonaných krokov; kód tento blokér nerieši ani neobchádza.
