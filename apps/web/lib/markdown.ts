import "server-only";

import type { Element, Root } from "hast";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

/**
 * Turns a post's Markdown into HTML, on the server.
 *
 * `server-only` for the same reason as lib/api.ts: this pulls in the whole
 * unified stack, and an accidental client import would ship a Markdown parser
 * to the browser to render text that was already HTML by the time it left the
 * server.
 *
 * The API stores Markdown and returns it verbatim — it never renders and never
 * sanitises. That choice puts the entire escaping problem in one place: here,
 * the only code that produces HTML from it. `rehype-sanitize` runs against
 * GitHub's schema, so a post body containing `<script>` or an `onerror=`
 * attribute is stripped rather than trusted.
 *
 * The output is handed to `dangerouslySetInnerHTML`. That is safe *because* of
 * the sanitiser, not in spite of it — if this pipeline ever loses that step,
 * the blog becomes a stored-XSS hole. There is a test that says so.
 */

/**
 * A conservative pattern for a fence's language. Only ever used to fill an
 * attribute this module writes, so nothing from a post body reaches the DOM
 * unescaped through it.
 */
const LANGUAGE_CLASS = /^language-([a-z0-9+#.-]{1,16})$/i;

/**
 * Copies a fence's language onto its `<pre>` as `data-lang`, so the stylesheet
 * can label the block without a client component.
 *
 * Runs *after* the sanitiser rather than before it. The default schema does not
 * allow `data-lang`, so a sanitiser running last would strip the attribute
 * again; and putting this last means the value is derived from a className the
 * sanitiser has already vetted, then matched against the pattern above.
 */
function labelCodeBlocks() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;

      const code = node.children.find(
        (child): child is Element => child.type === "element" && child.tagName === "code",
      );
      if (!code) return;

      const classes = code.properties?.className;
      if (!Array.isArray(classes)) return;

      for (const entry of classes) {
        const match = LANGUAGE_CLASS.exec(String(entry));
        if (match) {
          node.properties = { ...node.properties, "data-lang": match[1].toLowerCase() };
          return;
        }
      }
    });
  };
}

const processor = unified()
  .use(remarkParse)
  // Tables, strikethrough, task lists and bare-URL autolinks. Plain CommonMark
  // has none of those, and a post that uses a table would render its pipes.
  .use(remarkGfm)
  // `allowDangerousHtml` is deliberately absent: raw HTML in a post body is
  // dropped at this step, before the sanitiser is even asked about it.
  .use(remarkRehype)
  .use(rehypeSanitize, {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      // Every link out of a post body is untrusted by definition.
      a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
    },
  })
  .use(labelCodeBlocks)
  .use(rehypeStringify);

export async function renderMarkdown(markdown: string): Promise<string> {
  const file = await processor.process(markdown);
  return String(file);
}

/**
 * Roughly what the post says, with the Markdown taken off.
 *
 * Only ever used for the meta description and the index blurb when a post has
 * no `excerpt`, so approximate is fine — it does not have to survive a
 * round trip. Code fences go first and whole: a description opening with three
 * backticks and a language name describes nothing.
 */
export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[#>\s-]+/gm, "")
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** The blurb a post falls back to when it has no `excerpt` of its own. */
export function summarise(markdown: string, limit = 180): string {
  const text = plainText(markdown);
  if (text.length <= limit) return text;

  // Cut on a word boundary; a description ending mid-word looks truncated by
  // accident rather than on purpose.
  const clipped = text.slice(0, limit);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 0 ? lastSpace : limit)}…`;
}

/** Words per minute for silent reading of technical prose. */
const READING_SPEED = 200;

/**
 * How long the post takes to read, in whole minutes, never less than one.
 *
 * Counts the prose rather than the raw source, so a post that is half code
 * fences is not credited with the minutes it would take to read them aloud.
 *
 * Rounds up, not to nearest. A 274-word post is 1.37 minutes, and rounding to
 * nearest called that "1 min" — which reads as a stub rather than an estimate,
 * and is the one direction this number should not err in. Rounding up is also
 * what every other site's figure means, so it compares.
 */
export function readingMinutes(markdown: string): number {
  const words = plainText(markdown).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / READING_SPEED));
}
