import type { Metadata } from "next";

import { EmptyState, Section } from "@/components/section";
import { getCareerEntries } from "@/lib/api";
import { formatPeriod } from "@/lib/format";

export const metadata: Metadata = {
  title: "Career",
  description: "Roles and study, most recent first.",
};

export default async function CareerJourneyPage() {
  const entries = await getCareerEntries();

  return (
    <Section title="Career journey" description="Roles and study, most recent first.">
      {entries.length === 0 ? (
        <EmptyState>No career entries published yet.</EmptyState>
      ) : (
        <ol className="relative space-y-10 border-l border-border pl-6">
          {entries.map((entry) => (
            <li key={entry.id} className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-[1.9rem] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary"
              />
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {formatPeriod(entry.started_on, entry.ended_on)}
              </p>
              <h3 className="mt-1 font-semibold text-foreground">{entry.title}</h3>
              <p className="text-sm text-primary">{entry.company}</p>
              {entry.location ? (
                <p className="text-xs text-muted-foreground">{entry.location}</p>
              ) : null}

              {entry.highlights.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {entry.highlights.map((highlight) => (
                    <li key={highlight} className="flex gap-2 text-sm text-muted-foreground">
                      <span aria-hidden="true" className="text-primary">
                        •
                      </span>
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
