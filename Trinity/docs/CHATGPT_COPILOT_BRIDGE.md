# Trinity Assistant Bridge: ChatGPT a Microsoft Copilot

## Účel

Tento balík pripravuje spoločné **poznámky Trinity**, ktoré môže na výslovnú
žiadosť používateľa čítať a upravovať súkromný GPT v ChatGPT aj agent vytvorený
v **Microsoft Copilot Studio**. Nezlučuje účty, nečíta ich súkromnú históriu,
nepripája spotrebiteľskú aplikáciu Copilot a neudeľuje prístup k PC Bridge,
administrácii, nasadeniu ani ľubovoľným MCP nástrojom.

API poskytuje:
- GET /api/assistant-bridge/status (assistant:read)
- GET /api/assistant-bridge/notes (assistant:read, 50 poznámok/strana, voliteľný cursor)
- POST /api/assistant-bridge/notes (assistant:write, kontrola base_revision)

Pri konflikte revízie vracia HTTP 409 a current_revision. Klient musí znovu
načítať poznámku a vedome zosúladiť obsah; nesmie prepísať novšiu revíziu naslepo.
Atribút source označuje len pôvod deklarovaný klientom, **nie** overenú identitu
poskytovateľa. Notes sú oddelené podľa owner_id API kľúčov.

## Bezpečná aktivácia

1. Pripoj sa k súkromnému admin UI Trinity a over prihlasovanie.
2. Spusti testy z Trinity/: npm ci, npm test. Vyhodnoť výsledky CI.
3. Najskôr pre kontrolované vývojové prostredie aplikuj migráciu:
   npx wrangler d1 migrations apply trinity-development --remote --env development
4. Nasaď development (nie production) podľa docs/SINGLE_REPOSITORY.md
   a over release commit a /health.
5. Vlastník vytvorí **dva rozdielne**, časovo obmedzené API kľúče cez
   POST /api/assistant/api-keys, každý so scopes ["assistant:read","assistant:write"].
   Rozsahy mcp:read/mcp:write, api:invoke a admin token nepridávaj.
   API kľúče neposielaj cez chat, neukladaj do Git repozitára.
6. Vytvor súkromný GPT v ChatGPT: Configure > Actions > Create new action.
   Importuj ../openapi/assistant-bridge.yaml a nakonfiguruj API Key v hlavičke
   X-Trinity-API-Key; použi kľúč určený len pre ChatGPT.
7. V Copilot Studio: Agent > Tools > Add a tool > REST API (ak dostupné)
   alebo Custom connector. Importuj rovnakú OpenAPI schému. Pripoj vlastný
   Copilot kľúč cez zabezpečené spojenie. Agenta nezverejňuj verejne.
   Potrebuješ účet a oprávnenie pre Copilot Studio; bežný osobný Copilot nemusí
   podporovať pridanie takéhoto nástroja.
8. V oboch chatoch testuj status, vytvor poznámku (nové UUID,
   base_revision=0), prečítaj ju z druhého, aktualizuj s aktuálnou revíziou
   a over konflikt pri staršej revízii. Až po živom teste označ integráciu
   za funkčnú. Produkčné kľúče vydaj osobitne po schválení produkčného nasadenia.

**Kompatibilita:** oba GPT/agent nástroje používajú rovnakú schému;
default server v OpenAPI je https://auru.dev (development).
Pre produkciu zmeň server URL na https://auru.space až po overenom nasadení.

**Ohraničenie:** volania do GPT Actions a Copilot Studio sú volania na
vyžiadanie, nie obojsmerné kontinuálne prúdenie správ. Konverzácie ChatGPT
a Copilotu zostávajú oddelené. API prístup patrí len vlastníkovi,
ktorý si vedome vytvorí a uloží kľúče.

Oficiálne návody:
- https://help.openai.com/en/articles/9442513-gpt-actions-domain-settings-chatgpt-enterprise
- https://learn.microsoft.com/en-us/microsoft-copilot-studio/advanced-plugin-actions
