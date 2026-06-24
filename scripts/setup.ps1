# ============================================================
# COMET — Installation rapide (Windows / PowerShell)
# Usage: powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "+==============================================+" -ForegroundColor Cyan
Write-Host "|         COMET — Installation Windows         |" -ForegroundColor Cyan
Write-Host "+==============================================+" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: Docker n'est pas installe." -ForegroundColor Red
    Write-Host "Installez Docker Desktop: https://docs.docker.com/desktop/install/windows-install/"
    exit 1
}

try {
    docker compose version | Out-Null
} catch {
    try {
        docker-compose version | Out-Null
    } catch {
        Write-Host "ERREUR: 'docker compose' n'est pas disponible." -ForegroundColor Red
        Write-Host "Verifiez que Docker Desktop est lance."
        exit 1
    }
}

# Check Docker is running
try {
    docker info 2>$null | Out-Null
} catch {
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

    # Generate secrets using PowerShell
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

    $AUTH_SECRET = Get-RandomBase64 32
    $CRON_SECRET = Get-RandomBase64 16
    $ENCRYPTION_KEY = Get-RandomHex 32
    $POSTGRES_PASSWORD = Get-RandomBase64 24

    # Replace placeholders in .env
    $envContent = Get-Content ".env" -Raw
    $envContent = $envContent -replace "change-me-use-a-strong-password", $POSTGRES_PASSWORD
    $envContent = $envContent -replace "generate-with-openssl-rand-base64-32", $AUTH_SECRET
    $envContent = $envContent -replace "generate-with-openssl-rand-base64-16", $CRON_SECRET
    $envContent = $envContent -replace 'ENCRYPTION_KEY=""', "ENCRYPTION_KEY=`"$ENCRYPTION_KEY`""
    Set-Content ".env" $envContent -NoNewline

    Write-Host "  Secrets generes automatiquement." -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Fichier .env existant detecte, conservation." -ForegroundColor Yellow
    Write-Host ""
}

# Prompt for external URL
Write-Host "--------------------------------------------" -ForegroundColor DarkGray
Write-Host "URL d'acces (ex: https://comet.mondomaine.fr)"
Write-Host "Laisser vide pour http://localhost:3000"
Write-Host "--------------------------------------------" -ForegroundColor DarkGray
$APP_URL = Read-Host "> "
if ($APP_URL) {
    $envContent = Get-Content ".env" -Raw
    $envContent = $envContent -replace 'AUTH_URL="[^"]*"', "AUTH_URL=`"$APP_URL`""
    Set-Content ".env" $envContent -NoNewline
    Write-Host "  AUTH_URL mis a jour: $APP_URL" -ForegroundColor Green
}
Write-Host ""

# Build and start
Write-Host "Construction et demarrage des conteneurs..." -ForegroundColor Cyan
Write-Host "(Premiere execution : peut prendre 3-5 minutes)"
Write-Host ""
docker compose up -d --build

Write-Host ""
Write-Host "Attente du demarrage de l'application..."

# Read APP_PORT from .env or default to 3000
$APP_PORT = "3000"
if (Test-Path ".env") {
    $portLine = Get-Content ".env" | Where-Object { $_ -match "^APP_PORT=" }
    if ($portLine) {
        $APP_PORT = ($portLine -split "=", 2)[1].Trim()
    }
}

$retries = 30
$ready = $false
while ($retries -gt 0) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$APP_PORT/api/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
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
    $displayUrl = if ($APP_URL) { $APP_URL } else { "http://localhost:$APP_PORT" }
    Write-Host "+==============================================+" -ForegroundColor Green
    Write-Host "|        Installation terminee !               |" -ForegroundColor Green
    Write-Host "+==============================================+" -ForegroundColor Green
    Write-Host ""
    Write-Host "  URL: $displayUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "  Identifiants admin dans les logs:" -ForegroundColor White
    Write-Host "  docker compose logs app | Select-String 'Admin' -Context 0,3" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Commandes utiles:" -ForegroundColor White
    Write-Host "    Logs:     docker compose logs -f app" -ForegroundColor DarkGray
    Write-Host "    Stop:     docker compose down" -ForegroundColor DarkGray
    Write-Host "    Restart:  docker compose restart app" -ForegroundColor DarkGray
    Write-Host ""
} else {
    Write-Host "L'application met du temps a demarrer." -ForegroundColor Yellow
    Write-Host "Verifiez les logs: docker compose logs -f app"
    Write-Host ""
}
