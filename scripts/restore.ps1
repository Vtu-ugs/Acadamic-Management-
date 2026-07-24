<#
  restore.ps1  -  RUN ON THE SERVER PC

  Restores a backup produced by backup.ps1 into the running database.

  THIS REPLACES THE CURRENT DATABASE CONTENTS. You will be asked to confirm.

  USAGE (from the project root, on the server PC):
    .\scripts\restore.ps1 -File backups\ams-backup-2026-07-24_101500.sql
    .\scripts\restore.ps1 -Latest                 # restore the newest backup in backups\
    .\scripts\restore.ps1 -Latest -Force          # skip the confirmation prompt

  DISASTER RECOVERY (server PC died, rebuilding on a new machine):
    1. Install Docker, get the project onto the new PC, create .env.
    2. docker compose up -d
    3. .\scripts\restore.ps1 -File <your latest backup>.sql
#>
[CmdletBinding(DefaultParameterSetName = 'File')]
param(
    [Parameter(ParameterSetName = 'File', Mandatory = $true)]
    [string]$File,

    [Parameter(ParameterSetName = 'Latest', Mandatory = $true)]
    [switch]$Latest,

    [string]$BackupDir,
    [string]$Container = 'ams-mysql',
    [string]$DbName,
    [string]$DbUser = 'root',
    [string]$DbPassword,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

# --- Read DB settings from .env -------------------------------------------
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
if (-not $BackupDir)  { $BackupDir  = Join-Path $projectRoot 'backups' }

# --- Resolve which file to restore ----------------------------------------
if ($Latest) {
    $newest = Get-ChildItem -Path $BackupDir -Filter 'ams-backup-*.sql' -ErrorAction SilentlyContinue |
              Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $newest) { throw "No backups found in '$BackupDir'." }
    $File = $newest.FullName
}
if (-not (Test-Path $File)) { throw "Backup file not found: $File" }
$File = (Resolve-Path $File).Path

# --- Verify the backup is complete BEFORE destroying anything -------------
$tail = Get-Content $File -Tail 5 | Out-String
if ($tail -notmatch 'Dump completed') {
    throw "Refusing to restore: '$File' has no 'Dump completed' marker, so it is truncated/corrupt."
}
$sizeKB = [math]::Round((Get-Item $File).Length / 1KB, 1)

docker version *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker isn't running. Start Docker Desktop and try again." }
$running = docker ps --filter "name=$Container" --format "{{.Names}}"
if ($running -ne $Container) { throw "Container '$Container' is not running. Start the stack first: docker compose up -d" }

Write-Host "Restore source : $File ($sizeKB KB)" -ForegroundColor Cyan
Write-Host "Target database: $DbName in container $Container" -ForegroundColor Cyan

if (-not $Force) {
    Write-Warning "This REPLACES the current contents of '$DbName'."
    $confirm = Read-Host "Type 'restore' to confirm"
    if ($confirm -ne 'restore') { throw "Aborted - database left untouched." }
}

# --- Copy in and load ------------------------------------------------------
# docker cp keeps the file byte-exact; piping through PowerShell would not.
$innerPath = '/tmp/ams-restore.sql'
docker cp $File "${Container}:$innerPath"
if ($LASTEXITCODE -ne 0) { throw "docker cp into the container failed." }

Write-Host "Loading..." -ForegroundColor Cyan
docker exec -e "MYSQL_PWD=$DbPassword" $Container sh -c "mysql -u$DbUser < $innerPath 2>/tmp/ams-restore.err"
if ($LASTEXITCODE -ne 0) {
    $err = docker exec $Container sh -c "cat /tmp/ams-restore.err 2>/dev/null"
    throw "Restore failed (exit $LASTEXITCODE): $err"
}
docker exec $Container sh -c "rm -f $innerPath /tmp/ams-restore.err" *> $null

# --- Report what came back -------------------------------------------------
# Password goes via MYSQL_PWD so mysql doesn't print its "password on the command
# line is insecure" warning. Do NOT add `2>$null` here: in Windows PowerShell 5.1
# redirecting a native exe's stderr raises NativeCommandError and fails the script
# even on success.
Write-Host "`nRestored. Row counts:" -ForegroundColor Green
$countSql = "SELECT 'students', COUNT(*) FROM $DbName.student" +
            " UNION ALL SELECT 'admissions', COUNT(*) FROM $DbName.admission" +
            " UNION ALL SELECT 'fees', COUNT(*) FROM $DbName.fee" +
            " UNION ALL SELECT 'courses', COUNT(*) FROM $DbName.courses" +
            " UNION ALL SELECT 'logins', COUNT(*) FROM $DbName.app_user;"
# Build "-uroot" as its own string; a bare -u$DbUser token is not expanded.
$userArg = "-u" + $DbUser
docker exec -e "MYSQL_PWD=$DbPassword" $Container mysql $userArg -N -e $countSql

Write-Host "`nRestart the backend so it picks up a clean connection pool:" -ForegroundColor Yellow
Write-Host "  docker compose restart backend" -ForegroundColor Yellow
