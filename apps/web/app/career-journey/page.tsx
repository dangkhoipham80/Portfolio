import type { Metadata } from "next";

import { EmptyState, Section } from "@/components/section";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCareerEntries } from "@/lib/api";
import { formatPeriod } from "@/lib/format";

export const metadata: Metadata = {
  title: "Career",
  description: "Roles and study, most recent first.",
};

export default async function CareerJourneyPage() {
  const entries = await getCareerEntries();

  return (
    <Section level="h1" eyebrow="Career" title="Where I have worked and studied">
      {entries.length === 0 ? (
        <EmptyState>No career entries published yet.</EmptyState>
      ) : (
        /*
         * An ordered list, and the only numbered structure on the site. Career
         * history is genuinely a sequence — the order carries meaning a reader
         * needs. Projects are not, which is why they are an unordered grid.
         */
        <ol className="relative space-y-12 border-l border-border pl-7">
          {entries.map((entry) => (
            <li key={entry.id} className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-[2.05rem] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary"
              />
              <Eyebrow>{formatPeriod(entry.started_on, entry.ended_on)}</Eyebrow>
              {/* h2: the page heading is h1, so h3 here would skip a level. */}
              <h2 className="mt-2 font-display text-lg font-semibold text-foreground">
                {entry.title}
              </h2>
              <p className="text-sm text-primary">{entry.company}</p>
              {entry.location ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{entry.location}</p>
              ) : null}

              {entry.highlights.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {entry.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="flex gap-2.5 text-sm text-muted-foreground"
                    >
                      <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
