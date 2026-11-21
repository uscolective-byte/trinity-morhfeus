# Trinity Sovereign AI OS — Lightweight PowerShell PC Bridge (Port 7777)
[CmdletBinding()]
param([int]$Port = 7777)

$ErrorActionPreference = 'Stop'
$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "CHYBA: Port $Port je už obsadený alebo nie je dostupný!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   TRINITY ANTIGRAVITY PC BRIDGE BEŽÍ NA $prefix   " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Čakám na príkazy z Cloudflare Trinity Workeru..." -ForegroundColor Gray
Write-Host "Ukončenie kedykoľvek stlačením Ctrl + C." -ForegroundColor Gray
Write-Host ""

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # CORS Headers
        $response.AddHeader('Access-Control-Allow-Origin', '*')
        $response.AddHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        $response.AddHeader('Access-Control-Allow-Headers', '*')

        if ($request.HttpMethod -eq 'OPTIONS') {
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        if ($request.HttpMethod -eq 'POST') {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $bodyText = $reader.ReadToEnd()
            $reader.Close()

            $payload = $bodyText | ConvertFrom-Json
            $timeStr = Get-Date -Format 'HH:mm:ss'
            Write-Host "[$timeStr] $($payload.action) -> $($payload.target)" -ForegroundColor Magenta

            $result = @{ status = 'SUCCESS'; output = '' }

            try {
                switch ($payload.action) {
                    'OPEN_FILE' {
                        Start-Process $payload.target
                        $result.output = 'Otvorené'
                    }
                    'OPEN_APP' {
                        if ($payload.args) {
                            Start-Process $payload.target -ArgumentList $payload.args
                        } else {
                            Start-Process $payload.target
                        }
                        $result.output = 'Spustené'
                    }
                    'EXEC_COMMAND' {
                        $cmdOutput = Invoke-Expression -Command $payload.target 2>&1 | Out-String
                        $result.output = $cmdOutput
                    }
                    'CREATE_FILE' {
                        Set-Content -Path $payload.target -Value $payload.content -Force -Encoding UTF8
                        $result.output = 'Vytvorené'
                    }
                    default {
                        $result.status = 'ERROR'
                        $result.output = "Neznáma akcia: $($payload.action)"
                    }
                }
            } catch {
                $result.status = 'ERROR'
                $result.output = $_.Exception.Message
            }

            $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes(($result | ConvertTo-Json))
            $response.ContentType = 'application/json'
            $response.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
            $response.Close()
        } else {
            # GET /health check
            $healthJson = '{"status":"active","bridge":"trinity-pc","port":7777}'
            $healthBytes = [System.Text.Encoding]::UTF8.GetBytes($healthJson)
            $response.ContentType = 'application/json'
            $response.OutputStream.Write($healthBytes, 0, $healthBytes.Length)
            $response.Close()
        }
    } catch {
        # ignore context cancellation on exit
    }
}
