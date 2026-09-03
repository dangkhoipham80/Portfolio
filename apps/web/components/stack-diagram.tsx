import type { CSSProperties } from "react";

import { Container } from "@/components/ui/container";
import { cn } from "@/lib/cn";
import { levelLabel } from "@/lib/format";
import type { Skill, SkillLevel } from "@/lib/types";

/**
 * Capabilities as an architecture drawing: one layer per category, run as a
 * band across the full width of the page, skills as mono chips inside it,
 * proficiency carried by the chip's fill rather than a percentage bar. Bars
 * answer "how much of this do I claim" — a CV question. A stack answers
 * "where in the system do I work" — an engineering one.
 *
 * The layers used to sit in a card. They are bands now, edge to edge, and
 * each one lights as the reader crosses it (`.stack-band` in globals.css):
 * the stack is ordered top to bottom the way a request descends through one,
 * so the scan runs in that order at the reader's own pace. The chips inside
 * a band arrive one after another, left to right, on the same scroll.
 */

/*
 * Depth as temperature. The site's two lights are a request going out (cool)
 * and a response coming back (warm), and the stack borrows the scale: the
 * deeper the proficiency, the warmer the chip. Expert is lit warm, advanced
 * lit cool, intermediate is an unlit surface and beginner is an outline. The
 * text stays ink at every step — colour is on the fill, never the word.
 * Spelled out per level because Tailwind scans source for complete classes.
 */
const LEVEL_CHIP: Record<SkillLevel, string> = {
  expert: "border-sig-warm/60 bg-sig-warm/15 text-foreground font-medium",
  advanced: "border-sig-cool/50 bg-sig-cool/12 text-foreground",
  intermediate: "border-transparent bg-muted text-foreground",
  beginner: "border-border bg-transparent text-muted-foreground",
};

const LEGEND: SkillLevel[] = ["expert", "advanced", "intermediate", "beginner"];

export function StackDiagram({ groups }: { groups: [string, Skill[]][] }) {
  return (
    <div>
      <div className="border-t border-border/60">
        {groups.map(([category, entries]) => (
          <section key={category} className="stack-band border-b border-border/60">
            <Container
              width="full"
              className="grid gap-4 py-7 sm:grid-cols-[minmax(9rem,18vw)_1fr] sm:gap-10 lg:py-9"
            >
              {/* The layer's name at display weight, not as an eyebrow: in a
                  band this wide it is the thing the eye lands on first. */}
              <h3 className="font-display text-xl font-bold tracking-tight text-foreground sm:pt-0.5 sm:text-2xl">
                {category}
              </h3>
              <ul className="stagger flex flex-wrap gap-2">
                {entries.map((skill, i) => (
                  <li
                    key={skill.id}
                    title={levelLabel(skill.level)}
                    style={{ "--i": i } as CSSProperties}
                    className={cn(
                      "inline-flex items-center rounded-[var(--radius-control)] border px-3 py-1.5 font-mono text-xs sm:text-sm",
                      LEVEL_CHIP[skill.level],
                    )}
                  >
                    {skill.name}
                  </li>
                ))}
              </ul>
            </Container>
          </section>
        ))}
      </div>

      {/*
        The encoding, stated rather than assumed: a reader has no reason to
        know that fill means depth until this line says so.
      */}
      <Container width="full">
        <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>Depth:</span>
          {LEGEND.map((level) => (
            <span
              key={level}
              className={cn(
                "inline-flex items-center rounded-[var(--radius-control)] border px-2 py-0.5",
                LEVEL_CHIP[level],
              )}
            >
              {levelLabel(level)}
            </span>
          ))}
        </p>
      </Container>
    </div>
  );
}
