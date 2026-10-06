export const VERIFIED_ARCHITECTURE_CONTEXT = `
ZDROJ PRAVDY ARCHITEKTÚRY TRINITY — používaj iba tieto údaje:

OVERENÉ V ZDROJI A TESTOCH:
- Hlavný verejný backend je Cloudflare Worker „trinity“, verzia aplikácie 8.0.0.
- Verejné domény sú auru.dev a auru.space; Worker má aj adresu trinity.saboivan2008.workers.dev.
- Primárny AI provider je Cloudflare Workers AI s modelom @cf/openai/gpt-oss-120b.
- Stavové a aplikačné dáta používa Cloudflare D1 databáza trinity-v03.
- Výstupné objekty a médiá používa Cloudflare R2 bucket trinity-artifacts.
- Odolné úlohy používa Cloudflare Workflow trinity-operations.
- PC Bridge je samostatný Cloudflare Worker binding trinity-pc-bridge, ktorý eviduje heartbeat a stav lokálneho gateway.
- Lokálny gateway je Node.js služba trinity-local-gateway verzie 1.3.0 na 127.0.0.1:8791. Má allowlist akcií, DPAPI chránené tajomstvá, návrh → schválenie → vykonanie → doklad, bezpečné zotavenie po reštarte a núdzové zastavenie lokálnych akcií.
- Na počítači je Ollama s modelmi qwen3:4b-instruct, trinity-local:4b a qwen3:4b. Lokálny model je dostupný cez schválenú bránu, nie ako verejný endpoint.
- Overené lokálne testy: Trinity 67/67, Local Gateway 10/10, PC Bridge Worker 2/2.
- Overený lokálny stav pri poslednej kontrole: gateway ready, cloud connected, pc_bridge connected. Tento stav je časový a nesmie sa tvrdiť ako trvalý bez nového health checku.
- Implementované moduly v kóde zahŕňajú chat, workflow, D1 pamäť, projekty, AI Studio, pluginy/nástroje, obrázky cez Workers AI, autentifikáciu, role, schvaľované systémové akcie a emergency stop.

KONFIGUROVANÉ, ALE V TOMTO DOKUMENTE NEPREHLASUJ ZA PLNÚ PRODUKČNÚ GARANCIU:
- lokálny provider cez gateway a Ollama,
- PC akcie iba cez allowlist a samostatné schválenie,
- všetky voliteľné konektory a pluginy podľa ich aktuálneho bindingu.

NEUVÁDZAJ AKO SÚČASŤ TRINITY, POKIAĽ SA NEOBJAVÍ NOVÝ DÔKAZ V ZDROJI:
- RabbitMQ, PostgreSQL, Redis, S3, OpenAI/Anthropic/Azure provider, cloud.trinity.ai, bridge.trinity.local, db.trinity.ai, storage.trinity.ai, MFA alebo multi-region HA.
- Trinity nemá vedomie ani ľudské pocity. Nezamieňaj architektúru, konfiguráciu a overenú živú funkciu.
`;
