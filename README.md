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
running the tests — the contact-form and content cases insert rows.

The `Procfile` runs uvicorn only. Migrations belong in a release/pre-deploy
step, not the web process — a failed one there takes every instance down, and
concurrent instances race for the lock on rollout.

## Content

The API owns the portfolio content: projects, skills, certificates and career
history. Every content row carries a `slug` and a `published` flag. Public
callers see published rows only; an admin bearer token also returns drafts. An
unpublished row 404s rather than 403s, so whether a draft exists at that id
stays private.

```bash
cd apps/api
ADMIN_EMAIL=... ADMIN_PASSWORD=... python scripts/init_auth_tables.py  # roles + admin
python scripts/seed_content.py --dry-run                               # preview
python scripts/seed_content.py                                         # load content
```

`seed_content.py` carries the real portfolio content and is idempotent — rows
are keyed on slug, so re-running updates in place rather than duplicating.

`Skill.level` is a named enum (`beginner` … `expert`), not the old unlabelled
1-5 integer. `Project.status` is `completed` / `in_progress` / `on_hold` /
`dropped`. A career entry with a null `ended_on` is the current one.

## Known issues being worked through

- `portfolio/frontend` is still what production serves, and it does not call
  this API at all — its projects, skills, certificates and career entries are
  hardcoded arrays inside the components, and the contact form posts to EmailJS
  with the service keys inline. `VITE_API_URL` is declared in `env.example` and
  read by nothing.
- `apps/web` is an empty Next.js scaffold. Pointing it at the content endpoints
  above is the next piece of work.
- There is no CI. `ruff check .` and `pytest` are run by hand.
- Tests and the seed script both write to whatever `DATABASE_URL` names; there
  is no separate test database.

## Environment

Secrets live in `.env` files, never in git. See `apps/api/.env.example` and
`portfolio/frontend/env.example`. `VITE_CV_URL` must be set in Vercel or the
CV download 404s — the PDF is deliberately not committed.
