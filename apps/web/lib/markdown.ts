import "server-only";

import rehypeShiki, { type RehypeShikiOptions } from "@shikijs/rehype";
import type { Element, Root } from "hast";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { slugifyHeading } from "./headings";
import { renderSequenceDiagrams } from "./sequence-diagram/plugin";

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
export function labelCodeBlocks() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;

      const code = node.children.find(
        (child): child is Element => child.type === "element" && child.tagName === "code",
      );
      if (!code) return;

      // Shiki writes the class under the raw `class` key as a single string;
      // remark-rehype writes `className` as an array. Accept all of it —
      // this runs after either producer.
      const raw = code.properties?.className ?? code.properties?.["class"];
      const classes = Array.isArray(raw)
        ? raw
        : typeof raw === "string"
          ? raw.split(" ")
          : [];

      for (const entry of classes) {
        const match = LANGUAGE_CLASS.exec(String(entry));
        if (!match) continue;

        const language = match[1].toLowerCase();
        // "text" is the highlighter's filler for a bare fence (defaultLanguage
        // above), not something the author wrote. A TEXT corner label is a
        // guess, and the design leaves unlabelled fences unlabelled.
        if (language !== "text" && language !== "plaintext" && language !== "txt") {
          node.properties = { ...node.properties, "data-lang": language };
        }
        return;
      }
    });
  };
}

/**
 * The sanitiser's schema, exported so the MDX pipeline uses the same one.
 *
 * Two copies of this would be two answers to "what markup may a post contain",
 * and the one that drifts is the one nobody is looking at. `id` on headings is
 * allowed because `anchorHeadings` below writes them and the table of contents
 * links to them — the sanitiser runs first, so without this the anchors would
 * survive exactly until the next paragraph of this file was believed.
 */
export const sanitiseSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Every link out of a post body is untrusted by definition.
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
    h2: [...(defaultSchema.attributes?.h2 ?? []), "id"],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "id"],
  },
};

/**
 * Shiki's settings, shared with the MDX pipeline for the same reason.
 *
 * Highlighting runs *after* the sanitiser in both: everything Shiki emits — the
 * spans, the inline colour variables — is generated from code text the
 * sanitiser has already vetted, so none of it can smuggle markup in. Both
 * themes are emitted as CSS variables (`defaultColor: false`) and globals.css
 * picks a side per mode; on the server only, so the browser ships zero
 * highlighter code.
 */
export const shikiOptions: RehypeShikiOptions = {
  themes: { light: "vitesse-light", dark: "vitesse-dark" },
  defaultColor: false,
  defaultLanguage: "text",
  fallbackLanguage: "text",
  // Keeps `language-x` on the <code>, which labelCodeBlocks reads next.
  addLanguageClass: true,
  /*
   * Spelled out because the default is every grammar Shiki ships — which
   * makes the first render pay seconds of initialisation, in production
   * cold starts and in the test suite alike. This is the vocabulary of the
   * posts this blog actually writes; a fence in anything else degrades to
   * unhighlighted text via fallbackLanguage rather than failing.
   */
  langs: [
    "python", "javascript", "typescript", "tsx", "jsx", "json", "yaml",
    "toml", "bash", "shell", "sql", "css", "html", "dockerfile", "java",
    "markdown", "diff",
  ],
};

/**
 * Marks every link that leaves the site, so the stylesheet can say so.
 *
 * A post's references are the one kind of link on this site the app does not
 * write itself, and they arrived with nothing on them: same-tab, no `rel`,
 * indistinguishable from an anchor to the next heading. Every other outbound
 * link on the site goes through `ExternalLink`, which opens a new tab and
 * carries the ↗ mark — a post's references should read as the same thing.
 *
 * Runs *after* the sanitiser, like `labelCodeBlocks`, because the schema is
 * what allows `target` and `rel` on an anchor in the first place; a sanitiser
 * running later would strip them again. Only absolute `http(s)` URLs count as
 * leaving: a relative path, a `#fragment` or a `mailto:` stays as it is.
 */
export function markExternalLinks() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;

      const href = node.properties?.href;
      if (typeof href !== "string" || !/^https?:\/\//i.test(href)) return;

      node.properties = {
        ...node.properties,
        target: "_blank",
        // `noopener` so the new tab cannot reach back to this one; `noreferrer`
        // for the same reason ExternalLink sends it.
        rel: ["noopener", "noreferrer"],
      };
    });
  };
}

/**
 * Give every `h2` and `h3` the id its table-of-contents entry links to.
 *
 * The ids have to be derived the same way in two places that never see each
 * other's output — here, from the rendered tree, and in `headingsOf`, from the
 * Markdown source — so both call `slugifyHeading` and the duplicate-suffixing
 * rule is applied identically. A mismatch would not fail anywhere; the contents
 * list would simply scroll to nothing, which is why it is worth stating.
 */
export function anchorHeadings() {
  return (tree: Root) => {
    const seen = new Map<string, number>();

    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "h2" && node.tagName !== "h3") return;

      const base = slugifyHeading(textOf(node));
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);

      node.properties = {
        ...node.properties,
        id: count === 0 ? base : `${base}-${count + 1}`,
      };
    });
  };
}

/** A node's visible text, which for a heading is what the slug is made of. */
function textOf(node: Element): string {
  let text = "";
  visit(node, "text", (child: { value: string }) => {
    text += child.value;
  });
  return text;
}

const processor = unified()
  .use(remarkParse)
  // Tables, strikethrough, task lists and bare-URL autolinks. Plain CommonMark
  // has none of those, and a post that uses a table would render its pipes.
  .use(remarkGfm)
  // `allowDangerousHtml` is deliberately absent: raw HTML in a post body is
  // dropped at this step, before the sanitiser is even asked about it.
  .use(remarkRehype)
  .use(rehypeSanitize, sanitiseSchema)
  /*
   * Between the sanitiser and the highlighter, and it has to be exactly there —
   * the schema has no SVG in it, so a sanitiser running afterwards would delete
   * the diagram, and Shiki running first would have turned the fence into a
   * tree of coloured spans. See lib/sequence-diagram/plugin.ts.
   */
  .use(renderSequenceDiagrams)
  .use(rehypeShiki, shikiOptions)
  .use(labelCodeBlocks)
  .use(anchorHeadings)
  .use(markExternalLinks)
  .use(rehypeStringify);

/*
 * Re-exported so a caller reaching for "the headings of this post" finds them
 * next to the renderer. The definitions live in lib/headings.ts because the
 * table of contents is a client component and this module is `server-only` —
 * importing it there would ship remark, rehype and Shiki to the browser.
 */
export { hasContents, headingsOf, MINIMUM_HEADINGS, slugifyHeading } from "./headings";
export type { Heading } from "./headings";

export async function renderMarkdown(markdown: string): Promise<string> {
  const file = await processor.process(markdown);
  return String(file);
}

/**
 * Roughly what the post says, with the Markdown taken off.
 *
 * Only ever used for the meta description, the index blurb when a post has no
 * `excerpt`, and the reading estimate — so approximate is fine; it does not
 * have to survive a round trip. Code fences go first and whole: a description
 * opening with three backticks and a language name describes nothing.
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
