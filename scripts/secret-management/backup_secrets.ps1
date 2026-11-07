# -------------------------------------------------
# backup_secrets.ps1  –  záloha Cloudflare Workers secrets
# -------------------------------------------------
# 1. Získajte zoznam secretov (názvy) – už ste ich videli pomocou `wrangler secret list`.
#    Tieto názvy vložte do poľa $secretNames.
# 2. Vložte hodnoty manuálne (hneď po spustení, neukazuje ich).
# 3. Hodnoty sú šifrované lokálne pomocou DPAPI (Windows Data Protection API).
# 4. Výsledný binárny súbor je uložený v rovnakom priečinku a je zahrnutý do .gitignore.

# ---- KONFIGURÁCIA -------------------------------------------------
# Upravte nasledujúci zoznam tak, aby obsahoval VŠETKY názvy secretov,
# ktoré sú v projekte nastavené (nezabudnite na API kľúče a tokeny).
$secretNames = @(
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "AZURE_OPENAI_KEY",
    "COHERE_API_KEY",
    "OLLAMA_API_KEY",
    "TRINITY_INTERNAL_TOKEN",
    "ANOTHER_SECRET"
    # ← doplňte ďalšie názvy podľa `wrangler secret list`
)

# ---- EXPORT V HODNOTY --------------------------------------------
$secretValues = @{}
foreach ($name in $secretNames) {
    Write-Host "Zadajte hodnotu pre secret \"$name\": " -NoNewline
    # Používame SecureString, aby sa hodnota nezobrazila na obrazovke.
    $secure = Read-Host -AsSecureString
    # Konvertujeme SecureString na kryptografický string pre uloženie.
    $encrypted = $secure | ConvertFrom-SecureString
    $secretValues[$name] = $encrypted
}

# ---- VYTVORENIE ŠIFROVANEJ ZÁLOHY -------------------------------
$plainJson = $secretValues | ConvertTo-Json -Depth 5
# DPAPI šifruje pre aktuálneho používateľa a počítač
$encryptedBytes = [System.Security.Cryptography.ProtectedData]::Protect(
    [System.Text.Encoding]::UTF8.GetBytes($plainJson),
    $null,
    [System.Security.Cryptography.DataProtectionScope]::CurrentUser)

# Uložíme binárny súbor.  Tento súbor NEBUDE verzovaný.
$backupPath = Join-Path -Path $PSScriptRoot -ChildPath "trinity_secrets_backup.bin"
[IO.File]::WriteAllBytes($backupPath, $encryptedBytes)
Write-Host "\nZáloha secretov uložená do: $backupPath"
Write-Host "Uistite sa, že súbor je v .gitignore a nie je commitnutý."
