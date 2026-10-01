# Trinity na Cloudflare

Produkčné operačné centrum jednej osobnej asistentky Trinity. Verejný chat používa jednu identitu; 40 interných špecializácií, dva AI poskytovatelia a nástroje zostávajú v pozadí.

## Google účty a schvaľovanie profilov

Google login je implementovaný, ale zámerne sa nezapne, kým nie sú nastavené OAuth credentials. Admin allowlist (`TRINITY_ADMIN_EMAILS`) obsahuje `saboivan2008@gmail.com`, `usc31@auru.space`, `uscolective@gmail.com` a `delirium.trade12@gmail.com`. Google musí vrátiť overenú zhodu e-mailu; admin rola sa nastavuje iba podľa tohto allowlistu.

Po nakonfigurovaní Google OAuth sa ostatné overené Google účty môžu zaregistrovať do stavu `pending`. Admin ich schváli alebo zamietne v technickom centre v sekcii Používateľské účty. Každá session sa pri požiadavke kontroluje voči aktuálnemu stavu a role v D1.

Pred prepnutím produkcie na Google-only režim:

1. V Google Cloud vytvor OAuth Client typu Web application a pridaj autorizovaný redirect URI `https://auru.dev/api/auth/google/callback`.
2. Nastav `GOOGLE_CLIENT_ID` ako Worker variable a ulož iba `GOOGLE_CLIENT_SECRET` cez `npx wrangler secret put GOOGLE_CLIENT_SECRET` v priečinku `Trinity`; secret nevkladaj do repozitára.
3. Skontroluj `GOOGLE_REDIRECT_URI=https://auru.dev/api/auth/google/callback` a až po otestovaní nastav `TRINITY_AUTH_MODE=google` ako Worker variable.
4. Najprv otestuj Google login a admin účet na stagingu. V Google-only režime sa prístupový kľúč a jednorazové legacy linky odmietnu.

Bez týchto credentials zostáva Google tlačidlo skryté a doterajší prihlasovací režim sa nemení.

Trinity má stálu komunikačnú osobnosť a rozhodovací proces `kontext → plán → nástroje → kontrola dôkazov → odpoveď`. Nie je vydávaná za vedomú ani živú bytosť. Pri tvrdeniach o vykonanej externej akcii platí režim dôkazov: bez potvrdenia schváleného nástroja odpoveď takú akciu nesmie označiť za hotovú.

## Živé adresy

- Chat: <https://auru.dev/>
- Pokročilé centrum: <https://auru.dev/ops>
- Worker: <https://trinity.saboivan2008.workers.dev/>
- MCP: `POST https://auru.dev/mcp` (vyžaduje autorizáciu)

## Ako Trinity pracuje

1. Bežná konverzácia ide priamo cez jednu identitu Trinity.
2. Pracovný príkaz sa automaticky rozdelí na odolné kroky v Cloudflare Workflow.
3. Interné špecializácie pripravia plán, vykonajú odbornú časť a skontrolujú výsledok.
4. Posledný krok zjednotí odpoveď do jedného hlasu Trinity.
5. Stav a konverzácia sa ukladajú do D1; úplný výstup pracovnej úlohy sa archivuje v R2.

```text
auru.dev chat
    -> Worker trinity
        -> autentifikácia + limity
        -> D1 pamäť a história
        -> Cloudflare Workflow
            -> Ollama alebo Workers AI
            -> povolené nástroje
            -> kontrola výsledku
        -> R2 artefakt
```

## Zapojené Cloudflare služby

- Worker `trinity`
- Workflow `trinity-operations`
- D1 `trinity-v03`
- R2 `trinity-artifacts`
- KV `Mastermind`
- Workers AI
- Secrets Store pre Ollama API kľúč
- tri zachované Durable Objects
- interné service bindings pre existujúce Trinity/Aura Workery

## Schopnosti

- slovenský a anglický chat
- trvalá pamäť s označením pôvodu
- čítanie projektov a úloh
- webový výskum
- presné výpočty a analýza textu
- kontrola dostupnosti interných služieb
- MCP nástroje: `list_agents`, `dispatch_task`, `get_task`, `search_memory`, `check_services`
- bezpečný návrat z Ollama na Workers AI pri výpadku primárneho modelu
- AI Studio: generovanie kompletného webu, živý sandboxovaný náhľad, iterácie, verzie v D1/R2 a export HTML
- samostatná sekcia Nastavenia s prepínaním voliteľných modulov
- privátne systémové operácie cez lokálnu bránu, samostatné schválenie a auditné potvrdenie
- stála osobnosť uložená v D1, bez predstierania vedomia alebo biologických emócií
- automatická blokácia nepodložených tvrdení typu „nasadila som“, „vymazala som“ alebo „overila som“
- potvrdenia nástrojov s identifikátorom, časom a typom účinku

## Nainštalované moduly

Všetkých 11 modulov je súčasťou jadra Trinity a ich stav je uložený v D1: pamäť, projekty, webový výskum, strážca služieb, výpočty, analýza textu, čas a dátum, katalóg schopností, strážca pravdivosti, MCP most a archív výstupov. Nejde o samostatné osobnosti; sú to nástroje jednej Trinity. Strážca pravdivosti a archív sa nedajú vypnúť cez rozhranie.

## Bezpečnostné hranice

- tajomstvá nie sú v zdrojovom kóde ani vo Wrangler konfigurácii
- všetky súkromné API a MCP vyžadujú autorizáciu
- požiadavky z cudzieho originu sú blokované
- vstupy majú schémy, limity veľkosti a rýchlostné limity
- SQL dotazy používajú parametre a nástroje majú pevný zoznam povolení
- starý verejný SQL executor je vyradený
- pamäť sa považuje za nedôveryhodný kontext, nie za systémový príkaz
- automatický self-write jadra nie je povolený; zmena kódu sa nasadzuje až po výslovnom schválení
- stará pamäť, plán ani dostupná konfigurácia sa nepovažujú za dôkaz vykonanej akcie

## Lokálne overenie

```powershell
npm install
npm run types
npm run build
npm test
```

## Nasadenie

```powershell
npx wrangler d1 migrations apply DB --remote
npm run deploy
```

Aktuálna verzia 6.7.0 prešla 37 automatizovanými testami. Obsahuje stálu osobnosť, režim pravdy, 11 nainštalovaných modulov, AI Studio builder a privátnu lokálnu bránu prepojenú s Workerom `trinity-pc-bridge` cez interné Cloudflare RPC. Živé overenie Studia je v `verification/studio-live.json`; lokálny model a desktopový bridge sú overené v `verification/pc-bridge-live.json`.

Aktuálny Cloudflare Version ID: `e1999413-7972-46fd-ab30-4dce85a3a9d2`.
