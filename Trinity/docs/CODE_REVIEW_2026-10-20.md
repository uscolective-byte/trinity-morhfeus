# Kontrola a opravy Trinity — 20. október 2026

Východiskový commit: `d9d7c3628a4267476876dad1514565505dff8a61`.
Nasadzovaný zdroj je `Trinity/`. Zmeny sú pripravené na kontrolu, bez produkčného deployu, zásahu do D1 alebo nových credentialov.

## Opravené

1. Copilot chat prijímal voľné `options`, ktorými bolo možné prepísať serverom dosadenú identitu alebo vybrať vykonávaný skill. Verejná schéma teraz povoľuje iba ohraničené nastavenia chatu. Identita sa dosadzuje zo serverovej autentifikácie.
2. Cache používala iba normalizovaný dotaz. Teraz sa oddeľuje podľa používateľa, presného textu, poskytovateľa, tokenového limitu a verzie nasadenia. Históriové rozhovory, anonymné volania, skilly, Power Platform a fallbacky sa necachujú. Cache hit dostane nové request ID.
3. História rozhovoru bola indexovaná verejným session ID. Teraz používa hash identity a session ID v novom namespace. Anonymné interné tool volania neprijímajú zdieľanú históriu. Staré dáta sa nemažú; predchádzajúce nescopované konverzácie sa do novej histórie neprenesú.
4. Skills a Power Platform sa mohli automaticky opakovať po chybe vrátane prípadu, keď už vykonali zápis. Automatické retry sa pre tieto cesty vypína.
5. Generické `execute_skill` a registrácia rozšírení cez agentový tool vyžadujú serverový admin context. Zakázaný Copilot plugin sa kontroluje pri agentovom vykonaní, v generickom toole aj v centrálnom SkillRegistry vykonaní.
6. `copilot_chat`, `execute_skill`, `ecosystem_search` a `ecosystem_synthesize` chýbali v mapovaní dôveryhodného tool katalógu, takže ich gate pred vykonaním odmietala. Sú priradené existujúcemu pluginu `capabilities`; jeho installed/enabled kontrola ostáva zachovaná. Katalóg sa neinštaluje cez obchádzku autorizácie.
7. Copilot s iba Ollama credentialom nevybral existujúci Ollama provider. Teraz používa skutočnú provider cestu. Bez poskytovateľa odpoveď jasne uvádza chýbajúcu konfiguráciu.
8. Osem koreňových modulov v `src/` boli neúplné duplikáty s chýbajúcimi importmi. Sú kompatibilnými exportmi aktuálnych implementácií `Trinity/src/`. Dva koreňové testové vstupy odkazujú na aktuálne testy; CI ich samostatne vykonáva.

## Pridaný zabudovaný plugin

`integration-diagnostics` registruje skutočný skill `integrationReadiness`. Kontroluje iba prítomnosť nastavení pre Workers AI, Gemini, OpenAI, Ollama, Copilot Studio, Power Platform a PC Bridge. Nevracia hodnoty tajomstiev a nepoužíva sieť. Výsledok explicitne rozlišuje `needs_configuration` a `configured_unverified`.

Je dostupný cez admin endpoint `POST /api/copilot/skills/integrationReadiness/execute` s `{"input":{}}`. Nejde o živý test ani o konfiguráciu Gemini CLI/VS Code. Credentialy v šifrovanom vaulte sa musia overiť cez existujúci provider status; tento skill má explicitný rozsah `worker-environment`.

## Overenie

| Kontrola | Výsledok |
|---|---|
| Trinity dry-run build + kompletné testy | 264 úspešných, 0 zlyhaní |
| Koreňové kompatibilné testové vstupy | 34 úspešných, 0 zlyhaní |
| Audit Worker + PC Bridge Worker + Local Gateway | 29 úspešných, 1 Windows test preskočený |
| `npm audit --prefix Trinity --omit=dev` | 0 hlásených zraniteľností produkčných závislostí |
| `git diff --check` | bez chýb |

Nové regresie overujú izoláciu používateľov/cache/histórie, nové request ID, odmietnutie nepovolených verejných nastavení na skutočnom Worker endpointe, nevykonanie opakovaného zápisu, admin gate, vypnutý plugin, redakciu diagnostického výsledku a Ollama-only cestu.

Úvodná syntaktická kontrola 173 JS/MJS súborov identifikovala šesť súborov `Archive/cloudflare-exports/trinity-{core,skills,sentinel,dispatcher,guardian,memory}.multipart.txt`, ktoré obsahujú surový multipart export namiesto samostatného JavaScriptu. Sú zachované ako zdrojové exporty; neboli automaticky nasadené ani vyhlásené za validné moduly. Ostatných 167 kontrolovaných súborov prešlo syntax kontrolou. Nové moduly prešli následným buildom a testami.

## Zostávajúce hranice kontroly

- Nejde o úplný manuálny bezpečnostný audit všetkých vetiev, HTML/PowerShell skriptov a cloudových konfigurácií. Staré otvorené feature vetvy sa hromadne nemergovali.
- Copilot registry a jeho toggle stav sú naďalej v pamäti Worker isolate. Vypnutie sa vynucuje v danom runtime; globálne a trvalé nastavenie potrebuje samostatnú D1 integráciu. Diagnostický plugin stav nepovažuje za dôkaz live spojenia.
- Existujúce dynamicky syntetizované katalógové šablóny sa týmto nemenia na implementované externé integrácie. Nové npm balíky sa nepridávajú bez konkrétnej potreby.
- GitHub Actions runner pri poslednej predchádzajúcej kontrole zlyhal pred prvým krokom. Lokálne výsledky sú samostatná evidencia, nie zelený GitHub CI status. Nový PR má dostať vlastný výsledok kontrol.
- Windows, Gemini/Copilot prihlásenie, živý PC heartbeat, reálne externé API a Cloudflare deploy neboli vykonané ani overené týmto auditom.
- Zmena vyžaduje kontrolu pred release. Rollback: revert commit tohto PR; schéma a credentialy sa nemenia. Nový cache/session namespace môže znamenať studenú cache a nový začiatok Copilot histórie.
