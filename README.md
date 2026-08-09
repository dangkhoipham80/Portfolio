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

## Database

Alembic owns the schema; nothing creates tables implicitly any more.

```bash
cd apps/api
python -m alembic upgrade head                     # apply migrations
python -m alembic revision --autogenerate -m "..." # after changing a model
python -m pytest                                   # access-control tests
python -m ruff check .
```

Migrations are committed. Point `DATABASE_URL` at a scratch database when
running the tests — the contact-form cases insert rows.

## Known issues being worked through

- `scripts/init_auth_tables.py` bootstraps an admin with the literal password
  `admin123`. It must read from the environment before anything is deployed.
  The seed script that replaces it is not written yet.
- The content models are still the originals: no `slug`, no draft/published
  state, no career-history table, and `Skill.level` is an integer while the
  frontend uses strings.
- `portfolio/frontend` is still what production serves; `apps/web` is an empty
  Next.js scaffold.
- The `Procfile` runs uvicorn only. Migrations belong in a release/pre-deploy
  step, not the web process — a failed one there takes every instance down.

## Environment

Secrets live in `.env` files, never in git. See `apps/api/.env.example` and
`portfolio/frontend/env.example`. `VITE_CV_URL` must be set in Vercel or the
CV download 404s — the PDF is deliberately not committed.
