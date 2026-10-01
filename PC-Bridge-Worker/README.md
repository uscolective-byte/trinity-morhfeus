# Trinity PC Bridge Worker

Bezpečný Cloudflare Worker medzi jediným orchestrátorom Trinity a lokálnou bránou v počítači.

- Durable Object uchováva heartbeat a životný cyklus systémových akcií.
- Worker-to-Worker komunikácia používa interné Cloudflare RPC service binding.
- Verejný endpoint povoľuje iba `GET /health`.
- `POST /v1/heartbeat` a `GET /v1/status` vyžadujú secret `BRIDGE_KEY`.
- Worker priamo nespúšťa ľubovoľné príkazy. Vykonanie zostáva v Local Gateway a v jej allowliste.

Kontrola: `npm test` a `npm run build`.
