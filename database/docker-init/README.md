# docker-init — first-run database seed for Docker

Every `*.sql` file here is executed **once**, in filename order, when the MySQL
container initialises a brand-new (empty) data volume — i.e. the very first
`docker compose up` or any `up` after `docker compose down -v`.

## Use your real data (recommended)

Dump your existing database and drop it here as `01-data.sql`:

```bash
# from XAMPP's MariaDB
"C:\xampp\mysql\bin\mysqldump.exe" -u root office_management > database/docker-init/01-data.sql
```

That single dump contains the **complete schema, your records, and login
accounts**, so the app is fully working after `docker compose up -d --build`.

## Notes
- `*.sql` files in this folder are **git-ignored** (they can hold password
  hashes and real data). Only this README is tracked.
- The plain `database/schema.sql` does **not** include the `app_user` /
  `activity_log` tables (those were added by later migrations), so seeding from
  `schema.sql` alone would leave you with no way to log in. Use a full dump.
- Changing a file here does nothing to an already-initialised volume. Re-seed
  with: `docker compose down -v` then `docker compose up -d --build`.
