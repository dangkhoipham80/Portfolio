import { cn } from "@/lib/cn";

/**
 * The hero's thesis: this person builds systems where services talk to each
 * other.
 *
 * Every node is real infrastructure from the projects on this page — FastAPI,
 * Postgres, Redis and Kafka all appear in EduPath and Food Forum. A rotating
 * geometric shape would have said nothing about backend engineering; a topology
 * says the whole thing at a glance.
 *
 * Inline SVG on the server: no canvas, no WebGL, no client component, no
 * hydration, nothing competing with LCP. All motion is CSS — the boot-order
 * entrance (`hero-enter`) and the packet flow on the edges — so
 * `prefers-reduced-motion` stops the lot through the global rule rather than
 * needing its own escape hatch.
 *
 * Decorative by definition — the information is in the prose beside it — so the
 * whole graphic is hidden from assistive tech instead of narrating a diagram
 * nobody asked for.
 */

type Node = { id: string; label: string; x: number; y: number };

const NODE_WIDTH = 82;
const NODE_HEIGHT = 30;

const NODES: Node[] = [
  { id: "client", label: "Client", x: 6, y: 105 },
  { id: "api", label: "FastAPI", x: 155, y: 105 },
  { id: "postgres", label: "Postgres", x: 306, y: 30 },
  { id: "redis", label: "Redis", x: 306, y: 105 },
  { id: "kafka", label: "Kafka", x: 306, y: 180 },
];

/** Edges leave the right side of one node and arrive at the left of the next. */
const EDGES = [
  { d: "M88,120 L155,120", delay: "0s" },
  { d: "M237,120 C272,120 276,45 306,45", delay: "0.35s" },
  { d: "M237,120 L306,120", delay: "0.7s" },
  { d: "M237,120 C272,120 276,195 306,195", delay: "1.05s" },
];

/*
 * The boot order, one delay per node in NODES order: Client registers, the
 * API comes up, then its dependencies. Inline style rather than a Tailwind
 * arbitrary class because the values are indexed at render time and the
 * scanner would never see them.
 */
const NODE_BOOT_DELAY_MS = [450, 525, 600, 675, 750];

/*
 * Each rail is drawn just before the node it arrives at pops in, so the
 * sequence reads as one motion — the wire reaches the service, then the
 * service appears — rather than as two separate animations that happen to
 * overlap.
 */
const EDGE_DRAW_DELAY_MS = [240, 380, 470, 560];

/*
 * When the wires start flowing. Kafka's entrance technically runs until
 * 1.15s, but the deceleration easing has it visually settled well before
 * that — 0.8s starts the first flow the moment the graph reads as complete,
 * without a dead beat at the end of the boot.
 */
const FLOW_START = "0.8s";

export function HeroTopology({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 240"
      aria-hidden="true"
      // Capped only while the hero is a single column. Once the two-column
      // grid is active the diagram fills its column — at that scale it reads
      // as the architecture it depicts, not as an icon beside the text.
      className={cn("h-auto w-full max-w-lg lg:max-w-none", className)}
    >
      {/*
        The rails draw themselves in request order. `pathLength="1"` normalises
        every curve so one dasharray works for all of them — see `.edge-draw`.
        The base state is a fully drawn line, so with motion off (or without
        animation support) this is exactly the static graph it replaced.
      */}
      <g>
        {EDGES.map((edge, i) => (
          <path
            key={`rail-${edge.d}`}
            d={edge.d}
            pathLength="1"
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
            className="edge-draw"
            style={{ animationDelay: `${EDGE_DRAW_DELAY_MS[i]}ms` }}
          />
        ))}
      </g>

      {/* The packets. `.wire-flow` supplies the lit stroke and its glow. */}
      <g>
        {EDGES.map((edge) => (
          <path
            key={`flow-${edge.d}`}
            d={edge.d}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            className="wire-flow"
            // Held until the last node's entrance lands — flow through a
            // half-built graph would break the boot narrative.
            style={{ animationDelay: `calc(${FLOW_START} + ${edge.delay})` }}
          />
        ))}
      </g>

      {NODES.map((node, i) => (
        <g
          key={node.id}
          className="topology-node node-pop"
          style={{ animationDelay: `${NODE_BOOT_DELAY_MS[i]}ms` }}
        >
          {/*
            A halo under the API node only. It is the one service on this
            diagram that is *this* site's API, and giving exactly one node a
            slow breath is what stops the graph reading as a still life. One
            infinite animation, on a decorative mark, nowhere near text.
          */}
          {node.id === "api" ? (
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
            fill="hsl(var(--card))"
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
          />
          <text
            x={node.x + NODE_WIDTH / 2}
            y={node.y + NODE_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="hsl(var(--muted-foreground))"
            className="font-mono text-[11px]"
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
