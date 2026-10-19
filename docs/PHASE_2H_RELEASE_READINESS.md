# SAATHI — Phase 2H: Master Release-Readiness & Deployment Runbook

**Milestone Target:** Public Portfolio Demonstration & Safe Core Product Release  
**Status:** Verification Complete — **PASS WITH LIMITATIONS** (Local verification complete; live cloud/database provisioning and deployment pending)  
**Date:** October 2026  
**Document Location:** `docs/PHASE_2H_RELEASE_READINESS.md`

---

## 1. Executive Summary & Release Status

This document establishes the deployment architecture, configuration contracts, isolation boundaries, and ordered procedures required to publish SAATHI as a safe, public portfolio demo and deployable core neighborhood application.

### Current Status
- **Backend Release Controls:** **VERIFIED** via automated tests (Connection pooling, managed PostgreSQL TLS configuration, liveness/readiness probes, graceful shutdown, production CORS enforcement, and fail-closed demo safety guards).
- **Frontend Release Controls:** **VERIFIED** via automated tests and Vite production builds (Strict server-authoritative authentication, explicit API configuration, zero demo shortcuts by default, safe empty states on API failures, and visible demo disclosure banners).
- **Portfolio Demo Boundary:** **VERIFIED** in test harness. Fictional demo seed and reset tooling refuses execution unless four explicit environment variables and live database identity/role checks pass.
- **Physical Infrastructure:** **UNVERIFIED / PENDING**. Cloud database provisioning, network security groups, hosted TLS termination, and CI/CD pipeline triggers require active deployment credentials and have not been executed.

---

## 2. Intended Deployment Architecture

SAATHI utilizes a decoupled client-server architecture with strict separation between the **Public Portfolio Demo** environment and any future **Real-Community Production** environment.

```
                           [ Visitor / Evaluator Browser ]
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
         [ Portfolio Demo Frontend ]             [ Real-User Frontend (Future) ]
         Vercel / Cloudflare Pages               Vercel / Cloudflare Pages
         VITE_DEMO_MODE=true                     VITE_DEMO_MODE=false
         VITE_API_BASE_URL=https://demo-api...   VITE_API_BASE_URL=https://api...
                    │                                         │
                    ▼                                         ▼
         [ Portfolio Demo Backend ]              [ Real-User Backend (Future) ]
         Render / Railway / Cloud Run            Render / Railway / Cloud Run
         NODE_ENV=production                     NODE_ENV=production
         ALLOWED_ORIGINS=https://demo...         ALLOWED_ORIGINS=https://app...
         DATABASE_URL=.../saathi_demo            DATABASE_URL=.../saathi
                    │                                         │
                    ▼                                         ▼
         [ Dedicated Demo DB ]                   [ Real Production DB ]
         Managed PostgreSQL (AWS / Supabase)     Managed PostgreSQL (Separate instance)
         Database: saathi_demo                   Database: saathi
         Role: saathi_demo_user (Least Privileged) Role: saathi_app_user
         Data: Fictional Oakridge Personas       Data: Live neighborhood residents
```

### Key Architectural Invariants
1. **Two Completely Separate Databases:** The portfolio demo API connects *exclusively* to `saathi_demo`. It must never share a database, schema, or credentials with the production database `saathi`.
2. **Static Frontend Hosting:** Hosted via Vercel, Cloudflare Pages, or static S3/CloudFront. Frontend builds compile all `VITE_*` variables directly into public client JS assets.
3. **Containerized / Node.js Backend:** Hosted on a Node 20+ runtime (e.g. Render, Railway, AWS App Runner, Cloud Run).
4. **Managed PostgreSQL with TLS:** Requires TLS connection (`DATABASE_SSL=require` or `DATABASE_SSL=true`) with `DATABASE_SSL_REJECT_UNAUTHORIZED=true`.
5. **No Public Demo Reset Route:** Demo reset (`scripts/reset_demo.js`) is an operator CLI script run via secure administrative shell or scheduled maintenance job. It is **never** exposed as an unauthenticated HTTP endpoint.

---

## 3. Environment Variables & Configuration Inventory

### A. Backend (`saathi-api-updated-003/saathi-api-updated`)

