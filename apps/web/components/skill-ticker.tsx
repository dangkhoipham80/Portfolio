import type { Skill } from "@/lib/types";

/**
 * Every published capability, running across the full width of the page.
 *
 * Real content, not a mood: this is the same list the stack section groups
 * by layer further down, read once here as a single line the way a stack
 * trace reads a call chain. It is the first thing after the hero and the
 * first thing on the page to touch both edges, which is the layout's point.
 *
 * Two copies of the list on one track, the second hidden from assistive
 * tech, so the loop is seamless; `.ticker-track` in globals.css does the
 * moving and pauses under the pointer. Under reduced motion the track stops
 * and wraps and the copy is removed, so the band becomes a still list — see
 * the same rule. Server component; nothing here needs a browser.
 */
export function SkillTicker({ skills }: { skills: Skill[] }) {
  if (skills.length === 0) return null;

  const names = skills.map((skill) => skill.name);

  return (
    <div
      className="ticker relative overflow-hidden border-y border-border/60 bg-card/50 py-5 sm:py-6"
      aria-label="Technologies"
    >
      <div className="ticker-track">
        <TickerCopy names={names} />
        <TickerCopy names={names} hidden />
      </div>
    </div>
  );
}

function TickerCopy({ names, hidden = false }: { names: string[]; hidden?: boolean }) {
  return (
    <ul
      className="ticker-copy flex shrink-0 items-center gap-x-6 pr-6 sm:gap-x-8 sm:pr-8"
      aria-hidden={hidden ? "true" : undefined}
    >
      {names.map((name) => (
        <li
          key={name}
          className="flex items-center gap-x-6 whitespace-nowrap font-display text-xl font-semibold tracking-tight text-foreground/80 sm:gap-x-8 sm:text-2xl"
        >
          {name}
          {/* A node between entries, in the site's mark colour: the list is a
              chain, not a sentence. */}
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal/70" />
        </li>
      ))}
    </ul>
  );
}
