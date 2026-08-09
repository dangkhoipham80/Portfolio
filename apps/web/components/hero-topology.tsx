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
 * hydration, nothing competing with LCP. The motion is one CSS keyframe on the
 * edge strokes, so `prefers-reduced-motion` stops it through the global rule
 * rather than needing its own escape hatch.
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

export function HeroTopology({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 240"
      aria-hidden="true"
      className={cn("h-auto w-full max-w-md", className)}
    >
      {/* Static rails, so the graph still reads as connected when motion is off. */}
      {EDGES.map((edge) => (
        <path
          key={`rail-${edge.d}`}
          d={edge.d}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="1.5"
        />
      ))}

      {EDGES.map((edge) => (
        <path
          key={`flow-${edge.d}`}
          d={edge.d}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinecap="round"
          className="wire-flow"
          style={{ animationDelay: edge.delay }}
        />
      ))}

      {NODES.map((node) => (
        <g key={node.id}>
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
