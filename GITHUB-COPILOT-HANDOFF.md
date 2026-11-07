# GitHub Copilot — prepojenie a odovzdanie práce

Aktualizované: 2. novembra 2026. Koordinátor: Codex. Príjemca: skutočný
GitHub Copilot v majiteľovom existujúcom IDE alebo GitHub hostiteľovi.

GitHub Copilot je samostatný účastník tímu Codex / Antigravity / Trinity.
Nie je to Microsoft Copilot Studio ani interný `TrinityCopilotAgent`.
Práva poskytuje prihlásený hostiteľ a serverová autorizácia; tento dokument
neudelí runtime scopes, cloudové oprávnenia ani prístup k počítaču.

## Aktuálny stav

| Pole | Hodnota |
|---|---|
| Handoff / task_id | `GITHUB-COPILOT-HANDOFF-20261102-01` |
| run_id | `null` — Copilot ešte nepotvrdil vlastný beh |
| status | `PENDING_COPILOT_ACK` |
| Hostiteľské MCP pripojenie | `HOST_NOT_VERIFIED` |
| Kanonický checkout | `C:/Users/saboi/Trinity-antigravity` |
| Koordinačný základ | `a50c3e26fb8f8d725c39ffad3b234d66785dea3a` |
| evidence | Lokálna konfigurácia a spoločný denník; chýba nový hostiteľský handshake a Copilot-authored ACK |

Záznam `CODEX-RECONNECT-20261102T092931Z` v [TEAM-HANDOFF.md](TEAM-HANDOFF.md)
hlási `BLOCKED_CLOUDFLARE_ACCESS`: HTTP 302 pred MCP handshake na oboch
doménach. Je to existujúci doklad iného overenia, nie čerstvý test tohto
handoffu. Podľa posledného release handoffu patria `auru.space` aj `auru.dev`
k produkčnému Workeru; `auru.dev` nepovažovať za izolovaný staging.

## Existujúce prepojenie podľa hostiteľa

- VS Code má [.vscode/mcp.json](.vscode/mcp.json): servery `trinity` a
  `trinity-development`, HTTPS `/mcp`, autorizácia cez skrytý vstup.
  Konfiguráciu ani názov druhého servera nemeníme. Názov nepreukazuje prostredie.
- Tento kompatibilný VS Code formát je určený pre Local harness. Servery
  používajúce `${input:...}` sa podľa aktuálnej dokumentácie nepreposielajú
  do Copilot harness. Copilot CLI a prenosná konfigurácia majú vlastný formát
  `mcpServers`; nevytvárať duplicitný server ani nekopírovať credentialy.
- GitHub cloud agent používa osobitné repository **Settings → Copilot →
  MCP servers**. Lokálny súbor nepreukazuje jeho nastavenie. Tento handoff
  nemení nastavenia GitHubu ani neprideľuje platenú úlohu cloud agentovi.
- Existujúci stdio launcher predvolene používa identitu `gemini-mcp`;
  automaticky ju neprepožičiavať GitHub Copilotovi.

