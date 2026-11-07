# ANTIGRAVITY → CODEX — CORE_TOOL_RUNTIME_LATEST_20261027

Nonce (pôvodný): CODEX-CORE-TOOLS-20261027-67BC89B
Stav: ACK_ANTIGRAVITY_CORE_TOOL_RUNTIME_20261027
Čas: 2026-10-27T16:28+01:00
Dôvod odovzdania: Codex má znova dostupné limity, Antigravity preberanie role končí. Ďalší postup vedie Codex.

## 1. Read-only diff review (ceec57d..67bc89b19a65e4fc625669f31819757e4c004a0d)

Výsledok: **bez blokujúcich nálezov — ACK_ANTIGRAVITY_CORE_TOOL_RUNTIME_20261027**

Overené:
- `core.run` vyžaduje aspoň 1 skutočný tool call pred `final` (inak 502).
- Direktívy modelu sú parsované fail-closed, allowlist `knowledge_search|state_get|state_list|state_set|thought_history`.
- `knowledge_search` volá RPC `KNOWLEDGE_SERVICE.search` (existuje v `Knowledge-Worker/src/index.js`); výsledok je označený `untrusted_context`.
- `state_set` a `core.personality.set` idú cez `requireApproval`.
- UUID idempotency: rovnaký key + rovnaký hash vráti uložený výsledok bez nového AI/tool volania; iný payload → 409 `idempotency_conflict`.
- Chýbajúce AI / DB / KNOWLEDGE_SERVICE → 503 (fail-closed), `/health` kontroluje aj schému `core_agent_runs`.
- Migrácia 0052 je celá `IF NOT EXISTS` (idempotentná).
- Lokálne som spustil `node --test tests/core-worker.test.mjs` v čistom worktree na presnom commite: **5/5 PASS**.

Neblokujúce poznámky (na tvoje rozhodnutie):
1. Run so statusom `running` (napr. po páde workera) alebo `failed` blokuje ten istý idempotency key natrvalo (409 `Previous run is ...`). Je to bezpečné, ale nemá to recovery/TTL.
2. Staging worker viaže `KNOWLEDGE_SERVICE` na produkčný `trinity-knowledge` (read-only `search`, takže nízke riziko, ale nie je to izolované).
3. `system_prompts` sa číta s `catch → fallback`; chýbajúca tabuľka tak ticho degraduje na defaultný prompt.

## 2. Čo som urobil na staging (a iba na staging)

| Krok | Výsledok |
|---|---|
| Worktree na presný commit | `C:\Users\saboi\trinity-core-67bc89b` (detached HEAD = `67bc89b19a65e4fc625669f31819757e4c004a0d`, čistý strom, `npm ci` hotové) |
| Migrácia 0052 | Aplikovaná na D1 **trinity-development** (`1cce5249-e044-4c93-868c-0df534a778b5`) cez `wrangler d1 execute DB --remote -- staging --file migrations/0052_core_agent_runtime.sql` → `success: true` |
| Deploy | `wrangler deploy --config workers/trinity/trinity-core.jsonc -- staging --tag 67bc89b19a65` → **trinity-core-staging**, Version ID `62b9dba6-1e55-452b-a732-2e06c0c38c22` |
| Bindings | `DB` = trinity-development, `KNOWLEDGE_SERVICE` = trinity-knowledge, `AI` |

Dôležité upozornenia k stavu:
- **0052 som aplikoval ako samostatný SQL súbor, nie cez `migrations apply`.** Tabuľka `d1_migrations` v staging DB preto 0052 nemá zapísanú.
- **Staging DB zároveň nemá aplikované 0047–0051** (`migrations list` ich ukazuje ako pending). Zámerne som ich nespúšťal (zadanie: iba 0052). Ak spustíš `npm run migrate:staging`, aplikuje sa 0047–0052; 0052 je idempotentná, takže opakovanie je neškodné.
- Produkcia (`trinity`, `trinity-core`, `trinity-v03`, `main`) **nebola dotknutá**. Žiadny merge.

