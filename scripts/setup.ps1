# ============================================================
# COMET - Installation rapide (Windows / PowerShell)
# Usage: powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "+==============================================+" -ForegroundColor Cyan
Write-Host "|         COMET - Installation Windows         |" -ForegroundColor Cyan
Write-Host "+==============================================+" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: Docker n est pas installe." -ForegroundColor Red
    Write-Host "Installez Docker Desktop: https://docs.docker.com/desktop/install/windows-install/"
    exit 1
}

$composeOk = $false
try {
    $null = docker compose version 2>&1
    if ($LASTEXITCODE -eq 0) { $composeOk = $true }
} catch {}

if (-not $composeOk) {
    try {
        $null = docker-compose version 2>&1
        if ($LASTEXITCODE -eq 0) { $composeOk = $true }
    } catch {}
}

if (-not $composeOk) {
    Write-Host "ERREUR: docker compose n est pas disponible." -ForegroundColor Red
    Write-Host "Verifiez que Docker Desktop est lance."
    exit 1
}

# Check Docker is running
$dockerRunning = $false
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) { $dockerRunning = $true }
} catch {}

if (-not $dockerRunning) {
    Write-Host "ERREUR: Docker ne semble pas lance." -ForegroundColor Red
    Write-Host "Lancez Docker Desktop et reessayez."
    exit 1
}

Write-Host "[OK] Docker detecte" -ForegroundColor Green
Write-Host ""

# Create .env if missing
if (-not (Test-Path ".env")) {
    Write-Host "Creation du fichier .env..."
    Copy-Item ".env.example" ".env"

    # Generate secrets using PowerShell cryptography
    function Get-RandomBase64($bytes) {
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $buf = New-Object byte[] $bytes
        $rng.GetBytes($buf)
        return [Convert]::ToBase64String($buf)
    }

    function Get-RandomHex($bytes) {
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $buf = New-Object byte[] $bytes
        $rng.GetBytes($buf)
        return ($buf | ForEach-Object { $_.ToString("x2") }) -join ""
    }

    $authSecret = Get-RandomBase64 32
    $cronSecret = Get-RandomBase64 16
    $encryptionKey = Get-RandomHex 32
    $pgPassword = Get-RandomBase64 24

    # Remove characters that could break the .env file or DB URL
    $pgPassword = $pgPassword -replace '[+/=@#\$%&\*\(\)!]', 'x'

    # Replace placeholders in .env
    $envContent = Get-Content ".env" -Raw -Encoding UTF8
    $envContent = $envContent -replace "change-me-use-a-strong-password", $pgPassword
    $envContent = $envContent -replace "generate-with-openssl-rand-base64-32", $authSecret
    $envContent = $envContent -replace "generate-with-openssl-rand-base64-16", $cronSecret
    $envContent = $envContent -replace 'ENCRYPTION_KEY=""', ('ENCRYPTION_KEY="' + $encryptionKey + '"')
    [System.IO.File]::WriteAllText((Resolve-Path ".env").Path, $envContent)

    Write-Host "  Secrets generes automatiquement." -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Fichier .env existant detecte, conservation." -ForegroundColor Yellow
    Write-Host ""
}

# Prompt for external URL
Write-Host "--------------------------------------------" -ForegroundColor DarkGray
Write-Host "URL d acces (ex: https://comet.mondomaine.fr)"
Write-Host "Laisser vide pour http://localhost:3000"
Write-Host "--------------------------------------------" -ForegroundColor DarkGray
$appUrl = Read-Host ">"
if ($appUrl) {
    $envContent = Get-Content ".env" -Raw -Encoding UTF8
    $envContent = $envContent -replace 'AUTH_URL="[^"]*"', ('AUTH_URL="' + $appUrl + '"')
    [System.IO.File]::WriteAllText((Resolve-Path ".env").Path, $envContent)
    Write-Host "  AUTH_URL mis a jour: $appUrl" -ForegroundColor Green
}
Write-Host ""

# Build and start
Write-Host "Construction et demarrage des conteneurs..." -ForegroundColor Cyan
Write-Host "(Premiere execution : peut prendre 3-5 minutes)"
Write-Host ""

docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERREUR: docker compose up a echoue." -ForegroundColor Red
    Write-Host "Verifiez que Docker Desktop est bien lance."
    exit 1
}

Write-Host ""
Write-Host "Attente du demarrage de l application..."

# Read APP_PORT from .env or default to 3000
$appPort = "3000"
if (Test-Path ".env") {
    $portLine = Get-Content ".env" -Encoding UTF8 | Where-Object { $_ -match "^APP_PORT=" }
    if ($portLine) {
        $appPort = ($portLine -split "=", 2)[1].Trim()
    }
}

$retries = 30
$ready = $false
while ($retries -gt 0) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:${appPort}/api/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {
        # Not ready yet
    }
    $retries--
    Start-Sleep -Seconds 2
}

Write-Host ""
if ($ready) {
    if ($appUrl) { $displayUrl = $appUrl } else { $displayUrl = "http://localhost:${appPort}" }
    Write-Host "+==============================================+" -ForegroundColor Green
    Write-Host "|        Installation terminee !               |" -ForegroundColor Green
    Write-Host "+==============================================+" -ForegroundColor Green
    Write-Host ""
    Write-Host "  URL: $displayUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "  Identifiants admin dans les logs:" -ForegroundColor White
    Write-Host '  docker compose logs app | Select-String "Admin" -Context 0,3' -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Commandes utiles:" -ForegroundColor White
    Write-Host "    Logs:     docker compose logs -f app" -ForegroundColor DarkGray
    Write-Host "    Stop:     docker compose down" -ForegroundColor DarkGray
    Write-Host "    Restart:  docker compose restart app" -ForegroundColor DarkGray
    Write-Host ""
} else {
    Write-Host "L application met du temps a demarrer." -ForegroundColor Yellow
    Write-Host "Verifiez les logs: docker compose logs -f app" -ForegroundColor Yellow
    Write-Host ""
}
