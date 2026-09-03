import { Fragment } from "react";

import { cn } from "@/lib/cn";

/**
 * The hero's thesis, drawn across the whole screen: the request path that
 * served the page you are reading, as one wire from edge to edge.
 *
 * ## Why a band and not a panel
 *
 * This used to be a framed card beside the name — a serpentine of four nodes
 * in a 360×208 box. It was honest and it was small, and on a page the owner
 * described as boxed-in it was one more box. The same four services laid
 * along one horizontal wire do two things the card could not: they use the
 * full width of the viewport, which is the layout's whole argument, and they
 * give the packet a run of a thousand pixels to be seen on instead of a
 * hundred. The wire enters from the left edge (the reader's request coming
 * from off-screen) and leaves at the right (the row the database returns),
 * so the drawing is never cut off — it runs *through* the page.
 *
 * ## What is live, and how it knows
 *
 * The API node is the only lit one, and it is lit because `apiOk` says the
 * read that produced this page's content actually got an answer. `lib/api.ts`
 * hands back a fallback on failure so the site stays up, which makes an empty
 * list ambiguous — `Read.ok` is what disambiguates it. When the backend is
 * asleep the node goes dim and the readout says so.
 *
 * HTML rather than SVG, so the labels are real text at the site's mono size
 * and the layout is flex: the wires are `flex-1` and take whatever width the
 * viewport has. The packets travel in `cqw` (see `.wire-band`), so one
 * keyframe crosses any width. No client component, no hydration; all motion
 * is CSS and stops under `prefers-reduced-motion`.
 */

type Node = {
  id: string;
  label: string;
  /** The provider underneath, which is what turns a box into a deployment. */
  host?: string;
};

/* The order is strictly the order a request travels. */
const NODES: Node[] = [
  { id: "browser", label: "Browser" },
  { id: "next", label: "Next.js", host: "vercel" },
  { id: "api", label: "FastAPI", host: "fly.io · iad" },
  { id: "postgres", label: "Postgres", host: "neon · us-east-2" },
];

/*
 * The boot order, one delay per node in NODES order: the browser asks, the
 * renderer comes up, then the API, then its database. Each wire is drawn just
 * before the node it arrives at pops in, so the sequence reads as one motion
 * — the wire reaches the service, then the service appears. Inline style
 * because the values are indexed at render time and Tailwind's scanner would
 * never see them.
 */
const NODE_BOOT_DELAY_MS = [520, 700, 880, 1060];
const WIRE_DRAW_DELAY_MS = [400, 580, 760, 940, 1120];

export function HeroWire({
  projectCount,
  apiOk,
  className,
}: {
  /** Records the projects read returned — the number in the readout. */
  projectCount: number;
  /** Whether that read was actually answered. Drives the lit node. */
  apiOk: boolean;
  className?: string;
}) {
  return (
    <figure className={cn("wire-band relative", className)}>
      {/* The drawing is decorative — the readout below states the same fact
          in words — so the band is hidden from assistive tech rather than
          narrating a diagram nobody asked for. */}
      <div aria-hidden="true" className="relative flex items-center">
        {/*
          The request, and the answer coming back: a streak of light along
          the wire rather than a dot. A dot crawling a thousand pixels reads
          as a loading indicator; a streak with a tail reads as a signal on a
          line, which is what it is. Drawn before the nodes and below them in
          z-order, so it passes under each service and re-emerges on the far
          side. Cool going out, warm coming back — the rule every wire on the
          site keeps. See `.wire-streak` in globals.css.
        */}
        <span className="wire-streak wire-streak-out" />
        <span className="wire-streak wire-streak-back" />

        {/* The lead-in from the edge: the request arriving from off-screen. */}
        <span
          className="wire-run h-px w-[clamp(1.25rem,5vw,4rem)] shrink-0 bg-border"
          style={{ "--d": `${WIRE_DRAW_DELAY_MS[0]}ms` } as React.CSSProperties}
        />

        {NODES.map((node, i) => (
          <Fragment key={node.id}>
            {i > 0 ? (
              <span
                className="wire-run h-px flex-1 bg-border"
                style={{ "--d": `${WIRE_DRAW_DELAY_MS[i]}ms` } as React.CSSProperties}
              />
            ) : null}

            <div
              className="node-pop relative z-10 shrink-0"
              style={{ animationDelay: `${NODE_BOOT_DELAY_MS[i]}ms` }}
            >
              {/*
                A halo on the API node only, and only when the read that built
                this page was answered. It is the one service on this drawing
                that is this site's own backend, and giving exactly one node a
                slow breath is what stops the wire reading as a still life.
              */}
              {node.id === "api" && apiOk ? (
                <span className="node-live absolute -inset-1.5 rounded-[calc(var(--radius-control)+0.375rem)] border border-live" />
              ) : null}

              <span className="relative block rounded-[var(--radius-control)] border border-border bg-background px-3 py-1.5 font-mono text-[11px] text-foreground sm:px-5 sm:py-2.5 sm:text-sm">
                {node.label}
              </span>

              {node.host ? (
                <span className="absolute left-1/2 top-full mt-2 hidden -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-muted-foreground sm:block">
                  {node.host}
                </span>
              ) : null}
            </div>
          </Fragment>
        ))}

        {/* The lead-out: the row leaving for the edge. */}
        <span
          className="wire-run h-px w-[clamp(1.25rem,5vw,4rem)] shrink-0 bg-border"
          style={{ "--d": `${WIRE_DRAW_DELAY_MS[4]}ms` } as React.CSSProperties}
        />
      </div>

      {/*
        The same fact in words, and the reason the drawing is allowed to claim
        anything: this is the call the page actually made. Lower-case mono
        because it carries a path — uppercase would render "GET /PROJECTS/",
        which reads as shouting rather than as a route.
      */}
      <figcaption className="mt-9 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 font-mono text-xs text-muted-foreground sm:mt-10 sm:px-8 lg:px-12">
        <span>/request-path · the call that built this page</span>
        <span>
          {apiOk ? (
            <>
              GET /projects/ · 200 · {projectCount} record{projectCount === 1 ? "" : "s"}
            </>
          ) : (
            // The site is built to survive this: lib/api.ts returns a
            // fallback and the page renders. Saying so beats a lit node lying.
            <>GET /projects/ · no answer · serving fallback</>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
