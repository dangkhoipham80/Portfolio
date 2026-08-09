import type { ReactNode } from "react";

export function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-5xl px-5 py-14">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-8">{children}</div>
    </section>
  );
}

/**
 * Shown when a content list comes back empty.
 *
 * Empty means one of two things: the owner has published nothing yet, or the
 * API call failed and lib/api.ts returned its fallback. The visitor cannot act
 * on either, so both get the same neutral line rather than an error that looks
 * like the site is broken — the actual failure is on the server log.
 */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
