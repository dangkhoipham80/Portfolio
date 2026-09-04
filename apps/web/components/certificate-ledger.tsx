import { ExternalLink } from "@/components/ui/external-link";
import { eyebrowClasses } from "@/components/ui/eyebrow";
import { formatMonthYear } from "@/lib/format";
import type { Certificate } from "@/lib/types";

/**
 * A ledger, not a card grid. Certificates are supporting evidence for a
 * mid-level+ candidate — issuer, date, link — and a grid of cards gave them
 * the same visual weight as the projects. Rows read as the record they are.
 *
 * Shared by /certificates and the pavilion's panel in the world.
 */
export function CertificateLedger({
  certificates,
  level = "h2",
}: {
  certificates: Certificate[];
  level?: "h2" | "h3";
}) {
  const Heading = level;
  return (
    <div className="max-w-4xl border-t border-border/60">
      {certificates.map((certificate) => (
        <article
          key={certificate.id}
          className="grid gap-2 border-b border-border/60 py-6 sm:grid-cols-[8.5rem_1fr_auto] sm:items-baseline sm:gap-6"
        >
          {/* issue_date is a datetime; only the date part is meaningful. */}
          <p className={eyebrowClasses}>{formatMonthYear(certificate.issue_date.slice(0, 10))}</p>

          <div>
            <Heading className="font-display text-lg font-semibold text-foreground">{certificate.title}</Heading>
            <p className="mt-1 text-sm text-muted-foreground">
              {certificate.issuer}
              {certificate.category ? ` · ${certificate.category}` : null}
            </p>
            {certificate.skills.length > 0 ? (
              <p className={`${eyebrowClasses} mt-2 normal-case tracking-normal`}>{certificate.skills.join(" · ")}</p>
            ) : null}
          </div>

          {certificate.credential_url ? (
            <ExternalLink href={certificate.credential_url}>View credential</ExternalLink>
          ) : null}
        </article>
      ))}
    </div>
  );
}
