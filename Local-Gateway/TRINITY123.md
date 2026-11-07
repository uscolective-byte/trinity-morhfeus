# Trinity — OpenAI agent v skutočnom projekte

Aktualizácia 1. novembra 2026. Pôvodný uložený agent `trinity123` sa teraz volá **Trinity**. Jeho ID ostáva `agent_1aaaff96407d4cf78c03ec66862a88d6297656902a1f417293`, projekt `proj_FdhrNRLpsRia3MexJI7LigsV`. Model je `gpt-6-astra`, reasoning `max`/`auto`, text `text`/`medium`; pôvodný web search, local_tool_execute a multi-agent nastavenia zostali zachované.

## Kde sa používa

- `SPUSTIT-TRINITY-AGENT.cmd` otvorí existujúci lokálny chat s providerom **Trinity · OpenAI agent**.
- `npm run trinity:agent -- doctor` overí lokálnu konfiguráciu bez modelového volania.
- `npm run trinity:agent -- start "Správa"` spustí skutočnú Agents API reláciu cez systémový curl.
- Local Gateway má autentifikované rozhranie `/api/agents/trinity`; starší alias `/api/agents/trinity123` zostáva kompatibilný. Nové routy potrebuje načítať nový gateway proces.
- Lokálny chat používa rovnaký runtime a serverové poverenia, uchováva remote session ID a streamuje udalosti. Pri chybe OpenAI nemení model za iný a neoznačí úlohu za úspešnú.

## Poverenia a dostupné adaptéry

Hodnoty sa nevkladajú do promptov, chatu, Git ani tejto dokumentácie. Agent má iba serverové nástroje a metadáta.

| Poverenie | Uloženie a použitie | Overenie 1.11.2026 |
| --- | --- | --- |
| OPENAI_API_KEY | Ignorovaný `Local-Gateway/.env`, načíta sa pri štarte | GET a aktualizácia saved agenta úspešné; inference blokuje nulový kredit |
| TRINITY_LOCAL_TOKEN | Existujúci Windows DPAPI súbor | Autentifikovaný lokálny stav a skutočné čítanie súboru s kontrolou SHA-256 |
| TRINITY_GATEWAY_KEY | Existujúci Windows DPAPI súbor; používa ho cloud link gateway | Poverenie existuje; bežiaci gateway hlásil connected, nejde o nové poverenie modelu |
| TRINITY_MCP_API_KEY | Existujúca spoločná serverová konfigurácia | Autentifikovaný MCP zoznam a skutočný diagnostic_ping s dokladom |
| CLOUDFLARE_API_TOKEN | Existujúca spoločná serverová konfigurácia | Oficiálny endpoint potvrdil active; nie všetky možné oprávnenia |
| CLOUDFLARE_ACCESS_CLIENT_ID | Existujúca spoločná serverová konfigurácia | Nakonfigurované; samostatná platnosť sa týmto testom nepotvrdila |
| CLOUDFLARE_ACCESS_CLIENT_SECRET | Existujúca spoločná serverová konfigurácia | Nakonfigurované; samostatná platnosť sa týmto testom nepotvrdila |

Nový function tool `trinity_access` sprístupňuje inventár bez hodnôt, schémy povolených cloudových nástrojov, skutočné MCP volania a overenie CF tokenu. Cloudový adaptér povoľuje iba explicitný zoznam čítacích/diagnostických nástrojov. Nedáva modelu IAM administráciu, platobné oprávnenia ani nekontrolovaný deploy. Zápisy cez lokálny most ostávajú viazané na existujúce schvaľovanie.

## Kontext a pravidlá pravdivosti

Pokyny obsahujú pôvodnú konfiguráciu, pravidlá dokazovania a orientáciu v repozitári. Agent si relevantné dokumenty načíta autentifikovaným nástrojom. Nie je pravda, že sa tým naučil všetky súbory alebo že je neomylný.

`turn_status`, výsledok nástrojov a text modelu sú oddelené. Failed/pending nástroj sa nesmie zmeniť na úspech po dokončení modelu. Výsledky sa ukladajú pred doručením podľa session/turn/call ID; nejasná rozpracovaná akcia sa naslepo neopakuje. Pri čítaní súboru sa kontroluje hash obsahu. `output_verified:false` označuje prirodzený text modelu ako samostatne neoverený.

## Aktuálna prevádzková prekážka

Prvá živá relácia bola API prijatá, potom skončila na organizačnom usage/billing limite. API kredit bol 0 USD. Schválený jednorazový nákup 10 USD kreditu + 2.30 USD dane bol bankou zamietnutý pre insufficient funds; nákup sa neopakoval. Automatické dobíjanie bolo na výslovný pokyn vypnuté. Živá úspešná odpoveď a hosted file proof preto zatiaľ nie sú overené. Neúspešná testovacia relácia bola odstránená, uložený agent zostáva.

Testy integrácie: Local Gateway 54/54, Local Desktop 24/24. Skutočný cloudový doklad: `DIAG-RCPT-MVY1TXWZ-93B8C6F4`. Táto lokálna zmena nebola nasadená do Cloudflare produkcie. Správa budúceho kreditu je oddelená od kódu a nevyžaduje vytvoriť ďalší API kľúč.

## Príkazy a uložené dôkazy

V kanonickom repozitári:

```powershell
npm.cmd run trinity:agent -- doctor
npm.cmd run trinity:agent -- start "Ahoj Trinity"
npm.cmd run trinity:agent -- message SKUTOCNE_SESSION_ID "Pokračuj"
```

API kľúč sa načíta zo schváleného ignorovaného Local-Gateway/.env. Lokálny token sa odomkne z existujúceho Windows DPAPI úložiska. Žiadny kľúč nepridávaj do promptu. Samostatný prenosný balík neobsahuje poverenia.

Dôkazy v tomto výstupnom priečinku: saved-agent-verification.json, access-verification.json, diagnostic-live-verification.json, live-session-verification.json, failed-session-cleanup.json a billing-auto-reload-off.png. Starší verification-local.json zachytáva predchádzajúcu izolovanú skúšku bez kľúča; nie je aktuálnym tvrdením o chýbajúcej konfigurácii.

Priamo OpenAI API volá systémový curl bez SDK, Authorization ide cez stdin. Hosted executor spravuje OpenAI. Streamy a doklady sa ukladajú v ignorovanom data/trinity123; po odpojení sa vstup automaticky neopakuje. Spoločný gateway na 8791 zostal zachovaný; existujúci proces načíta nové agent routy až pri svojom riadnom reštarte. Local Desktop používa rovnaký runtime priamo a bol spustený s novým kódom.