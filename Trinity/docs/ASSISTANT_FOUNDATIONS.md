# Prvý balík jadra Trinity

## Rozsah

Tento balík rozširuje existujúcu Trinity 9.4.0. Nevytvára paralelnú identitu,
nenahrádza fungujúce GPT pripojenie a nemení autorizáciu ani schvaľovanie.

- **Pracovný plánovač:** dôveryhodný vstavaný plugin `task-planner`, nástroj
  `plan_work`. Vracia plán, riziko a kontrolné podmienky. Výstup explicitne
  označuje ako nevykonaný plán; neposkytuje oprávnenia.
- **Pamäť:** vyberá relevantné pojmy vrátane krátkych technických názvov,
  uprednostňuje profily a relevantné záznamy, odstraňuje duplicity. Zachováva
  pôvod a dostupný čas aktualizácie. Maskuje bežné tvary credentialov
  vo výsledku vyhľadávania a kontexte modelu, nie v uloženom origináli.
- **Skills:** pracovná pamäť, obnova integrácií a zrozumiteľná komunikácia
  majú konkrétne postupy a kontrolné podmienky. Skills neudeľujú nové oprávnenia.
- **Komunikácia:** výsledok pred technickým protokolom, jeden potrebný krok
  používateľa, žiadne automatické opakovanie odmietnutého pripojenia.
- **MCP:** `trinity_status` používa skutočný readiness check a register pluginov.
  Explicitne uvádza, že PC prístup neoveril. Funguje aj pre obmedzený
  `mcp:read` token, ktorý nemá prístup k súkromnému admin API.

Maskovanie nie je úplný DLP systém. Pamäť nie je úložisko tajomstiev; skutočné
credentials patria do existujúceho vaultu/Secrets. Súčasný model spoločnej pamäte
sa v tomto balíku nemení na per-user izoláciu.

## Posúdenie dvoch navrhnutých MCP serverov

### Lokálny Node.js variant

Stdio transport je použiteľný pre lokálnych MCP klientov. Ukážka však
neimplementuje SSE ani HTTPS endpoint, takže sama nepripojí Notion k LAN IP.
Neobmedzený `fs.readFileSync(filepath)` sprístupňuje ľubovoľné súbory procesu;
chýba koreň workspace, kontrola traversal/symlinkov, blokácia tajomstiev a limit
veľkosti. Pevné `ONLINE` a `ROOT_ADMIN` nie sú dôkazom stavu alebo identity.

Použiť existujúci lokálny adapter a allowlisty Gateway namiesto novej voľnej
filesystem služby. Nenastavovať port forwarding ani verejný neautorizovaný most.

### Cloudflare Worker variant

`SSEServerTransport` z uvedeného SDK očakáva Node `ServerResponse`, nie callback
alebo Fetch `Request`. Má `handlePostMessage`, nie použitú metódu `handleRequest`.
Chýba obsluha `/mcp/messages`, autorizácia a skutočné overenie databázy.
Názov Workera, domény, verzia a bindingy nezodpovedajú aktuálnemu projektu.

Použiť existujúci Worker `trinity`, `/mcp` a `createMcpHandler`. Cloudflare/Notion
pripojenie stále vyžaduje samostatnú bezpečnú autorizáciu; HTTP 200 ani tento
balík ju nenahrádzajú. Kód sa nekopíruje do Notion stránky ako spustiteľný server.

## Overenie a zavedenie

`npm test` v priečinku `Trinity` vykoná dry-run build a všetky testy.
Balík bol overený so 118 úspešnými testami. SDK transport bol overený lokálne;
na používateľovom Windows PC tento balík ešte nebol spustený.

Nový plugin sa v testovacej databáze nainštaluje migráciou
`0029_assistant_foundations.sql`. Migrácia nevynucuje zmenu existujúceho
nastavenia rovnakého pluginu a nemaže pamäť.

Pred produkčným zavedením:

1. Skontrolovať výsledky CI a vyriešiť existujúce blokátory účtu/preview.
2. Potvrdiť zdrojový commit, rollback a pending migrácie.
3. Zaviesť migráciu a otestovaný build v kontrolovanom release.
4. Overiť register pluginov, `plan_work`, autorizovaný `trinity_status`
   a odmietnutie neautorizovanej požiadavky.

Uloženie tohto balíka na GitHub samo osebe neznamená, že je nainštalovaný
v produkcii alebo že Notion, Gemini či Copilot získali prístup k PC.