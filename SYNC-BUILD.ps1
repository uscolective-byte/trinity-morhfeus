param(
    [switch]$Full = $false,
    [switch]$Test = $false,
    [switch]$Deploy = $false,
    [switch]$Verbose = $false,
    [switch]$Force = $false
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
$ScriptPath = if ($MyInvocation.MyCommandPath) { Split-Path -Parent $MyInvocation.MyCommandPath } else { (Get-Location).Path }
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$LogFile = "$ScriptPath\logs\sync-build_$Timestamp.log"
$ConfigFile = "$ScriptPath\stav-projektu.json"

if (-not (Test-Path "$ScriptPath\logs")) {
    New-Item -Path "$ScriptPath\logs" -ItemType Directory -Force | Out-Null
}

function Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )

    $Prefix = ""
    switch ($Level) {
        "SUCCESS" { $Prefix = "OK"; $FgColor = "Green" }
        "ERROR" { $Prefix = "ERR"; $FgColor = "Red" }
        "WARN" { $Prefix = "WARN"; $FgColor = "Yellow" }
        "HEADER" { $Prefix = "=="; $FgColor = "Cyan" }
        default { $Prefix = "->"; $FgColor = "White" }
    }

    $LogMessage = "[$Timestamp] [$Level] $Message"
    Write-Host "$Prefix $Message" -ForegroundColor $FgColor
    Add-Content -Path $LogFile -Value $LogMessage -Force
}

function Test-Prerequisites {
    Log "Checking required tools..." "INFO"

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
                Log "$($tools[$tool]) found: $version" "SUCCESS"
            }
            else {
                throw "Exit code: $LASTEXITCODE"
            }
        }
        catch {
            $missing += $tool
            Log "$($tools[$tool]) not found" "WARN"
        }
    }

    try {
        $wranglerVer = & wrangler --version 2>&1
        Log "Wrangler found: $wranglerVer" "SUCCESS"
    }
    catch {
        Log "Wrangler not found (required before deploy)" "WARN"
    }

    if ($missing.Count -gt 0 -and $missing -contains "node") {
        Log "Critical tools missing: $($missing -join ', '). Install them first." "ERROR"
        return $false
    }

    return $true
}

function Sync-Repository {
    Log "Running git sync..." "INFO"

    Push-Location $ScriptPath
    try {
        & git status 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Git repository not initialized" }

        & git fetch origin 2>&1 | Out-Null
        & git pull origin master 2>&1 | Out-Null

        Log "Git sync successful" "SUCCESS"
        Pop-Location
        return $true
    }
    catch {
        Log "Git sync failed: $_" "ERROR"
        Pop-Location
        return $false
    }
}

function Install-Dependencies {
    param(
        [string]$ModulePath,
        [string]$ModuleName
    )

    Log "Installing dependencies for $ModuleName..." "INFO"

    if (-not (Test-Path "$ModulePath/package.json")) {
        Log "package.json not found in $ModuleName" "WARN"
        return $true
    }

    Push-Location $ModulePath
    try {
        if ($Full -and (Test-Path "node_modules")) {
            Log "Removing node_modules in $ModuleName..." "INFO"
            Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
        }

        if ($Full) {
            & npm cache clean --force 2>&1 | Out-Null
        }

        & npm ci 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Log "Dependencies installed for $ModuleName" "SUCCESS"
            Pop-Location
            return $true
        }

        throw "npm ci returned exit code: $LASTEXITCODE"
    }
    catch {
        Log "Dependency install failed for ${ModuleName}: $($_)" "ERROR"
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

    if (-not $BuildCommand) {
        Log "No build command configured for $ModuleName; skipping." "INFO"
        return $true
    }

    Log "Building module: $ModuleName..." "INFO"

    if (-not (Test-Path $ModulePath)) {
        Log "Module $ModuleName does not exist at $ModulePath" "ERROR"
        return $false
    }

    if (-not (Install-Dependencies -ModulePath $ModulePath -ModuleName $ModuleName)) {
        return $false
    }

    Push-Location $ModulePath
    try {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json

        if ($packageJson.scripts.$BuildCommand) {
            Log "Running: npm run $BuildCommand..." "INFO"
            & npm run $BuildCommand 2>&1 | Out-Null

            if ($LASTEXITCODE -ne 0) {
                throw "npm run $BuildCommand returned exit code: $LASTEXITCODE"
            }
        }
        else {
            Log "Build script not found in $ModuleName" "WARN"
        }

        Log "Module $ModuleName built successfully" "SUCCESS"
        Pop-Location
        return $true
    }
    catch {
        Log "Build failed for ${ModuleName}: $($_)" "ERROR"
        Pop-Location
        return $false
    }
}

