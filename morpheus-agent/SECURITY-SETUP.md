# Bezpečné spustenie samostatného Morpheus agenta

Tento Python servis je samostatný modul. Lokálna kontrola nie je dôkazom
nasadenia, pripojenia účtov ani odoslania na sociálne siete.

- Pred spustením nastav `MORPHEUS_VAULT_KEY` (alebo existujúci
  `TRINITY_VAULT_KEY`) zo súkromného správcu tajomstiev. Bez kľúča sa servis
  nespustí. Verejný náhradný kľúč bol odstránený.
- Nastav samostatný náhodný `MORPHEUS_ADMIN_TOKEN`. Dashboard, generovanie
  príspevkov, DNS synchronizácia, vytváranie krátkych odkazov a správa OAuth
  vyžadujú autentifikáciu. Prehliadač používa HTTP Basic: používateľ `owner`,
  heslo je tento token. API používa `Authorization: Bearer <token>`.
  Používaj HTTPS; token nepatrí do URL, zdrojov ani logov.
- Meta vyžaduje `META_APP_SECRET` a vlastný `META_WEBHOOK_VERIFY_TOKEN`.
  Chýbajúca konfigurácia vráti 503, chýbajúci/chybný podpis POST vráti 401.
- X webhook vyžaduje `X_CONSUMER_SECRET` (consumer secret aplikácie;
  OAuth 2.0 `X_CLIENT_SECRET` nie je náhradou). CRC aj podpis POST používajú
  HMAC-SHA256 v Base64. Webhook nikdy nespustí spracovanie bez podpisu.
- Verejné sú len webhooky s vlastným overením, OAuth callback s jednorazovým
  stavom, presmerovania odkazov, landing stránky a health endpoint.
- CORS povoľuje iba nakonfigurovaný pôvod služby; admin kontroluje aj Origin.
  Verejný pôvod vychádza z `DomainSettings.base_url` (`MORPHEUS_PRIMARY_DOMAIN`
  a `MORPHEUS_SUBDOMAIN`), takže kontrola funguje aj po ukončení TLS v Caddy.
  Hlavičky Host a X-Forwarded-* nerozširujú zoznam povolených pôvodov.

Ak sa v minulosti uložili tokeny pod verejným náhradným vault kľúčom,
považuj ich za kompromitované. Zruš ich u poskytovateľov a účty znovu
autorizuj s vlastným kľúčom. Zmena kľúča sama neprešifruje staré dáta.

Offline regresie: `python -m unittest discover -s morpheus-agent/tests -v`
z koreňa repozitára. Vyžadujú FastAPI, httpx a cryptography z requirements.
Webhook testy spúšťajú skutočné telá handlerov izolovane od DB/schedulera;
nepredstavujú integračný test bežiaceho servisu.

X formát: https://github.com/xdevplatform/samples/blob/main/python/webhooks/webhook_server.py
