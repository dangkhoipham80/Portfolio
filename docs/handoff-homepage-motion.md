# Handoff — make the public homepage genuinely impressive

Paste the block below into a new session. It is written to be self-contained.

---

## The task

Make `apps/web`'s **public homepage** (`/`) genuinely impressive: layered
animation, real imagery/motion graphics, standout UI/UX. This is a portfolio —
the homepage is the product a recruiter judges in five seconds.

**Public site only.** Do not spend effort on `/admin` (the console) — nobody but
the owner sees it and it is already done.

Repo: `D:\Portfolio`, branch `feat/frontend-redesign`, 5 commits ahead of
`origin/main`, working tree clean.

## Read these first

- `CLAUDE.md` — the working rules. They are not boilerplate; each one is there
  because something broke. Rules 1–4 in particular.
- `docs/redesign.md` — the design history and decisions log.

## Taste history — read this before proposing a palette

The owner has rejected two directions already. Do not re-propose either.

1. **Amber accent on near-black + graph-paper grid.** Verdict: *"màu chữ vàng và
   khung kẻ sọc rất xấu."* Removed. That formula is also the `frontend-design`
   skill's named AI-default #2, and the warm-cream light mode was its #1.
2. **Pure monochrome.** Verdict: *"chán thế, sao lại màu thuần trắng/đen."*

**Current direction, and the constraint that survived both:**

> Static things are ink. Live things are lit.

Colour never touches text. Hue appears only where something is actually
happening — packets moving on a wire, the node that is this site's own API, the
availability status. The accent is green (`--live`), matching `c-dot-live` in
the console so both surfaces agree.

Keep that constraint unless the owner relaxes it. The brief now is **more
motion, more imagery, more presence** — not more colour on text.

## What is already done

| Commit | What |
|---|---|
| `53be83b` | Removed amber-as-text and the grid; status badges encode state by dot, not hue |
| `3883cc9` | Vercel Blob image upload in the console, behind `require_admin` |
| `24bee71` | `next/image` for uploaded covers, host pinned, `isOptimisableImage()` guard + tests |
| `6671255` | Page light source; topology draws itself; `--live` accent |
| `6d656da` | `data-scroll-behavior="smooth"` so route changes stop scrolling |

Motion that exists today, all CSS, no animation JS:

- Hero boot ladder (`hero-enter`), topology self-draw (`edge-draw`,
  `pathLength="1"`), node pop (`node-pop`), one breathing node (`node-live`),
  packet flow (`wire-flow`)
- Scroll-driven `reveal-in`, `rule-draw`, `spine-draw` via `animation-timeline:
  view()`

## What is NOT done — the actual work

1. **The bottom half of the homepage has no motion.** Everything above went into
   the hero. Case rows, the stack diagram, the contact block are static.
2. **Zero real images.** `main img` count is 0. All five project covers are
   generated placeholder gradients. **This is the biggest single reason the page
   underwhelms, and no amount of animation fixes it.** Upload is built but no
   image has been uploaded yet.
3. **Density.** ~6.6 screens tall at 1440×900 with large voids; contact block
   alone ~1065px. Target ~4.5.
4. **`/writing · 0`** — a 545px section that says "Nothing published yet". Either
   publish posts or drop the section when empty.
5. **A motion library was researched but never installed.** `motion` via
   `motion/react-client` renders from server components (no hand-written
   `"use client"`, so `CLAUDE.md` rule 5 is not violated), and `LazyMotion` +
   `motion/react-m` is ~4.6KB. `docs/redesign.md` rejected it on bundle grounds
   before that was known. Consider it for spring/gesture/shared-layout work that
   CSS cannot do.

## How to run and verify

Port 8000 is taken on this machine. The deployed API is public and read-only —
point the dev server at it to get **real content** instead of empty states:

```
cd /d/Portfolio/apps/web && API_URL=https://khoi-portfolio-api.fly.dev pnpm exec next dev --port 3100
```

Checks, in order of how often they catch something:

```
npx impeccable detect --fast --json apps/web/app apps/web/components   # [] is clean
pnpm --filter web type-check && pnpm --filter web lint
pnpm --filter web test        # 112 unit
pnpm --filter web test:e2e    # 58 e2e, builds against a dead API on purpose
```

## Traps that have already cost time here

- **`type-check` passing proves nothing visual.** It passed while the page was
  throwing `EDGE_DRAW_DELAY_MS is not defined`. Drive the page.
- **`rounded-[--radius-x]` emits invalid CSS.** Tailwind v4 writes bracket values
  literally. Write `rounded-[var(--radius-card)]`. Verify tokens with
  `getComputedStyle`, never by reading the class name.
- **Impeccable prints nothing at all when clean** in text mode, which is
  indistinguishable from not having run. Use `--json`; clean is `[]`. Prove the
  tool is alive with a deliberate `bg-clip-text` gradient before trusting silence.
- **`pkill -f "next dev"` does not work.** The process is `node` running
  `next/dist/server/lib/start-server.js`. Kill by PID from
  `netstat -ano | grep :3100`. A stale server serving old content has already
  caused one false verification in this project.
- **Full-page screenshots tile/corrupt** on the dev server with scroll-driven
  animations. Screenshot per viewport and scroll with `behavior: 'instant'`.
- **Verify motion, do not assume it.** `document.getAnimations()` shows what is
  really running. Then cancel them all and check nothing is left invisible —
  that is the reduced-motion and no-support path in one test.

## Things the assistant could not do — ask the owner

- Creating Blob stores and reading `ADMIN_EMAIL`/`ADMIN_PASSWORD` from
  `apps/api/.env` were blocked by a permission classifier. **The authenticated
  upload path has never been exercised end to end.** Only the rejection path is
  proven: unauthenticated POST → JSON 401, forged cookie → 401, admin *page* →
  307 to `/login`.
- `/plugin marketplace add pbakaus/impeccable` is a Claude Code slash command the
  owner must run. `npx impeccable` works without it.

## Suggested order

1. Get one real image in (ask the owner to upload, or build coded device
   mockups). Everything else looks better on top of real work.
2. Motion pass on the bottom half, same principle as the hero — one orchestrated
   idea, not scattered effects.
3. Density.
4. Then a batched `frontend-reviewer` pass — ask first, it costs ~100k tokens and
   ~20 min. It is the outstanding unticked item in `docs/redesign.md` Phase 6.
