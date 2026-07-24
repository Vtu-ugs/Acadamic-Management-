<#
  deploy.ps1  -  RUN ON THE SERVER PC

  One command to (optionally) pull the latest code and (re)build + start the
  whole stack (MySQL + backend + frontend) with Docker.

  FIRST-TIME SETUP on the server PC (do these once, by hand):
    1. Install Docker Desktop and start it.
    2. Get the project here (git clone <repo>, or copy the folder).
    3. Copy .env.example -> .env and fill in real secrets:
         NODE_ENV=production
         DB_PASSWORD=<long random password>
         JWT_SECRET=<openssl rand -hex 32>
         CORS_ORIGIN=http://<this-server's-LAN-IP>:8080
    4. Open the firewall (PowerShell as Administrator):
         New-NetFirewallRule -DisplayName "AMS App" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow

  USAGE (from the project root, on the server PC):
    .\scripts\deploy.ps1                 # git pull + build + start
    .\scripts\deploy.ps1 -NoPull         # skip git pull (deploying a copied folder)
    .\scripts\deploy.ps1 -FreshData      # WIPE the DB volume so a new 01-data.sql loads
#>
[CmdletBinding()]
param(
    [switch]$NoPull,      # skip 'git pull' (use when the project was copied, not cloned)
    [switch]$FreshData    # DANGER: wipes the database volume before starting
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
Write-Host "Deploying from: $projectRoot" -ForegroundColor Cyan

# --- Preflight -------------------------------------------------------------
if (-not (Test-Path (Join-Path $projectRoot '.env'))) {
    throw ".env is missing. Copy .env.example -> .env and set real secrets first (see header of this script)."
}
docker version *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker isn't running. Start Docker Desktop and try again." }

# --- Pull latest code ------------------------------------------------------
if (-not $NoPull) {
    if (Test-Path (Join-Path $projectRoot '.git')) {
        Write-Host "Pulling latest code..." -ForegroundColor Cyan
        git pull --ff-only
        if ($LASTEXITCODE -ne 0) { throw "git pull failed. Resolve it and re-run, or use -NoPull." }
    } else {
        Write-Host "Not a git repo - skipping pull. (Use -NoPull to silence this.)" -ForegroundColor Yellow
    }
}

# --- Optional clean slate for the database --------------------------------
if ($FreshData) {
    Write-Warning "FreshData: this ERASES the current database and reloads database/docker-init/*.sql."
    $confirm = Read-Host "Type 'wipe' to confirm"
    if ($confirm -ne 'wipe') { throw "Aborted - database left untouched." }
    docker compose down -v
}

# --- Build + start ---------------------------------------------------------
Write-Host "Building and starting containers..." -ForegroundColor Cyan
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed. Check the output above." }

Write-Host "`nContainer status:" -ForegroundColor Cyan
docker compose ps

# --- Report the LAN URL ----------------------------------------------------
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
       Where-Object { $_.IPAddress -notlike '169.*' -and $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } |
       Select-Object -First 1).IPAddress
Write-Host "`nDeployed." -ForegroundColor Green
if ($ip) {
    Write-Host "Open on this PC:      http://localhost:8080" -ForegroundColor Green
    Write-Host "Open from other PCs:  http://$ip:8080" -ForegroundColor Green
    Write-Host "(Make sure CORS_ORIGIN in .env matches the address people actually use.)" -ForegroundColor Yellow
} else {
    Write-Host "Open: http://localhost:8080  (couldn't auto-detect LAN IP; run 'ipconfig')" -ForegroundColor Green
}
