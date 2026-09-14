"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import type { Viewer } from "./viewer";

/**
 * Who is signed in, in the browser, fetched once and shared.
 *
 * ## Why a store rather than a fetch per component
 *
 * Because five things on a post page need the same answer — the header, the
 * comment form, the login gate, the progress recorder and the reading marks —
 * and each of them mounting its own `useEffect(fetch)` is five identical
 * requests on every page load, arriving in an order nobody controls.
 *
 * The shape is the one lib/reading-history.ts already uses and for the same
 * reasons: an external source of truth the server cannot see, read through
 * `useSyncExternalStore` so the server renders one snapshot, the client
 * another, and React reconciles them without a cascading second render.
 *
 * `getSnapshot` has to be referentially stable — returning a fresh object each
 * call is an infinite render loop rather than a bug found later — which is what
 * the cached `current` below is for.
 *
 * ## Why the load is started by the first subscriber
 *
 * So that a page with no viewer-aware component on it makes no request at all,
 * and so that "start loading" is not something every call site has to remember.
 * Mounting is the signal.
 *
 * ## Why it is asked again on every navigation
 *
 * Because "fetch once" was wrong in the one flow this whole feature exists for.
 * Signing in ends in `redirect()` from a Server Action, which is a *client*
 * navigation — the app shell survives it, and so does this module. So a reader
 * who met the login gate, signed in and was sent back to the article arrived at
 * a page whose session store still said "nobody": no monogram in the header, no
 * comment box, and the gate still shut. Only a hard reload fixed it, which is
 * precisely what the redirect was there to avoid.
 *
 * A navigation is the one moment the answer can have changed without this tab
 * doing anything, so it is when to ask again. The cost is one small request per
 * client-side navigation: for a signed-out visitor the route reads a cookie
 * that is not there and answers immediately, without touching the API. Nothing
 * flickers, because the snapshot only changes if the answer did.
 *
 * ## What this is not
 *
 * Authorisation. Everything here came from a public route that reports the
 * caller's own identity, and it moves links and swaps sentences. Every write it
 * leads to is checked again by the API against the httpOnly token, which
 * nothing in this file can read.
 */

export type ViewerState =
  /** The fetch has not answered yet. The server always reports this. */
  | { status: "unknown"; viewer: null }
  | { status: "ready"; viewer: Viewer | null };

/**
 * What the server renders, and what the client shows until the fetch lands.
 *
 * Frozen and shared so its identity never changes — React compares snapshots by
 * reference. It is deliberately distinct from "signed out": a control that
 * cannot tell the two apart flashes the signed-out state on every page load for
 * someone who is, in fact, signed in.
 */
const UNKNOWN: ViewerState = Object.freeze({ status: "unknown", viewer: null });

let current: ViewerState = UNKNOWN;
/** The request in flight, so several components mounting together make one. */
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: ViewerState): void {
  current = next;
  for (const listener of listeners) listener();
}

function load(): Promise<void> {
  inFlight ??= fetchViewer().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function fetchViewer(): Promise<void> {
  try {
    const response = await fetch("/api/session", {
      // The route says no-store too. Both, because this one is about the
      // browser's own cache and that one is about everything in between.
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      publish({ status: "ready", viewer: null });
      return;
    }

    const body = (await response.json()) as { viewer?: Viewer | null };
    publish({ status: "ready", viewer: body?.viewer ?? null });
  } catch {
    // Offline, or the route is unreachable. Signed out is the safe reading:
    // every control here degrades to the anonymous one, which works.
    publish({ status: "ready", viewer: null });
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // The first mount starts the request; later ones join the one in flight.
  void load();

  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): ViewerState {
  return current;
}

export function getServerSnapshot(): ViewerState {
  return UNKNOWN;
}

/** The signed-in reader, or null, or not known yet. */
export function useViewer(): ViewerState {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const pathname = usePathname();

  // Ask again when the path changes — see the note at the top. On the first
  // mount this collapses into the request `subscribe` has already started.
  useEffect(() => {
    void load();
  }, [pathname]);

  return state;
}

/**
 * Re-ask the API who is signed in, from outside a component.
 *
 * Nothing needs this today: the navigation hook above covers signing in and
 * signing out, which are the only two ways the answer changes. It is here for
 * a future control that changes the session without navigating.
 */
export function refreshViewer(): void {
  void load();
}
