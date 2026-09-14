/**
 * What the site knows about the person reading it.
 *
 * No imports and no directive, for the reason lib/comment-form.ts and
 * lib/sign-in.ts both record: this shape is produced on the server
 * (lib/viewer-server.ts), carried over the wire by app/api/session/route.ts and
 * consumed in the browser (lib/viewer-store.ts). A type that lives in any one of
 * those three cannot be imported by the other two without dragging that file's
 * environment along with it — `server-only` is a build error in a client bundle,
 * and a `"use client"` module is the wrong thing for a server module to reach
 * into.
 *
 * ## Why it is this small
 *
 * Everything here reaches a client component, so the test for adding a field is
 * whether the *screen* needs it — not whether it was to hand. There is no token,
 * no roles list and no account id.
 *
 * ## What none of it is
 *
 * Authorisation. `isAdmin` moves a link; `isVerified` swaps a sentence. Every
 * write either could lead to is checked again by the API against the httpOnly
 * token, which nothing in the browser can read.
 */
export type Viewer = {
  name: string;
  email: string;
  isAdmin: boolean;
  isVerified: boolean;
  /** Consecutive days signed in, as the API counts them. */
  streak: number;
};