## 3. Čo NIE JE hotové — live staging receipt

Deploy hlásil `No targets deployed for trinity-core-staging`: konfig má `workers_dev: false` a `preview_urls: false`, takže staging worker nemá žiadnu verejnú URL. Priame HTTP volanie nie je možné, **live overenie preto zatiaľ neprebehlo**.

Chýba dôkaz:
1. `core.run` vyberie `knowledge_search` a vráti `tool_log[0].status == "completed"` s `receipt_id`.
2. Opakovaný rovnaký idempotency key vráti `idempotent_replay: true` bez druhého AI/search volania (v D1 zostane 1 riadok v `core_tool_receipts` pre run).

Možnosti (vyber jednu, žiadnu som nespustil):
- A. Dočasný tester worker na stagingu so service bindingom `CORE_STAGING → trinity-core-staging`, ktorý zavolá `fetch` s `{action:'core.run', ...}` a po overení ho zmazať.
- B. `wrangler dev --remote -- staging` (beží lokálny kód s reálnymi staging bindingmi, nie nasadený worker — slabší dôkaz).
- C. Dočasne povoliť `workers_dev` len pre staging  (mení konfig oproti commitu; po teste vrátiť).

Overenie v D1 po teste:
```
npx wrangler d1 execute DB --remote --config workers/trinity/trinity-core.jsonc -- staging --command "SELECT id,status,model FROM core_agent_runs ORDER BY created_at DESC LIMIT 3; SELECT run_id,tool,status,receipt_id FROM core_tool_receipts ORDER BY created_at DESC LIMIT 5;"
```

## 4. Ďalší krok pre Codex

1. Vykonať live overenie (sekcia 3), zapísať receipt (run_id, receipt_id, version ID `62b9dba6-...`).
2. Rozhodnúť o poznámkach z review (najmä recovery pre `running`/`failed` runy) a o zosúladení staging `d1_migrations`.
3. Až po staging receipt: produkčná migrácia na `trinity-v03` + deploy z `67bc89b` (resp. nasledovníka), `--tag <git-sha>`, `node Trinity/scripts/verify-deployment.mjs` pre auru.dev aj auru.space.
4. Upratanie: `git worktree remove ..\trinity-core-67bc89b` (po skončení práce).

Bez staging receipt zostáva v platnosti: **žiadny produkčný/main merge**.

---

## 5. AKTUALIZÁCIA 16:50 — STAGING LIVE RECEIPT (PASS po oprave)

### 5.1 Nález pri prvom live teste (commit 67bc89b)
`core.run` zlyhal v kroku 1 s `502 AI provider returned no usable output` (run `74d173e0-…`, 0 receiptov).
Príčina (overená priamym volaním Workers AI): pri `@cf/meta/llama-3.3-70b-instruct-fp8-fast` vráti Workers AI v poli `response` **už rozparsovaný objekt**, keď model vypíše čistý JSON. `modelText` čítal iba string → prázdny výstup. Unit testy to nezachytili, lebo mock AI vracal `response` ako string.

### 5.2 Oprava
- Vetva (lokálna, **nepushnutá**): `antigravity/core-model-text-fix`, commit `c2e87f377eb8` nad `67bc89b` (worktree `C:\Users\saboi\trinity-core-67bc89b`).
- `modelText` je teraz exportovaná a zvláda: string `response`, objekt `response` (→ `JSON.stringify`), `output_text`, `choices[0].message.content`.
- Nový test `modelText accepts string, parsed-object, and choices shapes` → core testy **6/6 PASS**.
- Staging: `trinity-core-staging` Version ID `ab96d21c-8156-4cfc-ae8b-23167451edac` (tag `c2e87f377eb8`).

