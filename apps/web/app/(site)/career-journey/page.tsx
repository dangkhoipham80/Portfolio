import type { Metadata } from "next";

import { CareerTimeline } from "@/components/career-timeline";
import { EmptyState, Section } from "@/components/section";
import { getCareerEntries } from "@/lib/api";

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
        // h2 per entry: the page heading is h1, so h3 here would skip a level.
        <CareerTimeline entries={entries} level="h2" />
      )}
    </Section>
  );
}
