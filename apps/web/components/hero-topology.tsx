import { eyebrowClasses } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";

/**
 * The hero's thesis, as an instrument rather than an illustration: the request
 * path that served the page you are reading.
 *
 * ## Why it changed
 *
 * This drawing used to show FastAPI fanning out to Postgres, Redis and Kafka.
 * Those are real technologies from the projects further down the page, but they
 * are not in *this* system — so the first thing a portfolio about honest
 * systems engineering did was put a diagram in its hero of something that was
 * not running. The nodes below are the four that actually serve this response,
 * and the region bracket is the real reason the API lives in `iad`: it is next
 * to the database and to Vercel's functions, because no browser ever calls it
 * directly.
 *
 * ## What is live, and how it knows
 *
 * The API node is the only lit one, and it is lit because `apiOk` says the read
 * that produced this page's content actually got an answer. `lib/api.ts` hands
 * back a fallback on failure so the site stays up, which makes an empty list
 * ambiguous — `Read.ok` is what disambiguates it. When the backend is asleep
 * the node goes dim and the readout says so. A status light that is always on
 * is not a status light.
 *
 * Inline SVG on the server: no canvas, no WebGL, no client component, no
 * hydration, nothing competing with LCP. All motion is CSS, so
 * `prefers-reduced-motion` stops it through the global rule in globals.css.
 *
 * The drawing is decorative — the readout line below states the same fact in
 * words — so the SVG is hidden from assistive tech rather than narrating a
 * diagram nobody asked for.
 */

type Node = {
  id: string;
  label: string;
  /** The provider underneath, which is what turns a box into a deployment. */
  host?: string;
  /** Which side of the node its host label sits on, to keep it off the wires. */
  hostAbove?: boolean;
  x: number;
  y: number;
};

const NODE_WIDTH = 104;
const NODE_HEIGHT = 34;

/*
 * A serpentine rather than a straight row, and the reason is the packet.
 *
 * Four nodes in a line leaves only a ~30px gap between each pair, so a dot
 * travelling behind them is hidden for 92% of its journey and reads as a
 * flicker rather than as a request. Folding the chain puts long open runs
 * between the services — the packet is visible for about three quarters of the
 * path — and it fills the hero's column instead of stretching a thin strip
 * across it. The order is still strictly the order a request travels.
 */
const NODES: Node[] = [
  { id: "browser", label: "Browser", x: 6, y: 28 },
  { id: "next", label: "Next.js", host: "vercel", hostAbove: true, x: 250, y: 28 },
  { id: "api", label: "FastAPI", host: "fly.io · iad", x: 250, y: 148 },
  { id: "postgres", label: "Postgres", host: "neon · us-east-2", x: 6, y: 148 },
];

/** The open runs between services — the wires, minus what a node covers. */
const EDGES = [
  { d: "M110,45 L250,45" },
  { d: "M302,62 L302,148" },
  { d: "M250,165 L110,165" },
];

/*
 * The boot order, one delay per node in NODES order: the browser asks, the
 * renderer comes up, then the API, then its database. Inline style rather than
 * a Tailwind arbitrary class because the values are indexed at render time and
 * the scanner would never see them.
 */
const NODE_BOOT_DELAY_MS = [420, 500, 580, 660];

/*
 * Each rail is drawn just before the node it arrives at pops in, so the
 * sequence reads as one motion — the wire reaches the service, then the
 * service appears — rather than as two animations that happen to overlap.
 */
const EDGE_DRAW_DELAY_MS = [300, 420, 540];

export function HeroTopology({
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
    <figure
      className={cn(
        // A frame, so the drawing reads as a panel on an instrument rather
        // than a sketch floating in the margin. bg-card against the page's
        // bg-background, with the nodes filled bg-background again, so the
        // services read as recessed into the panel in both themes.
        "rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6",
        className,
      )}
    >
      {/* eyebrowClasses rather than <Eyebrow>: the label belongs to the figure,
          so it has to be a <figcaption>, which is not one of the elements that
          component renders. */}
      <figcaption className={eyebrowClasses}>/request-path</figcaption>

      <svg viewBox="0 0 360 208" aria-hidden="true" className="mt-4 h-auto w-full">
        {/*
          The rails draw themselves in request order. `pathLength="1"`
          normalises every segment so one dasharray works for all of them — see
          `.edge-draw`. The base state is a fully drawn line, so with motion off
          this is exactly the static graph it replaced.
        */}
        {EDGES.map((edge, i) => (
          <path
            key={edge.d}
            d={edge.d}
            pathLength="1"
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
            className="edge-draw"
            style={{ animationDelay: `${EDGE_DRAW_DELAY_MS[i]}ms` }}
          />
        ))}

        {/*
          The request, and the answer coming back.

          Drawn before the nodes so it passes *behind* them: the packet
          disappears under each service and re-emerges on the far side, which
          is the one thing a static architecture diagram can never say. Both
          dots ride the same straight path across the row via `offset-path`;
          the timing that makes one an outbound request and the other a
          response lives in the keyframes. See `.packet-out` in globals.css.
        */}
        <g className="packet-path">
          <circle r="3.5" className="packet packet-out" fill="hsl(var(--live))" />
          <circle r="3" className="packet packet-back" fill="hsl(var(--live))" />
        </g>

        {NODES.map((node, i) => (
          <g
            key={node.id}
            className="topology-node node-pop"
            style={{ animationDelay: `${NODE_BOOT_DELAY_MS[i]}ms` }}
          >
            {/*
              A halo under the API node only, and only when the read that built
              this page was answered. It is the one service on this diagram
              that is this site's own backend, and giving exactly one node a
              slow breath is what stops the graph reading as a still life. One
              infinite animation, on a decorative mark, nowhere near text.
            */}
            {node.id === "api" && apiOk ? (
              <rect
                x={node.x - 5}
                y={node.y - 5}
                width={NODE_WIDTH + 10}
                height={NODE_HEIGHT + 10}
                rx="13"
                fill="none"
                stroke="hsl(var(--live))"
                strokeWidth="1"
                className="node-live"
              />
            ) : null}

            <rect
              x={node.x}
              y={node.y}
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx="8"
              fill="hsl(var(--background))"
              stroke="hsl(var(--border))"
              strokeWidth="1.5"
            />
            <text
              x={node.x + NODE_WIDTH / 2}
              y={node.y + NODE_HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="hsl(var(--foreground))"
              className="font-mono text-[11px]"
            >
              {node.label}
            </text>
            {node.host ? (
              <text
                x={node.x + NODE_WIDTH / 2}
                // Above or below, whichever side the wires are not on.
                y={node.hostAbove ? node.y - 9 : node.y + NODE_HEIGHT + 15}
                textAnchor="middle"
                fill="hsl(var(--muted-foreground))"
                className="font-mono text-[9px]"
              >
                {node.host}
              </text>
            ) : null}
          </g>
        ))}
      </svg>

      {/*
        The same fact in words, and the reason the drawing is allowed to claim
        anything: this is the call the page actually made. Lower-case mono
        because it carries a path — the eyebrow treatment would render it
        "GET /PROJECTS/", which reads as shouting rather than as a route.
      */}
      <p className="mt-4 border-t border-border/60 pt-3 font-mono text-xs text-muted-foreground">
        {apiOk ? (
          <>
            GET /projects/ · 200 · {projectCount} record{projectCount === 1 ? "" : "s"}
          </>
        ) : (
          // The site is built to survive this: lib/api.ts returns a fallback
          // and the page renders. Saying so is better than a lit node lying.
          <>GET /projects/ · no answer · serving fallback</>
        )}
      </p>
    </figure>
  );
}
