# Frontend redesign — "The System, Seen"

Branch: `feat/frontend-redesign` · Started 2026-08-12

**Thesis.** The owner builds invisible infrastructure; the site makes it visible.
One continuous data path (the *spine*) runs through the page, sections dock onto
it like services, and information arrives the way packets do. Dark-first
instrument aesthetic: blue-black ink, one warm **signal-amber** accent, large
confident type, motion that is orchestrated rather than sprinkled.

This document is the working plan. Boxes get ticked as each item lands; when a
decision changes during implementation, the change is recorded here.

---

## Design system

### Color

Same amber accent in both modes (replaces the old green-light / purple-dark
split identity). Values are bare HSL channels for the `hsl(var(--x))`
indirection in `globals.css`.

| Token | Dark (primary mode) | Light |
|---|---|---|
| `--background` | `222 24% 6%` (#0B0D12 ink) | `40 20% 96%` (warm paper) |
| `--card` | `222 20% 9%` | `0 0% 100%` |
| `--raised` | `222 18% 13%` | `40 20% 99%` |
| `--primary` (signal) | `38 90% 60%` (#F2A33C amber) | `33 85% 32%` (AA-dark amber) |
| `--signal` | vivid amber, both modes — non-text marks only (nodes, packets, diacritics) | |
| `--foreground` | `222 18% 92%` | `222 20% 11%` |
| `--muted-foreground` | `222 10% 65%` | `222 10% 40%` |
| `--border` | `222 14% 18%` | `40 12% 86%` |

Status colors stay utilitarian Tailwind greens/blues/reds so amber remains the
only voice.

### Type

- **Display + body: Be Vietnam Pro** (latin + vietnamese) — one family, two
  voices: 800 tight-tracked display, 400/500 body. First-class diacritics for
  the name.
- **Utility: IBM Plex Mono** (kept) — eyebrows, spine labels, timestamps, code.
- Body copy target 1.7 line-height; hero name `clamp(3.5rem, 9vw, 7.5rem)`.

### Signatures

1. **The spine** — a vertical line that runs down the page; sections dock onto
   it at amber nodes with mono labels (`/selected-work`, `/contact`, `/eof`).
   Scroll-driven draw via the existing `view()` timeline system; packets via
   the existing `wire-flow`. Static line under reduced motion; left rail on
   mobile.
2. **Amber diacritics** — in the hero, the accented glyphs of “Phạm Đăng Khôi”
   render in signal amber; the rest stays ink. The name is the logo.

---

## Phases

### Phase 1 — Foundation ✅ = done · ◻ = todo

- [x] `docs/redesign.md` committed (this file)
- [x] Fonts: Be Vietnam Pro (display+body) + IBM Plex Mono; Space Grotesk and
      Plex Sans removed (`app/layout.tsx`, `--font-*` tokens)
- [x] `globals.css` palette rewrite: ink/paper + signal amber, `--raised` and
      `--signal` tokens added, grid texture retuned per mode
- [x] Radii: card 1rem, control 0.625rem
- [x] Primitives reskinned: `Button` (amber glow primary, surface quiet, press
      compress), `Card` (surface-step, soft border, raise on hover), `Badge`
      (mono chip), `Eyebrow` (tracking pass)
- [x] Header: blurred ink bar, name with amber terminal dot, active link = amber
      node-dot
- [x] Mobile nav: full-screen overlay menu (staggered reveal, Esc close,
      focus behavior) — replaces the two-letter initials hack
- [x] Footer: restyled, spine terminus `/eof` node
- [x] Console accent remapped violet → amber so site and console are one brand
- [x] Type-check passes; site drives at 1440/375 in both themes

### Phase 2 — Hero + spine signature

- [x] Hero rebuilt full-viewport: name at display scale with amber diacritics,
      thesis line, status line, two actions (View work / Read writing)
- [x] Topology restyled into the amber system (bigger, glowing edges, packets)
- [x] Hero boot sequence retimed (grid → rails → nodes → name → diacritics)
- [x] `Node` primitive (junction dot + mono label)
- [x] Spine system: per-section rail that draws with scroll, docks each home
      section at a labeled node; continuous line illusion across sections
- [x] Reduced-motion + no-`view()` fallbacks verified (static line, visible content)

### Phase 3 — Home sections

- [x] Selected work: featured projects as full-width alternating case rows
      (media panel + title + one-liner + mono tech + status); remaining
      projects as compact index list. Rows without an image get a designed
      generative cover (slug gradient + ghost initial + mono slug).
- [x] Capabilities: skill bars deleted; stack-diagram layout (labeled layers,
      mono chips, proficiency via weight/fill + legend)
- [x] Writing preview section (3 latest posts, date-led rows)
- [x] Contact restyled: docked to the layout spine, reading measure kept
      (packet-burst on success deferred to Phase 6 stretch)
- [x] Section rhythm bumped to py-24/32/40

### Phase 4 — Detail pages

- [x] Project page as case study: media header, sticky mono meta rail at `lg`,
      prose sections, next/previous project links
- [x] Blog index: date-led rows kept (already on-system); year groups dropped —
      see decisions log
- [x] Post page: left-edge amber progress spine, `article-prose` type pass
      (17–18px, amber links), **Shiki** syntax highlighting
- [x] View transitions list → detail (progressive enhancement)

### Phase 5 — Career, certificates, states

- [x] Career timeline docked on the spine (nodes = roles)
- [x] Certificates as a compact ledger; demoted from primary nav to footer
- [x] ~~`loading.tsx` skeletons for streamed routes~~ **Reverted** — see
      decisions log: a loading boundary broke 404 status codes and no-JS
      rendering, and the e2e suite caught both
- [x] Empty/error/404 voice pass (`404 — route not found`, dashed spine)
- [x] Login page aligned to the new system

### Phase 6 — Polish

- [x] Micro-interaction pass: button press compress + amber glow, card raise,
      cover zoom on case-row hover. Media tilt cut — restraint (see log).
- [x] Perf: production build green, all project pages prerendered (SSG); hero
      LCP is server-rendered text with `display: swap` fonts
- [x] Full sweep: 375/768/1440 × light/dark verified in-browser; no horizontal
      overflow at 375. Reduced-motion: every new animation (spine draw,
      skeleton sheen, vertical reading progress) sits behind the existing
      global guards with visible base states
- [ ] `frontend-reviewer` batch pass; fix all Blocking findings — **proposed,
      awaiting go-ahead** (one batch covering the whole redesign)

Review checkpoints (per repo rules, proposed before running): after Phase 2 and
after Phase 5.

---

## Decisions log

- **Amber replaces both green and purple.** One accent across modes; the old
  scheme had no single identity.
- **No WebGL/three.js.** Depth from surface steps, glow, and pointer tilt;
  LCP and taste both prefer it.
- **No scroll-hijacking (Lenis etc.).** Native scroll + CSS scroll-driven
  animations, consistent with the existing motion system.
- **Libraries added: `shiki` + `@shikijs/rehype` only.** `motion` and
  `lucide-react` were budgeted but never needed — CSS covered every
  interaction (the overlay menu reuses the hero-enter system), and the site's
  hand-drawn marks covered the icons. Zero client-side animation JS shipped.
- **View transitions** use React's own `<ViewTransition>` through a typed shim
  (`lib/view-transition.tsx`): @types/react does not know the export yet, and
  the shim degrades to a plain fragment on runtimes without it.
- **Blog year groups dropped.** With a handful of posts, year headers are
  more chrome than content; the date column already carries the chronology.
- **Certificates page** stays reachable (footer + direct URL) but left the
  primary nav; the ledger layout replaced the card grid.
- **Skill bars are deleted, not restyled.** Percentage bars read as CV
  template; the stack diagram says "systems engineer".
- **`ProjectCard` removed.** The home grid it served no longer exists; case
  rows and index rows replaced it.
- **Route-level `loading.tsx` reverted.** A loading boundary makes Next stream
  the shell: the 200 status is committed before `notFound()` runs (so every
  404 became a 200), and swapping the Suspense fallback for content needs
  inline scripts, so a no-JS visitor kept the skeleton forever. The e2e suite
  caught both — the site is largely prerendered anyway, so skeletons bought
  almost nothing.
