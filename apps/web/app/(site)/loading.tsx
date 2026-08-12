import { Container } from "@/components/ui/container";

/**
 * The route-level loading state for every public page: the shape of a Section
 * — eyebrow, heading, a few content rows — in placeholder form, so navigation
 * paints structure immediately instead of a blank viewport while a server
 * component fetches.
 */
export default function Loading() {
  return (
    <Container width="layout" className="py-24 sm:py-32" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div aria-hidden="true">
        <div className="skeleton h-3 w-44" />
        <div className="skeleton mt-6 h-10 w-2/3 max-w-md" />
        <div className="mt-14 space-y-5">
          <div className="skeleton h-28 w-full rounded-[var(--radius-card)]" />
          <div className="skeleton h-28 w-full rounded-[var(--radius-card)]" />
          <div className="skeleton h-28 w-4/5 rounded-[var(--radius-card)]" />
        </div>
      </div>
    </Container>
  );
}
