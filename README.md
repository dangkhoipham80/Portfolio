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

`apps/web` reads its content from the API. Pages are React Server Components, so
the fetch happens on the server: the browser never calls the API, CORS does not
apply, and `API_URL` is not shipped to the client. Every read has a fallback —
if the API is unreachable the page still renders with an empty section rather
than a 500, because this replaces a static site that could not break.

## Running it

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # point API_URL at the API
pnpm dev                # apps/web on :3000

cd apps/api
python -m venv .venv && .venv/Scripts/activate   # or bin/activate on unix
pip install -r requirements-dev.txt
cp .env.example .env    # fill in DATABASE_URL and SECRET_KEY
uvicorn app.main:app --reload --port 8000
```

If port 8000 is taken, run the API elsewhere and set `API_URL` to match — the
web app has no other way to find it.

Root scripts: `pnpm dev` / `build` / `lint` / `type-check` / `test` / `test:e2e`
for the web app, and `pnpm api:dev` / `api:lint` / `api:test` for the API — the
API ones invoke `python -m ...`, so **activate the virtualenv first** or they
will not resolve.

## Tests

87 on the API, 72 on the web app, split across three runners that each answer a
question the others cannot.

```bash
pnpm test          # vitest — 46 unit tests, under a second, no browser
pnpm test:e2e      # playwright — 26 tests in Chromium against a production build
pnpm api:test      # pytest — 87 tests, needs the virtualenv and a scratch database
```

**Vitest covers the modules that are plain functions**: every way a request in
`lib/api.ts` can fail, and the contact form's field rules in `lib/contact.ts`.
One of those tests reads `apps/api/app/schemas/portfolio.py` and compares the
field limits directly, because the comment saying they mirror the API is not
something a comment can enforce.

**Playwright covers what only exists once a page is rendered**: the empty
states, and the contact form's 429 and outage notices. It builds the app against
a port it has checked is closed, then serves that build with `API_URL` pointing
at a stub. That split is the whole design — every page here is prerendered, so
the fallback is chosen at *build* time, while the Server Action behind the
contact form runs per request and reaches the stub. One build, both states, and
no real API is ever contacted.

**There are no component tests, and that is a decision.** The jsdom layer
between these two would need a faked DOM, a faked `useActionState` and a stubbed
Server Action to ask a question Playwright already answers against the real
thing.

The e2e servers default to ports 3142 and 8142, and fail immediately rather than
reuse anything already listening — a port quietly answered by another project is
how a suite ends up testing software that is not this one. Override with
`E2E_WEB_PORT` and `E2E_STUB_PORT`.

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

## Design

Tokens live in `apps/web/app/globals.css` — colour, a three-step radius scale,
and three type roles: Space Grotesk (display), IBM Plex Sans (body), IBM Plex
Mono (eyebrows and meta rows). Mono is doing real work there: those lines are
counts, dates and field names, which is the vocabulary of the subject.

Primitives are in `apps/web/components/ui/`. Check what exists before writing a
component; a class string that appears twice belongs in one of them.

**Light mode deviates from the Vite app's palette in two places.** The
background is a tinted green rather than white, and that tint ate the contrast
margin: the legacy `--muted-foreground` measured 4.40:1 on it and `--primary`
measured 3.86:1 as text, both under the 4.5:1 AA threshold. Both were darkened.
Dark mode's `--primary-foreground` was also flipped from near-white to near-black,
because the mid-lightness purple primary under white text measured 3.29:1 — a
pairing only the filled buttons use, which is why it went unnoticed.

### Why the hero is SVG and not three.js

The signature element is an animated service topology built from the real stack
in these projects — FastAPI, Postgres, Redis, Kafka. It is inline SVG rendered
on the server, with one CSS keyframe animating the edge strokes.

three.js was considered and rejected for this slot. It costs ~150KB gzipped
before anything is drawn, forces a client component and a canvas into the
highest-priority region of the page, and a rotating abstract shape would say
nothing about backend engineering. The topology costs no JavaScript, cannot
affect LCP, and stops dead under `prefers-reduced-motion` through the global
rule rather than needing its own opt-out.

If a WebGL layer is wanted later, the constraint to keep is placement: below the
fold, dynamically imported, gated on `prefers-reduced-motion` and on a coarse
pointer check so phones do not pay for it.

## Known issues being worked through

- `portfolio/frontend` is still what production serves, and it does not call
  this API at all — its projects, skills, certificates and career entries are
  hardcoded arrays inside the components, and the contact form posts to EmailJS
  with the service keys inline. `VITE_API_URL` is declared in `env.example` and
  read by nothing. `apps/web` is the replacement, but Vercel's root directory
  has not been switched over yet.
- The legacy decorative layer — meteors, drifting stars, the fifteen keyframe
  animations in `portfolio/frontend/src/index.css` — is not ported. Only the
  colour tokens are.
- Project images are unused: `image_url` is null on every row, so
  `ProjectMedia` renders its generated placeholder everywhere.
- The contact form stores a message and nothing else happens. There is no email
  notification, so a message is only seen by someone opening the admin endpoint.
- Locally, the API tests and the seed script still write to whatever
  `DATABASE_URL` names. CI runs them against a throwaway Postgres service
  container; on a development machine, pointing `DATABASE_URL` at a scratch
  database is still a matter of remembering to.

## Environment

Secrets live in `.env` files, never in git. See `apps/api/.env.example` and
`portfolio/frontend/env.example`. `VITE_CV_URL` must be set in Vercel or the
CV download 404s — the PDF is deliberately not committed.
