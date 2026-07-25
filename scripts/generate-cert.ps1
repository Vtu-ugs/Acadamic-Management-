<#
  generate-cert.ps1  -  RUN ON THE SERVER PC (once)

  Creates a self-signed TLS certificate so the app can be served over HTTPS on
  a LAN / IP address. Output goes to  ./certs/server.crt  and  ./certs/server.key,
  which docker-compose.yml mounts into the nginx (frontend) container.

  It uses OpenSSL from a throwaway Docker container, so you do NOT need OpenSSL
  installed on Windows — only Docker Desktop (which you already have).

  USAGE (from the project root, on the server PC):
    .\scripts\generate-cert.ps1                 # auto-detect this PC's LAN IP
    .\scripts\generate-cert.ps1 -ServerIp 192.168.1.50
    .\scripts\generate-cert.ps1 -ServerIp ams.local   # a hostname works too

  Because it's self-signed, the FIRST time each browser opens the site it shows
  a "Not secure / your connection is not private" warning. Click
  Advanced -> Proceed. The connection is still encrypted; the warning only means
  the certificate isn't signed by a public authority (expected on a LAN).

  Re-run this to renew (the cert is valid ~2 years) or after the server IP changes.
#>
[CmdletBinding()]
param(
    [string]$ServerIp,                 # LAN IP or hostname; auto-detected if omitted
    [int]$Days = 825                   # cert validity (max browsers accept for leaf certs)
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# --- Preflight -------------------------------------------------------------
docker version *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker isn't running. Start Docker Desktop and try again." }

# --- Figure out the address the cert should cover --------------------------
if (-not $ServerIp) {
    $ServerIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
                 Where-Object { $_.IPAddress -notlike '169.*' -and $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } |
                 Select-Object -First 1).IPAddress
    if (-not $ServerIp) { throw "Could not auto-detect a LAN IP. Pass one: .\scripts\generate-cert.ps1 -ServerIp 192.168.1.50" }
    Write-Host "Auto-detected server address: $ServerIp" -ForegroundColor Cyan
}

# Put the address in subjectAltName. Chrome/Edge require a SAN that matches;
# an IPv4 goes in as IP:, anything else as DNS:.
if ($ServerIp -match '^\d{1,3}(\.\d{1,3}){3}$') { $san = "IP:$ServerIp" } else { $san = "DNS:$ServerIp" }
# Always cover localhost too, so opening it on the server PC itself works.
$sanList = "$san,DNS:localhost,IP:127.0.0.1"

$certsDir = Join-Path $projectRoot 'certs'
if (-not (Test-Path $certsDir)) { New-Item -ItemType Directory -Path $certsDir | Out-Null }

Write-Host "Generating self-signed certificate for: $ServerIp ($sanList)" -ForegroundColor Cyan

# --- Generate via the official OpenSSL image -------------------------------
# The certs dir is mounted at /out; openssl writes the key + cert there.
docker run --rm -v "${certsDir}:/out" alpine/openssl `
    req -x509 -nodes -newkey rsa:2048 `
    -keyout /out/server.key -out /out/server.crt `
    -days $Days -subj "/CN=$ServerIp" -addext "subjectAltName=$sanList"
if ($LASTEXITCODE -ne 0) { throw "OpenSSL failed. See the output above." }

Write-Host "`nCertificate created:" -ForegroundColor Green
Write-Host "  $certsDir\server.crt"
Write-Host "  $certsDir\server.key   (keep this private - it is git-ignored)"
Write-Host "`nNext: set CORS_ORIGIN=https://$ServerIp in .env, then run .\scripts\deploy.ps1" -ForegroundColor Yellow