| Variable Name | Public / Secret | Environments | Purpose & Requirements | Safe Example Value |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Non-Secret | Dev, Demo, Prod | Execution mode. When set to `production`, enforces strict CORS, strict DB config, and hides stack traces. | `production` |
| `PORT` | Non-Secret | Dev, Demo, Prod | HTTP listening port for Express server. | `3000` |
| `DATABASE_URL` | **SECRET** | Dev, Demo, Prod | PostgreSQL connection string. Must target `saathi_demo` in demo and `saathi` in prod. | `postgres://saathi_demo_user:safe_pass@db.provider.internal:5432/saathi_demo` |
| `DATABASE_SSL` | Non-Secret | Demo, Prod | TLS enforcement mode (`require`, `verify-full`, `true`, `false`). Required for managed cloud DBs. | `require` |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Non-Secret | Demo, Prod | Enforces valid CA certificates. Must be `true` in production unless custom CA is used. | `true` |
| `DATABASE_SSL_CA` | **SECRET** | Optional (Prod) | Inline custom CA PEM certificate for self-hosted or private cloud databases. | *(PEM certificate string)* |
| `DATABASE_SSL_CA_PATH` | Non-Secret | Optional (Prod) | Filesystem path to CA PEM certificate file. | `/etc/ssl/certs/rds-ca.pem` |
| `DATABASE_CONNECT_TIMEOUT_MS` | Non-Secret | Demo, Prod | Timeout for establishing new database pool connections (ms). Defaults to `5000`. | `5000` |
| `DATABASE_MAX_POOL_SIZE` | Non-Secret | Demo, Prod | Maximum concurrent database connections in pool. Defaults to `10`. | `10` |
| `DATABASE_IDLE_TIMEOUT_MS` | Non-Secret | Demo, Prod | Idle connection release timeout (ms). Defaults to `10000`. | `10000` |
| `DB_READINESS_TIMEOUT_MS` | Non-Secret | Demo, Prod | Maximum wait time for `GET /health/ready` probe. Defaults to `2000`. | `2000` |
| `SHUTDOWN_TIMEOUT_MS` | Non-Secret | Demo, Prod | Bounded drain time during SIGTERM/SIGINT before forceful exit. Defaults to `10000`. | `10000` |
| `ALLOWED_ORIGINS` | Non-Secret | Demo, Prod | Comma-separated list of exact allowed browser origins. Wildcards strictly rejected in production. | `https://demo.saathi.community` |
| `SESSION_TTL_DAYS` | Non-Secret | Demo, Prod | Session token lifetime in days. Defaults to `30`. | `30` |
| `ENABLE_EMERGENCY_ROUTES` | Non-Secret | Dev, Demo, Prod | Feature flag gating emergency/SOS routes. Must remain `false` for initial demo. | `false` |
| `DEMO_MODE` | Non-Secret | Demo Tooling Only | Authorizes demo seed/reset script execution. Refuses run if not `true`. | `true` |
| `ALLOW_DEMO_RESET` | Non-Secret | Demo Tooling Only | Authorizes table truncation and data overwrite in demo DB. Refuses run if not `true`. | `true` |
| `EXPECTED_DEMO_DB_NAME` | Non-Secret | Demo Tooling Only | Fail-closed safeguard. Must be configured strictly as `saathi_demo`. | `saathi_demo` |
| `EXPECTED_DEMO_ROLE` | Non-Secret | Demo Tooling Only | Fail-closed role guard. Must match PostgreSQL `SELECT current_user`. | `saathi_demo_user` |

### B. Frontend (`saathi-frontend`)

> **CRITICAL SECURITY NOTE:** All `VITE_*` variables are embedded into client JavaScript bundles and are readable by any site visitor. **Never place secrets, private tokens, or database passwords in frontend configuration.**

| Variable Name | Public / Secret | Environments | Purpose & Requirements | Safe Example Value |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Public | Dev, Demo, Prod | Target backend API base URL without trailing slash. Validated at build time; build fails if missing or malformed. | `https://demo-api.saathi.community` |
| `VITE_DEMO_MODE` | Public | Demo Only | Enables demo login shortcuts, persona prefill, and top disclosure banner. Must be unset or `false` in production. | `true` (Demo) / `false` (Prod) |

---

## 4. Demo vs Production Separation Requirements