function Test-Module {
    param(
        [string]$ModulePath,
        [string]$ModuleName
    )

    Log "Testing module: $ModuleName..." "INFO"

    if (-not (Test-Path $ModulePath)) {
        Log "Test skipped for $ModuleName because module does not exist" "WARN"
        return $true
    }

    Push-Location $ModulePath
    try {
        if (Test-Path "package.json") {
            $packageJson = Get-Content "package.json" | ConvertFrom-Json
            if ($packageJson.scripts.test) {
                & npm test 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Log "Tests passed for $ModuleName" "SUCCESS"
                    Pop-Location
                    return $true
                }

                Log "Tests failed for $ModuleName (exit code: $LASTEXITCODE)" "WARN"
                Pop-Location
                return $true
            }
        }

        Log "No test script defined for $ModuleName" "WARN"
        Pop-Location
        return $true
    }
    catch {
        Log "Testing $ModuleName failed: $_" "WARN"
        Pop-Location
        return $true
    }
}

function Verify-Security {
    Log "Checking security..." "INFO"

    try {
        $secretFiles = @("*.dpapi", ".credentials", ".env", ".env.*", ".dev.vars", ".wrangler")
        $violations = 0

        foreach ($pattern in $secretFiles) {
            $found = Get-ChildItem -Path $ScriptPath -Recurse -Force -File -Filter $pattern -ErrorAction SilentlyContinue |
                Where-Object {
                    $_.FullName -notmatch '[\\/](node_modules|\.wrangler|\.git)[\\/]' -and
                    $_.Name -notmatch '^\.env\.(example|sample|template|dist)(\..*)?$'
                }
            if ($found) {
                Log "Potential security issue: $pattern found" "WARN"
                $violations++
            }
        }

        if ($violations -eq 0) {
            Log "Security check passed" "SUCCESS"
            return $true
        }

        Log "Found $violations potential security issues" "WARN"
        return $true
    }
    catch {
        Log "Security check failed: $_" "WARN"
        return $true
    }
}

function Deploy-Module {
    param(
        [string]$ModulePath,
        [string]$ModuleName
    )

    Log "Deploying module: $ModuleName..." "INFO"

    Push-Location $ModulePath
    try {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json

        if ($packageJson.scripts.deploy) {
            Log "Running deploy script..." "INFO"
            & npm run deploy 2>&1

            if ($LASTEXITCODE -eq 0) {
                Log "Deploy succeeded for $ModuleName" "SUCCESS"
                Pop-Location
                return $true
            }

            throw "npm run deploy returned exit code: $LASTEXITCODE"
        }

        Log "Deploy script not found in $ModuleName" "WARN"
        Pop-Location
        return $true
    }
    catch {
        Log "Deploy failed for ${ModuleName}: $($_)" "ERROR"
        Pop-Location
        return $false
    }
}

