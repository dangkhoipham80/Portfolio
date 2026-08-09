import type { Metadata } from "next";

import { EmptyState, Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ExternalLink } from "@/components/ui/external-link";
import { getCertificates } from "@/lib/api";
import { formatMonthYear } from "@/lib/format";

export const metadata: Metadata = {
  title: "Certificates",
  description: "Courses and certifications completed.",
};

export default async function CertificatesPage() {
  const certificates = await getCertificates();

  return (
    <Section
      level="h1"
      eyebrow={`Certificates · ${certificates.length}`}
      title="Courses and certifications"
    >
      {certificates.length === 0 ? (
        <EmptyState>No certificates published yet.</EmptyState>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {certificates.map((certificate) => (
            <Card key={certificate.id} className="gap-3">
              <div className="flex items-start justify-between gap-3">
                {/* h2: the page heading is h1, so h3 here would skip a level. */}
                <h2 className="font-display font-semibold text-foreground">
                  {certificate.title}
                </h2>
                {certificate.category ? (
                  <Badge variant="outline" className="shrink-0">
                    {certificate.category}
                  </Badge>
                ) : null}
              </div>

              <div>
                <p className="text-sm text-primary">{certificate.issuer}</p>
                {/* issue_date is a datetime; only the date part is meaningful. */}
                <Eyebrow className="mt-1">
                  {formatMonthYear(certificate.issue_date.slice(0, 10))}
                </Eyebrow>
              </div>

              {certificate.description ? (
                <p className="flex-1 text-sm text-muted-foreground">
                  {certificate.description}
                </p>
              ) : null}

              {certificate.skills.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {certificate.skills.map((skill) => (
                    <li key={skill}>
                      <Badge>{skill}</Badge>
                    </li>
                  ))}
                </ul>
              ) : null}

              {certificate.credential_url ? (
                <div className="border-t border-border/60 pt-3">
                  <ExternalLink href={certificate.credential_url}>
                    View credential
                  </ExternalLink>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </Section>
  );
}
