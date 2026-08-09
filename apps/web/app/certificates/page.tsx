import type { Metadata } from "next";

import { EmptyState, Section } from "@/components/section";
import { getCertificates } from "@/lib/api";
import { formatMonthYear } from "@/lib/format";

export const metadata: Metadata = {
  title: "Certificates",
  description: "Courses and certifications completed.",
};

export default async function CertificatesPage() {
  const certificates = await getCertificates();

  return (
    <Section title="Certificates" description="Courses and certifications completed.">
      {certificates.length === 0 ? (
        <EmptyState>No certificates published yet.</EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {certificates.map((certificate) => (
            <article
              key={certificate.id}
              className="flex flex-col rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-foreground">{certificate.title}</h3>
                {certificate.category ? (
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground">
                    {certificate.category}
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-sm text-primary">{certificate.issuer}</p>
              <p className="text-xs text-muted-foreground">
                {formatMonthYear(certificate.issue_date.slice(0, 10))}
              </p>

              {certificate.description ? (
                <p className="mt-3 flex-1 text-sm text-muted-foreground">
                  {certificate.description}
                </p>
              ) : null}

              {certificate.skills.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {certificate.skills.map((skill) => (
                    <li
                      key={skill}
                      className="rounded bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              ) : null}

              {certificate.credential_url ? (
                <a
                  href={certificate.credential_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-4 text-sm text-primary hover:underline"
                >
                  View credential
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}
