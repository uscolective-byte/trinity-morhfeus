# Windows PowerShell 5.1+. Changes one existing production secret, not local source code.
# The existing DPAPI-protected key is sent through stdin; no plaintext file or CLI argument.
[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$ProjectRoot)

$ErrorActionPreference = 'Stop'
$key = $null
$secure = $null
$pointer = [IntPtr]::Zero
$uploaded = $false
$work = $null
$config = $null

function Invoke-GatewayWrangler {
    param([string]$NativeArguments, [string]$SecretInput = $null)
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $script:nodePath
    $info.Arguments = '"' + $script:cli + '" ' + $NativeArguments
    $info.WorkingDirectory = $script:work
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $info.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
    # Wrangler emits secret-list JSON at "log" level; "info" silently hides it.
    $info.EnvironmentVariables['WRANGLER_LOG'] = 'log'
    $info.EnvironmentVariables['WRANGLER_LOG_SANITIZE'] = 'true'
    $info.EnvironmentVariables['CLOUDFLARE_ACCOUNT_ID'] = $script:accountId
    $info.EnvironmentVariables['CLOUDFLARE_API_BASE_URL'] = 'https://api.cloudflare.com/client/v4'
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $info
    try {
        $process.Start() | Out-Null
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if ($SecretInput) { $process.StandardInput.WriteLine($SecretInput) }
        $process.StandardInput.Close()
        if (-not $process.WaitForExit(120000)) {
            try { $process.Kill() } catch {}
            throw 'CLI timeout. The request may have reached Cloudflare; do not repeat the upload without checking.'
        }
        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            Output = $stdout.GetAwaiter().GetResult()
            ErrorOutput = $stderr.GetAwaiter().GetResult()
        }
    }
    finally { $process.Dispose() }
}

try {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).ProviderPath
    $script:accountId = 'b60342e5e52f5646fbd4e913bb409334'
    $script:nodePath = (Get-Command node -ErrorAction Stop).Source
    $candidates = @(
        (Join-Path $ProjectRoot 'Trinity\node_modules\wrangler\bin\wrangler.js'),
        (Join-Path $ProjectRoot 'node_modules\wrangler\bin\wrangler.js'),
        (Join-Path $env:USERPROFILE 'node_modules\wrangler\bin\wrangler.js')
    )
    $script:cli = $candidates |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Select-Object -First 1
    if (-not $script:cli) { throw 'Installed Wrangler not found. No packages or keys were changed.' }
    $keyFile = Join-Path $ProjectRoot 'Local-Gateway\.credentials\gateway-key.dpapi'
    if (-not (Test-Path -LiteralPath $keyFile -PathType Leaf)) {
        throw 'Protected gateway key is missing. No new key was created.'
    }
    $script:work = Join-Path $env:LOCALAPPDATA (
        'Trinity\GatewayKeySync\' + [guid]::NewGuid().ToString('N')
    )
    New-Item -ItemType Directory -Path $script:work -Force | Out-Null
    $config = Join-Path $script:work 'wrangler.json'
    $metadata = @{
        name = 'trinity'
        account_id = $script:accountId
        send_metrics = $false
    } | ConvertTo-Json
    [IO.File]::WriteAllText($config, $metadata, [Text.UTF8Encoding]::new($false))
    $flags = '--name trinity --config "' + $config + '"'

    # Read names only, before opening the private local key.
    $check = Invoke-GatewayWrangler -NativeArguments ('secret list ' + $flags)
    if ($check.ExitCode -ne 0) {
        throw 'Cloudflare preflight failed. Check your Wrangler login/account access. The key was not uploaded.'
    }
    if ([string]::IsNullOrWhiteSpace($check.Output)) {
        throw 'Wrangler returned no metadata output. No private key was opened and nothing was uploaded.'
    }
    $names = @($check.Output | ConvertFrom-Json)
    if (-not ($names | Where-Object { $_.name -eq 'TRINITY_GATEWAY_KEY' })) {
        throw 'Expected existing secret not found in trinity. No secret was created or replaced.'
    }

    $secure = ConvertTo-SecureString (
        (Get-Content -LiteralPath $keyFile -Raw).Trim()
    )
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ($key.Length -lt 32 -or $key -match '\s') {
        throw 'Local key format is invalid. Nothing was uploaded.'
    }

    # Exactly one upload attempt. No versions upload/deploy, force flag or source-code upload.
    # Cloudflare creates and immediately deploys a new version for this secret change.
    $result = Invoke-GatewayWrangler `
        -NativeArguments ('secret put TRINITY_GATEWAY_KEY ' + $flags) `
        -SecretInput $key
    if ($result.ExitCode -ne 0) {
        $message = ($result.ErrorOutput + ' ' + $result.Output).Replace($key, '[HIDDEN]')
        $message = $message -replace '(?i)(Bearer\s+)[^\s"]+', '$1[HIDDEN]'
        $message = $message -replace '[A-Za-z0-9_+/=-]{24,}', '[HIDDEN]'
        throw ('Upload was not confirmed. Do not force a deployment. ' + $message.Substring(0, [Math]::Min(700, $message.Length)))
    }
    $uploaded = $true
    Write-Output 'GATEWAY_KEY_SYNC_OK: trinity / TRINITY_GATEWAY_KEY'
    Write-Output 'Existing local key reused; no key value printed and no local source code uploaded.'
}
catch {
    Write-Output ('GATEWAY_KEY_SYNC_STOPPED: ' + $_.Exception.Message)
}
finally {
    $key = $null
    if ($pointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    if ($secure) { $secure.Dispose() }
    # Only the temporary metadata config is removed, never project files or credentials.
    if ($config -and (Test-Path -LiteralPath $config)) {
        Remove-Item -LiteralPath $config -Force -ErrorAction SilentlyContinue
    }
}
if (-not $uploaded) { exit 1 }

Write-Output 'Waiting for existing Gateway to retry (up to about 90 seconds)...'
$health = $null
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:8791/health' -TimeoutSec 5
        if ($health.cloud -eq 'connected' -and $health.pc_bridge -eq 'connected') { break }
    } catch {}
    Start-Sleep -Seconds 3
}
if ($health) {
    $health | Select-Object service, version, status, cloud, pc_bridge | ConvertTo-Json
} else {
    Write-Output 'Gateway health unavailable. The cloud secret update was confirmed; start Gateway from OneDrive.'
}