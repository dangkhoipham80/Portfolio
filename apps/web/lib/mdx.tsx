import "server-only";

import { compile, run } from "@mdx-js/mdx";
import type { ReactNode } from "react";
import * as runtime from "react/jsx-runtime";

import { MDX_COMPONENTS } from "@/components/mdx-blocks";

import {
  anchorHeadings,
  labelCodeBlocks,
  renderMarkdown,
  shikiOptions,
} from "./markdown";
import { messageFor, rejectExecutableMdx } from "./mdx-guard";

/**
 * Renders a post body — Markdown, or MDX restricted to the site's components.
 *
 * What MDX is allowed to be, and why the restriction exists at all, is in
 * lib/mdx-guard.ts. This file is the half that needs React, and it does two
 * things the guard cannot: it compiles, and it decides what happens when the
 * compile fails.
 *
 * ## Why it compiles rather than transforming to HTML
 *
 * With expressions rejected, the emitted function body is nothing but `_jsx()`
 * calls with literal props — so this *could* have been a rehype transform
 * producing a string, like the Markdown path. Compiling keeps the components as
 * real React components, which is what lets one of them become interactive
 * later without changing the pipeline underneath it.
 *
 * ## Why a broken body renders instead of failing
 *
 * MDX is far easier to get wrong than Markdown: one unclosed tag is a compile
 * error, and the error arrives at render time, on a page the author is probably
 * not looking at. Throwing would mean a typo in a post takes the post down —
 * the exact failure mode lib/api.ts's fallbacks exist to rule out. So a failure
 * falls back to the Markdown pipeline, which renders the tags as text and shows
 * the reader the prose. `problem` carries what went wrong so the console's
 * preview can say so; the public page just renders.
 */

/*
 * The `article-prose` class is applied *here*, on the element that directly
 * contains the post's own markup, rather than by the page around it.
 *
 * That is not tidiness. Every rule in that stylesheet is a direct-child
 * selector — `.article-prose > * + *` is what puts a gap between paragraphs —
 * and the first version of this returned the body wrapped in a plain `<div>`
 * for the page to put the class on. One extra element between the class and the
 * content, and every one of those selectors matched the wrapper instead: the
 * whole article rendered with no spacing between anything. Type-check, lint and
 * build all passed; a screenshot is what caught it.
 */
const PROSE = "article-prose";

export type RenderedBody = {
  /** Already carries `article-prose`. Render it directly, do not wrap it. */
  content: ReactNode;
  /** What actually rendered it, which is not always what was asked for. */
  used: "markdown" | "mdx";
  /** Why MDX was not used, when it was asked for and did not work. */
  problem?: string;
};

export async function renderPostBody(
  body: string,
  format: "markdown" | "mdx",
): Promise<RenderedBody> {
  if (format !== "mdx") {
    return { content: await renderedMarkdown(body), used: "markdown" };
  }

  try {
    return { content: await renderMdx(body), used: "mdx" };
  } catch (error) {
    console.error("[mdx] falling back to markdown:", error);
    return {
      content: await renderedMarkdown(body),
      used: "markdown",
      problem: messageFor(error),
    };
  }
}

/**
 * The existing Markdown pipeline's HTML, as a node.
 *
 * `dangerouslySetInnerHTML` is safe here for exactly the reason lib/markdown.ts
 * gives and no other: that pipeline sanitises. This wrapper adds nothing to it
 * and takes nothing away.
 */
async function renderedMarkdown(body: string): Promise<ReactNode> {
  const html = await renderMarkdown(body);
  return <div className={PROSE} dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Why `rehype-sanitize` is absent here, when the Markdown path depends on it.
 *
 * Because it silently deletes every component. `hast-util-sanitize` keeps nodes
 * of type `element` and drops everything it does not recognise, and an MDX
 * component is an `mdxJsxFlowElement` — so it went, without an error, without a
 * fallback, leaving the prose in place and the callouts, figures and embeds
 * simply not there. This file used to carry a comment asserting the opposite,
 * which was an assumption nobody had run. A post rendered on the real page is
 * what found it.
 *
 * What the sanitiser was doing for this path, and what covers it now:
 *
 * * **Raw HTML.** Impossible in MDX — every angle bracket is JSX, and the guard
 *   refuses any JSX name outside the four components, lowercase ones included.
 *   `<script>` is rejected by name with a message the author can act on.
 * * **Inline event handlers and arbitrary attributes.** Same answer: they can
 *   only arrive on JSX, and the guard allows one attribute shape — a name with
 *   a plain string value.
 * * **`javascript:` and `data:` URLs in Markdown links.** This one is real and
 *   is *not* JSX, so the guard now checks it directly. See `SAFE_PROTOCOLS`.
 *
 * The remaining difference from the Markdown path is that a component's own
 * attributes are not schema-checked. They are plain strings by then, and each
 * component decides what to do with them — `Video` builds its URL from a
 * provider key and an id matched against a pattern rather than accepting one.
 */
async function renderMdx(body: string): Promise<ReactNode> {
  const compiled = await compile(body, {
    outputFormat: "function-body",
    development: false,
    remarkPlugins: [
      // First, so nothing executable reaches a later plugin — or the compiler.
      rejectExecutableMdx,
      (await import("remark-gfm")).default,
    ],
    rehypePlugins: [
      [(await import("@shikijs/rehype")).default, shikiOptions],
      // Both of these were missing, which is why an MDX post had no `data-lang`
      // labels on its fences and no ids on its headings — so its table of
      // contents linked to anchors that did not exist. Nothing failed; the
      // contents list just scrolled nowhere.
      labelCodeBlocks,
      anchorHeadings,
    ],
  });

  const { default: Content } = await run(compiled, {
    ...runtime,
    baseUrl: import.meta.url,
  });

  return (
    <div className={PROSE}>
      <Content components={MDX_COMPONENTS} />
    </div>
  );
}
