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
    <Section
      level="h1"
      // layout so the page shares the nav's outer edge; the max-w on the list
      // keeps the highlight lines at a reading measure inside it.
      width="layout"
      eyebrow="/career"
      title="Where I have worked and studied"
    >
      {entries.length === 0 ? (
        <EmptyState>No career entries published yet.</EmptyState>
      ) : (
        /*
         * An ordered list, and the only numbered structure on the site. Career
         * history is genuinely a sequence — the order carries meaning a reader
         * needs. Projects are not, which is why they are an unordered grid.
         *
         * The entries dock onto their own rail with the same amber nodes the
         * home page's sections use: a career is the one content type that
         * literally is a timeline, so it gets the spine vocabulary for free.
         */
        <ol className="relative max-w-3xl space-y-14 border-l border-border/60 pl-8">
          {entries.map((entry) => (
            <li key={entry.id} className="relative">
              <span
                aria-hidden="true"
                className="spine-node absolute -left-[2.3rem] top-1.5"
              />
              <Eyebrow>{formatPeriod(entry.started_on, entry.ended_on)}</Eyebrow>
              {/* h2: the page heading is h1, so h3 here would skip a level. */}
              <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {entry.title}
              </h2>
              <p className="mt-0.5 text-primary">{entry.company}</p>
              {entry.location ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{entry.location}</p>
              ) : null}

              {entry.highlights.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {entry.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="flex gap-3 text-muted-foreground"
                    >
                      <span aria-hidden="true" className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-signal" />
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
