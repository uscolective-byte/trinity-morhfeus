# Trinity Morhfeus - Complete Synchronization & Build Script
# Version: 2.0 | Date: 2026-10-01
# ============================================================================
# Funkcia: Zabezpečenie, sinhronizácia a build všetkých Trinity modulov
# ============================================================================

param(
    [switch]$Full = $false,
    [switch]$Test = $false,
    [switch]$Deploy = $false,
    [switch]$Verbose = $false,
    [switch]$Force = $false
)

# Nastavenie globálnych premenných
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommandPath
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$LogFile = "$ScriptPath\logs\sync-build_$Timestamp.log"
$ConfigFile = "$ScriptPath\stav-projektu.json"

# Vytvára log adresár ak neexistuje
if (-not (Test-Path "$ScriptPath\logs")) { New-Item -Path "$ScriptPath\logs" -ItemType Directory -Force | Out-Null }

function Log {
    param([string]$Message, [string]$Level = "INFO")
    $Prefix = ""
    switch ($Level) {
        "SUCCESS" { $Prefix = "✓"; $FgColor = "Green" }
        "ERROR" { $Prefix = "✗"; $FgColor = "Red" }
        "WARN" { $Prefix = "⚠"; $FgColor = "Yellow" }
        "HEADER" { $Prefix = "="; $FgColor = "Cyan" }
        default { $Prefix = "→"; $FgColor = "White" }
    }
    
    $LogMessage = "[$Timestamp] [$Level] $Message"
    Write-Host "$Prefix $Message" -ForegroundColor $FgColor
    Add-Content -Path $LogFile -Value $LogMessage -Force
}

function Test-Prerequisites {
    Log "Kontrola požadovaných nástrojov..." "INFO"
    
    $tools = @{
        "node" = "Node.js"
        "npm" = "NPM"
        "git" = "Git"
    }
    
    $missing = @()
    foreach ($tool in $tools.Keys) {
        try {
            $version = & $tool --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Log "$($tools[$tool]) nájdený: $version" "SUCCESS"
            } else {
                throw "Exit code: $LASTEXITCODE"
            }
        }
        catch {
            $missing += $tool
            Log "$($tools[$tool]) nenájdený" "WARN"
        }
    }
    
    # Wrangler a Firebase sú opcionálne pre deploy
    try {
        $wranglerVer = & wrangler --version 2>&1
        Log "Wrangler nájdený: $wranglerVer" "SUCCESS"
    }
    catch {
        Log "Wrangler nenájdený (vyžadovaný pre deploy)" "WARN"
    }
    
    if ($missing.Count -gt 0 -and $missing -contains "node") {
        Log "Chýbajú kritické nástroje: $($missing -join ', '). Nainštaluj ich prosím." "ERROR"
        return $false
    }
    return $true
}

function Sync-Repository {
    Log "Spúšťam git synchronizáciu..." "INFO"
    
    Push-Location $ScriptPath
    try {
        & git status 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Git nie je inicializovaný" }
        
        & git fetch origin 2>&1 | Out-Null
        & git pull origin master 2>&1 | Out-Null
        
        Log "Git synchronizácia úspešná" "SUCCESS"
        Pop-Location
        return $true
    }
    catch {
        Log "Git synchronizácia zlyhal: $_" "ERROR"
        Pop-Location
        return $false
    }
}

function Install-Dependencies {
    param(
        [string]$ModulePath,
        [string]$ModuleName
    )
    
    Log "Inštalujem NPM balíčky pre: $ModuleName..." "INFO"
    
    if (-not (Test-Path "$ModulePath/package.json")) {
        Log "package.json nenájdený v $ModuleName" "WARN"
        return $true
    }
    
    Push-Location $ModulePath
    try {
        # Zmazať node_modules ak je požadovaný full clean
        if ($Full -and (Test-Path "node_modules")) {
            Log "Vymazávam node_modules v $ModuleName..." "INFO"
            Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
        }
        
        # Clean npm cache pre full build
        if ($Full) {
            & npm cache clean --force 2>&1 | Out-Null
        }
        
        # Inštalácia
        & npm ci 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Log "NPM balíčky pre $ModuleName nainštalované" "SUCCESS"
            Pop-Location
            return $true
        }
        else {
            throw "npm ci vrátil exit code: $LASTEXITCODE"
        }
    }
    catch {
        Log "Inštalácia $ModuleName zlyhal: $_" "ERROR"
        Pop-Location
        return $false
    }
}

