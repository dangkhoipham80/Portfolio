# Portfolio

Personal portfolio of Phạm Đăng Khôi — a full-stack app, not a static site.

## Layout

```
apps/
├── web/                Next.js 16 (App Router, React 19, Tailwind v4)
└── api/                FastAPI + SQLAlchemy + Alembic, Postgres (Neon)
portfolio/frontend/     the legacy Vite SPA — still what production serves
```

`apps/web` is being built to replace `portfolio/frontend`. The Vite app stays
deployed until the Next.js one passes its smoke tests, then Vercel's root
directory switches over and `portfolio/` is deleted.

## Running it

```bash
pnpm install
pnpm dev                # apps/web on :3000

cd apps/api
python -m venv .venv && .venv/Scripts/activate   # or bin/activate on unix
pip install -r requirements-dev.txt
cp .env.example .env    # fill in DATABASE_URL and SECRET_KEY
uvicorn app.main:app --reload --port 8000
```

Root scripts: `pnpm dev` / `build` / `lint` / `type-check` for the web app, and
`pnpm api:dev` / `api:lint` / `api:test` for the API — the API ones invoke
`python -m ...`, so **activate the virtualenv first** or they will not resolve.

## Known issues being worked through

The backend has not been deployed yet, and it should not be until the block
below is cleared.

**Security — the dependency pins are from late 2023 and carry known CVEs:**

| Package | Pinned | Issue |
|---|---|---|
| `python-jose` | 3.3.0 | CVE-2025-61152 `alg=none` signature bypass; CVE-2024-33663 algorithm confusion; CVE-2024-33664 JWE decompression DoS. Unmaintained since 2022 — no fixed version exists. Migrate to **PyJWT**. |
| `fastapi` | 0.104.1 | Floors Starlette at 0.27.x → CVE-2026-48710 (`Host` header auth bypass), CVE-2024-47874, CVE-2025-62727. Upgrade to 0.115.x+. |
| `python-multipart` | 0.0.6 | CVE-2024-24762 and CVE-2024-53981, both unauthenticated DoS. Needs ≥ 0.0.18. |
| `passlib` | 1.7.4 | Unmaintained; breaks on bcrypt ≥ 4.1. `bcrypt` is pinned to 4.0.1 as a stopgap — with bcrypt 5.x, `CryptContext.hash()` raises for *every* password and auth stops working entirely. |

**Correctness:**

- Every write route is unauthenticated. `require_admin` exists in
  `app/api/v1/dependencies.py` and is applied to exactly zero endpoints, so
  anyone who finds the URL can create or delete content.
- `app/main.py` calls `create_tables()` at *module* level, so merely importing
  the app opens a database connection. This has to go before Alembic can own
  the schema.
- `alembic.ini` is missing (deleted in `32c7391`) and `alembic/versions/` is
  empty — there are no migrations at all. The `Procfile` therefore does not run
  them yet.
- `scripts/init_auth_tables.py` bootstraps an admin with the literal password
  `admin123`. It must read from the environment before anything is deployed.
- The pins have **no Python 3.13 wheels** (`psycopg2-binary==2.9.9`,
  `pydantic-core==2.14.1`). Use Python 3.11 — see `runtime.txt` — until the
  upgrade lands. The modern stack resolves cleanly on 3.13.

## Environment

Secrets live in `.env` files, never in git. See `apps/api/.env.example` and
`portfolio/frontend/env.example`. `VITE_CV_URL` must be set in Vercel or the
CV download 404s — the PDF is deliberately not committed.
