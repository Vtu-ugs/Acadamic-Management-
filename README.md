# Office Management Software

Student Administration & Financial Records system, implemented from
[`PRD_Office_Management_System3.md`](./PRD_Office_Management_System3.md) (v1.0).

A single, **course-agnostic** data model handles all programs (B.E. – 8 semesters,
M.C.A. – 1–4 semesters) with no schema change when onboarding a new course.

## Tech Stack (PRD §10)

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | React (Vite) + React Router       |
| Backend  | Node.js + Express + Sequelize ORM |
| Database | MySQL                             |
| PDF      | pdfkit (receipts & certificates)  |
| Excel/CSV| xlsx (bulk import/export)         |

## Project Layout

```
management/
├── database/
│   ├── schema.sql        # Tables, FK/UK/CHECK constraints (PRD §5)
│   └── seed.sql          # Sample courses, staff, students, fees…
├── backend/
│   ├── src/
│   │   ├── config/database.js
│   │   ├── models/       # 9 Sequelize models + associations (§5.10)
│   │   ├── controllers/  # student, fee, certificate, import/export, crudFactory
│   │   ├── routes/       # REST endpoints
│   │   └── server.js
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/        # Dashboard, Students, Fees, Certificates, …
        ├── components/   # CrudPage, Modal, useApi
        └── api.js
```

## Prerequisites

- Node.js 18+
- MySQL 8+ (running locally or reachable)

## Setup

### 1. Database

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql      # optional sample data
```

### Run the whole app with Docker (one command)

The fastest path — no Node/XAMPP needed, just
[Docker Desktop](https://www.docker.com/products/docker-desktop/). It builds and
runs **database + backend + frontend** together.

**One-time:** seed the database from your existing data (stop XAMPP's MySQL
first, both use port 3306):

```bash
"C:\xampp\mysql\bin\mysqldump.exe" -u root office_management > database/docker-init/01-data.sql
```

That dump has the full schema + your records + logins; it auto-loads on first
run. (No existing data? See `database/docker-init/README.md`.)

**Then, from the project root:**

```bash
docker compose up -d --build     # build + start everything
docker compose ps                # wait until all services are healthy
```

Open **http://localhost:8080** — the frontend serves the app and proxies `/api`
to the backend. Useful commands:

```bash
docker compose logs -f backend   # tail API logs
docker compose down              # stop (keeps the database volume)
docker compose down -v           # stop AND wipe the database (fresh slate)
```

Before hosting on a public server, change `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD`
and `JWT_SECRET` in `docker-compose.yml`, and put the app behind HTTPS.

#### Just the database in Docker (for local `npm run dev`)

```bash
docker compose up -d db          # only MySQL 8, on localhost:3306
```

Then set `DB_PASSWORD=office_dev_pw` in `backend/.env` and run the backend and
frontend the classic way (below). Reset the DB anytime with
`docker compose down -v`.

### 2. Backend

```bash
cd backend
cp .env.example .env          # then edit DB_USER / DB_PASSWORD
npm install
npm run dev                   # http://localhost:4000  (or: npm start)
```

Check it: open <http://localhost:4000/health> → `{ "status": "ok" }`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

The Vite dev server proxies `/api/*` to the backend on port 4000, so no extra
config is needed in development.

## REST API

Base path: `/api`

| Module        | Endpoints |
|---------------|-----------|
| Students      | `GET/POST /students`, `GET/PUT/DELETE /students/:dsn`, `GET /students/search?q=`, `GET /students/usn-pending`, `PATCH /students/:dsn/usn`, `GET /students/export`, `POST /students/import` |
| Admissions    | `GET/POST /admissions`, `GET/PUT/DELETE /admissions/:id` |
| Fees          | `GET/POST /fees`, `GET /fees/student/:dsn`, `GET /fees/:id/receipt.pdf`, `GET /fees/report/by-year`, `GET /fees/report/by-course`, `GET /fees/report/pending-dues` |
| Certificates  | `GET/POST /certificates`, `DELETE /certificates/:id`, `GET /certificates/:id/document.pdf` |
| Courses       | `GET/POST/PUT/DELETE /courses` |
| Staff         | `GET/POST/PUT/DELETE /staff` |
| Coordinators  | `GET/POST/PUT/DELETE /coordinators` |
| Weekly Diary  | `GET/POST/PUT/DELETE /diary` |

## PRD Requirement Coverage

- **Student (FR-S1…S8):** add/edit with personal details, USN-pending lifecycle
  (`dsn` interim key → `usn` allotted later), priority search (USN → name → mobile → dsn),
  USN-pending report, Excel import/export with duplicate USN/Aadhar validation.
- **Financial (FR-F1…F8):** fee recording with auto `pending_due` / `payment_status`,
  PDF receipts, student-wise history, year-/course-wise reports, dues report, loan fields.
- **Certificates (FR-C1…C6):** Bonafide / TC / NOC templates auto-filled from student
  data, PDF generation, issuance log, remarks.
- **Staff & Coordination (FR-X1…X3):** staff master, coordinators, weekly diary with
  approval workflow.

## Notes & Deviations

- `usn` is `UNIQUE` but nullable — MySQL permits multiple `NULL`s, which is the desired
  "USN pending" behaviour (PRD §5.1). Uniqueness is enforced in the app on USN update/import.
- Auth/RBAC (PRD §4) is **not** implemented in this scaffold — all endpoints are open.
  Add an auth middleware + a `users` table before production use.
- For production deployment guidance (PM2, Nginx, HTTPS, backups) see PRD §11.

## Production build

```bash
cd frontend && npm run build      # outputs frontend/dist (serve via Nginx)
cd backend  && npm start          # run under PM2 in production
```