function Build-Module {
    param(
        [string]$ModulePath,
        [string]$ModuleName,
        [string]$BuildCommand = "build"
    )
    
    Log "Budovanie modulu: $ModuleName..." "INFO"
    
    if (-not (Test-Path $ModulePath)) {
        Log "Modul $ModuleName neexistuje na $ModulePath" "ERROR"
        return $false
    }
    
    # Inštalácia závislostí
    if (-not (Install-Dependencies -ModulePath $ModulePath -ModuleName $ModuleName)) {
        return $false
    }
    
    Push-Location $ModulePath
    try {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        
        if ($packageJson.scripts.$BuildCommand) {
            Log "Spúšťam: npm run $BuildCommand..." "INFO"
            & npm run $BuildCommand 2>&1 | Out-Null
            
            if ($LASTEXITCODE -ne 0) {
                throw "npm run $BuildCommand vrátil exit code: $LASTEXITCODE"
            }
        }
        else {
            Log "Build script nenájdený v $ModuleName" "WARN"
        }
        
        Log "Modul $ModuleName úspešne vybudovaný" "SUCCESS"
        Pop-Location
        return $true
    }
    catch {
        Log "Budovanie $ModuleName zlyhal: $_" "ERROR"
        Pop-Location
        return $false
    }
}

function Test-Module {
    param(
        [string]$ModulePath,
        [string]$ModuleName
    )
    
    Log "Testujem modul: $ModuleName..." "INFO"
    
    if (-not (Test-Path $ModulePath)) {
        Log "Test pre $ModuleName preskočený (modul neexistuje)" "WARN"
        return $true
    }
    
    Push-Location $ModulePath
    try {
        if (Test-Path "package.json") {
            $packageJson = Get-Content "package.json" | ConvertFrom-Json
            if ($packageJson.scripts.test) {
                & npm test 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Log "Testy modulu $ModuleName prešli" "SUCCESS"
                    Pop-Location
                    return $true
                }
                else {
                    Log "Testy modulu $ModuleName zlyhal (exit code: $LASTEXITCODE)" "WARN"
                    Pop-Location
                    return $true  # Pokračuj aj keď testy failnú
                }
            }
        }
        Log "Žiadne testy definované pre $ModuleName" "WARN"
        Pop-Location
        return $true
    }
    catch {
        Log "Testovanie $ModuleName zlyhal: $_" "WARN"
        Pop-Location
        return $true
    }
}

function Verify-Security {
    Log "Overovanie bezpečnosti..." "INFO"
    
    try {
        # Skontrolovať .gitignore je respektovaný
        $secretFiles = @("*.dpapi", ".credentials", ".env", ".env.*", ".dev.vars", ".wrangler")
        $violations = 0
        
        foreach ($pattern in $secretFiles) {
            $found = Get-ChildItem -Path $ScriptPath -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue
            if ($found) {
                Log "Potenciálny bezpečnostný problém: $pattern nájdený" "WARN"
                $violations++
            }
        }
        
        if ($violations -eq 0) {
            Log "Bezpečnostná kontrola passou" "SUCCESS"
            return $true
        }
        else {
            Log "Nájdené $violations potenciálne bezpečnostných problémov" "WARN"
            return $true
        }
    }
    catch {
        Log "Bezpečnostná kontrola zlyhal: $_" "WARN"
        return $true
    }
}

function Deploy-Module {
    param(
        [string]$ModulePath,
        [string]$ModuleName
    )
    
    Log "Deployujem modul: $ModuleName..." "INFO"
    
    Push-Location $ModulePath
    try {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        
        if ($packageJson.scripts.deploy) {
            Log "Spúšťam deploy skript..." "INFO"
            & npm run deploy 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Log "Deploy modulu $ModuleName úspešný" "SUCCESS"
                Pop-Location
                return $true
            }
            else {
                throw "npm run deploy vrátil exit code: $LASTEXITCODE"
            }
        }
        else {
            Log "Deploy script nenájdený v $ModuleName" "WARN"
            Pop-Location
            return $true
        }
    }
    catch {
        Log "Deploy $ModuleName zlyhal: $_" "ERROR"
        Pop-Location
        return $false
    }
}