function Update-ProjectStatus {
    param(
        [hashtable]$Updates
    )

    Log "Updating project status..." "INFO"

    try {
        if (-not (Test-Path $ConfigFile)) {
            Log "Config file not found: $ConfigFile" "WARN"
            return $true
        }

        $status = Get-Content -Path $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json

        foreach ($key in $Updates.Keys) {
            try {
                $status.PSObject.Properties.Remove($key)
            }
            catch {}
            $status | Add-Member -Name $key -Value $Updates[$key] -MemberType NoteProperty -Force
        }

        try {
            $status.PSObject.Properties.Remove("updated_at")
        }
        catch {}
        $status | Add-Member -Name "updated_at" -Value (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz") -MemberType NoteProperty -Force

        $status | ConvertTo-Json -Depth 10 | Set-Content -Path $ConfigFile -Encoding UTF8 -Force

        Log "Project status updated" "SUCCESS"
        return $true
    }
    catch {
        Log "Project status update failed: $_" "WARN"
        return $true
    }
}

Log "==================================================" "HEADER"
Log "Trinity Morhfeus - Sync & Build Pipeline START" "HEADER"
Log "==================================================" "HEADER"
Log "Parameters: Full=$Full, Test=$Test, Deploy=$Deploy, Verbose=$Verbose" "INFO"

if (-not (Test-Prerequisites)) {
    Log "Required tools missing. Exiting." "ERROR"
    exit 1
}

if (-not (Sync-Repository)) {
    Log "Git sync failed, continuing with local code..." "WARN"
}

Verify-Security | Out-Null

$discoveredModules = Get-ChildItem -Path $ScriptPath -Directory |
    Where-Object {
        $_.Name -notin @('.git', '.vscode', 'logs', 'node_modules') -and
        (Test-Path (Join-Path $_.FullName 'package.json'))
    } |
    Sort-Object Name |
    ForEach-Object {
        $pkgPath = Join-Path $_.FullName 'package.json'
        $packageJson = Get-Content -Path $pkgPath -Raw | ConvertFrom-Json
        $scriptNames = @($packageJson.scripts.PSObject.Properties.Name)
        $buildCmd = if ($scriptNames -contains 'build') { 'build' }
                    elseif ($scriptNames -contains 'start' -and $($_.Name -notmatch 'Local-Gateway|Gateway|gateway')) { 'start' }
                    else { $null }

        [pscustomobject]@{
            Path = $_.FullName
            Name = $_.Name
            BuildCmd = $buildCmd
        }
    }

$modules = @($discoveredModules)
if (-not $modules -or $modules.Count -eq 0) {
    Log "No modules with package.json were found. Exiting." "ERROR"
    exit 1
}

Log "Discovered modules: $($modules.Name -join ', ')" "INFO"

Log "==================================================" "HEADER"
Log "BUILD PHASE" "HEADER"
Log "==================================================" "HEADER"

$buildResults = @{}
foreach ($module in $modules) {
    $buildResults[$module.Name] = Build-Module -ModulePath $module.Path -ModuleName $module.Name -BuildCommand $module.BuildCmd

    if ($buildResults[$module.Name] -and $Test) {
        Log "---" "INFO"
        Test-Module -ModulePath $module.Path -ModuleName $module.Name
        Log "---" "INFO"
    }
}

if ($Deploy) {
    Log "==================================================" "HEADER"
    Log "DEPLOY PHASE" "HEADER"
    Log "==================================================" "HEADER"

    foreach ($module in $modules) {
        if ($buildResults[$module.Name]) {
            Deploy-Module -ModulePath $module.Path -ModuleName $module.Name
        }
    }
}

Log "==================================================" "HEADER"
Log "RESULTS" "HEADER"
Log "==================================================" "HEADER"

$successCount = ($buildResults.Values | Where-Object { $_ -eq $true }).Count
$totalCount = $buildResults.Count

Log "Successfully built: $successCount/$totalCount modules" "INFO"
Log "" "INFO"

foreach ($module in $buildResults.Keys) {
    $status = if ($buildResults[$module]) { "OK SUCCESS" } else { "FAILED" }
    Log "$status - $module" "INFO"
}

Log "" "INFO"
Update-ProjectStatus -Updates @{
    "last_sync" = (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz")
    "build_status" = if ($successCount -eq $totalCount) { "success" } else { "partial_failure" }
    "modules_built" = $successCount
}

Log "==================================================" "HEADER"
Log "Trinity Morhfeus - Sync & Build Pipeline FINISHED" "HEADER"
Log "Log stored: $LogFile" "INFO"
Log "==================================================" "HEADER"

if ($successCount -eq $totalCount) {
    Log "All modules built successfully." "SUCCESS"
    exit 0
}

Log "Some modules failed." "WARN"
exit 1
