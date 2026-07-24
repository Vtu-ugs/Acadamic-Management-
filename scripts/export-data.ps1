<#
  export-data.ps1  -  RUN ON YOUR DEV PC (the one with the live data)

  Dumps your current database into database/docker-init/01-data.sql, which the
  server's MySQL auto-loads the first time it starts on an empty volume.

  Run it right before you ship data to a fresh server, then commit/copy the file.

  USAGE (from the project root):
    # From XAMPP MariaDB (default: user root, empty password)
    .\scripts\export-data.ps1

    # From the local Docker MySQL container instead
    .\scripts\export-data.ps1 -Source docker -DbPassword office_dev_pw

    # From XAMPP with a password / custom db name
    .\scripts\export-data.ps1 -DbPassword secret -DbName office_management
#>
[CmdletBinding()]
param(
    [ValidateSet('xampp', 'docker')]
    [string]$Source = 'xampp',

    [string]$DbName = 'office_management',
    [string]$DbUser = 'root',
    [string]$DbPassword = '',                    # XAMPP default is empty
    [string]$XamppMysqldump = 'C:\xampp\mysql\bin\mysqldump.exe',
    [string]$DockerContainer = 'ams-mysql'
)

$ErrorActionPreference = 'Stop'

# Resolve output path relative to this script, so it works from any CWD.
$projectRoot = Split-Path -Parent $PSScriptRoot
$outFile     = Join-Path $projectRoot 'database\docker-init\01-data.sql'
$outDir      = Split-Path -Parent $outFile
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

# Common mysqldump flags: single transaction (no table locks), include CREATE
# statements + routines, and add DROP so a re-run replaces cleanly.
$dumpArgs = @(
    '--single-transaction',
    '--routines',
    '--add-drop-table',
    "--databases", $DbName
)

Write-Host "Dumping '$DbName' from $Source -> $outFile" -ForegroundColor Cyan

if ($Source -eq 'xampp') {
    if (-not (Test-Path $XamppMysqldump)) {
        throw "mysqldump not found at '$XamppMysqldump'. Pass -XamppMysqldump with the correct path."
    }
    $pwArg = if ($DbPassword) { "-p$DbPassword" } else { $null }
    $allArgs = @("-u$DbUser") + ($(if ($pwArg) { @($pwArg) } else { @() })) + $dumpArgs
    & $XamppMysqldump @allArgs | Out-File -FilePath $outFile -Encoding utf8
}
else {
    # docker: run mysqldump inside the running MySQL container
    $running = docker ps --filter "name=$DockerContainer" --format "{{.Names}}"
    if ($running -ne $DockerContainer) {
        throw "Container '$DockerContainer' is not running. Start it with: docker compose up -d db"
    }
    $pwArg = if ($DbPassword) { "-p$DbPassword" } else { $null }
    $inner = @("-u$DbUser") + ($(if ($pwArg) { @($pwArg) } else { @() })) + $dumpArgs
    docker exec $DockerContainer mysqldump @inner | Out-File -FilePath $outFile -Encoding utf8
}

if ($LASTEXITCODE -ne 0) { throw "mysqldump failed (exit $LASTEXITCODE). Check credentials/db name above." }

$size = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
Write-Host "Done. Wrote $size KB to $outFile" -ForegroundColor Green
Write-Host "Next: commit this file (git add + commit + push) or copy it with the project to the server PC." -ForegroundColor Yellow
