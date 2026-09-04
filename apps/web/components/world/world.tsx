"use client";

/*
 * A client component because the island is interactive by definition —
 * pointer hover, click-to-travel, a WebGL canvas, a reduced-motion query and
 * a visibility observer that stops drawing when the reader scrolls on. The
 * signpost strip at the foot is plain links and renders on the server, so
 * the five ways in exist in the HTML before any of this loads.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";

import { usePalette } from "./palette";
import { PLACES, placeById, type PlaceId } from "./places";

/*
 * The scene, and with it `three`, arrives only in the browser and only once
 * this component has mounted — a server render of a WebGL canvas is nothing,
 * and the renderer is the largest thing the site ships, so it is not on the
 * critical path of a page that is otherwise text.
 */
const Scene = dynamic(() => import("./scene"), { ssr: false });

let webglSupport: boolean | undefined;

/** Whether this browser can draw the island. Checked once, on the client. */
function hasWebGL(): boolean {
  if (webglSupport === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webglSupport = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

const MOTION_QUERY = "(prefers-reduced-motion: no-preference)";

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const noop = () => () => {};

/**
 * The island: five places, five paths, and the reader at the crossroads.
 *
 * ## What it is for
 *
 * The home page used to open with a name and a sentence, which is what
 * every portfolio opens with. This opens with somewhere to go. Each of the
 * site's sections is a landmark on the island — the lighthouse is the work,
 * the big tree is the writing, the mountain trail is the career, the
 * pavilion is the credentials, the cabin is the way to get in touch — and
 * choosing one flies the camera to it and takes you there.
 *
 * ## What it is not allowed to cost
 *
 * The strip of links under the scene is the real navigation: server-rendered,
 * keyboard-reachable, 44px tall. The floating signposts over the landmarks
 * are duplicates of it, hidden from assistive technology and unreachable by
 * tab, so nobody has to find a heading by hovering a mountain. Without
 * WebGL the canvas is replaced by a drawn map of the same five places; under
 * reduced motion nothing on the island idles and a click goes straight
 * there. Off screen, the canvas stops drawing.
 */
export function World({
  counts,
  className,
}: {
  /** How many things each place holds, for the signposts. Absent = unknown. */
  counts: Partial<Record<PlaceId, number>>;
  className?: string;
}) {
  const router = useRouter();
  const palette = usePalette();
  // Both are facts about the browser, read as external stores so they are
  // `null`/false on the server and true on the client without a re-render
  // in an effect. Motion follows the OS setting live.
  const motion = useSyncExternalStore(subscribeMotion, () => window.matchMedia(MOTION_QUERY).matches, () => false);
  const webgl = useSyncExternalStore(noop, hasWebGL, () => null);
  const [active, setActive] = useState(false);
  const [hovered, setHovered] = useState<PlaceId | null>(null);
  const [flight, setFlight] = useState<PlaceId | null>(null);
  const labels = useRef(new Map<PlaceId, HTMLElement>());
  const root = useRef<HTMLDivElement>(null);

  // Draw only while on screen and while the tab is in front.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let seen = false;
    const settle = () => setActive(seen && document.visibilityState === "visible");
    const observer = new IntersectionObserver(
      (entries) => {
        seen = entries.some((entry) => entry.isIntersecting);
        settle();
      },
      { threshold: 0.05 },
    );
    observer.observe(el);
    document.addEventListener("visibilitychange", settle);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", settle);
    };
  }, []);

  const go = useCallback(
    (id: PlaceId) => {
      const { href } = placeById(id);
      // A section of this same page: the hash does the scrolling, smoothly
      // where the reader allows it (`scroll-behavior` in globals.css).
      if (href.startsWith("/#") && window.location.pathname === "/") {
        window.location.hash = href.slice(2);
        return;
      }
      router.push(href);
    },
    [router],
  );

  const select = useCallback(
    (id: PlaceId) => {
      if (flight) return;
      if (!motion) {
        go(id);
        return;
      }
      setFlight(id);
    },
    [flight, motion, go],
  );

  const onArrive = useCallback(() => {
    if (flight) go(flight);
  }, [flight, go]);

  // Warm the route while the pointer is still deciding.
  const hover = useCallback(
    (id: PlaceId | null) => {
      setHovered(id);
      if (id) {
        const { href } = placeById(id);
        if (!href.startsWith("/#")) router.prefetch(href);
      }
    },
    [router],
  );

  return (
    <div
      ref={root}
      className={cn("world relative isolate overflow-hidden", className)}
      style={{ cursor: hovered && !flight ? "pointer" : undefined }}
    >
      <div aria-hidden="true" className="absolute inset-0">
        {webgl && palette ? (
          <Scene
            palette={palette}
            motion={motion}
            active={active}
            hovered={hovered}
            setHovered={hover}
            select={select}
            flight={flight}
            onArrive={onArrive}
            labels={labels}
          />
        ) : webgl === false ? (
          <IslandMap />
        ) : null}
      </div>

      {/*
        The floating signposts. Positioned by the scene each frame, so they
        start invisible and appear once the first frame has placed them.
        Decorative duplicates of the strip below: not in the tab order, not
        announced. Absent on phone widths where five of them would overlap.
      */}
      {webgl ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden sm:block">
          {PLACES.map((place) => (
            <button
              key={place.id}
              type="button"
              tabIndex={-1}
              ref={(el) => {
                if (el) labels.current.set(place.id, el);
                else labels.current.delete(place.id);
              }}
              onPointerEnter={() => hover(place.id)}
              onPointerLeave={() => hover(null)}
              onClick={() => select(place.id)}
              className={cn(
                "world-post absolute left-0 top-0 opacity-0",
                hovered === place.id && "is-lit",
              )}
            >
              <span className="world-post-node" />
              <span className="world-post-label">
                {place.label}
                {counts[place.id] !== undefined ? (
                  <span className="text-muted-foreground"> · {counts[place.id]}</span>
                ) : null}
              </span>
              <span className="world-post-blurb">{place.blurb}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* A caption in the corner, in the site's own voice. */}
      <p className="pointer-events-none absolute right-5 top-4 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground sm:right-8">
        /world · five paths
      </p>

      {/* The real navigation. */}
      <nav aria-label="Places" className="absolute inset-x-0 bottom-0 px-5 pb-5 sm:px-8">
        <ul className="flex flex-wrap gap-2">
          {PLACES.map((place) => (
            <li key={place.id}>
              <Link
                href={place.href}
                onPointerEnter={() => hover(place.id)}
                onPointerLeave={() => hover(null)}
                onFocus={() => hover(place.id)}
                onBlur={() => hover(null)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-pill)] border bg-background/75 px-4 font-mono text-xs uppercase tracking-[0.18em] backdrop-blur-md transition-[color,border-color,translate] duration-200",
                  hovered === place.id
                    ? "-translate-y-px border-primary/50 text-primary"
                    : "border-border/70 text-foreground hover:-translate-y-px hover:border-primary/50 hover:text-primary",
                )}
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal" />
                {place.label}
                {counts[place.id] !== undefined ? (
                  <span className="text-muted-foreground">· {counts[place.id]}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/**
 * The island without WebGL: the same five places on a drawn map, so a
 * browser that cannot run the scene still sees where the paths go. The
 * strip carries the links; this is the picture behind them.
 */
function IslandMap() {
  const scale = 4.2;
  return (
    <svg viewBox="-60 -60 120 120" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <circle r="50" className="fill-muted stroke-border" strokeWidth="0.5" />
      {PLACES.map((place) => (
        <line
          key={place.id}
          x1="0"
          y1="0"
          x2={place.at[0] * scale}
          y2={place.at[1] * scale}
          className="stroke-border"
          strokeWidth="0.6"
          strokeDasharray="1.5 2"
        />
      ))}
      <circle r="1.6" className="fill-foreground" />
      {PLACES.map((place) => (
        <g key={place.id} transform={`translate(${place.at[0] * scale} ${place.at[1] * scale})`}>
          <circle r="2.2" className="fill-signal" />
          <text y="-4" textAnchor="middle" className="fill-foreground font-mono" fontSize="3.4">
            {place.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
