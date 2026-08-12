import type { Metadata } from "next";

import { EmptyState, Section } from "@/components/section";
import { ExternalLink } from "@/components/ui/external-link";
import { eyebrowClasses } from "@/components/ui/eyebrow";
import { getCertificates } from "@/lib/api";
import { formatMonthYear } from "@/lib/format";

export const metadata: Metadata = {
  title: "Certificates",
  description: "Courses and certifications completed.",
};

/**
 * A ledger, not a card grid. Certificates are supporting evidence for a
 * mid-level+ candidate — issuer, date, link — and a grid of cards gave them
 * the same visual weight as the projects. Rows read as the record they are.
 */
export default async function CertificatesPage() {
  const certificates = await getCertificates();

  return (
    <Section
      level="h1"
      width="layout"
      eyebrow={`/credentials · ${certificates.length}`}
      title="Courses and certifications"
    >
      {certificates.length === 0 ? (
        <EmptyState>No certificates published yet.</EmptyState>
      ) : (
        <div className="max-w-4xl border-t border-border/60">
          {certificates.map((certificate) => (
            <article
              key={certificate.id}
              className="grid gap-2 border-b border-border/60 py-6 sm:grid-cols-[8.5rem_1fr_auto] sm:items-baseline sm:gap-6"
            >
              {/* issue_date is a datetime; only the date part is meaningful. */}
              <p className={eyebrowClasses}>
                {formatMonthYear(certificate.issue_date.slice(0, 10))}
              </p>

              <div>
                {/* h2: the page heading is h1, so h3 here would skip a level. */}
                <h2 className="font-display text-lg font-semibold text-foreground">
                  {certificate.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {certificate.issuer}
                  {certificate.category ? ` · ${certificate.category}` : null}
                </p>
                {certificate.skills.length > 0 ? (
                  <p className={`${eyebrowClasses} mt-2 normal-case tracking-normal`}>
                    {certificate.skills.join(" · ")}
                  </p>
                ) : null}
              </div>

              {certificate.credential_url ? (
                <ExternalLink href={certificate.credential_url}>
                  View credential
                </ExternalLink>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}
