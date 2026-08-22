/**
 * What this browser has read, and when it was last here.
 *
 * ## Why localStorage and not an account
 *
 * A reading history is only useful to the person it belongs to, and the moment
 * it is stored server-side it becomes a record of who read what, tied to an
 * address, on a site that has no sign-in and no reason to know. Keeping it in
 * the browser means the feature costs no table, no cookie banner and no privacy
 * claim that has to be true — there is nothing to breach because there is
 * nothing here.
 *
 * The cost is that it does not follow you to another device. For "which of
 * these have I already read", that is an acceptable answer.
 *
 * ## Why it is a store rather than a pair of getters
 *
 * The components that need it are rendering from it, and the server cannot know
 * any of it — so the obvious shape, `useEffect` plus `setState`, is a render, a
 * commit, and a second render on every mount. React has a purpose-built answer
 * for exactly this (an external source of truth the server cannot see), and it
 * is `useSyncExternalStore`: one snapshot on the client, a different one on the
 * server, no cascading render, and no flash of the wrong state.
 *
 * `getSnapshot` therefore has to be referentially stable — returning a fresh
 * array each call is an infinite loop, not a bug you find later — which is what
 * the cached `client` object below is for.
 *
 * ## Why the visit time is captured once
 *
 * The index does two things on load: it marks which posts are new *since your
 * last visit*, and it records that you have now visited. Those two race, and
 * the second would overwrite what the first needs. The snapshot is taken once
 * and `markVisit` deliberately does not update it, so every component sees the
 * same before-this-page-load value for the life of the page.
 */

const VISIT_KEY = "blog:last-visit";
const READ_KEY = "blog:read";

/** How many posts to remember. Older entries fall off the end. */
const HISTORY_LIMIT = 24;

export type ReadEntry = {
  slug: string;
  title: string;
  /** Epoch milliseconds. */
  at: number;
  /** How far down the post they got, 0-1. Absent on an older entry. */
  progress?: number;
};

export type History = {
  /** When this browser last opened the blog. Null if it never has. */
  lastVisit: number | null;
  /** Most recently read first. */
  entries: ReadEntry[];
};

/**
 * What the server renders from, and what the client renders before storage has
 * been read. Frozen and shared so its identity never changes — React compares
 * snapshots by reference.
 */
const NOTHING: History = Object.freeze({ lastVisit: null, entries: [] });

let client: History | null = null;
const listeners = new Set<() => void>();

/**
 * Every read here is wrapped, and not out of superstition.
 *
 * localStorage throws rather than returning null in two ordinary situations:
 * Safari's private mode, and a browser configured to block site data. Both
 * would take down the page that called it, for a feature whose whole job is a
 * convenience — so failure means "no history", never an error.
 */
function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded, or storage blocked. Nothing to do and nothing to say.
  }
}

function load(): History {
  const visit = readStore<number | null>(VISIT_KEY, null);
  const entries = readStore<ReadEntry[]>(READ_KEY, []);

  return {
    lastVisit: typeof visit === "number" ? visit : null,
    // Defensive: this comes back from storage a visitor can edit by hand, and a
    // malformed entry would otherwise reach a component that maps over it.
    entries: Array.isArray(entries)
      ? entries.filter(
          (entry): entry is ReadEntry =>
            typeof entry?.slug === "string" && typeof entry?.title === "string",
        )
      : [],
  };
}

function publish(next: History): void {
  client = next;
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): History {
  if (client === null) client = load();
  return client;
}

export function getServerSnapshot(): History {
  return NOTHING;
}

/**
 * Record that the blog was opened now.
 *
 * Writes storage but deliberately does not move the snapshot's `lastVisit` —
 * see the note at the top. Safe to call more than once.
 */
export function markVisit(): void {
  // Reads first, so the snapshot holds the *previous* visit whichever component
  // happens to call this first.
  getSnapshot();
  writeStore(VISIT_KEY, Date.now());
}

/** Note that a post was opened, moving it to the front of the history. */
export function markRead(slug: string, title: string, progress?: number): void {
  const current = getSnapshot();
  const rest = current.entries.filter((entry) => entry.slug !== slug);
  const entries = [{ slug, title, at: Date.now(), progress }, ...rest].slice(
    0,
    HISTORY_LIMIT,
  );

  writeStore(READ_KEY, entries);
  publish({ ...current, entries });
}

export function hasRead(history: History, slug: string): boolean {
  return history.entries.some((entry) => entry.slug === slug);
}

export function clearHistory(): void {
  try {
    window.localStorage.removeItem(READ_KEY);
  } catch {
    // As above.
  }
  publish({ ...getSnapshot(), entries: [] });
}
