# Portfolio

Personal portfolio of Phạm Đăng Khôi — a full-stack app, not a static site.

## Layout

```
apps/
├── web/                Next.js 16 (App Router, React 19, Tailwind v4)
└── api/                FastAPI + SQLAlchemy + Alembic, Postgres (Neon)
```

There was a third directory here, `portfolio/frontend` — a Vite SPA whose
content was hardcoded arrays inside the components and whose contact form posted
to EmailJS with the keys inline. It served production until the cutover on
2026-08-09 and has been deleted. Its EmailJS credentials are still in the git
history of a public repository, so that template was disabled rather than
trusted to be unreachable.

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

## Deployment

The site is at **https://khoipham.vercel.app**. The API is at
**https://khoi-portfolio-api.fly.dev**.

| | where | how it gets there |
|---|---|---|
| `apps/web` | Vercel, root directory `apps/web` | pushing to `main` |
| `apps/api` | Fly.io, `khoi-portfolio-api`, one 256MB machine in `iad` | pushing to `main`, if `apps/api` changed and CI passed |

The API deploy is a job in `ci.yml` rather than a workflow of its own, so that
`needs: api` can hold it behind ruff, the migrations and all 93 tests on that
same commit. It skips when nothing under `apps/api` changed — there is one
machine, so a needless rollout is a few seconds during which the contact form
gets a connection refused — and it finishes by asking the deployed API for real
content, because a passing health check only proves the process started.

`iad` is deliberate. No browser ever contacts the API — `lib/api.ts` is
`server-only` — so every caller is a Vercel build, an ISR revalidation or the
contact Server Action, all us-east, and the Neon database is in `us-east-2`. The
same endpoint measured 51ms from `iad` and roughly 0.8s from Singapore, which is
a meaningful share of the 5s budget in `lib/api.ts`.

Fly runs `alembic upgrade head` as a `release_command` on a separate machine, so
a failed migration aborts the deploy instead of taking the running version with
it. Secrets are set with `fly secrets`, never committed; `ENVIRONMENT` and
`DEBUG` come from `fly.toml` instead, because a secret would override them and
`.env` has them set to development values.

## Tests

93 on the API, 72 on the web app, split across three runners that each answer a
question the others cannot.

```bash
pnpm test          # vitest — 46 unit tests, under a second, no browser
pnpm test:e2e      # playwright — 26 tests in Chromium against a production build
pnpm api:test      # pytest — 93 tests, needs the virtualenv and a scratch database
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

Neither the `Dockerfile` nor the `Procfile` runs migrations. They belong in a
release/pre-deploy step — a failed one in the web process takes every instance
down, and concurrent instances race for the lock on rollout. `fly.toml` runs
them as its `release_command`.

`Procfile` and `runtime.txt` are kept although Fly uses neither: together they
are all a buildpack host needs, so moving to Railway or Render stays a decision
rather than a rewrite.

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

## Console access

`/login` is the one way in; there is no public sign-up, and the single admin
account comes from `init_auth_tables.py` above. `/forgot-password` mails a
one-hour, single-use link to `/reset-password?token=...`, and spending it
revokes every token the account holds — which is what makes a reset the remedy
for a stolen session rather than just a new password beside a live old one.

Two properties are deliberate and easy to undo by accident:

- **The request answers the same 200 for an address that has an account and one
  that does not**, and the confirmation screen says "if there is an account for
  …" rather than "we have emailed you". Either half alone leaks which addresses
  are registered — the API's four early returns in `request_password_reset` and
  the wording in `components/forgot-password-form.tsx` have to agree.
- **A missing, malformed, expired and already-spent link all land on one
  screen.** Telling them apart would say whether a given token ever existed.

Mail needs `SMTP_USER` / `SMTP_PASSWORD`; with them blank nothing is sent, the
token is still minted, and the API logs a warning rather than 500ing — a failure
there would itself be the enumeration signal. `FRONTEND_URL` is what the link in
the mail points at. Leave it unset and it falls back to the first
`BACKEND_CORS_ORIGINS` entry, which is right locally and wrong as soon as that
list carries a preview origin.

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

### The home page is an island

The home page is a small open world: a low-poly island drawn with three.js
through `@react-three/fiber`, with one landmark per section of the site — the
lighthouse is the work, the cairn the stack, the big tree the writing, the
mountain the career, the pavilion the credentials, the cabin the way to get
in touch, and the owner stands at the crossroads. The visitor walks it in
third or first person (WASD, click-to-walk, a joystick on touch), talks to
the people on it, follows the fox to whatever they have not found yet, and
arriving at a place opens that section as a panel over the scene.

The content is not in the scene. Every panel is a server component built
from the same reads the rest of the site uses, handed to the world twice: as
panels to open on arrival, and as the *atlas* — the same sections in walking
order, which is what the server renders, what a browser without WebGL gets,
what a hash link like `/#projects` scrolls to without the scene, and what
"read it as a list" opens for anyone who would rather not walk. The people
on the island say what the data says: the keeper names the newest project
because there is one, and says the lighthouse is dark when the API is asleep.

The constraints that were set when this slot was still SVG still hold: the
renderer is dynamically imported and never reaches a page that does not draw
the island; nothing idles under `prefers-reduced-motion` and the camera cuts
rather than swoops; the canvas stops drawing off screen; and the page's
content exists in the HTML before any of it loads. See
`apps/web/components/world/` — `places.ts` and `content.ts` are the data,
`world.tsx` is the orchestration, `scene.tsx` the renderer.

## Known issues being worked through

- The legacy decorative layer — meteors, drifting stars, the fifteen keyframe
  animations the Vite app carried — is not ported. Only the colour tokens are.
- Project images are unused: `image_url` is null on every row, so
  `ProjectMedia` renders its generated placeholder everywhere.
- Locally, the API tests and the seed script still write to whatever
  `DATABASE_URL` names. CI runs them against a throwaway Postgres service
  container; on a development machine, pointing `DATABASE_URL` at a scratch
  database is still a matter of remembering to.

## Environment

Secrets live in `.env` files, never in git — see `apps/api/.env.example` and
`apps/web/.env.example`. In production they are Fly secrets and Vercel
environment variables; nothing reads a `.env` there.

`.dockerignore` is doing security work rather than housekeeping: `COPY` does not
consult `.gitignore`, so without it `apps/api/.env` — the database URL, the
signing key and the SMTP password — is baked into an image layer and survives
any later layer that deletes the file.
