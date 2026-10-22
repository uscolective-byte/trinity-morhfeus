# Preview Brain namespace — oprava konfigurácie
## Dôkaz
Používateľ poskytol log Cloudflare buildu 9d084c5b-85a5-4200-a209-41bf1a9bc17f pre commit c25c64e. Node suite: 317 tests, 317 pass, 0 fail. Build command completed. Nasledoval npx wrangler preview --config wrangler.jsonc (Wrangler 4.151.1).
Preview deployment zlyhal kódom 10061: Brain odkazuje na namespace 95f4f252037542b8a346e90756d4daf6, ktorý API nenašlo.

## Úprava
V top-level previews aj env.development.previews sú explicitne deklarované Brain/TrinityAgent, CHAT_AGENT/ChatAgent a GUARDIAN_AGENT/GuardianAgent. Bindingy používajú iba name a class_name bez namespace_id alebo script_name. Preview vars obsahujú TRINITY_ENV=preview a zachovaný TRINITY_PREVIEW_MODE=build-only.

Produkčné aj vývojové durable_objects a exports zostávajú nezmenené. Nepribudla migrácia, premenovanie, odstránenie ani pokus nahradiť existujúci produkčný namespace.

Oficiálne podklady:
- https://developers.cloudflare.com/workers/previews/configuration/
- https://developers.cloudflare.com/workers/previews/resources/
- https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/

Cloudflare vyžaduje previews.durable_objects.bindings pre env bindingy a uvádza samostatné namespaces pre preview. V pôvodnom previews bloku boli iba vars. Chýbajúce bindingy sú opravené; nie je zatiaľ preukázané, že boli jedinou príčinou chýbajúceho namespace.

## Overenie a ďalší postup
JSON konfigurácia je parsovateľná; obe preview sady obsahujú tri očakávané triedy a nemajú pevné namespace ID alebo externý Worker. Produkčné lifecycle deklarácie sa nezmenili. 317 testov platí pre predchádzajúci commit podľa dodaného logu, nie automaticky pre tento nový commit. Plný build a preview overí nový Cloudflare build.

Ak API znovu vracia rovnaký namespace ID, treba cez Cloudflare read-only diagnostiku porovnať existujúce preview, Previews Base a zoznam namespaces. Bez tejto kontroly nemaž produkčné namespaces, nemeň exports na deleted a nezavádzaj náhradné triedy. Opätovné vytvorenie konkrétneho poškodeného preview je samostatný zásah, pretože zahadzuje jeho vlastné dáta; nie je súčasťou tejto opravy.

Úspešný preview deployment nie je produkčný deploy ani dôkaz živého chatu. GitHub runner blokér je samostatný problém.
