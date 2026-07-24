# Deploy scripts

Two PowerShell scripts to host this app on a **server PC** on your LAN.

| Script | Runs on | What it does |
|--------|---------|--------------|
| `export-data.ps1` | **Dev PC** (has the live data) | Dumps your DB into `database/docker-init/01-data.sql` so it travels with the project. |
| `deploy.ps1` | **Server PC** | Pulls latest code + builds + starts the whole stack with Docker. |
| `backup.ps1` | **Server PC** | Snapshots the live database to `backups\`. Safe to run while people use the app. |
| `restore.ps1` | **Server PC** | Restores a backup. Also the disaster-recovery path onto a new machine. |

## First deployment

**On your dev PC** — snapshot the data you want the server to start with:
```powershell
.\scripts\export-data.ps1                       # from XAMPP (default)
# or:  .\scripts\export-data.ps1 -Source docker -DbPassword office_dev_pw
```

> **The seed file does NOT travel through git.** `database/docker-init/*.sql` is gitignored on
> purpose — those dumps contain real student data and password hashes, which must never be pushed
> to a hosted repo. Copy `database/docker-init/01-data.sql` to the server PC **by hand** (USB,
> network share, or `scp`) into the same `database/docker-init/` folder there.

**On the server PC** — one-time setup, then deploy:
```powershell
git clone <your-repo-url>
cd "acadamic management system"
Copy-Item .env.example .env          # then edit .env: set NODE_ENV=production, DB_PASSWORD, JWT_SECRET, CORS_ORIGIN
# Firewall (Admin PowerShell): New-NetFirewallRule -DisplayName "AMS App" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
.\scripts\deploy.ps1 -FreshData      # -FreshData loads 01-data.sql into an empty DB
```

## Later updates (code only, keep server data)
```powershell
# dev PC:   push your changes as usual
# server PC:
.\scripts\deploy.ps1
```

## Pushing a NEW data snapshot to the server (overwrites server data)
```powershell
# dev PC:   .\scripts\export-data.ps1   ->  copy 01-data.sql to the server by hand
# server PC:
.\scripts\deploy.ps1 -FreshData        # wipes the DB volume, reloads the fresh dump
```

## What the current seed contains

The seed shipped for hosting is a **clean starter**: master data only, no student records.

| Kept (has rows) | Emptied (starts at zero) |
|---|---|
| `courses` — your 5 programs | `student`, `student_personal_details` |
| `app_user` / `user` — login accounts | `admission` |
| `certificate_template` — Bonafide/TC formats | `fee`, `fee_structure` |
| `custom_field` — admin-defined fields | `certificate` (issued ones) |
| `staff`, `academic_coordinator` | `weekly_diary`, `activity_log` |

Emptied tables have their `AUTO_INCREMENT` reset, so the first record created on the server gets id 1.

**Fee structures are empty** — re-enter them in the app (Fee Structures page) on the server before
admissions, or the fee calculation has no amounts to work from.

A full dump of your real data is kept at `database/full-dump-backup.sql` (gitignored, never
deployed) in case you need to restore it locally.

---

# Backups (after hosting)

**All application data lives in MySQL.** File imports are parsed in memory
(`multer.memoryStorage()`), nothing is written to disk, and no table stores file paths or blobs.
So a single `backup.ps1` dump is a *complete* backup - there is nothing else on the server to save.

```powershell
.\scripts\backup.ps1                      # -> backups\ams-backup-<timestamp>.sql
.\scripts\backup.ps1 -KeepDays 30         # prune backups older than 30 days
.\scripts\backup.ps1 -OutDir E:\ams-backups   # write straight to a USB/network drive
```

Runs against the live database with `--single-transaction`, so it does **not** lock tables or
interrupt anyone using the app. Every backup is checked for the `Dump completed` marker and the
script fails loudly if the file is truncated.

## Restoring

```powershell
.\scripts\restore.ps1 -Latest                              # newest backup
.\scripts\restore.ps1 -File backups\ams-backup-....sql     # a specific one
```

Refuses to run if the backup file is truncated - it verifies *before* touching your data.
Afterwards, run `docker compose restart backend`.

## If the server PC dies

1. Install Docker on the new PC, get the project there, create `.env`.
2. `docker compose up -d`
3. `.\scripts\restore.ps1 -File <latest backup>.sql`

## Automating it (recommended)

Task Scheduler -> Create Task -> Daily, Action = Start a program:

- Program: `powershell.exe`
- Arguments: `-ExecutionPolicy Bypass -File "D:\path\to\project\scripts\backup.ps1" -KeepDays 30`
- Check "Run whether user is logged on or not"

> **A backup on the same disk as the database is not a backup.** Copy `backups\` to a USB drive,
> network share, or cloud folder regularly - or point `-OutDir` at one directly.

## Verified

This round trip was tested end to end on an isolated copy of the stack: seed loaded -> records
added -> `backup.ps1` -> database volume destroyed (`down -v`) -> rebuilt empty -> `restore.ps1`.
All rows returned with an identical MD5 checksum, including JSON custom fields and NULLs.

> **`-FreshData` erases the server's database** and reloads `01-data.sql`. Only use it for the first
> deploy or when you deliberately want to replace all server data. A plain `.\scripts\deploy.ps1`
> keeps existing data and just updates the code.

If you copied the folder instead of cloning, add `-NoPull` to `deploy.ps1`.