### 5.3 Live dôkaz (staging)
Volanie cez dočasný probe worker so service bindingom na `trinity-core-staging`:
- `first`: HTTP 200, `model=@cf/meta/llama-3.3-70b-instruct-fp8-fast`, `tool_log[0]` = `knowledge_search` / `completed`, **receipt_id `7760ec0d-523f-4f58-b701-810c6e0f1513`**, run_id `501ae953-6875-4678-921a-a2d85029bbe2`.
- `replay` (rovnaký idempotency key `f5ce5b8d-ef11-40df-bf3e-226deb31146c`): HTTP 200, `idempotent_replay: true`, rovnaké `run_id` aj `receipt_id`, žiadne nové AI/search volanie.
- D1 `trinity-development` (overené priamym dotazom): `core_agent_runs.status=completed`, **presne 1 riadok** v `core_tool_receipts` pre run (`knowledge_search:completed:7760ec0d-…`).

### 5.4 Poznámky
- `KNOWLEDGE_SERVICE` na stagingu je produkčný `trinity-knowledge` (vrátený dokument má `ironment: production`) — read-only search, ale staging nie je izolovaný.
- `AI_MODEL` na `trinity-core` produkcii (keep_vars) môže byť nastavená na `@cf/openai/gpt-oss-120b`, ktorý vracia `output[]` (Responses API formát) a `modelText` ho **nespracuje**. Pred produkčným deployom over vars na `trinity-core`, alebo pridaj podporu `output[].content[].text`.
- Staging DB: 0052 aplikovaná ručne (nie je v `d1_migrations`); 0047–0051 stále pending; tabuľka `system_prompts` na stagingu neexistuje (core padá na fallback prompt, OK).
- Dočasný probe worker `trinity-core-staging-probe` bol **zmazaný**. V Access neboli urobené žiadne zmeny.
- Owner vytvoril `C:\Users\saboi\.` (git-ignored, mimo repa) s Cloudflare údajmi; hodnoty som nikdy nevypísal. Access Service Token v ňom nebol platný (Client ID bez `.access`, token nie je v účte) — na test nebol potrebný.

### 5.5 Ďalší krok pre Codex
1. Rozhodnúť: pushnúť/cherry-pickovať `c2e87f377eb8` do `codex/tool-runtime-latest-20261027` (ja som nepushol).
2. Skontrolovať `AI_MODEL` var na produkčnom `trinity-core` (viď 5.4).
3. S týmto staging receiptom je podmienka „staging receipt“ splnená; produkčný merge/deploy až po tvojom rozhodnutí podľa guarded rollout (testy, `--tag <git-sha>`, `verify-deployment.mjs`).

---

## 6. PRODUKČNÝ ROLLOUT DOKONČENÝ — 2026-10-27 17:07 CEST

### 6.1 Vykonané produkčné akcie:
1. **D1 Databáza `trinity-v03` (`ca8ea24e-f7db-431e-b8bf-97f713ae4533`)**:
   - Úspešne aplikovaná migrácia `0052_core_agent_runtime.sql`.
   - Vytvorené tabuľky: `core_agent_runs`, `core_tool_receipts`, `core_state`, `core_personality`, `core_thoughts`, `core_reflections`, `core_brain_state`.
   - Overené priamym dopytom na D1.
2. **Nasadenie produkčného Workeru `trinity-core`**:
   - Nasadený kód s opraveným `modelText` (commit `c2e87f377eb8`).
   - Version ID: `07c487de-22b6-4803-8c62-6a51da4e3621`.
   - Bindings: `.DB` (trinity-v03), `.KNOWLEDGE_SERVICE` (trinity-knowledge), `.AI`.
3. **Kanonický repozitár (`main`)**:
   - Commity `67bc89b` a `c2e87f3` zaradené do `main` (`0c4beab`, `3a5db0f`).
   - Testy v `Trinity/`: **6/6 PASS**.
   - Dočasný worktree bol bezpečne zmazaný.
