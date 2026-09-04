# Detector ignores, and why

`npx impeccable detect` is run on every commit under `apps/web` (see
`CLAUDE.md`). Two of its rules fire on this site for reasons that were checked
in a browser and found not to be defects. They are suppressed here rather than
argued about again on every run.

Everything else the detector reports is treated as a failing test. This file is
the only place a finding is allowed to be waived, and each entry has to say what
was measured.

## `text-overflow`

> `span.dark:hidden overflows its container by 161px`

The element is the screen-reader label inside `components/theme-toggle.tsx`. Its
parent is Tailwind's `sr-only`, measured in the browser as a 1×1 box with
`overflow: hidden` and `clip-path: inset(50%)`. The 161px is the label text
sitting inside that clip, which is how `sr-only` works — nothing reaches the
page.

Checked with `document.documentElement.scrollWidth` against `window.innerWidth`
at 320, 375, 390, 640, 768, 1024, 1280, 1440, 1920 and 2560: no horizontal
overflow at or above the 375px floor. There is a 2px overflow at 320px, from the
hero wire rather than from this label, and 320 is below the supported floor.

## `heading-rhythm`

> `h3 "Portfolio API" has 16px above vs 64px below`

The rule measures from the `h3`. On this site a heading is a *group* — a mono
eyebrow carrying the path and period, then the title 16px under it — so the
space the rule wants to see is above the eyebrow, not above the `h3`.

Measured on the rendered page: the eyebrow-plus-title group has 100px above it
inside its block against 64px below. The rhythm the rule is asking for is
already there; the rule cannot see the eyebrow as part of the heading.

If the eyebrow convention ever goes (see the `kicker-above-heading` discussion),
this ignore should go with it and the rule should be re-run.

## `radial-spotlight-glow`

> `radial-gradient spotlight glow "contact" (#f15322 a0.22 → transparent)`
> `radial-gradient spotlight glow "cover-lit" (#2a52f4 a0.34 → transparent)`

Kept, on the owner's call. These are not a haze dropped behind a hero for
decoration — they are the palette. `app/globals.css` builds the whole scheme on
two lights rather than on paint: requests go out cool and responses come back
warm, and the page warms as it is read, cool at the top and warm by the time it
reaches the contact form. The coral field under `/contact` and the blue under a
project cover are the two ends of that.

The rule is right about the shape and wrong about this instance. If the light
concept is ever dropped, these go with it.

## `all-caps-body` — fixed, not waived

The meta line above a project title read `/portfolio-api · FEBRUARY 2025 —
PRESENT`: 40 characters of tracked uppercase. The path is a field name and keeps
the marker style; the period is a value and now sets `normal-case`. That leaves
a ~14-character uppercase run, which is what the style is for.

## `content-hidden-at-rest`

> `30% of page text stays at opacity 0 after reveal handlers ran`

Kept, and the one real failure it pointed at is fixed. The rule's stated concern
is content that "shipped but never becomes visible". That was checked:

- **On scroll** — drove the whole page to the bottom at 1440 and 390 and counted
  elements still under opacity 1: zero. Nothing is stranded, including at the
  end of the document where a `view()` timeline can run out of range.
- **Reduced motion** — 0% hidden at rest.
- **Print** — was 12% hidden, because a `view()` timeline resolves against a
  scroll position and paper has none. That was a real defect and is fixed by the
  `@media print` guard in `globals.css`; now 0% on every route checked.

What remains is a scroll-driven entrance on content that is below the fold and
becomes visible when reached. That is the page's motion design, it is guarded
three ways, and it is not the failure the rule describes.

## `kicker-above-heading` / `hero-eyebrow-chip` — partly fixed

Three eyebrows that only restated their own heading are gone: "Restricted" above
"Console access", "Locked out" above "Reset your password", and "404 — route not
found" above "Nothing is listening on this path" (now just the status code).

The rest stay. They are not generated kickers — they carry a path and a count
(`/capabilities · 10`, `/writing · 3`), which is data the heading does not have,
in the site's systems vocabulary. Left unsuppressed so the rule keeps reporting
if a contentless one is ever added back.
