import * as React from "react";
import type { ReactNode } from "react";

/**
 * React's <ViewTransition>, reached around the type definitions.
 *
 * The App Router runs a React canary that exports `ViewTransition`, but
 * @types/react (stable) does not know it yet — so a direct named import fails
 * to type-check while working at runtime. This shim reads the export
 * dynamically and, when it is genuinely absent (an older runtime), renders
 * children untouched: navigation still works, the morph just does not animate.
 * That is the View Transitions API's own contract — progressive enhancement —
 * extended one level down.
 */
type ViewTransitionProps = { name?: string; children: ReactNode };

const Runtime = (React as Record<string, unknown>)["ViewTransition"] as
  | React.ComponentType<ViewTransitionProps>
  | undefined;

export function ViewTransition({ name, children }: ViewTransitionProps) {
  if (!Runtime) return <>{children}</>;
  return <Runtime name={name}>{children}</Runtime>;
}
