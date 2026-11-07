# Stav konfigurácií a prepojení — 1. november 2026

Tento záznam rozlišuje konfiguráciu, autentifikáciu a skutočné vykonanie.
Neobsahuje hodnoty credentials ani tvrdenie o dokončenom deployi.

## Vykonané zmeny

- Nové vzdialené D1 databázy: trinity-rea-staging
  (646283b3-1b15-4ff4-81a0-eef80b8e70d4) a trinity-pc-bridge-staging
  (54d1f8c0-c40b-4fb3-93cf-966a94273e31).
- Nový KV namespace trinity-pc-state-staging
  (7335f27a99574fe097010cec9c602cb6).
- Staging konfigurácia používa aj existujúci staging KV trinity-development
  (759143cfa6fb44d6a0f4c8e4951945c8) a R2 trinity-development-artifacts.
  Zoznam vzdialených zdrojov po vytvorení potvrdil nové ID.
- Staging D1/KV/R2 majú odlišné identifikátory od produkcie.
  Audit je konfiguračný: nezaručuje celkovú izoláciu služieb. Service bindings
  a Vectorize stále smerujú aj na produkčné služby; preview zostáva build-only.
  Nové pomocné D1 databázy sú prázdne, bez kópie produkčných dát alebo schém.
- Self-deploy workflow vyžaduje metadata/isolation preflight a prestáva
  potláčať chybu staging verifikácie. Access redirect nie je úspešné overenie.
- Firebase verejný stavový most používa produkciu auru.space, päťsekundový
  deadline, validáciu health odpovede a pravdivý neoverený stav pri chybe.
- Developer Hub prestáva vracať fiktívne úspechy a zapisovať fiktívne dokumenty
  exekúcie. Chýbajúci executor znamená not_configured. Deklarované API a
  prítomný binding sa nezobrazujú ako overené OAuth alebo živé spojenie.

## Skutočný stav poskytovateľov

| Služba | Overené | Zostávajúca podmienka |
|---|---|---|
| GitHub | Vetva a PR sa dajú pushnúť; Actions check má nula krokov | Účet je zamknutý pre billing issue; obnoviť službu v nastavení účtu |
| Cloudflare | OAuth pre konto Basterix31, Secrets Store metadata/scopes, vytvorenie staging zdrojov, build dry-run | Zelené CI a platný staging release receipt pred produkciou |
| Google Cloud | gcloud prihlásený, tangential-osprey-dl7cp ACTIVE, číslo projektu 529087588161 | Zapnutie požadovaných API odmietnuté: serviceusage.services.enable; IAM read tiež odmietnutý |
| Firebase | Konfigurácia mosta opravená; CLI nainštalované cez samostatný npm cache | Nové bezpečné prihlásenie CLI a oprávnenie k trinity-morhfeus-20261001; gcloud prístup k tomuto projektu bol odmietnutý |
| Copilot Studio | Existujúce identifikátory v Local-Desktop; Power Platform CLI nainštalované | Pri kontrole bez auth profilov; spustené interaktívne prihlásenie, prijatie identity zatiaľ neoverené |
| Meta | Existujúca konfigurácia app ID 1105151122389213 a META_APP_SECRET v zozname Worker secrets | Skutočný Facebook developer účet, owner OAuth session, overenie tokenu a schválenie konkrétnych scopes |
| PC Bridge / Ollama | GET lokálnej brány ready, cloud connected, pc_bridge connected; Ollama cez tunel ONLINE | Tieto odpovede nie sú dôkaz vykonania ľubovoľného príkazu ani receipt spustenia aplikácie |

Google API pokus bol zamietnutý pre celý požadovaný zoznam: Gemini,
Resource Manager, People, Drive, Docs, Sheets a Firestore.
Google konfigurácia nie je dôkaz aktivácie týchto API. Nevytvoril sa nový
projekt, API key, service account, OAuth client ani nová IAM rola.
Nemenili sa platby ani billing nastavenia.

Meta Graph integrácia spravuje účty/Pages/Instagram podľa skutočných scopes.
Nie je totožná s osobným chatom Meta AI. Používanie Llama modelu cez Workers AI
samo osebe nepripája Facebook účet.

## Potrebné identity a súhlasy

Autentifikácia prebieha priamo v lokálnych prihlasovacích oknách, bez hesiel,
tokenov alebo autorizačných kódov v chate. Neudeľovať automaticky admin scopes
len preto, že existuje model alebo deklarovaný názov účtu.

- Google projekt: https://console.cloud.google.com/apis/dashboard?project=tangential-osprey-dl7cp
- Google IAM: https://console.cloud.google.com/iam-admin/iam?project=tangential-osprey-dl7cp
  Vlastník projektu musí povoliť potrebnú operáciu alebo ju vykonať sám;
  aktuálna relácia sa nedokáže sama povýšiť.
- OAuth callbacky pre neskoršieho oprávneného správcu:
  https://auru.space/auth/google/callback a https://auru.dev/auth/google/callback;
  API varianty /api/auth/google/callback len ak ich používa konkrétny klient.
- Copilot Studio: https://copilotstudio.microsoft.com/
  Environment b2ffa450-7427-e2dd-89dd-7df6a8c0a149;
  bot 767f155a-5b45-15fc-17b1-e4d712682945.
  Interaktívne prihlásenie: pac auth create --name Trinity --environment
  b2ffa450-7427-e2dd-89dd-7df6a8c0a149. Bez username/password parametrov.
- Meta app: https://developers.facebook.com/apps/1105151122389213/
  Callback: https://auru.space/api/assistant/connectors/meta/callback.
  Existujúci konektor vyžaduje overenú owner session v Trinity.
- GitHub Actions príčina: check 124733875024, run 41267707230.
  Annotation: The job was not started because your account is locked due to a billing issue.

## Validácia a release hranice

Trinity 722/722, Audit 6/6, Capacity 10/10, Jericho 12/12 a kontrakty
15/15 prešli lokálne. Jericho a kontrakty boli dokončené samostatne po oprave
pracovného dependency layoutu; netvrdí sa jeden neprerušený npm run check.
Secrets Store preflight, staging isolation audit, docs check a staging
Wrangler dry-run prešli. Nevytvárali sa platby ani on-chain transakcie.

Produkcia, staging Worker ani Firebase hosting v tomto kroku neboli
nasadené. Zelené lokálne sady nenahrádzajú požadované CI. Na dokončenie
release treba odstrániť billing blokáciu, potvrdiť presný finálny SHA cez CI,
oprávnený review, staging deploy a jeho skutočný receipt; následne
produkčný deploy a overenie správneho deployment ID/tagu.

## Aktualizácia po Antigravity ACK

Antigravity v origin/main potvrdila presné ID
CODEX-AG-RECONNECT-20261101T025931Z-66b0d78d a prevzatie predchádzajúceho
PR #29. Codex nezávisle overil produkciu: version ID
e4bfc1e6-00aa-4cfc-a9a6-d0b0d5ddc600, tag
e6eafa5f470ae9dfa8ebcf8264560ea54854f3b7, verified:true.
Tento predchádzajúci deploy neobsahuje nové platformové zmeny z tejto vetvy.

Firebase login:list --json neočakávane vrátilo aj credentials. Firebase CLI
relácia pre daný účet bola následne zrušená cez logout (exit 0). Neopakovať
raw JSON výpis login:list. Ďalšie kontroly musia vypísať iba boolean stavu;
žiadne credentials sa neukladajú do repozitára. Pred pokračovaním je potrebné
nové bezpečné interaktívne prihlásenie. Google gcloud relácia je samostatná.