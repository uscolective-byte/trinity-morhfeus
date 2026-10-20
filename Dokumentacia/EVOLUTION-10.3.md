# Trinity 10.3 — implementácia a aktivácia

## Čo sa zmenilo

| Požiadavka | Implementácia | Podmienka reálnej prevádzky |
|---|---|---|
| Vlastné návrhy aj vykonať | `self-improvement.js`, `project-evolution.js`: návrh → presný commit → modelová oprava → samostatná vetva → PR → CI → integrácia | GitHub token a funkčný CI runner; zdrojové zmeny vyžadujú review |
| Bežný jazyk | Komunikačné pravidlá a nástroje `project_inspect`, `project_read`, `improvement_submit`; bez potreby `!zlepsenie` | Model musí vrátiť nástrojový krok; kvalita jazyka závisí aj od modelu |
| Sama nájsť problém v kóde | Diagnostika zlyhaných úloh, vyhľadanie relevantných ciest, denná rotujúca analýza troch zdrojových súborov | `TRINITY_AUTO_IMPROVE=true`, GitHub token a Workers AI |
| Prístup na web | `web_fetch` číta verejný text/HTML/JSON priamo z cloudu, kontroluje DNS a presmerovania | Plugin Web zapnutý; platia kvóty, časové a veľkostné limity |
| Domény | Vyhľadanie názvov, čerstvá cenová kontrola, registrácia, stav registrácie, import DNS zón | Cloudflare Registrar Write, defaultný registrant, podmienky a platobný profil |
| Vytváranie subdomén | CNAME pod synchronizovanou DNS zónou | Cloudflare DNS Edit a existujúca zóna |
| Hosting | Studio projekt → samostatný Worker → workers.dev URL; privátny prístup cez samostatný Bearer kľúč | Cloudflare Workers Scripts Write, R2 a Studio projekt |
| MCP aplikácie | Existujúci `/mcp` rozšírený o vývojové nástroje a `ui://trinity/control.html`; panel má aj textový fallback | Klient s podporou MCP Apps pre vizuálny panel |
| Poriadok v súboroch | Surové multipart exporty presunuté do `Archive/cloudflare-exports/`, duplicitné koreňové SQL do archívu; `npm run inventory` | Aktívny kód zostáva v `Trinity/src`, root `src/` zachováva kompatibilitu |

## Oprávnenia a dôkazy

Trinity operuje na delegovanom Cloudflare/GitHub účte vlastníka. Nemá vlastnú právnu identitu, platobnú kartu ani nezávislý registračný účet.
Registrácia vyžaduje konkrétny názov, `purchase_confirmed=true`, menu a `max_price`; cena sa overuje tesne pred volaním registračného API. `202/in_progress` nie je dokončená registrácia. Ručne zaevidovaná doména zostáva pending a nemá vymyslený dátum exspirácie ani nameservery.

Worker Secrets (hodnoty sa necommitujú):

- `TRINITY_GITHUB_TOKEN`: prístup iba k potrebnému repozitáru, Contents Read/Write a Pull requests Read/Write; Actions Write pre spustenie development deploy workflow. Checks Read a možnosť zlúčenia sú potrebné pri automatickej integrácii.
- `CF_API_TOKEN` alebo `CLOUDFLARE_API_TOKEN`: iba potrebné Registrar, DNS a Workers oprávnenia pre správny účet.
- `TRINITY_HOSTING_ACCESS_KEY`: najmenej 32 náhodných znakov; používa sa len pre privátne hosťované weby, nie ako prihlasovací kľúč jadra Trinity.

Konfigurácia zapína automatické návrhy. Automatické zlučovanie je obmedzené na UI a dokumentáciu, vyžaduje zelené kontroly presného commitu a rešpektuje GitHub rulesety. Zdrojový kód, autentifikácia, CI, migrácie a nasadzovanie nepodliehajú automatickému zlúčeniu.
Denná analýza je limitovaná jedným modelovým skenom za 24 hodín; nepredstiera neobmedzenú kapacitu.

## Build a nasadenie

`npm --prefix Trinity test` zostaví aj MCP App pred Wrangler bundlom. `npm --prefix Trinity run deploy:development -- --tag COMMIT_SHA` a `npm --prefix Trinity run deploy -- --tag COMMIT_SHA` rovnako zostavia potrebné UI zdroje.
GitHub workflow najprv testuje a nasadzuje vývoj. Kontrola po deployi vyžaduje zhodu verzie aj `deployment.tag` s konkrétnym commitom; samotné HTTP 200 starej verzie nestačí.
Produkcia zostáva pod existujúcim production Environment a výslovnou voľbou vo workflow alebo nastavenou repository premennou.

Pri návrate verzie použi predchádzajúci overený Cloudflare Version ID. Pri tejto zmene nepribudla D1 migrácia. Návrat kódu nevracia nákup domény ani externú infraštruktúrnu operáciu.

## Stav overenia pri príprave

Lokálne testy a audit sú uvedené v PR a finálnom výsledku. Živá registrácia, hosting, GitHub opravy generované Workers AI a vizuálne zobrazenie v konkrétnom MCP hoste potrebujú samostatný živý dôkaz; mock testy tento dôkaz nenahrádzajú.
Priamy Cloudflare deploy v prípravnom prostredí nemá token. Posledný kontrolovaný GitHub CI job pre main `1da8bb1` skončil failure bez runnera a bez krokov. Nie je označený ako úspešný build.
Produkčný `/health` počas prípravy hlásil 10.2.0; zdrojové vydanie 10.3.0 sa nesmie označiť za živé bez následnej kontroly.

## Ďalšie odporúčané moduly

1. Release Guardian: overenie API, databázy a PC Bridge po deployi, merateľný canary a automatický návrat kódu.
2. Capability Doctor: dôkazový test každého konektora, detekcia expirovaných poverení a konkrétny postup opravy.
3. Project Librarian: priebežný inventár súborov a verzií, kontrola odkazov a archivácia len potvrdených nepoužívaných kópií.
