# Trinity 11 — Spoločné oprávnenia AI agentov a bezpečná autonómia

Aktualizované: 31. októbra 2026. Tento dokument je **pracovná politika**
a nie potvrdenie, že externý účet má platný token alebo že je klient pripojený.
Kanonický zdroj: `uscolective-byte/Trinity-antigravity@main`.
Korekcia podľa konfigurácie 2. novembra 2026: `auru.space` aj `auru.dev` sú
produkčné routes Workera `trinity`. Staging `trinity-staging` (`--env staging`)
má samostatnú konfiguráciu bez týchto routes; doména `auru.dev` nie je dôkaz izolácie.

## Klienti a vykonávacia identita

| Klient/model | Cesta k vykonávaniu | Identita |
|---|---|---|
| Codex | lokálny IDE/CLI + GitHub/Trinity MCP | vlastné OAuth/GitHub App oprávnenie |
| ChatGPT | autorizovaný GitHub konektor a Trinity MCP | používateľova schválená relácia / osobitný token |
| Google Antigravity | IDE + Git + Trinity MCP | lokálne prihlásenie a scoped connector |
| GitHub Copilot | VS Code / CLI / GitHub cloud agent + hostiteľské MCP | existujúca GitHub relácia a osobitne overený scope hostiteľa; actor `github-copilot` |
| Gemini (API) | model cez Trinity Model Router | **nie je** administrátor ani GitHub identita |
| Microsoft Copilot Studio | OAuth/Direct Line + vlastný REST/MCP nástroj | overený Entra/MSA účet + scoped token |
| Ollama (lokálne/cloud) | lokálny gateway/Model Router | **nie je** automaticky oprávnený účastník GitHubu |

Prístup poskytuje overená **identita volajúceho a oprávnenie nástroja**, nie
meno modelu, prompt, e-mail spomenutý v chate alebo prítomnosť API kľúča.
Modely môžu navrhovať príkazy, ale konajú len prostredníctvom existujúceho
autorizovaného hostiteľa, ktorý ich vykoná, zaloguje a vráti receipt.

GitHub Copilot sa zapája cez [.github/copilot-instructions.md](../../.github/copilot-instructions.md),
aktuálny [TEAM-HANDOFF.md](../../TEAM-HANDOFF.md) a
[GITHUB-COPILOT-HANDOFF.md](../../GITHUB-COPILOT-HANDOFF.md). Copilot Studio aj
interný `TrinityCopilotAgent` zostávajú samostatné integrácie. Tento zápis nemení
runtime grants, GitHub oprávnenia ani prístup k PC. Aktuálny Copilot stav je
`HOST_NOT_VERIFIED / PENDING_COPILOT_ACK`; spojenie možno potvrdiť až dôkazom
initialize → tools/list → read-only status z konkrétneho Copilot hostiteľa.

## Maximálny pracovný režim bez zbytočných potvrdení

Pre už overeného vlastníka/administrátora a bezpečný izolovaný workspace:

- Automaticky: čítanie, výskum, plánovanie, generovanie a úprava zdrojového
  kódu vo vyhradenej pracovnej vetve, formátovanie, testy, build dry-run,
  tvorba commitov, PR, revízia diffu, správa issues a vytváranie dokumentácie.
- Automaticky po prechode kontrolami: aktualizácia testovacieho/staging
  prostredia a opravy s nízkym dopadom, pokiaľ to dovolí politika nasadenia.
- Merge len po overení presného HEAD SHA, zelenom CI a rešpektovaní
  CODEOWNERS/branch protection; bez force-push, tajných bypassov alebo
  ignorovania zlyhávajúcich checkov. Existujúca úzko ohraničená funkcia
  automaticMergeAllowed nemení práva externého klienta.
- Kritické zmeny (produkčný deploy, odstránenie dát, zmena IAM/ACL,
  rotácia kľúčov, platby, publikovanie na cudzie účty) môžu byť automatizované
  len cez konkrétnu, auditovanú a časovo obmedzenú politiku vlastníka.
  Všeobecné „všetky oprávnenia“ v promptoch nesmie byť náhrada identity.
- Vlastník môže po autentifikácii schváliť pracovný rozsah na celý projekt;
  nevyžadovať nové schválenie za každý krok v rámci rovnakého scope.
  Akcia mimo scope sa nezvykne ticho spustiť.

## Nastavenia prístupov podľa poskytovateľa (bez ukladania hodnôt do Git)

**GitHub**: odporúčaný samostatný GitHub App alebo fine-grained token viazaný
na kanonický repozitár; Metadata read, Contents read/write, Pull requests
read/write, Issues read/write, Checks/Actions read, Actions write len pri
potrebe dispatch workflow, Workflows write len pre schválené úpravy CI.
Práva na správu repo a branch protection nech zostanú u vlastníka.
Všetci agenti používajú oddelené scope/identity; nezdielajú jeden plný PAT.

**Cloudflare**: separátny account-scoped token na worker build/deploy, D1
migrácie a stav bindingov len v určenom prostredí. Bežný agent nemá prístup
ku konfigurácii Access, DNS delegácii, Secrets Store administrácii a
finančným nastaveniam. Workers Secrets sú write-only, nemožno ich
automaticky exportovať do druhého Workera. `TRINITY_VAULT_KEY` nikdy
nerotovať bez migračného postupu.

**Microsoft/Google/Meta**: samostatné OAuth súhlasy a presné scopes.
Copilot/Gemini API token nie je ekvivalent administrátorského oprávnenia
k počítaču, GitHubu ani Cloudflare. Externé API musí vydať skutočný
verification receipt, až potom sa stav označí ako connected/verified.

**Windows**: lokálna brána musí byť online, autorizovaná a musí obmedzovať
pracovný priestor. Administrátorsky otvorený PowerShell nie je dôkazom
pripojenia Desktop Commander ani oprávnenia ďalšieho modelu. Nikdy nespúšťať
nedôveryhodné skripty s tokenmi v prostredí.

## Koordinácia účastníkov

1. Prečítať `TEAM-HANDOFF.md` a relevantné inštrukcie.
2. Zistiť kanonické HEAD/checkout, existujúce CLAIM a presné cieľové súbory.
3. CLAIM → izolovaná vetva/worktree → oprava → testy → commit → PR → HANDOFF.
4. CI a bezpečnostná kontrola konkrétneho commitu pred merge a deploy.
5. Staging deploy → verify deployment ID a 40-miestne SHA → produkcia
   len podľa existujúcej kritickej politiky → read-only monitoring.
6. Každú akciu vykazovať ako `proposed`, `running`, `completed`, `failed`
   podľa reálneho API alebo gateway receiptu. Netvrdiť vykonanie bez dôkazu.

## Stav aktivácie k 31.10.2026

- GitHub konektor má správcu nad oboma repozitármi v tejto relácii.
- Desktop Commander Basterix je offline; lokálne ACL, PowerShell a tokeny
  nebolo možné meniť.
- Nie je potvrdená živá autorizácia jednotlivých účtov Copilot, Gemini,
  Ollama, Meta a Google vo vnútri Trinity.
- Otvorené draft PR pre Microsoft Graph a Marketplace nie sú merge ani deploy.
- Zlyhávajúce GitHub CI nie je povolenie na bypass. Tento dokument sám
  nemení GitHub collaborators, Cloudflare IAM, OAuth ani secrets.
