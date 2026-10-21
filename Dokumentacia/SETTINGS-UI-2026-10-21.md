# Nastavenia a skutočná pripravenosť Trinity

- Panel Čo Trinity dokáže teraz načíta existujúce /api/assistant/capabilities, čas kontroly a stav PC. Rozlišuje konfiguráciu od nedávneho dokladu vykonania. Obnoviť stav nespúšťa model ani externú úlohu.
- Kľúče majú výber účelu: API, MCP iba čítanie alebo OpenClaw/MCP čítanie a úlohy. Platnosť je 7/30/90 dní, predvolene 30. Zoznam zobrazuje scopes a expiráciu. Tajomstvo sa ukazuje raz.
- Integrácie označené configured už UI neoznačuje Pripojené. Zobrazuje Nakonfigurované · čaká na test. Platform binding neznamená overený Cloudflare API token.
- Voliteľné sekcie nastavení sa načítajú cez allSettled. Chyba jednej sekcie nezhodí ostatné. Nedostupná sekcia sa označí, jej ovládanie je inertné a obnovenie je dostupné v spoločnom paneli.
- Admin a owner panel naďalej podliehajú serverovej autorizácii. Bežný používateľ nezíska oprávnenia iba z viditeľnosti karty.

Nové testy overujú pravdivé stavy, účel/scopes a expiráciu kľúča. Plný Worker build, Node testy a vizuálne/browser overenie nie sú v odpojenom prostredí potvrdené. Pripravené zmeny v PR nie sú nasadená aplikácia.

Pri pridanej platnosti kľúčov sa zároveň opravuje SQL porovnanie expires_at: julianday nahrádza textové porovnanie ISO času s datetime('now'), ktoré mohlo prijať kľúč po jeho expirácii v rovnaký deň. Pridaný test používa skutočný node:sqlite a autentifikáciu, ale zatiaľ nebol spustený v Node prostredí.