function Update-ProjectStatus {
    param(
        [hashtable]$Updates
    )
    
    Log "Aktualizujem stav projektu..." "INFO"
    
    try {
        if (-not (Test-Path $ConfigFile)) {
            Log "Konfiguračný súbor nenájdený: $ConfigFile" "WARN"
            return $true
        }
        
        $status = Get-Content $ConfigFile | ConvertFrom-Json
        
        foreach ($key in $Updates.Keys) {
            $status.PSObject.Properties.Remove($key) -ErrorAction SilentlyContinue
            $status | Add-Member -Name $key -Value $Updates[$key] -MemberType NoteProperty -Force
        }
        
        $status.PSObject.Properties.Remove("updated_at") -ErrorAction SilentlyContinue
        $status | Add-Member -Name "updated_at" -Value (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz") -MemberType NoteProperty -Force
        
        $status | ConvertTo-Json -Depth 10 | Set-Content $ConfigFile -Force
        
        Log "Stav projektu aktualizovaný" "SUCCESS"
        return $true
    }
    catch {
        Log "Aktualizácia stavu zlyhal: $_" "WARN"
        return $true
    }
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

Log "════════════════════════════════════════════════════════════════" "HEADER"
Log "Trinity Morhfeus - Sync & Build Pipeline START" "HEADER"
Log "════════════════════════════════════════════════════════════════" "HEADER"
Log "Parametre: Full=$Full, Test=$Test, Deploy=$Deploy, Verbose=$Verbose" "INFO"

# 1. Kontrola požadovaných nástrojov
if (-not (Test-Prerequisites)) {
    Log "Chýbajú požadované nástroje. Skončujem." "ERROR"
    exit 1
}

# 2. Synchronizácia repository
if (-not (Sync-Repository)) {
    Log "Git synchronizácia zlyhal, ale pokračujem s lokálnym kódom..." "WARN"
}

# 3. Bezpečnostná kontrola
Verify-Security | Out-Null

# 4. Definovanie modulov na build
$modules = @(
    @{Path = "$ScriptPath\Trinity"; Name = "Trinity"; BuildCmd = "build"}
    @{Path = "$ScriptPath\Local-Gateway"; Name = "Local-Gateway"; BuildCmd = "start"}
    @{Path = "$ScriptPath\PC-Bridge-Worker"; Name = "PC-Bridge-Worker"; BuildCmd = "build"}
    @{Path = "$ScriptPath\Firebase"; Name = "Firebase"; BuildCmd = "build"}
)

Log "════════════════════════════════════════════════════════════════" "HEADER"
Log "BUILD FÁZA" "HEADER"
Log "════════════════════════════════════════════════════════════════" "HEADER"

# 5. Budovanie modulov
$buildResults = @{}
foreach ($module in $modules) {
    $buildResults[$module.Name] = Build-Module -ModulePath $module.Path -ModuleName $module.Name -BuildCommand $module.BuildCmd
    
    if ($buildResults[$module.Name] -and $Test) {
        Log "---" "INFO"
        Test-Module -ModulePath $module.Path -ModuleName $module.Name
        Log "---" "INFO"
    }
}

# 6. Deploy ak je požadovaný
if ($Deploy) {
    Log "════════════════════════════════════════════════════════════════" "HEADER"
    Log "DEPLOY FÁZA" "HEADER"
    Log "════════════════════════════════════════════════════════════════" "HEADER"
    
    foreach ($module in $modules) {
        if ($buildResults[$module.Name]) {
            Deploy-Module -ModulePath $module.Path -ModuleName $module.Name
        }
    }
}

# 7. Finálne zhrnutie
Log "════════════════════════════════════════════════════════════════" "HEADER"
Log "VÝSLEDKY" "HEADER"
Log "════════════════════════════════════════════════════════════════" "HEADER"

$successCount = ($buildResults.Values | Where-Object { $_ -eq $true }).Count
$totalCount = $buildResults.Count

Log "Úspešne vybudované: $successCount/$totalCount modulov" "INFO"
Log "" "INFO"

foreach ($module in $buildResults.Keys) {
    $status = if ($buildResults[$module]) { "✓ SUCCESS" } else { "✗ FAILED" }
    Log "$status - $module" "INFO"
}

Log "" "INFO"
Update-ProjectStatus -Updates @{
    "last_sync" = (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz")
    "build_status" = if ($successCount -eq $totalCount) { "success" } else { "partial_failure" }
    "modules_built" = $successCount
}

Log "════════════════════════════════════════════════════════════════" "HEADER"
Log "Trinity Morhfeus - Sync & Build Pipeline FINISHED" "HEADER"
Log "Log uložený: $LogFile" "INFO"
Log "════════════════════════════════════════════════════════════════" "HEADER"

if ($successCount -eq $totalCount) {
    Log "Všetko úspešne! ✓" "SUCCESS"
    exit 0
}
else {
    Log "Niektoré moduly failnuli ✗" "WARN"
    exit 1
}
