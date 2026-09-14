"use client";

import { useSyncExternalStore } from "react";

import type { Heading } from "./headings";

/**
 * What changed about the article on screen, for the two things outside it that
 * have to know.
 *
 * A post page renders its body in one place and two of its fittings somewhere
 * else: the contents list lives in the rail, a grid column away, and the copy
 * buttons are wired by a listener attached once at the top. Both were correct
 * for the markup the server sent — and both go stale the moment a gated post is
 * unlocked in place and its body is replaced with the whole article.
 *
 * Passing a callback down would mean threading one through the page, the rail
 * and two components that are otherwise independent of each other. A module
 * store is the shape this codebase already uses for exactly this — see
 * lib/reading-history.ts and lib/viewer-store.ts — and it keeps the components
 * that read it unaware of who writes it.
 *
 * `getSnapshot` has to be referentially stable, which is what the cached
 * `current` below is for: returning a fresh object each call is an infinite
 * render loop rather than a bug found later.
 */

export type ArticleState = {
  /**
   * Bumped whenever the body on screen is replaced.
   *
   * The copy-button listener keys its effect on this: its handles are `querySelector`
   * results against markup that no longer exists after an unlock, so it has to
   * run again — and "the article changed" is the only thing it needs to know.
   */
  version: number;
  /**
   * The headings of what is on screen now, or null while that is still whatever
   * the server sent.
   *
   * Null rather than the server's list, so the contents list can tell "nothing
   * has happened" from "the article was replaced and happens to have the same
   * headings" — and so it keeps rendering from its props until there is
   * genuinely something else to render.
   */
  headings: Heading[] | null;
};

const INITIAL: ArticleState = Object.freeze({ version: 0, headings: null });

let current: ArticleState = INITIAL;
const listeners = new Set<() => void>();

/**
 * Announce that the body on screen has been replaced.
 *
 * Called once, by the component that did the replacing. Everything else reads.
 */
export function publishArticle(headings: Heading[]): void {
  current = { version: current.version + 1, headings };
  for (const listener of listeners) listener();
}

/**
 * Forget anything published, so the next post starts clean.
 *
 * The store outlives a client-side navigation between two posts — it is a
 * module, not a component — and without this the second post would render the
 * first one's contents list.
 */
export function resetArticle(): void {
  if (current === INITIAL) return;
  current = INITIAL;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ArticleState {
  return current;
}

function getServerSnapshot(): ArticleState {
  return INITIAL;
}

export function useArticleState(): ArticleState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