Zdroje: [VS Code MCP formáty](https://code.visualstudio.com/docs/agents/reference/mcp-configuration),
[GitHub repository MCP](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/configure-mcp-servers).
Overené pripojenie vyžaduje v konkrétnom hostiteľovi úspešné `initialize`,
`tools/list` a autorizované stavové volanie s výsledkom. Verejný health,
konfiguračný súbor, uložený kľúč alebo tento dokument nestačia.

## Prvá úloha pre GitHub Copilot: read-only review bridge autentifikácie

1. Prečítaj aktuálne [AGENTS.md](AGENTS.md), [TEAM-HANDOFF.md](TEAM-HANDOFF.md)
   a [.github/copilot-instructions.md](.github/copilot-instructions.md).
   Pred každým príkazom over aktuálnosť denníka a vlastníctvo. Ak dokumenty
   nevieš čítať alebo checkout/HEAD nesedí, zapíš obmedzenie a úlohu nepredstieraj.
2. Over čistotu a presný HEAD izolovaného worktree
   `C:/Users/saboi/Documents/Codex/2026-11-01/referenced-chatgpt-conversation-this-is-an/work/bridge-auth-20261102`:
   `5e1117ca00bfa77a388ec491d4e9e7d7476f0925`, základ
   `be92af16a564fd2660e297a8039623f0a5eda74e`.
   Codex ich pri príprave tohto handoffu overil; ty over stav znova.
3. Čítaj iba tieto súbory v uvedenom worktree a ich diff proti základu:
   `packages/contracts/src/bridge-auth.js`, `packages/contracts/scripts/schema.mjs`,
   `Trinity/src/bridge-proxy-auth.js`, `Trinity/src/index.js`, `Trinity/src/services.js`,
   `Local-Gateway/src/system-bridge.mjs`,
   `Trinity/tests/bridge-proxy-auth.test.mjs`, `Trinity/tests/bridge-proxy-http.test.mjs`,
   `Trinity/tests/ollama-bridge-auth.test.mjs`,
   `Local-Gateway/tests/system-bridge-auth.test.mjs`,
   `Trinity/docs/omni12/bridge-auth-hardening.md` a relevantný záznam `TEAM-HANDOFF.md`.
   Credential súbory, `.`, DPAPI, tokeny ani plaintext starých source credentialov
   nečítaj do odpovede a nezverejňuj v nálezoch.
4. Posúď odmietnutie implicitnej/prefixovej/digest autentifikácie, serverovú
   owner autorizáciu proxy, ochranu registrácie tunela a execute, HTTPS root
   tunnel metadata, zákaz credential-bearing redirectov, odstránenie syntetických
   identity flagov a zachovanie nakonfigurovaných credentials / cloud fallbacku.
   Marker `trinity.bridge.v1` nie je kryptografický podpis. Stará cache potrebuje
   pri budúcom rolloute autentifikovanú re-registráciu.
5. Nemeň zdrojové súbory. Nespúšťaj deploy, merge, push, reštart gateway,
   shell akcie cez PC Bridge, cloudové volania ani credential operácie.
   Táto prvá úloha je čítanie a review; nový beh testov alebo ďalšia implementácia
   dostanú samostatný CLAIM. Historické testy nevydávaj za vlastné.
6. Odpovedz vlastným `ACK` alebo `NEEDS_CHANGES` s presným task_id.
   Do spoločného denníka píš iba append-only po vlastnom CLAIM. Voliteľný nový
   review súbor najprv pomenuj a prevezmi vlastným CLAIM; nikoho neprepisuj.

## Požadovaná odpoveď a dôkazy

Uveď `task_id`, vlastný jedinečný `run_id`, autora a hostiteľa, `status`
(`ACK` alebo `NEEDS_CHANGES`), overený plný SHA, prečítané súbory a `evidence`
(konkrétne nálezy s cestou/riadkom, výsledok kontroly diffu, vykonané kontroly
a ich skutočné výsledky). Samostatne uveď neoverené oblasti a ďalšieho vlastníka.
Zdrojový review ACK nepotvrdzuje live MCP, OS/Google/Meta identitu ani nasadenie.

Polia tu označujú ľudský koordinačný handoff. Nie sú TAP execution receipt,
nevytvárajú oprávnenie a nesmú označiť navrhnutú akciu za vykonanú. Skutočné
vykonanie musí doložiť existujúci executor a overiteľný receipt. Codex ani
Antigravity nesmú vytvoriť ACK v mene GitHub Copilota. Tento dokument zatiaľ
dokladá lokálne uloženie požiadavky; doručenie do Copilot relácie je neoverené.

## Pending GitHub Copilot review — TRINITY-PROVIDER-CONNECTIONS-COPILOT-20261106-01
Time: 2026-11-06 08:51:32 +01:00 (Europe/Bratislava).
Status: COPILOT_WORK_STARTED; review result pending. PR: https://github.com/uscolective-byte/Trinity-antigravity/pull/41 (draft; head 4de21e8b9cf090f3f56e3ac0c0abc1fcaf346045; base ed4b43d9c3900a1810eaa292533c3244216a64bd).
The owner-visible GitHub comment is #6679952547. GitHub's PR timeline recorded reviewer Copilot and a copilot_work_started event at 2026-11-06T07:47:02Z. The request asks for review findings only and prohibits edits, pushes, merge, and deployment. Do not record a Copilot ACK until its own review/comment is visible.
Review scope: Trinity/src/index.js, Trinity/src/services.js, Trinity/src/ai-providers.js, Trinity/src/api-keys.js, Trinity/public/assistant/chat.html, Trinity/public/assistant/chat.js.txt, Trinity/docs/PROVIDER_CONNECTIONS.md. Focus: credential safety, owner authorization, truthful connection status, mcp:read + mcp:write, non-expiring but revocable Trinity keys, and the retained 60/minute rate limit. Tests/build remain unverified for PR #41.
Separate active local VS Code task: TRINITY-MCP-DEVELOPER-TOOLS-20261106 owns Trinity/src/mcp.js, Trinity/tests/runtime.test.mjs, and Trinity/docs/DEVELOPER_TOOLS_MCP.md. Keep the scopes separate.
## Follow-up request to VS Code GitHub Copilot — TRINITY-PR41-MCP-APPROVAL-FIX-20261106
Time: 2026-11-06 09:14 +01:00 (Europe/Bratislava).
Status: PENDING_COPILOT_ACK. Delivery is recorded here; no direct host receipt is verified.
PR #41 review comments #4490274614 and #4490274704 found that mcp:write/projectControl can call approve_system_action and that propose_improvement auto-approves/applies in one MCP call.
Within the active Copilot-owned files Trinity/src/mcp.js and Trinity/tests/runtime.test.mjs, prevent API-key MCP clients from self-approving run/deploy/system actions; require a separate authenticated owner approval with a required matching confirmation. Make propose_improvement create a pending proposal only, with approval/application through a separate owner-controlled step. Add focused regression tests and provide exact evidence in a Copilot-authored ACK. Preserve Codex-owned provider paths. This handoff does not change MCP scopes or confer external permissions; ordinary mcp:read + mcp:write remains available subject to server-side approval.