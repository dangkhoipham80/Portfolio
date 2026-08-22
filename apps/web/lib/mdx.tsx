import "server-only";

import { compile, run } from "@mdx-js/mdx";
import type { ReactNode } from "react";
import * as runtime from "react/jsx-runtime";
import rehypeSanitize from "rehype-sanitize";

import { MDX_COMPONENTS } from "@/components/mdx-blocks";

import { renderMarkdown, sanitiseSchema, shikiOptions } from "./markdown";
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
      // The same sanitiser and schema as the Markdown path. It runs over the
      // Markdown-derived half of the tree; the component tags are MDX nodes it
      // passes through, which is why the guard's allow-list is what covers
      // those and not this.
      [rehypeSanitize, sanitiseSchema],
      [(await import("@shikijs/rehype")).default, shikiOptions],
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