To ensure zero risk of data leakage, corruption, or confusion between the public portfolio demo and any future real-world usage, the following 10 rules must be enforced:

| Requirement | Implementation Summary | Status / Category |
| :--- | :--- | :--- |
| **1. Dedicated Demo Database** | Demo API connects exclusively to database named `saathi_demo`. Real-user API connects to separate database `saathi`. | **Verified from repository/tests** (`demo_guard.js`, `db.js`) |
| **2. Separate Credentials & Roles** | Demo role (`saathi_demo_user`) possesses separate credentials from production role (`saathi_app_user`). | **Documented but not verified** (Requires DB provisioning) |
| **3. Least-Privileged Demo Role** | `saathi_demo_user` must be created with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`. | **Documented but not verified** (PostgreSQL DDL requirement) |
| **4. Zero Cross-Database Access** | Demo role must have `REVOKE ALL ON DATABASE saathi FROM saathi_demo_user` and no access to test databases. | **Requires live infrastructure verification** |
| **5. Decoupled Seed/Reset Authorization** | Seed/reset cannot be triggered by normal API startup or HTTP requests; requires 4 explicit CLI flags. | **Verified from repository/tests** (`tests/phase2h_demo_boundary_test.js`) |
| **6. Credential Quarantine** | Public demo credentials (`*.demo@saathi.local` / `DemoSecret123!`) exist *only* in `saathi_demo` and are never seeded or accepted in `saathi`. | **Verified from repository/tests** (`seed_demo.js`, `demoConfig.js`) |
| **7. No Public Reset Route** | The backend exposes no HTTP route capable of triggering `resetDemo()`. Reset is strictly an administrative CLI tool. | **Verified from repository/tests** (`src/routes/`, `src/app.js`) |
| **8. Independent Deployment Environments** | Demo and production deployments must run in separate host projects with disjoint environment variable configurations. | **Documented but not verified** (Hosting provider setup) |
| **9. Zero Real Data Ingestion** | No real resident personal details, addresses, phone numbers, or coordinates may ever be imported into `saathi_demo`. | **Verified from repository/tests** (Fictional Oakridge baseline) |
| **10. Clear Fictional Disclosure** | When demo mode is active, all views render unambiguous disclaimers stating data is simulated fixtures. | **Verified from repository/tests** (`LoginView.jsx`, `Dashboard.jsx`) |

---

## 5. Ordered Deployment Steps

Follow these exact steps when deploying SAATHI for the first time:

### Step 1: Managed Database Provisioning
1. Provision a managed PostgreSQL instance (e.g. Neon, AWS RDS, Supabase).
2. **Database and Role Identity Requirements:**
   - Isolated demo database name: `saathi_demo` (strictly verified by `scripts/demo_guard.js` via `EXPECTED_DEMO_DB_NAME=saathi_demo` and live query `SELECT current_database()`).
   - Dedicated demo login role: `saathi_demo_user` (strictly verified by `scripts/demo_guard.js` via `EXPECTED_DEMO_ROLE=saathi_demo_user` and live query `SELECT current_user`).
   - The demo role must be least-privileged: `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`.
3. **Privileges, Object Ownership, and Extension Constraints:**
   - **Database vs. Schema Privileges:** In PostgreSQL (including Neon), database privileges (`CONNECT`, `CREATE`) and schema privileges (`USAGE`, `CREATE ON SCHEMA public`) are distinct. In PostgreSQL 15+, `CREATE` privilege on schema `public` is no longer granted by default; it must be explicitly granted to the migration role within `saathi_demo`.
   - **Object Ownership for Migrations:** Migrations `001` through `008` create domain tables, functions, and triggers, followed by incremental `ALTER TABLE` and trigger additions. In PostgreSQL, a role must own a table to alter its structure or attach triggers. Running migrations as `saathi_demo_user` ensures that this role owns the created objects and can apply all subsequent migration scripts.
   - **`pgcrypto` Extension:** Migration `001_baseline.sql` executes `CREATE EXTENSION IF NOT EXISTS pgcrypto;`. Installing an extension in PostgreSQL requires database-level `CREATE` privilege (for trusted extensions) or administrative/owner authority; `IF NOT EXISTS` skips creation only if the extension already exists on the database. If `saathi_demo_user` lacks extension creation privileges, `pgcrypto` must be installed administratively (e.g. via `neondb_owner`) before running migrations.
4. **Provisioning Execution (Neon SQL Editor vs. `psql` CLI):**
   - *Tooling distinction:* `\c saathi_demo` is a `psql` client meta-command and is **invalid SQL** in the Neon Web SQL Editor. In the Neon Console, switch database context using the database selector dropdown menu in the SQL Editor, or execute commands through separate database connections.
   - **Administrative Setup (run in default/admin database context as `neondb_owner` or superuser):**
     ```sql
     CREATE DATABASE saathi_demo;
     CREATE USER saathi_demo_user WITH PASSWORD '<STRONG_RANDOMLY_GENERATED_PASSWORD>';
     ALTER ROLE saathi_demo_user NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
     GRANT CONNECT ON DATABASE saathi_demo TO saathi_demo_user;
     ```
   - **Database-Scoped Setup (run directly within `saathi_demo` via console database selector or `psql -d saathi_demo`):**
     ```sql
     -- As admin (neondb_owner), install pgcrypto inside saathi_demo before running migrations:
     CREATE EXTENSION IF NOT EXISTS pgcrypto;

     -- Grant schema privileges required for migration table, function, and trigger creation:
     GRANT USAGE, CREATE ON SCHEMA public TO saathi_demo_user;

     ```
5. Verify that `saathi_demo_user` cannot access any other databases (e.g. default `neondb` or production `saathi`).

### Step 2: Database Migration
1. From an administrative terminal or deployment task, run the idempotent migration runner against `saathi_demo`:
   ```bash
   DATABASE_URL="postgres://saathi_demo_user:<PASSWORD>@<HOST>:5432/saathi_demo" \
   DATABASE_SSL="require" \
   npm run migrate
   ```
2. Verify migration success:
   ```bash
   DATABASE_URL="postgres://saathi_demo_user:<PASSWORD>@<HOST>:5432/saathi_demo" \
   DATABASE_SSL="require" \
   npm run verify-schema
   ```

### Step 3: Populate Fictional Demo Seed
1. Run the isolated demo seed script with all 4 mandatory authorization variables:
   ```bash
   DEMO_MODE=true \
   ALLOW_DEMO_RESET=true \
   EXPECTED_DEMO_DB_NAME=saathi_demo \
   EXPECTED_DEMO_ROLE=saathi_demo_user \
   DATABASE_URL="postgres://saathi_demo_user:<PASSWORD>@<HOST>:5432/saathi_demo" \
   DATABASE_SSL="require" \
   npm run demo:seed
   ```
2. Confirm the output reports:
   - Hubs: 1
   - Personas: 4
   - Resources: 3
   - Coordinations: 1
   - Issues: 1
   - Queries: 1

### Step 4: Deploy Backend Application
1. Configure backend host environment variables:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `DATABASE_URL=postgres://saathi_demo_user:<PASSWORD>@<HOST>:5432/saathi_demo`
   - `DATABASE_SSL=require`
   - `DATABASE_SSL_REJECT_UNAUTHORIZED=true`
   - `ALLOWED_ORIGINS=https://demo.saathi.community`
   - `ENABLE_EMERGENCY_ROUTES=false`
