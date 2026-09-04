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
