<#
  backup.ps1  -  RUN ON THE SERVER PC

  Takes a complete, consistent snapshot of the live database into backups\.
  Safe to run while people are using the app: --single-transaction takes the
  snapshot inside one transaction, so it neither locks tables nor blocks writes.

  ALL application data lives in MySQL (file imports are parsed in memory and
  never written to disk), so this dump is a COMPLETE backup - nothing else on
  the server needs backing up except this file.

  USAGE (from the project root, on the server PC):
    .\scripts\backup.ps1                       # -> backups\ams-backup-<timestamp>.sql
    .\scripts\backup.ps1 -KeepDays 30          # also prune backups older than 30 days
    .\scripts\backup.ps1 -OutDir E:\ams-backups  # write to a USB/network drive

  RESTORE with:  .\scripts\restore.ps1 -File backups\ams-backup-....sql
#>
[CmdletBinding()]
param(
    [string]$OutDir,                       # default: <project>\backups
    [string]$Container = 'ams-mysql',
    [string]$DbName,                       # default: from .env, else office_management
    [string]$DbUser = 'root',
    [string]$DbPassword,                   # default: from .env, else compose dev default
    [int]$KeepDays = 0                     # 0 = keep everything
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

# --- Read DB settings from .env so this matches the running stack ----------
$envFile = Join-Path $projectRoot '.env'
$envMap = @{}
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$') {
            $envMap[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
        }
    }
}
if (-not $DbName)     { $DbName     = if ($envMap['DB_NAME'])     { $envMap['DB_NAME'] }     else { 'office_management' } }
if (-not $DbPassword) { $DbPassword = if ($envMap['DB_PASSWORD']) { $envMap['DB_PASSWORD'] } else { 'office_dev_pw' } }
if (-not $OutDir)     { $OutDir     = Join-Path $projectRoot 'backups' }

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

# --- Preflight -------------------------------------------------------------
docker version *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker isn't running. Start Docker Desktop and try again." }
$running = docker ps --filter "name=$Container" --format "{{.Names}}"
if ($running -ne $Container) { throw "Container '$Container' is not running. Start the stack first: docker compose up -d" }

$stamp   = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$outFile = Join-Path $OutDir "ams-backup-$stamp.sql"

Write-Host "Backing up '$DbName' -> $outFile" -ForegroundColor Cyan

# Dump INSIDE the container, then docker cp it out. This is byte-exact.
# (Piping mysqldump through PowerShell would add a UTF-8 BOM and can mangle
#  line endings, which breaks the restore. Do not "simplify" this.)
# Password is passed via MYSQL_PWD, not -p, so it never appears in the
# container's process list (and mysqldump skips its "insecure" warning).
$innerPath = '/tmp/ams-backup.sql'
$dumpCmd = "mysqldump -u$DbUser --single-transaction --routines --triggers --events --add-drop-table --databases $DbName > $innerPath 2>/tmp/ams-backup.err"
docker exec -e "MYSQL_PWD=$DbPassword" $Container sh -c $dumpCmd
if ($LASTEXITCODE -ne 0) {
    $err = docker exec $Container sh -c "cat /tmp/ams-backup.err 2>/dev/null"
    throw "mysqldump failed (exit $LASTEXITCODE): $err"
}

docker cp "${Container}:$innerPath" $outFile
if ($LASTEXITCODE -ne 0) { throw "docker cp failed - backup not saved." }
docker exec $Container sh -c "rm -f $innerPath /tmp/ams-backup.err" *> $null

# --- Sanity-check the artifact --------------------------------------------
if (-not (Test-Path $outFile)) { throw "Backup file was not created." }
$sizeKB = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
$tail = Get-Content $outFile -Tail 5 | Out-String
if ($tail -notmatch 'Dump completed') {
    throw "Backup looks TRUNCATED (no 'Dump completed' marker). Do not trust this file: $outFile"
}
Write-Host "OK - $sizeKB KB, verified complete ('Dump completed' marker present)." -ForegroundColor Green

# --- Prune old backups -----------------------------------------------------
if ($KeepDays -gt 0) {
    $cutoff = (Get-Date).AddDays(-$KeepDays)
    $old = Get-ChildItem -Path $OutDir -Filter 'ams-backup-*.sql' | Where-Object { $_.LastWriteTime -lt $cutoff }
    if ($old) {
        $old | Remove-Item -Force
        Write-Host "Pruned $($old.Count) backup(s) older than $KeepDays days." -ForegroundColor Yellow
    }
}

Write-Host "`nIMPORTANT: copy backups OFF this PC (USB / network drive / cloud)." -ForegroundColor Yellow
Write-Host "A backup sitting on the same disk as the database dies with that disk." -ForegroundColor Yellow
