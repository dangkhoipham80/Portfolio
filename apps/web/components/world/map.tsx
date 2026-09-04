import type { ReactNode } from "react";

import { PLACES } from "./places";

/**
 * The island drawn flat: the same places at the same positions, as a map.
 *
 * Two jobs. In the atlas it is the picture at the top of the list view,
 * for a browser without WebGL or a reader who would rather scroll. In the
 * HUD it is the minimap, with the player's marker passed in as `children`
 * so the scene can move it. No hooks, so it renders on the server.
 */
export const MAP_SCALE = 4.2;

export function IslandMap({
  children,
  labels = true,
  className,
}: {
  children?: ReactNode;
  labels?: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="-60 -60 120 120" className={className} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <circle r="50" className="fill-muted stroke-border" strokeWidth="0.5" />
      {PLACES.filter((place) => place.id !== "about").map((place) => (
        <line
          key={place.id}
          x1="0"
          y1="0"
          x2={place.at[0] * MAP_SCALE}
          y2={place.at[1] * MAP_SCALE}
          className="stroke-border"
          strokeWidth="0.6"
          strokeDasharray="1.5 2"
        />
      ))}
      {PLACES.map((place) => (
        <g key={place.id} transform={`translate(${place.at[0] * MAP_SCALE} ${place.at[1] * MAP_SCALE})`}>
          <circle r={place.id === "about" ? 1.6 : 2.2} className={place.id === "about" ? "fill-foreground" : "fill-signal"} />
          {labels ? (
            <text y="-4" textAnchor="middle" className="fill-foreground font-mono" fontSize="3.4">
              {place.label}
            </text>
          ) : null}
        </g>
      ))}
      {children}
    </svg>
  );
}
