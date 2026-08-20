import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";

export function Section({
  id,
  eyebrow,
  title,
  description,
  /**
   * On the home page a Section is one of several, under the hero's h1, so h2
   * is right. On /career-journey and /certificates the Section *is* the page —
   * defaulting to h2 there left those pages with no h1 at all and a heading
   * outline starting at level 2.
   */
  level = "h2",
  /**
   * Passed through to Container. Sections of cards want the wide measure; a
   * section that is mostly text or a single column of form fields does not,
   * and stretching one to 5xl leaves a very long line and a lot of dead space.
   */
  width = "wide",
  /**
   * A one-step background tint. The page's sections were separated by nothing
   * but a 1px rule, so four of them read as one undifferentiated column.
   * Alternating a section onto `bg-muted` is the same convention as striping
   * rows in a query result: it marks a layer boundary without decorating it.
   */
  tinted = false,
  children,
}: {
  id?: string;
  /** The mono label above the heading — a count, a field name, a state. */
  eyebrow?: string;
  title: string;
  description?: string;
  level?: "h1" | "h2";
  width?: "wide" | "layout" | "reading";
  tinted?: boolean;
  children: ReactNode;
}) {
  const Heading = level;

  return (
    <section
      id={id}
      className={cn(
        // section-rule replaces the top border with a line that can be drawn
        // as the section arrives; see globals.css. Without scroll-driven
        // animation support it renders as exactly the border it replaced.
        //
        // py-40 at `lg` put 160px of nothing above and below every section —
        // 320px per boundary, which on its own was roughly a screen and a half
        // of the home page. The rule and the tint already mark where a section
        // starts; the padding does not have to do it a third time.
        "section-rule relative py-20 sm:py-24 lg:py-28",
        tinted && "bg-muted",
      )}
    >
      {/*
        The spine: a rail spanning the section's full height, including its
        vertical padding, so stacked sections read as one continuous line.
        Positioned by a mirror of the content Container so it sits exactly on
        the content box's left edge at every viewport. Decorative — the
        structure it draws is already in the headings — so hidden from
        assistive tech, and absent below lg where its gutter does not exist.
      */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
        <Container width={width} className="h-full">
          <div className="spine-rail" />
        </Container>
      </div>

      <Container width={width}>
        <div className="relative lg:pl-16">
          {/* The junction: this section, docked to the path. */}
          <span
            aria-hidden="true"
            className="spine-node absolute left-0 top-1 ml-px hidden -translate-x-1/2 lg:block"
          />

          {eyebrow ? <Eyebrow className="reveal mb-3">{eyebrow}</Eyebrow> : null}
          <Heading className="reveal font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {title}
          </Heading>
          {description ? (
            <p className="reveal mt-4 max-w-2xl text-lg text-muted-foreground">{description}</p>
          ) : null}
          <div className="mt-10">{children}</div>
        </div>
      </Container>
    </section>
  );
}

/**
 * Shown when a content list comes back empty.
 *
 * Empty means one of two things: nothing is published yet, or the API call
 * failed and lib/api.ts returned its fallback. A visitor can act on neither, so
 * both get the same neutral line rather than an error that makes a working site
 * look broken. The real failure is on the server log.
 */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[var(--radius-card)] border border-dashed border-border px-4 py-10 text-center font-mono text-sm text-muted-foreground">
      {children}
    </p>
  );
}
