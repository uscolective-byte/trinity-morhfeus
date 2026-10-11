# Spoločný projektový prístup pre štyroch klientov

## Rozsah a skutočný stav

ChatGPT, Gemini, Microsoft Copilot a Notion AI / trino majú používať rovnaký projektový MCP rozsah `mcp:read` + `mcp:write`, ale každý vlastný kľúč. Kľúč jednej aplikácie sa nekopíruje do ďalšej.

Existujúci Worker už podporuje tento generický scope model. Scoped MCP volanie dostáva projektový prístup; vytvorenie návrhu zmeny však nenahrádza schválenie vlastníka. PC allowlisty, workspace obmedzenia, blokácia tajomstiev a prihlasovanie zostávajú zapnuté. Tento balík nemení autorizačný kód Workera ani existujúce kľúče.

Pri príprave bol v produkčnom registri potvrdený aktívny kľúč `Gemini MCP Bridge` s oboma MCP scopes. Existujúce GPT pripojenie podľa vlastníka funguje a nemení sa. Samostatný Trinity konektor v Notione ešte nebol nájdený; GitHub a Cloudflare konektory sú samostatné prístupy.

JSON v `config/project-mcp-clients.json` je verejný plán konfigurácie, nie živý register, udelenie oprávnení ani dôkaz spojenia. Skripty sú príprava na spustenie vo Windows. Kým ich vlastník nespustí a neprejde autentifikácia/discovery klientov, nové prístupy nie sú nainštalované ani overené.

## Bezpečné vytvorenie oddelených prístupov vo Windows

Použiť vlastnú prihlásenú Windows reláciu a Wrangler s prístupom k existujúcemu Cloudflare účtu. V priečinku projektu `Trinity` spustiť:

```powershell
powershell -NoProfile -File .\scripts\provision-project-clients.ps1
```

Skript overí konkrétny Cloudflare účet a databázu, ponechá existujúce lokálne credential súbory a ostatným klientom vytvorí vlastný 90-dňový kľúč s limitom 60 požiadaviek za minútu. D1 obsahuje iba hash. Lokálny token je šifrovaný Windows DPAPI; `.credentials` je ignorované Gitom. Token sa nevypisuje. Pri chybe ukladania po vytvorení DB záznamu sa skript pokúsi zrušiť iba nový kľúč a ohlási potrebu manuálneho zrušenia, ak rollback zlyhá.

Neobsahuje automatickú rotáciu. Prítomnosť lokálneho credential súboru nepotvrdzuje, že jeho kľúč je stále aktívny alebo že klient už funguje. Skript nečíta existujúce cudzie credentialy.

Vytvorenie konkrétneho klienta možno obmedziť cez `-Clients notion`, napríklad. Až keď klient zobrazí súkromné pole na autentifikáciu:

```powershell
powershell -NoProfile -File .\scripts\copy-project-client-token.ps1 -Client notion
```

Pre pole obsahujúce celú hlavičku `Authorization` pridať `-HeaderValue`. Token vložiť iba do súkromného autentifikačného poľa. Nikdy do chatu, Notion stránky alebo repozitára. Po vložení vyčistiť schránku.

## Klienti

- **Gemini:** používať existujúci Gemini MCP credential; neprepisovať funkčné nastavenia.
- **ChatGPT:** ponechať fungujúce existujúce spojenie. Natívne MCP aplikácie majú požiadavky na plán, webové rozhranie a podporovanú autentifikáciu. Tento balík nie je OAuth server a nesľubuje, že bearer token možno vložiť do Windows ChatGPT aplikácie.
- **Microsoft Copilot:** overená cesta je Copilot Studio MCP wizard, endpoint `https://auru.space/mcp`, API key v hlavičke `Authorization` s hodnotou `Bearer ...`. Následne vytvoriť spojenie a vybrať nástroje. Automatické pridanie do bežnej spotrebiteľskej Windows Copilot aplikácie nebolo potvrdené. Copilot Studio môže vyžadovať príslušný účet/licenciu; balík ich nekupuje ani nevytvára.
- **Notion AI / trino:** dokončiť natívny MCP setup pre uvedený endpoint, použiť vlastný Notion credential a povoliť konkrétne nástroje. Zapnutie všeobecného MCP nastavenia neznamená úspešné pripojenie Trinity.

## Kontrola po pripojení

U každého klienta overiť `tools/list` a autorizované `trinity_status`. Najprv otestovať čítanie; až potom samostatný návrh neškodnej projektovej zmeny. Overiť, že citlivá akcia naďalej čaká na vlastníka a že kľúč klienta nemožno použiť na súkromné admin API. Tvorba návrhu alebo HTTP 200 nie sú doklad vykonania úlohy. Audit starších projektových MCP nástrojov zatiaľ používa označenie `mcp:gemini` aj pre iných scoped klientov; samotný nápis preto nie je dôkaz identity aplikácie.

## Overenie tohto balíka

Node testy kontrolujú manifest a bezpečnostné invarianty skriptov. Nenahrádzajú vykonanie PowerShellu, Windows DPAPI, Wrangler autorizácie, clipboardu ani skutočnú klientsku autentifikáciu. Tento balík nezískava prístup k používateľovmu PC.

Referencie:

- [ChatGPT developer mode a MCP aplikácie](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)
- [Microsoft Copilot Studio MCP pripojenie a autentifikácia](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent)
