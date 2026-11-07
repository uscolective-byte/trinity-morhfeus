# Pripojenie Cloudflare, GitHub, OpenAI, Gemini, Antigravity a VS Code

Trinity pripája externé služby pomocou samostatných API poverení. Do Trinity nevkladaj heslo k účtu ani kľúč do chatu. Poverenie vlož cez **Nastavenia → Trezor API kľúčov**; trezor ho šifruje a zobrazuje iba maskovaný údaj. Potom použi **Overiť**. Uložený token bez úspešného overenia sa nepovažuje za funkčné pripojenie.

## Cloudflare

Vytvor API token v [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens). Obmedz ho na potrebný účet, zóny a oprávnenia. V trezore vyber **Cloudflare**, ulož token a spusti overenie. Overenie kontroluje, či token Cloudflare prijíma; potvrdený rozsah neznamená, že token má každé oprávnenie potrebné pre každú operáciu Trinity.

## GitHub

Vytvor [fine-grained personal access token](https://github.com/settings/personal-access-tokens) s prístupom len k potrebným repozitárom a oprávneniam. V trezore vyber **GitHub**, ulož token a spusti overenie. Aktuálne overenie potvrdzuje identitu a čitateľný prístup ku kanonickému repozitáru Trinity; nepotvrdzuje právo zapisovať, vytvárať PR, meniť nastavenia ani zlúčiť kód. GitHub všeobecne odporúča GitHub Apps, keď sú potrebné presnejšie a krátkodobé oprávnenia.

## OpenAI / GPT

Vytvor API kľúč v [OpenAI Platform](https://platform.openai.com/api-keys), vlož ho do trezora pod **OpenAI / ChatGPT** a over ho. Potom v karte **Modely a poskytovatelia** vyber overený kľúč, zvoľ model, ulož a spusti živý test. Ide o prístup k OpenAI API. Prihlásenie do ChatGPT a jeho predplatné nie sú API kľúč a Trinity ich týmto krokom nepripojí.

## Google Gemini

Vytvor Gemini API kľúč v [Google AI Studio](https://aistudio.google.com/app/apikey), vlož ho do trezora pod **Google Gemini**, over ho a vyber v karte **Modely a poskytovatelia**. Google prihlásenie do Trinity je samostatné a samo osebe neprideľuje Gemini API prístup.

## Google Antigravity → Trinity MCP

Antigravity používa vlastné Google prihlásenie na tomto počítači. Trinity nepotrebuje čítať jeho lokálne Google tokeny. V **Nastavenia → Pripojiť Antigravity k Trinity** vytvor samostatný kľúč s plným rozsahom `mcp:read` aj `mcp:write`. Kľúč nemá dátum expirácie, zobrazí sa iba pri vytvorení a môžeš ho kedykoľvek ručne zrušiť.

Stránka vytvorí konfiguráciu Antigravity s adresou MCP služby a Bearer kľúčom. Vlož ju do správy `mcpServers` v konfigurácii MCP Antigravity. Kľúč považuj za heslo, ulož ho iba na dôveryhodnom počítači a nezdieľaj ho. Zoznam Trinity API kľúčov umožňuje kľúč kedykoľvek zrušiť; po zrušení Antigravity stratí prístup.

Antigravity podporuje vzdialený Streamable HTTP MCP server cez `serverUrl` a Bearer hlavičku. Jeho Google účet a prístup k Trinity MCP sú dve samostatné autorizácie.

## Visual Studio Code

V **Nastavenia → Pripojiť VS Code s plnými MCP oprávneniami** vytvoríš samostatný kľúč s `mcp:read` aj `mcp:write`. Kľúč nemá dátum expirácie a môžeš ho kedykoľvek ručne odvolať. Trinity ho neobmedzí na konkrétny MCP nástroj; rozsah zápisu zahŕňa všetky nástroje MCP, ktoré povoľujú meniace operácie.

Vlož vygenerovaný blok do VS Code `mcp.json`. Je nastavený ako skrytý vstup `promptString`, takže VS Code si vyžiada kľúč pri prvom spustení a uloží zadanú hodnotu bezpečne pre ďalšie použitie. VS Code dokumentuje, že takéto interaktívne vstupy sa nepreposielajú do Copilot harness relácií. Pre Copilot harness je pripravený prenosný formát `mcpServers` s premennou prostredia `TRINITY_MCP_TOKEN`; nastav ju na počítači alebo vzdialenom hostiteľovi, ktorý spúšťa Copilot, a reštartuj VS Code. Nedávaj kľúč priamo do zdieľaného súboru s nastaveniami.

## Kontrola a zrušenie

- **Uložené** znamená, že poverenie je v trezore, nie že ho služba prijala.
- **Overené** znamená, že prešlo kontrolou implementovanou pre daného poskytovateľa. Neznamená to automaticky plné oprávnenia.
- Odpojenie tokenu v trezore alebo zrušenie MCP kľúča v Trinity odoberie Trinity prístup cez dané poverenie. Samotný token môžeš zrušiť aj priamo v príslušnej službe.

Trinity nemení oprávnenia ani expiráciu Cloudflare, GitHub, OpenAI alebo Gemini tokenov. Tie určuje poskytovateľ a nastavenia účtu, z ktorého token vytvoríš. Ak potrebuješ zápis alebo dlhšiu platnosť pre tieto služby, nastav ju pri vytváraní tokenu u poskytovateľa.

Kde sa API tokeny vydávajú, môžu sa meniť adresy a dostupné typy tokenov. Pred vytvorením tokenu skontroluj aktuálny rozsah a pravidlá platnosti v účte poskytovateľa.
