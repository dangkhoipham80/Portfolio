# Working rules for this repo

## The frontend is the product

This is a portfolio. `apps/web` is not a client for the API — it *is* the thing
being judged. A recruiter forms an opinion of this engineer from how the site
looks, moves and feels, in about five seconds. Treat frontend work with the
same seriousness as the auth hardening in `apps/api`, not as a wrapper around
`fetch`.

## Rules for any change under apps/web

1. **Use the `frontend-design` skill before designing.** Not after. It exists to
   stop the work converging on the same three AI-default looks.

   It is worth knowing that this site walked straight into one of them anyway.
   The amber redesign was "near-black ground plus one bright accent" — that
   skill's own AI-default #2 — and the light mode was a warm cream, its #1. Both
   were argued for at length in `globals.css` and both were still the default
   answer. Reading the skill is not the same as escaping the thing it warns
   about; check the finished screen against the list, not just the plan.

2. **Review with the `frontend-reviewer` subagent once per batch, not once per
   change — and ask before starting it.** A pass costs roughly 100k tokens and
   twenty minutes, which is out of proportion to a restyled footer. Propose it,
   say what it would cover, and wait; if the answer is no, carry on and offer
   again when there is more surface to sweep. When it does run, give it a
   running dev-server URL so it drives the real page, and fix everything it
   marks Blocking.

   For a small change, verify it yourself instead: drive the page, screenshot
   at 1440px and 375px in both themes, and measure tap targets and overflow in
   the browser. That is the floor, not an excuse to skip looking.

   Do not read this as permission to drop the review. The two passes that have
   run found three Blocking issues on the console PR — one of them a real bug
   introduced in that same PR — and, on the next one, that
   `rounded-[--radius-x]` emits invalid CSS, which meant every corner on the
   site had silently been square. Batch it; do not abandon it.

3. **Look at what you built.** Screenshot it. A change that has only been
   type-checked has not been verified — `pnpm type-check` passing tells you
   nothing about whether the page is usable.

   There is no local API on the default port (8000 is taken on this machine).
   The quickest way to see real content rather than empty states is to point
   the dev server at the deployed API, which is public and read-only:

   ```
   API_URL=https://khoi-portfolio-api.fly.dev pnpm exec next dev --port 3100
   ```

   And check tokens with `getComputedStyle`, never by reading the class name —
   see rule 5.

   The three checks belong to three different layers, and none replaces
   another: `frontend-design` picks the *direction* before any code exists,
   this rule catches what a screen actually looks like, and `frontend-reviewer`
   (rule 2) sweeps a whole batch. A deterministic detector such as
   `npx impeccable detect` fits between the last two — it is the layer that
   would have caught `rounded-[--radius-x]` in CI for no tokens at all, which
   type-check, lint, build and a human review all missed for weeks.

4. **Server components by default.** `"use client"` needs a reason that is
   stated in a comment: an event handler, browser API, or hook that genuinely
   cannot run on the server. Reaching for it to call `useState` for something
   CSS can do is the most common mistake here.

5. **Tokens, not literals.** Colours, radii and spacing come from
   `app/globals.css`. A raw hex or a one-off `rounded-[13px]` in a component is
   a bug — it is how a component set stops looking like one system.

   Reaching for a token is not the same as getting one. Tailwind v4 emits a
   bracket arbitrary value literally, so `rounded-[--radius-card]` compiles to
   `border-radius:--radius-card`, which is not valid CSS — the browser drops the
   declaration and the element renders at 0. Every corner on this site was
   square for weeks that way, through type-check, lint, build and review. Write
   `rounded-[var(--radius-card)]`. When a token stops applying, nothing fails
   loudly: check the emitted stylesheet or `getComputedStyle`, not the class
   name.

6. **Primitives, not copy-paste.** If the same class string appears twice, it
   belongs in `components/ui/`. Check what is already there before writing a new
   one.

7. **The quality floor is not optional and is not announced.** Responsive to
   375px, visible keyboard focus, `prefers-reduced-motion` respected, real
   `<button>`/`<a>` for interactive things, one `<h1>` per page. These are not
   features to mention in a PR; they are the cost of entry.

8. **The API can be down.** Every read in `lib/api.ts` returns a fallback, and
   pages render an empty state rather than a 500. Keep it that way — this
   replaced a static site that could not break.

## Rules for apps/api

Alembic owns the schema; nothing creates tables implicitly. Migrations are
hand-checked, not blindly autogenerated — see the header of
`alembic/versions/b2f1c7d94a30_content_model_reshape.py` for two cases where
autogenerate output would have been wrong.

Public content routes must default to published-only. `PortfolioService` reads
take `include_unpublished=False` by default so a route that forgets to think
about visibility leaks nothing.

## Verifying

Run it. `pnpm build && pnpm --filter web start`, with the API on whatever port
is free — port 8000 is often taken on this machine, so set `API_URL` to match
rather than assuming.

Do not report a change as working on the strength of tests alone if it has a
visual surface.
