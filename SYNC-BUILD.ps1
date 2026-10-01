# Trinity Morhfeus - Complete Synchronization & Build Script
# Version: 1.0 | Date: 2026-10-01
# ============================================================================
# Funkcia: Zabezpečenie, sinhronizácia a build všetkých Trinity modulov
# ============================================================================

param(
    [switch]$Full = $false,
    [switch]$Test = $false,
    [switch]$Deploy = $false,
    [switch]$Verbose = $false
)

# Nastavenie globálnych premenných
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommandPath
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$LogFile = "$ScriptPath\logs\sync-build_$Timestamp.log"
$ConfigFile = "$ScriptPath\stav-projektu.json"

# Vytvára log adresár ak neexistuje
if (-not (Test-Path "$ScriptPath\logs")) { New-Item -Path "$ScriptPath\logs" -ItemType Directory | Out-Null }

function Log {
    param([string]$Message, [string]$Level = "INFO")
    $LogMessage = "[$Timestamp] [$Level] $Message"
    Write-Host $LogMessage
    Add-Content -Path $LogFile -Value $LogMessage -Force
}

function Test-Prerequisites {
    Log "Kontrola požadovaných nástrojov..."
    
    $tools = @{
        "node" = "Node.js"
        "npm" = "NPM"
        "git" = "Git"
        "wrangler" = "Wrangler CLI"
        "firebase" = "Firebase CLI"
    }
    
    $missing = @()
    foreach ($tool in $tools.Keys) {
        try {
            $version = & $tool --version 2>&1
            Log "✓ $($tools[$tool]) nájdený: $version" "SUCCESS"
        }
        catch {
            $missing += $tool
            Log "✗ $($tools[$tool]) nenájdený" "WARN"
        }
    }
    
    if ($missing.Count -gt 0) {
        Log "Chýbajúce nástroje: $($missing -join ', '). Nainštaluj ich prosím." "ERROR"
        return $false
    }
    return $true
}

function Sync-Repository {
    Log "Spúšťam git synchronizáciu..."
    
    Set-Location $ScriptPath
    
    try {
        & git status | Out-Null
        & git fetch origin
        & git pull origin master
        Log "✓ Git synchronizácia úspešná" "SUCCESS"
        return $true
    }
    catch {
        Log "✗ Git synchronizácia zlyhala: $_" "ERROR"
        return $false
    }
}

function Build-Module {
    param(
        [string]$ModulePath,
        [string]$ModuleName,
        [bool]$IsWorker = $false
    )
    
    Log "Budovanie modulu: $ModuleName..."
    
    if (-not (Test-Path $ModulePath)) {
        Log "✗ Modul $ModuleName neexistuje na $ModulePath" "ERROR"
        return $false
    }
    
    Set-Location $ModulePath
    
    try {
        # Inštalácia závislostí
        if (Test-Path "package.json") {
            Log "Inštalujem NPM balíčky..."
            & npm ci --production
            if ($LASTEXITCODE -ne 0) { throw "NPM install zlyhal" }
        }
        
        # Build podľa typu modulu
        if ($IsWorker) {
            Log "Buildovanie Cloudflare Workera..."
            & wrangler build --config wrangler.jsonc
            if ($LASTEXITCODE -ne 0) { throw "Wrangler build zlyhal" }
        }
        else {
            Log "Buildovanie Node.js modulu..."
            if (Test-Path "package.json") {
                $packageJson = Get-Content "package.json" | ConvertFrom-Json
                if ($packageJson.scripts.build) {
                    & npm run build
                    if ($LASTEXITCODE -ne 0) { throw "npm run build zlyhal" }
                }
            }
        }
        
        Log "✓ Modul $ModuleName úspešne vybudovaný" "SUCCESS"
        return $true
    }
    catch {
        Log "✗ Budovanie $ModuleName zlyhalo: $_" "ERROR"
        return $false
    }
}

function Test-Module {
    param(
        [string]$ModulePath,
        [string]$ModuleName
    )
    
    Log "Testujem modul: $ModuleName..."
    
    if (-not (Test-Path $ModulePath)) {
        Log "! Test pre $ModuleName preskočený (modul neexistuje)" "WARN"
        return $true
    }
    
    Set-Location $ModulePath
    
    try {
        if (Test-Path "package.json") {
            $packageJson = Get-Content "package.json" | ConvertFrom-Json
            if ($packageJson.scripts.test) {
                & npm test 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Log "✓ Testy modulu $ModuleName prešli" "SUCCESS"
                    return $true
                }
                else {
                    Log "✗ Testy modulu $ModuleName zlyhal" "ERROR"
                    return $false
                }
            }
        }
        Log "! Žiadne testy definované pre $ModuleName" "WARN"
        return $true
    }
    catch {
        Log "✗ Testovanie $ModuleName zlyhal: $_" "ERROR"
        return $false
    }
}

