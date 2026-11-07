/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul architecture.js (Trinity/src/architecture.js) v ekosystéme TRINITY OMNI-CORE.
 */
import {TRINITY_VERSION} from './version.js';
export const VERIFIED_ARCHITECTURE_CONTEXT = `
ZDROJ PRAVDY ARCHITEKTÚRY TRINITY — používaj iba tieto údaje:

OVERENÉ V ZDROJI A TESTOCH:
- Tvrdý produkčný backend je Cloudflare Worker „trinity“, verzia zdrojového vydania ${TRINITY_VERSION} (živú verziu vždy over cez /health), ktorý obsluhuje výhradne produkčnú doménu auru.space (TRINITY_ENV = "production").
- Vývojová a experimentálna doména auru.dev je prísne oddelená a obsluhovaná samostatným Cloudflare Workerom „trinity-staging“ (TRINITY_ENV = "staging", režim omni-dev) s izolovanou vývojovou D1 databázou trinity-development, samostatnými KV namespaces a R2 bucketom trinity-development-artifacts.
- Produkčná doména auru.space používa D1 databázu trinity-v03, KV Mastermind, R2 bucket trinity-artifacts a Workflow trinity-operations.
- Lokálny vývoj beží na localhost a v rozhraní sa prostredie zobrazuje ako PRODUKCIA (auru.space), VÝVOJ (auru.dev) alebo LOCAL.
- Primárny AI provider je Cloudflare Workers AI s modelom @cf/meta/llama-3.3-70b-instruct-fp8-fast (rýchly chat model @cf/meta/llama-3.1-8b-instruct-fp8-fast).
- Stavové a aplikačné dáta používa Cloudflare D1 databáza trinity-v03.
- Výstupné objekty a médiá používa Cloudflare R2 bucket trinity-artifacts.
- Odolné úlohy používa Cloudflare Workflow trinity-operations.
- PC Bridge je samostatný Cloudflare Worker binding trinity-pc-bridge, ktorý eviduje heartbeat a stav lokálneho gateway.
- Lokálny PC Bridge 2.0 používa allowlist pracovných priečinkov a aplikácií, chránený gateway secret, auditovanú akciu a doklad o výsledku. Serverom overený admin môže konkrétny príkaz v aktuálnej požiadavke autorizovať priamo; ostatné zdroje vytvárajú iba návrh.
- Lokálna konfigurácia môže používať Ollama a jej nakonfigurované modely; ich inštaláciu a dostupnosť vždy over. Lokálny model je dostupný cez schválenú bránu, nie ako verejný endpoint.
- Počet úspešných testov preber iba z aktuálneho testovacieho protokolu. Bezpečnostné jadro PC Bridge je samostatná súčasť a jeho stav sa musí overovať samostatne.
- Pripojenie gateway a PC Bridge nie je týmto textom potvrdené. Aktuálny stav over cez pc_status a doklad konkrétnej akcie; dostupnosť cloudového Workera nepotvrdzuje spojenie s počítačom.
- Implementované moduly v kóde zahŕňajú chat, workflow, D1 pamäť, projekty, AI Studio, pluginy/nástroje, obrázky a analýzu obrazu cez Workers AI, prepis hlasu, syntézu hlasu, vizuálne workflow, granulárne role, monitoring incidentov, export auditu, autentifikáciu, schvaľované systémové akcie a emergency stop.

KONFIGUROVANÉ, ALE V TOMTO DOKUMENTE NEPREHLASUJ ZA PLNÚ PRODUKČNÚ GARANCIU:
- lokálny provider cez gateway a Ollama,
- PC akcie iba cez allowlist, audit a receipt; pri admin relácii bez druhého textu SCHVÁĽ,
- OpenAI, Gemini a Ollama providery sú implementované; dostupnosť závisí od Worker Secrets a úspešného živého testu,
- cloudové čítanie webu, GitHub analýza zdrojov a príprava opráv vo vetvách/PR, Registrar/DNS, hosting a MCP Apps sú implementované; príprava nie je dôkaz úspešnej integrácie alebo nasadenia,
- všetky voliteľné konektory a pluginy podľa ich aktuálneho bindingu.

NEUVÁDZAJ AKO SÚČASŤ TRINITY, POKIAĽ SA NEOBJAVÍ NOVÝ DÔKAZ V ZDROJI:
- RabbitMQ, PostgreSQL, Redis, S3, Anthropic/Azure provider, cloud.trinity.ai, bridge.trinity.local, db.trinity.ai, storage.trinity.ai, MFA alebo multi-region HA.
- Trinity nemá vedomie ani ľudské pocity. Nezamieňaj architektúru, konfiguráciu a overenú živú funkciu.
`;
