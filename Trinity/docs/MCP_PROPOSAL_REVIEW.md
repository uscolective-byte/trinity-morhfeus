# Posúdenie alternatívneho MCP návodu

## Záver

Dodaný návrh nie je pripravená funkčná inštalácia. Použiteľná je myšlienka oddelených prístupov a kontrola povolených nástrojov pri volaní. Predložený router ani štyri konfiguračné bloky sa však nekopírujú do produkcie ani klientskych nastavení.

Aktuálny produkčný základ je Trinity 9.4.0, nie 8.0.0. Server už má reálny autorizovaný MCP handler na `https://auru.space/mcp`. PR #8 pripravuje generické projektové scopes `mcp:read` + `mcp:write` s oddelenými credentialmi, bez paralelného neovereného routera.

## Čo je v dodanom návrhu nesprávne

1. **Nebezpečné prevzatie súborov.** `git checkout` s adresárom alebo wildcardom môže prepísať existujúce lokálne súbory. Označenie „iba nové súbory“ tento príkaz nezabezpečuje. PR #8 pridáva konkrétne súbory pod `Trinity/scripts`, nie navrhovaný adresár `scripts/win`.
2. **Neoverené cesty a súbory.** Používateľ uviedol projekt `C:\Users\saboi\Documents\Codex\Morhfeus\Trinity`. Alternatívny návod používa iné používateľské priečinky a odkazuje na `mcp-chatgpt.js`, `mcp-gemini.ts`, `mcp-copilot.js` a `mcp-notion.js`, ktoré PR #8 nepridáva. Ich lokálnu existenciu ani funkčnosť návrh nepotvrdzuje.
3. **Neúplný router.** Nástrojom vo výsledku `tools/list` chýba povinné `inputSchema`. `read_local_workspace` a `execute_windows_script` sú ponúkané, ale handler ich nevykonáva: skončia ako neznámy/nepodporovaný nástroj. Kontrola allowlistu sama nie je implementácia nástroja.
4. **Falošný stav a oprávnenia.** Pevná odpoveď `ONLINE` neoveruje Worker, databázu ani PC. Názov správcu ani premenná `ACCESS_ROLE=ROOT_ADMIN` nepredstavujú autorizáciu alebo udelenie privilégií. Konfiguračné bloky zároveň neobsahujú deklarované odkazy na reálne tokeny.
5. **Nesprávne zjednotené klientské konfigurácie.** JSON s `command: node` nie je univerzálny import pre ChatGPT Desktop, Notion a Microsoft Copilot. Stdio server neponúka HTTPS endpoint ani sieťový most na uvedenej LAN IP; `TRINITY_BRIDGE_HOST` v dodanom kóde nie je použitý. Notion setup vyžaduje natívne pripojenie konkrétneho vzdialeného servera a výber nástrojov.
6. **Zámena Copilot produktov a rozdielne scopes.** GitHub Copilot/VS Code nie je požadovaná spotrebiteľská Microsoft Copilot aplikácia. Overená cesta Microsoftu je Copilot Studio MCP wizard. Návrh navyše prideľuje GPT a Notionu menej nástrojov než Gemini/Copilotu, hoci vlastník požiadal o rovnaký projektový rozsah pre všetkých štyroch.

Tieto chyby neznamenajú, že existujúce GPT alebo Gemini spojenie nefunguje. Existujúce nastavenia sa nemenia a klientské spojenia sa bez overenia nepovažujú za hotové.

## Presné súbory overeného balíka PR #8

Zdrojový snapshot overený 126 úspešnými Node testami:
`35a3138a4115f4d5286adf20965e768d69ba92df`.

- `Trinity/scripts/provision-project-clients.ps1`
- `Trinity/scripts/copy-project-client-token.ps1`
- `Trinity/config/project-mcp-clients.json`
- `Trinity/docs/PROJECT_CLIENT_ACCESS.md`
- `Trinity/tests/project-client-access.test.mjs`

Žiadny z týchto súborov nevytvára nový neautorizovaný filesystem server. Provisioner používa existujúci scoped MCP model; credentialy musí vytvoriť až vlastník vo svojej Windows relácii.

## Bezpečné selektívne prevzatie bez checkoutu

Nasledujúci postup je manuálne pripravený na Windows a zatiaľ tam nebol vykonaný. Pred spustením overiť skutočný Git root. Ak sa líši od uvedeného, zastaviť a overiť cestu, nie naslepo prepísať priečinky. Postup preberá iba uvedený otestovaný snapshot, nie ľubovoľný nový head. Nevykonáva `checkout`, `reset`, `restore`, staging, merge ani credential provisioning.

