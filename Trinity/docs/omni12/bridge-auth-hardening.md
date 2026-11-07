# Bridge autentifikácia — kompatibilná lokálna oprava

Pokračovanie auditu z 2. novembra 2026. Základ je lokálny main `be92af16a564fd2660e297a8039623f0a5eda74e`; jeho existujúce all-changes commity a novší Agents SDK sa nemenia. Oprava sa pripravuje v oddelenom worktree, bez nasadenia alebo reštartu živého Local Gateway.

## Zmena správania

- Spoločný `configuredBridgeToken` číta iba explicitné string hodnoty TRINITY_BRIDGE_TOKEN alebo existujúci TRINITY_LOCAL_TOKEN. Žiadny token zo zdroja, prefix alebo statický digest nie je implicitným oprávnením.
- Lokálny System Bridge porovná presný nakonfigurovaný token cez SHA-256/timingSafeEqual. Platné existujúce credentials ostávajú použiteľné.
- Cloudové bridge POST proxy a registrácia vyžadujú presný bridge credential alebo existujúcu serverom overenú owner session. User/admin session, email/phone hlavičky a verified* flags v tele oprávnenie nedávajú. Origin sa overuje pred akciou.
- Register-tunnel a bridge-execute používajú rovnakú bránu. Cloud do lokálneho privileged endpointu posiela iba action/payload a nakonfigurovaný credential; neposiela fiktívne overenie Google/Windows ani predvolenú osobnú identitu.
- Ne-PC `/api/command` používa existujúcu autentifikáciu a serverovú identitu; nevyžaduje PC credential. Anonymný volajúci nespustí model ani rate-limit zápis.
- Ollama model dispatcher bez explicitného bridge credentialu lokálny tunel nevolá. Existujúci autentifikovaný Ollama cloud fallback je zachovaný. Credential-bearing požiadavky majú redirect=manual.

## Stará cache a budúci rollout

Starý registračný endpoint mohol zapísať tunnel metadata cez verejne známy credential bypass. Preto nestačí opraviť iba aktuálnu HTTP bránu: staré uložené URL sa nesmú automaticky použiť na odoslanie skutočného tokenu.

Nová **autentifikovaná serverová registrácia** zapisuje `auth_version=trinity.bridge.v1`. Všetci cloudoví bridge konzumenti prijmú iba takéto metadáta s koreňovou HTTPS URL bez prihlasovacích údajov, query, fragmentu alebo dodatočnej cesty. Marker je migračná/provenance značka pri dôveryhodnom KV zápise, **nie kryptografický podpis**.

Pred budúcim schváleným rolloutom musí vlastník overiť explicitné credentials a aktualizovať cloudovú aj lokálnu stranu. Následne treba urobiť autentifikovanú re-registráciu skutočného tunela; staré záznamy bez markeru vrátia TUNNEL_OFFLINE alebo použijú povolený cloudový model fallback. Táto zmena sama neprepisuje cloudové KV, nečíta ani nerotuje secrets a nereštartuje PC most. Živý stav po takejto aktualizácii vyžaduje vlastný receipt.

## Overenie a hranice

Regresie používajú lokálne Miniflare HTTP/D1/KV a loopback fixture servery, nie externé OAuth alebo živých providerov. Testujú anonymné/podvrhnuté požiadavky, presné a neplatné credentials, owner/non-owner sessions, zachovaný cloud fallback, odobratie klientskych identity assertions, staré metadáta a platnú novú registráciu. Pôvodný Windows SID test je zachovaný; nové prenositeľné fixture identity nie sú tvrdením skutočného Google OAuth.

Legacy verejné GET statusy, rozsah privileged action allowlistu, miestne OS permissions a historické lifecycle/receipt pravdivostné označenia `/api/bridge` nepredstavujú nový kompletný bezpečnostný alebo execution audit. Tento rez opravuje autentifikáciu a smerovanie credentialov. Nevydáva nový live provider/Meta/PC connection claim.

Samostatná drobná oprava `schema:check` normalizuje CRLF pri porovnaní generovaných JSON schém. Čerstvý Windows checkout tak nehlási falošný drift len kvôli koncom riadkov; obsahová kontrola zostáva prísna a samotná schéma sa nemení.