2. Start the application:
   ```bash
   npm start
   ```
3. Test health endpoints:
   - `curl -i https://demo-api.saathi.community/health/live` -> Expect `HTTP 200`
   - `curl -i https://demo-api.saathi.community/health/ready` -> Expect `HTTP 200` with `database: "connected"`

### Step 5: Build and Deploy Frontend
1. Set frontend build-time environment variables in hosting provider (e.g. Vercel):
   - `VITE_API_BASE_URL=https://demo-api.saathi.community`
   - `VITE_DEMO_MODE=true`
2. Execute production build:
   ```bash
   npm run build
   ```
3. Deploy compiled `dist/` directory to static hosting.

### Step 6: Post-Deployment Smoke Testing
1. Visit `https://demo.saathi.community` in desktop and mobile browsers.
2. Confirm top disclosure banner `"PORTFOLIO DEMO MODE — FICTIONAL DATA"` is visible.
3. Click demo persona button (e.g. Alice Xu) on `LoginView` and click Enter.
4. Verify direct navigation to the Greenwood Commons 3D dashboard.
5. Verify resources, coordination list, and issues load from the live API.
6. Verify CORS headers in browser DevTools Network tab (`access-control-allow-origin: https://demo.saathi.community`).

---

## 6. Health Checks, Smoke Tests & Recovery Procedures