```powershell
$ErrorActionPreference = 'Stop'
$expectedRoot = [IO.Path]::GetFullPath('C:\Users\saboi\Documents\Codex\Morhfeus')
Set-Location (Join-Path $expectedRoot 'Trinity')
$rootOutput = & git rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0) { throw 'Toto nie je Git projekt. Nic sa nepreberalo.' }
$repo = [IO.Path]::GetFullPath(($rootOutput -join "`n").Trim())
if (-not [string]::Equals($repo, $expectedRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Git root je iny. Najprv over skutocnu cestu projektu.'
}

$source = '35a3138a4115f4d5286adf20965e768d69ba92df'
& git fetch --no-tags https://github.com/uscolective-byte/trinity-morhfeus.git refs/pull/8/head
if ($LASTEXITCODE -ne 0) { throw 'Fetch zlyhal. Pracovne subory sa nezmenili.' }
& git merge-base --is-ancestor $source FETCH_HEAD
if ($LASTEXITCODE -ne 0) { throw 'Overeny snapshot nie je v PR #8. Zastavujem.' }

$files = @(
  'Trinity/scripts/provision-project-clients.ps1',
  'Trinity/scripts/copy-project-client-token.ps1',
  'Trinity/config/project-mcp-clients.json',
  'Trinity/docs/PROJECT_CLIENT_ACCESS.md',
  'Trinity/tests/project-client-access.test.mjs'
)
$buffers = @()
$utf8 = New-Object System.Text.UTF8Encoding
foreach ($relative in $files) {
  $target = [IO.Path]::GetFullPath((Join-Path $repo $relative))
  if (Test-Path -LiteralPath $target) {
    throw "Subor uz existuje, neprepisujem: $relative"
  }
  # Refuse existing junction/symlink ancestors before any file creation.
  $ancestor = Split-Path -Parent $target
  while ($ancestor -and $ancestor.Length -ge $repo.Length) {
    if (Test-Path -LiteralPath $ancestor) {
      $item = Get-Item -LiteralPath $ancestor -Force
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Cesta obsahuje junction alebo symlink: $ancestor"
      }
    }
    if ([string]::Equals($ancestor, $repo, [StringComparison]::OrdinalIgnoreCase)) { break }
    $ancestor = Split-Path -Parent $ancestor
  }
  $content = & git show "${source}:$relative"
  if ($LASTEXITCODE -ne 0) { throw "Zdrojovy subor chyba: $relative" }
  $buffers += @{ Path = $target; Bytes = $utf8.GetBytes(($content -join "`n") + "`n") }
}

# All paths and source files passed preflight. CreateNew refuses overwriting.
foreach ($entry in $buffers) {
  New-Item -ItemType Directory -Path (Split-Path -Parent $entry.Path) -Force | Out-Null
  $stream = [IO.File]::Open($entry.Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $stream.Write($entry.Bytes, 0, $entry.Bytes.Length) } finally { $stream.Dispose() }
}
Write-Host 'Prevzate iba nove subory. Existujuce upravy ani Git index sa neprepisali.'
Write-Host 'Credentialy este nevytvorene; najprv skontroluj skripty a Windows/Cloudflare pristup.'
```

Kontroly ciest nie sú náhradou za zabezpečenie Windows používateľskej relácie. Pri chybe počas samotného vytvárania môže zostať časť nových súborov; existujúce súbory sa však neprepisujú. Nepoužívať automatický Force/checkout na obídenie kontroly existujúcich súborov. PowerShell 5.1 môže spracovať ne-ASCII text z Git stdout inak; obsah a diff treba skontrolovať, alebo použiť PowerShell 7 s UTF-8. Tento manuálny import nepovažujeme za binárne presnú archiváciu.

Až po kontrole prevzatého skriptu, Windows DPAPI a Wrangler prihlásenia použiť pôvodný provisioner podľa `PROJECT_CLIENT_ACCESS.md`. Potom dokončiť súkromnú autentifikáciu/discovery v každom podporovanom klientovi. Kľúče nikdy nevypisovať do chatu. Existujúce GPT/Gemini konfigurácie sa neprepisujú.

## Referencie

- [Skutočný PR #8 a zoznam súborov](https://github.com/uscolective-byte/trinity-morhfeus/pull/8/files)
- [Existujúci produkčný MCP handler](https://github.com/uscolective-byte/trinity-morhfeus/blob/809397fe43a45ab8c566fb90aa474909849c4634/Trinity/src/mcp.js)
- [ChatGPT developer mode a MCP aplikácie](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)
- [Microsoft Copilot Studio MCP setup](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent)
