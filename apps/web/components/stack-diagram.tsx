import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { levelLabel } from "@/lib/format";
import type { Skill, SkillLevel } from "@/lib/types";

/**
 * Capabilities as an architecture drawing: one layer per category, skills as
 * mono chips inside it, proficiency carried by the chip's fill rather than a
 * percentage bar. Bars answer "how much of this do I claim" — a CV question.
 * A stack answers "where in the system do I work" — an engineering one.
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
      <div className="reveal-row overflow-hidden rounded-[var(--radius-card)] border border-border/60 bg-card/50">
        {groups.map(([category, entries], i) => (
          <section
            key={category}
            className={cn(
              // stack-layer is the scan: an ink tick at the left of every
              // layer that lights as that layer crosses the viewport. See
              // globals.css — it needs `relative` for the tick to anchor to.
              "stack-layer relative grid gap-3 p-5 pl-6 sm:grid-cols-[9rem_1fr] sm:gap-6 sm:p-6 sm:pl-7",
              i > 0 && "border-t border-border/60",
            )}
          >
            <Eyebrow as="h3" className="pt-1">
              {category}
            </Eyebrow>
            <ul className="flex flex-wrap gap-2">
              {entries.map((skill) => (
                <li
                  key={skill.id}
                  title={levelLabel(skill.level)}
                  className={cn(
                    "inline-flex items-center rounded-[var(--radius-control)] border px-2.5 py-1 font-mono text-xs",
                    LEVEL_CHIP[skill.level],
                  )}
                >
                  {skill.name}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/*
        The encoding, stated rather than assumed: a reader has no reason to
        know that fill means depth until this line says so.
      */}
      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
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
    </div>
  );
}