### Health Check Commands
```bash
# 1. Process Liveness Check (Should return HTTP 200)
curl -s -o /dev/null -w "%{http_code}\n" https://demo-api.saathi.community/health/live

# 2. Database Dependency Readiness Check (Should return HTTP 200)
curl -s https://demo-api.saathi.community/health/ready

# 3. CORS Preflight Verification (Should return Access-Control-Allow-Origin)
curl -I -X OPTIONS https://demo-api.saathi.community/auth/me \
  -H "Origin: https://demo.saathi.community" \
  -H "Access-Control-Request-Method: GET"
```

### Public Demo Periodic Reset Procedure
If public evaluators submit test data or alter resource request states, the database can be reset back to the pristine fictional baseline at any time:
```bash
DEMO_MODE=true \
ALLOW_DEMO_RESET=true \
EXPECTED_DEMO_DB_NAME=saathi_demo \
EXPECTED_DEMO_ROLE=saathi_demo_user \
DATABASE_URL="postgres://saathi_demo_user:<PASSWORD>@<HOST>:5432/saathi_demo" \
DATABASE_SSL="require" \
npm run demo:reset
```
*Note: Truncates operational tables in foreign-key safe cascade order while preserving `schema_migrations` and `task_taxonomy`.*

### Rollback Procedure
If a backend deployment introduces runtime errors or fails readiness checks:
1. **Traffic Rollback:** In the hosting provider (e.g. Render, Railway, Cloud Run), roll back the active deployment revision to the previous working image.
2. **Database State:** Since migrations in SAATHI are forward-only and additive (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), rolling back the backend code to the previous release does not require database rollback.
3. **Frontend Rollback:** In Vercel / Cloudflare Pages, revert the deployment alias to the previous production deployment with one click.

---

## 7. Master Go / No-Go Release Gate Checklist

| Release Gate Item | Status | Verification Detail |
| :--- | :---: | :--- |
| **Frontend production build succeeds** | **VERIFIED** | `vite build` completed in 751ms (`dist/` generated with minified JS/CSS) |
| **Backend starts with production configuration** | **VERIFIED** | Tested via `phase2h_server_hardening_test.js` and `phase2h_cors_env_test.js` |
| **Readiness checks work against hosted database** | **UNVERIFIED** | Verified with mock client; requires live cloud database connection |
| **Managed PostgreSQL TLS verified** | **UNVERIFIED** | Logic handles TLS modes; requires live cloud DB TLS handshake |
| **CORS works for exact deployed frontend origin** | **VERIFIED** | Strict origin validation tested; rejects wildcards and localhost in prod |
| **Authentication & core flows tested in cloud** | **UNVERIFIED** | Core services tested locally; requires live deployed browser smoke test |
| **Emergency/SOS remains disabled** | **VERIFIED** | `ENABLE_EMERGENCY_ROUTES=false` in `.env.example` and guarded in routes |
| **Demo and production use separate databases** | **VERIFIED** | Guard verifies `EXPECTED_DEMO_DB_NAME=saathi_demo`; requires separate DBs |
| **Public demo login works only against demo API** | **VERIFIED** | Fictional accounts quarantined to `saathi_demo` seed script |
| **No secrets in client bundle or repo** | **VERIFIED** | Verified client bundle contains only public URLs and demo flags |
| **Deployment logs & error handling usable** | **VERIFIED** | Structured JSON error responses, connection sanitation verified |
| **Recovery & rollback plan documented** | **VERIFIED** | Defined in Section 6 of this runbook |
| **Desktop and mobile browser responsiveness** | **UNVERIFIED** | Tested in local dev; requires final smoke test on deployed domain |

---

## 8. Final Recommendation

**Go / No-Go Verdict:** **READY FOR INFRASTRUCTURE PROVISIONING**

All codebase hardening, configuration contracts, fail-closed boundaries, and build steps are complete and verified. The single blocker to public release is the physical provisioning of the cloud infrastructure (database, backend host, and frontend host).
