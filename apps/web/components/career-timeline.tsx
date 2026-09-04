import { Eyebrow } from "@/components/ui/eyebrow";
import { formatPeriod } from "@/lib/format";
import type { CareerEntry } from "@/lib/types";

/**
 * The career as an ordered list, and the only numbered structure on the
 * site. Career history is genuinely a sequence — the order carries meaning a
 * reader needs. Projects are not, which is why they are an unordered grid.
 *
 * The entries dock onto their own rail with the same amber nodes the home
 * page's sections use: a career is the one content type that literally is a
 * timeline, so it gets the spine vocabulary for free.
 *
 * Shared by /career-journey and the mountain's panel in the world, so the
 * two cannot drift. `level` is the heading each entry gets: h2 under a
 * page's h1, h3 under a panel's h2.
 */
export function CareerTimeline({ entries, level = "h2" }: { entries: CareerEntry[]; level?: "h2" | "h3" }) {
  const Heading = level;
  return (
    <ol className="relative max-w-3xl space-y-14 border-l border-border/60 pl-8">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span aria-hidden="true" className="spine-node absolute -left-[2.3rem] top-1.5" />
          <Eyebrow>{formatPeriod(entry.started_on, entry.ended_on)}</Eyebrow>
          <Heading className="mt-2 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {entry.title}
          </Heading>
          <p className="mt-0.5 text-primary">{entry.company}</p>
          {entry.location ? <p className="mt-0.5 text-sm text-muted-foreground">{entry.location}</p> : null}

          {entry.highlights.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {entry.highlights.map((highlight) => (
                <li key={highlight} className="flex gap-3 text-muted-foreground">
                  <span aria-hidden="true" className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-signal" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
