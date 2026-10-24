# Správca chatu Trinity

Jeden súkromný Cloudflare Worker `trinity-chat-maintainer` má rolu `chat-maintainer` pre produkciu aj vývoj. Trinity na oboch doménach ho volá cez binding `CHAT_MAINTENANCE`. Verejná URL ani prístupové tokeny sa nevytvárajú.

Každých päť minút skontroluje najviac 20 aktívnych úloh v každom prostredí. Skončené workflow zosúladí so stavom chatu; úlohu bez zmeny dlhšie než 45 minút najprv ukončí vo Workflows a potom podmienene označí ako neúspešnú. Nové odpovede, dokončené úlohy a súbežné zmeny chráni porovnanie stavu a času aktualizácie. Platby, nákupy, správy ani ostatné nástroje nikdy automaticky neopakuje.

Chybné staré odpovede zostávajú uložené s incidentom v `ops_chat_incidents`. Spoločná kontrola kvality bráni uloženiu prázdnych alebo opakovaných nových odpovedí. Pri nefunkčnom modeli Trinity raz skúsi záložný model.

Admin rozhrania v Trinity:

- `GET /api/assistant/chat/health`: rola, posledná kontrola, incidenty.
- `POST /api/assistant/chat/maintenance`: okamžitá kontrola a oprava s obmedzením frekvencie.
- Nástroj `chat_health`: diagnostika v chate.
- Nástroj `tool_catalog`: vyhľadá povolené zapnuté nástroje a ich presné vstupné schémy; nové oprávnenia neudeľuje.

Migráciu `Trinity/migrations/0047_chat_maintenance.sql` aplikuj na obe databázy pred prvým nasadením. Potom v priečinku Trinity spusti `npm run build:chat-maintainer` a `npm run deploy:chat-maintainer -- --tag COMMIT`. Hlavná konfigurácia je `Chat-Maintenance-Worker/wrangler.jsonc`.

Rýchly režim používa menší model a stručnejší kontext s výberom relevantných nástrojov. Výsledky nástrojov sú viditeľné v pracovnom priebehu; katalogizácia nástroja nepotvrdzuje dostupné poverenia ani úspešné vykonanie.
