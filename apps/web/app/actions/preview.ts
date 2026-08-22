"use server";

import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/admin-guard";
import { renderPostBody } from "@/lib/mdx";

/**
 * Render a post body exactly the way the public page will.
 *
 * ## Why the real pipeline and not a client-side renderer
 *
 * Because a preview that is *nearly* right is worse than none: it teaches the
 * author to trust it, and the one time it disagrees is the time something ships
 * wrong. A second renderer in the browser would mean a second sanitiser, a
 * second set of Shiki grammars and a second answer to what MDX may contain —
 * three things that would drift, silently, in the direction of being more
 * permissive than the real one.
 *
 * ## Why it returns React rather than an HTML string
 *
 * Two earlier versions turned the rendered tree into a string with
 * `renderToStaticMarkup`, once from a Server Action and once from a route
 * handler. Next refuses `react-dom/server` in both — "You're importing a
 * component that imports react-dom/server" — and it is right to: the tree does
 * not need flattening, because a Server Action can return React elements and
 * the client can render them.
 *
 * That is also strictly better. No HTML string means no `dangerouslySetInnerHTML`
 * on the other end, so the preview is not a second place where markup is
 * trusted — the components arrive as components, already rendered on the
 * server, and the browser never parses a string this module produced.
 *
 * ## Why it is admin-only
 *
 * A Server Action is a POST endpoint the browser can reach directly. Without
 * the guard this would be an open "compile and run MDX on our server"
 * endpoint — which lib/mdx-guard.ts makes far less interesting than it sounds,
 * but "less interesting than it sounds" is not a reason to leave it open.
 */

export type Preview = {
  /** Already carries `article-prose`, and is safe to render directly. */
  content: ReactNode;
  used: "markdown" | "mdx";
  /** Why MDX was not used, when it was asked for and did not work. */
  problem: string | null;
};

/** Roughly the largest body worth rendering, and a bound on what one call costs. */
const MAX_BODY = 200_000;

export async function renderPreview(body: string, format: string): Promise<Preview> {
  await requireAdmin("/admin/posts");

  if (typeof body !== "string" || body.length > MAX_BODY) {
    return {
      content: null,
      used: "markdown",
      problem: "That body is too long to preview. Save it and open the post instead.",
    };
  }

  // Anything but "mdx" is Markdown. Narrowed rather than trusted: the value
  // decides which pipeline runs, and the stricter one is the right default.
  const rendered = await renderPostBody(body, format === "mdx" ? "mdx" : "markdown");

  return {
    content: rendered.content,
    used: rendered.used,
    problem: rendered.problem ?? null,
  };
}
