# Codex: nezávislá kontrola domén Trinity

Dátum: 24. 10. 2026. Používateľ určil opravu existujúcich domén ako prioritu spoločného vývoja.
Rozdelenie: Antigravity vlastní Cloudflare DNS/Worker konfiguráciu a DOMAIN-COLLABORATION.md. Codex vlastní tento záznam a scripts/check-trinity-domains.mjs + scripts/check-trinity-domains.test.mjs. Rovnaké implementačné súbory neupravujeme súbežne.

## Východiskový stav

- auru.space: DNS a HTTPS fungujú; root a /health HTTP 200. Trinity 11.0.0, environment production, status serving. Pri poslednej kontrole deployment ID 8352f194-ee99-451f-9256-a823bad4d0fa, commit tag null.
- auru.dev: DNS a HTTPS fungujú; root a /health HTTP 200. Trinity 11.0.0, environment development, status serving. Deployment ID 658a1586-40c9-44de-8892-8538be820af8, commit tag null.
- jericho123.auru.space a jericho123.auru.dev: DNS aj TLS fungujú. Verejné volania root a /health HTTP 302 na Cloudflare Access login. To je ochrana, nie dôkaz zlyhania domény. Funkčnosť originu za autentifikáciou nebola týmto preukázaná.
- www.auru.space a www.auru.dev: DNS ENOTFOUND; HTTPS sa nedá nadviazať.
- Jericho-Worker/wrangler.jsonc mapuje obe Jericho custom domains na jeden Worker jericho123 s ENVIRONMENT production; neobsahuje env.development. Samostatná vývojová inštancia teda nie je doložená touto konfiguráciou.

## Požadované výsledky

1. www hosty sa vyriešia v DNS a cez HTTPS presmerujú na príslušnú apex doménu pomocou 301/308, so zachovaním cesty a query. www.auru.dev nesmie presmerovať na produkciu.
2. Existujúce apex appky zostanú dostupné a hlásia správne production/development prostredie.
3. Jericho si zachová Access ochranu a vývoj nebude používať produkčné zdroje iba na zamaskovanie chýb konfigurácie.
4. Commit/runtime tagy, rozdielne Worker version ID a skutočné nasadenie sa dokladujú oddelene. Samotná zhoda čísla verzie 11.0.0 neznamená zhodný zdroj ani dáta.
5. Žiadne registrácie nových domén, nákupy, mazanie nesúvisiacich DNS alebo vypnutie Access v rámci tejto opravy.

## Kontrolný nástroj Codex

Read-only skript: node scripts/check-trinity-domains.mjs.
Testy: node --test scripts/check-trinity-domains.test.mjs -> 5/5 PASS.
Kontrola nečíta žiadne credentials a nemení DNS ani nasadenie. Overuje všetkých šesť hostov, HTTP status oddelene od status poľa v JSON, environment, canonical path/query a pravý Cloudflare Access redirect bez zapisovania login tokenov.
Živé východiskové spustenie: 4 hosty prešli kontrolou dostupnosti/ochrany; obe www zlyhali v DNS. Tento výsledok neznamená overenie prihlásenej služby ani oddelenia dát.

Stav: konkrétne nálezy a požiadavka na opravu doručené Antigravity; prijatie správ je potvrdené. DNS oprava a izolácia Jericho zatiaľ neboli nezávisle potvrdené.
