# Trinity + OpenClaw + telefón

Lokálny prepojovací skript: Trinity/integrations/openclaw/connect.mjs.
Nie je to potvrdenie nainštalovaného OpenClaw ani aktívneho telefónneho kanála.

OpenClaw sa pripojí k existujúcemu Streamable HTTP MCP endpointu Trinity /mcp. Telefón sa páruje cez WhatsApp QR; Telegram bot je samostatný kanál. Nový Worker pre toto spojenie nie je potrebný.

## Predpoklady
- OpenClaw nainštalovaný a onboardovaný na vlastnom Gateway; na Windows použiť Windows Hub/WSL2.
- Funkčný model v OpenClaw.
- Samostatný Trinity API kľúč s mcp:read a mcp:write, lokálne ako TRINITY_MCP_TOKEN. Gateway služba musí mať tento kľúč aj po reštarte.
- WhatsApp na telefóne a vlastník prítomný pri párovaní.

## Spustenie vo WSL2/Linuxe
node Trinity/integrations/openclaw/connect.mjs
Pre development pridať --development.

Skript si vypýta číslo a potvrdenie normalizovaného čísla. Číslo ani token sa neukladajú do repozitára. Pred zmenou existujúcej konfigurácie vytvorí lokálnu zálohu. Nastaví MCP server s odkazom na premennú prostredia, obmedzí nástroje na stav a vytvorenie/čítanie úlohy, povolí WhatsApp iba potvrdenému číslu a vypne skupiny.

Pri chybe zastaví ďalšie kroky. Už vykonané zmeny automaticky nevracia. Gateway ani model neinštaluje a nespravuje ich trvalé poverenia.

## Overenie
1. MCP probe musí načítať nástroje Trinity.
2. QR pairing musí potvrdiť vlastník na telefóne; channels status --probe musí potvrdiť kanál.
3. Vo WhatsApp požiadať o trinity_status.
4. Konkrétnu úlohu zadať cez dispatch_task; queued ID ešte nie je dokončenie. Overiť get_task so stavom completed.
5. Samotné uloženie konfigurácie nie je test doručenia. MCP kanál automaticky neudeľuje owner-commerce ani finančné oprávnenia.

## Blokér nasadenia
CI pre PR #44 skončilo pred prvým krokom bez runner_name. Bez anotácie z GitHub UI nemožno určiť, či ide o kvótu, fakturáciu, pravidlá Actions alebo iný problém. V tejto relácii nie je dostupný executor ani prístup cez browser extension. Zmena kódu zatiaľ runner problém nevyriešila. Testy sa neodstraňujú.

## Oficiálne zdroje
https://docs.openclaw.ai/cli/mcp/registry
https://docs.openclaw.ai/gateway/config-extensions
https://docs.openclaw.ai/channels/whatsapp
https://docs.openclaw.ai/platforms/windows
