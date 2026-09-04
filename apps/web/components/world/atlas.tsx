import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { pillClasses } from "@/components/ui/pill";

import { IslandMap } from "./map";
import type { Place } from "./places";

/**
 * The island as a list.
 *
 * Three readers get this instead of the scene: a browser without WebGL,
 * a search engine, and anyone who presses "read it as a list" — which
 * includes everyone using a screen reader, for whom a 3D world is a canvas
 * with nothing in it. Same places, same content, in the order a first walk
 * takes. It is also what the server renders, so the page has all of its
 * content in the HTML before any script runs.
 *
 * No hooks: the atlas is a server component, and the world swaps it in and
 * out on the client without owning it.
 */
export function Atlas({
  nameplate,
  sections,
  back,
}: {
  /** The page's h1, which in the scene floats over the island and here leads the list. */
  nameplate: ReactNode;
  sections: { place: Place; content: ReactNode }[];
  /** The control back to the scene, for readers who have one to go back to. */
  back?: ReactNode;
}) {
  return (
    <div className="world-atlas">
      <Container width="full" className="pt-4 sm:pt-6">
        {nameplate}
        <div className="mt-10 grid items-center gap-8 sm:mt-14 lg:grid-cols-[1fr_minmax(16rem,22rem)]">
          <div>
            <Eyebrow>/atlas · {sections.length} places</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl">
              The island, as a list.
            </h2>
            <p className="mt-3 max-w-[var(--measure)] text-muted-foreground">
              Every path from the crossroads leads to one part of this portfolio.
              Here they are in walking order.
            </p>
            <nav aria-label="Places" className="mt-6">
              <ul className="flex flex-wrap gap-2">
                {sections.map(({ place }) => (
                  <li key={place.id}>
                    <a href={`#${place.id}`} className={pillClasses()}>
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal" />
                      {place.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            {back ? <div className="mt-6">{back}</div> : null}
          </div>
          <IslandMap className="mx-auto w-full max-w-xs lg:max-w-none" />
        </div>
      </Container>

      {sections.map(({ place, content }) => (
        <section key={place.id} id={place.id} className="section-rule mt-12 scroll-mt-24 py-12 sm:py-16">
          <Container width="full">
            <div className="max-w-3xl">
              <p className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span aria-hidden="true" className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-signal align-middle" />
                {place.landmark}
              </p>
              {content}
            </div>
          </Container>
        </section>
      ))}
    </div>
  );
}