function Verify-Security {
    Log "Overovanie bezpečnosti..."
    
    try {
        # Skontrolovať či nie sú zverejnené tajomstvá
        $secretPatterns = @(
            "\.credentials",
            "\.env",
            "\.dev\.vars",
            "DPAPI",
            "private.*key",
            "secret.*token"
        )
        
        $files = Get-ChildItem -Path $ScriptPath -Recurse -File | Where-Object {
            $_.Extension -eq ".js" -or $_.Extension -eq ".ps1"
        }
        
        $secretsFound = 0
        foreach ($file in $files) {
            foreach ($pattern in $secretPatterns) {
                if (Select-String -Path $file.FullName -Pattern $pattern -Quiet) {
                    if ($file.FullName -notmatch "(node_modules|\.git|logs)" -and 
                        $file.Name -notmatch "(.gitignore|README|sync|setup)") {
                        Log "⚠ Potenciálne tajomstvo v $($file.Name)" "WARN"
                        $secretsFound++
                    }
                }
            }
        }
        
        if ($secretsFound -eq 0) {
            Log "✓ Bezpečnostná kontrola passou" "SUCCESS"
            return $true
        }
        else {
            Log "✗ Nájdené potenciálne tajomstvá. Skontroluj prosím ručne." "WARN"
            return $false
        }
    }
    catch {
        Log "✗ Bezpečnostná kontrola zlyhal: $_" "ERROR"
        return $false
    }
}

function Deploy-Module {
    param(
        [string]$ModulePath,
        [string]$ModuleName,
        [string]$Environment = "production"
    )
    
    Log "Deployujem modul: $ModuleName na $Environment..."
    
    Set-Location $ModulePath
    
    try {
        if ($ModuleName -like "*Worker*" -or $ModuleName -eq "Trinity") {
            Log "Deployujem Cloudflare Workera..."
            $config = if ($Environment -eq "production") { "wrangler.jsonc" } else { "wrangler.ops.jsonc" }
            
            if (Test-Path $config) {
                & wrangler deploy --config $config
                if ($LASTEXITCODE -ne 0) { throw "Wrangler deploy zlyhal" }
            }
        }
        elseif ($ModuleName -eq "Firebase") {
            Log "Deployujem Firebase Hosting..."
            & firebase deploy --project trinity-morhfeus-20261001
            if ($LASTEXITCODE -ne 0) { throw "Firebase deploy zlyhal" }
        }
        
        Log "✓ Deploy modulu $ModuleName úspešný" "SUCCESS"
        return $true
    }
    catch {
        Log "✗ Deploy $ModuleName zlyhal: $_" "ERROR"
        return $false
    }
}

function Update-ProjectStatus {
    param(
        [hashtable]$Updates
    )
    
    Log "Aktualizujem stav projektu..."
    
    try {
        $status = Get-Content $ConfigFile | ConvertFrom-Json
        
        foreach ($key in $Updates.Keys) {
            $status | Add-Member -Name $key -Value $Updates[$key] -MemberType NoteProperty -Force
        }
        
        $status.updated_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz")
        $status | ConvertTo-Json -Depth 10 | Set-Content $ConfigFile
        
        Log "✓ Stav projektu aktualizovaný" "SUCCESS"
        return $true
    }
    catch {
        Log "✗ Aktualizácia stavu zlyhal: $_" "ERROR"
        return $false
    }
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

Log "════════════════════════════════════════════════════════════════"
Log "Trinity Morhfeus - Sync & Build Pipeline START" "HEADER"
Log "════════════════════════════════════════════════════════════════"

# 1. Kontrola požadovaných nástrojov
if (-not (Test-Prerequisites)) {
    Log "Chýbajú požadované nástroje. Skončujem." "ERROR"
    exit 1
}

# 2. Synchronizácia repository
if (-not (Sync-Repository)) {
    Log "Synchronizácia zlyhal. Skončujem." "ERROR"
    exit 1
}

# 3. Bezpečnostná kontrola
if (-not (Verify-Security)) {
    Log "Bezpečnostní overenie zlyhal" "WARN"
    if (-not $Force) {
        Log "Pokračovanie bez bezpečnostného odsúhlasu..." "WARN"
    }
}

# 4. Budovanie modulov
$modules = @(
    @{Path = "$ScriptPath\Trinity"; Name = "Trinity"; IsWorker = $true}
    @{Path = "$ScriptPath\Local-Gateway"; Name = "Local-Gateway"; IsWorker = $false}
    @{Path = "$ScriptPath\PC-Bridge-Worker"; Name = "PC-Bridge-Worker"; IsWorker = $true}
    @{Path = "$ScriptPath\Firebase"; Name = "Firebase"; IsWorker = $false}
)

$buildResults = @{}
foreach ($module in $modules) {
    $buildResults[$module.Name] = Build-Module -ModulePath $module.Path -ModuleName $module.Name -IsWorker $module.IsWorker
    
    if ($buildResults[$module.Name] -and $Test) {
        Test-Module -ModulePath $module.Path -ModuleName $module.Name
    }
}

# 5. Deploy ak je požadovaný
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

# 6. Finálne zhrnutie
Log "════════════════════════════════════════════════════════════════" "HEADER"
Log "VÝSLEDKY" "HEADER"
Log "════════════════════════════════════════════════════════════════" "HEADER"

$successCount = ($buildResults.Values | Where-Object { $_ -eq $true }).Count
Log "Úspešne vybudované: $successCount/$($buildResults.Count) modulov" "INFO"

foreach ($module in $buildResults.Keys) {
    $status = if ($buildResults[$module]) { "✓" } else { "✗" }
    Log "$status $module" "INFO"
}

Update-ProjectStatus -Updates @{
    "last_sync" = (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz")
    "build_status" = if ($successCount -eq $buildResults.Count) { "success" } else { "partial" }
}

Log "════════════════════════════════════════════════════════════════" "HEADER"
Log "Trinity Morhfeus - Sync & Build Pipeline FINISHED" "HEADER"
Log "Log uložený: $LogFile" "INFO"
Log "════════════════════════════════════════════════════════════════" "HEADER"

if ($successCount -eq $buildResults.Count) {
    exit 0
}
else {
    exit 1
}
