import type { Metadata } from "next";

import { CertificateLedger } from "@/components/certificate-ledger";
import { EmptyState, Section } from "@/components/section";
import { getCertificates } from "@/lib/api";

export const metadata: Metadata = {
  title: "Certificates",
  description: "Courses and certifications completed.",
};

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
        // h2 per row: the page heading is h1, so h3 here would skip a level.
        <CertificateLedger certificates={certificates} level="h2" />
      )}
    </Section>
  );
}
