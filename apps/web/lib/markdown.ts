import "server-only";

import rehypeShiki, { type RehypeShikiOptions } from "@shikijs/rehype";
import type { Element, Root } from "hast";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema, type Options as Schema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";

import { type Heading, type HeadingLevel, slugifyHeading } from "./headings";
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
 * How wide a block is, in characters — the longest line it contains.
 *
 * Tabs count as two columns because that is what a `<pre>` with the default
 * `tab-size` renders them as at the start of a line, which is where they occur.
 */
function widestLine(node: Element): number {
  let text = "";
  visit(node, "text", (child: { value: string }) => {
    text += child.value;
  });

  return text
    .split("\n")
    .reduce((widest, line) => Math.max(widest, line.replace(/\t/g, "  ").length), 0);
}

/**
 * Copies a fence's language onto its `<pre>` as `data-lang`, and its width in
 * characters onto the same element as `--cols`.
 *
 * `data-lang` lets the stylesheet label the block without a client component.
 * `--cols` is the input to the rule that stops wide blocks scrolling sideways:
 * CSS can measure the column a block sits in but has no idea how many
 * characters are in it, so the one fact it is missing is written here, where
 * the text is in hand. See `.article-prose pre` in globals.css.
 *
 * Runs *after* the sanitiser rather than before it. The default schema does not
 * allow `data-lang`, so a sanitiser running last would strip the attribute
 * again; and putting this last means the value is derived from a className the
 * sanitiser has already vetted, then matched against the pattern above. The
 * `--cols` value is a number this module counted, so nothing from the post body
 * reaches the style attribute either.
 */
export function labelCodeBlocks() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;

      const code = node.children.find(
        (child): child is Element => child.type === "element" && child.tagName === "code",
      );
      if (!code) return;

      const columns = widestLine(code);
      if (columns > 0) {
        // Appended rather than assigned: Shiki has already written the theme's
        // colour variables here, and replacing them turns every block in both
        // themes into unstyled text.
        const existing = node.properties?.style;
        node.properties = {
          ...node.properties,
          style: `${typeof existing === "string" && existing ? `${existing};` : ""}--cols:${columns}`,
        };
      }

      for (const entry of classesOf(code)) {
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
 * Put a copy button in every code block.
 *
 * ## Why the button is emitted here rather than by a React component
 *
 * Because a post body is a string of HTML by the time it reaches the page —
 * `dangerouslySetInnerHTML` on the Markdown path — so there is no component
 * tree to put a button into. The alternatives were a client component that
 * walks the DOM after mount and injects buttons (invisible to the server, and
 * a flash of buttonless blocks on every post), or hydrating a component per
 * fence, which is a React root per code block to run one `writeText`.
 *
 * So the markup is rendered on the server with the rest of the post, and one
 * listener in the browser serves every block on the page. See
 * components/blog/code-copy.tsx.
 *
 * ## Why the button lives inside the `<pre>`
 *
 * `.article-prose` styles direct children of the prose element — `> * + *` is
 * what puts a gap between blocks — so wrapping each `pre` in a figure would put
 * an element between every rule and the thing it styles. The same class of
 * mistake as the `article-prose` wrapper note in lib/mdx.tsx, which cost every
 * paragraph on the site its spacing.
 *
 * A `<button>` is phrasing content and is valid inside `<pre>`. It is absolutely
 * positioned, so it is out of the text flow and the `white-space: pre` the
 * block is set in never sees it.
 *
 * The one consequence that matters: `pre.textContent` now includes the word on
 * the button. That is why the copy handler reads `pre > code` instead — which
 * it would want to do anyway, since the code is what a reader asked for.
 *
 * ## Why it starts hidden
 *
 * `hidden` is removed on mount by the listener. Without JavaScript the button
 * cannot do anything, and a control that does nothing when pressed is worse
 * than no control.
 *
 * ## What does not get one
 *
 * A block with no `<code>` child. After `rehype-katex` a display formula is a
 * `<pre>` full of KaTeX spans with no code element left, and "copy" on an
 * equation would copy the rendered maths markup's text — the same check
 * `labelCodeBlocks` already makes, for the same reason.
 */
export function copyableCodeBlocks() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;

      const code = node.children.find(
        (child): child is Element => child.type === "element" && child.tagName === "code",
      );
      if (!code) return;

      node.properties = { ...node.properties, "data-code-block": "" };
      node.children = [
        {
          type: "element",
          tagName: "button",
          properties: {
            type: "button",
            "data-copy": "",
            hidden: true,
            className: ["code-copy"],
          },
          // Two spans rather than one label swapped by script: the resting word
          // and the confirmation are both in the markup, and CSS shows one at a
          // time off `data-copied`. That keeps the button's width from jumping
          // between "Copy" and "Copied" — and means the state is in the DOM
          // where a test, and a screen reader, can see it.
          children: [
            {
              type: "element",
              tagName: "span",
              properties: { className: ["code-copy-idle"] },
              children: [{ type: "text", value: "Copy" }],
            },
            {
              type: "element",
              tagName: "span",
              properties: { className: ["code-copy-done"] },
              children: [{ type: "text", value: "Copied" }],
            },
          ],
        },
        ...node.children,
      ];
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
export const sanitiseSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Every link out of a post body is untrusted by definition.
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
    // Every level `anchorHeadings` gives an id to has to be listed, or the
    // sanitiser strips it and the contents list scrolls to nothing — silently,
    // since neither the build nor the tests would notice an absent attribute.
    h1: [...(defaultSchema.attributes?.h1 ?? []), "id"],
    h2: [...(defaultSchema.attributes?.h2 ?? []), "id"],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "id"],
    h4: [...(defaultSchema.attributes?.h4 ?? []), "id"],
    /*
      The default schema allows one shape of class on a `code` — `language-*` —
      and drops everything else. `remark-math` marks a formula by putting
      `math-inline` or `math-display` there, and KaTeX finds formulas by looking
      for exactly those two, so a sanitiser that strips them leaves the LaTeX
      source sitting on the page as text. Three literal values, not a pattern:
      nothing else needs a class here.
    */
    code: [["className", /^language-./, "math-inline", "math-display"]],
  },
};

/**
 * KaTeX's settings, shared with the MDX pipeline the same way Shiki's are.
 *
 * `throwOnError` is off because a post body is not a build input: an unbalanced
 * brace in one formula would otherwise throw at render and take the whole
 * article down, which is the failure mode lib/api.ts's fallbacks exist to rule
 * out. What happens instead is the plugin's own error path — the source printed
 * in `errorColor`, with the parse error in a `title` — so the reader sees that
 * something is wrong and the author can see what.
 *
 * `errorColor` is the token rather than KaTeX's default red, which is a hex
 * that answers to nothing in this palette. The variable is defined globally, so
 * the inline style KaTeX writes resolves in both themes.
 *
 * `strict: false` because these posts are written in Vietnamese. KaTeX's strict
 * mode warns on any character outside its own metrics tables, and `\text{tỷ}` —
 * "billion" — is three of them in one word. The glyphs render; the warning is
 * only about KaTeX not knowing their exact widths, which a console full of
 * warnings per page is not going to fix.
 */
export const katexOptions = {
  throwOnError: false,
  errorColor: "hsl(var(--destructive-text))",
  strict: false as const,
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
 * Put every table in a box that scrolls, so the page does not.
 *
 * A table's minimum width is the sum of its columns' longest unbreakable words,
 * and on a phone a four-column table of API paths exceeds the viewport. Nothing
 * clipped it, so the *document* scrolled sideways instead — every heading and
 * paragraph on the page dragging along with a table halfway down it. Measured
 * at 375px: 561px of scroll width for a 360px viewport.
 *
 * The wrapper is a labelled region with `tabindex="0"` rather than a bare
 * `overflow-x` div, because a box that scrolls has to be reachable by keyboard
 * or its right-hand columns are only available to a mouse. The alternative
 * going around — `table { display: block }` — needs no wrapper and costs the
 * element its table semantics, which is a worse trade than one div.
 */
export function scrollableTables() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "table" || !parent || index === undefined) return;

      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: {
          "data-table-scroll": "",
          tabIndex: 0,
          role: "region",
          "aria-label": "Table",
        },
        children: [node],
      };

      // The table now lives one level down; descending into it from here would
      // find it again and wrap the wrapper.
      return SKIP;
    });
  };
}

/**
 * A paragraph that is nothing but formulas becomes display maths.
 *
 * `remark-math` decides between inline and display on syntax alone: `$$…$$`
 * spanning its own lines is a block, and `$$…$$` opened and closed on one line
 * is inline — even when that line is the entire paragraph. Which means the two
 * compound-interest lines in the ETF post,
 *
 * ```
 * $$1.000.000.000 \times (1+9{,}5\%)^{10} \approx 2{,}48\ \text{tỷ}$$
 * $$1.000.000.000 \times (1+8{,}0\%)^{10} \approx 2{,}16\ \text{tỷ}$$
 * ```
 *
 * would render as two inline formulas run together on one line with a space
 * between them, at body size. Nobody writing that means "inline"; `$$` is the
 * display delimiter everywhere it exists, and a formula alone in a paragraph is
 * a displayed equation by definition.
 *
 * So a paragraph holding only formulas — plus the whitespace and line breaks
 * between them — is replaced by those formulas as blocks. A paragraph with a
 * sentence in it is left exactly alone, which is what keeps `$$x$$` inline.
 *
 * ## Why this works on the HTML rather than on the Markdown
 *
 * The first version ran in remark and built `{type: "math"}` nodes, which
 * looked like the tidier place to do it and rendered the LaTeX source as plain
 * text on the page. An mdast maths node is not just a type and a value: it
 * carries `data.hName` and `data.hChildren` describing the element it becomes,
 * written by `mdast-util-math` while parsing, and a node assembled without them
 * falls through to the handler for unknown nodes — which emits the value as
 * text. Nothing failed; the article simply printed `\approx`.
 *
 * Here the shape is the contract instead: the classes below are what
 * `rehype-katex` looks for, and they are also what the sanitiser has just been
 * asked to preserve. Rewriting one class is a smaller thing to get wrong than
 * reconstructing a node another package owns.
 */
export function displayMathBlocks() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "p" || !parent || index === undefined) return;

      const formulas: Element[] = [];

      for (const child of node.children) {
        // The gaps: the newline between two formulas, and the hard break that
        // gap becomes if the author ended the line with two spaces.
        if (child.type === "text" && child.value.trim() === "") continue;
        if (child.type === "element" && child.tagName === "br") continue;

        if (child.type === "element" && classesOf(child).includes("math-inline")) {
          formulas.push(child);
          continue;
        }

        // Anything else — a word, a link, an image — means the formula is part
        // of a sentence and belongs in the line it was written on.
        return;
      }

      if (formulas.length === 0) return;

      parent.children.splice(index, 1, ...formulas.map(displayed));

      // Where to carry on from. The nodes just spliced in are `pre`, not `p`,
      // so there is nothing in them for this visitor to find.
      return index + formulas.length;
    });
  };
}

/** A formula, in the exact shape `mdast-util-math` gives a `$$` block. */
function displayed(code: Element): Element {
  return {
    type: "element",
    tagName: "pre",
    properties: {},
    children: [
      {
        ...code,
        properties: { ...code.properties, className: ["language-math", "math-display"] },
      },
    ],
  };
}

/**
 * An element's classes, however the producer wrote them.
 *
 * Shiki writes the attribute under the raw `class` key as a single string;
 * remark-rehype writes `className` as an array. Both callers here run after one
 * producer or the other, so both forms have to be accepted.
 */
function classesOf(node: Element): string[] {
  const raw = node.properties?.className ?? node.properties?.["class"];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return raw.split(" ");
  return [];
}

/** The heading levels a post's contents list is built from. */
const HEADING_TAGS: Record<string, HeadingLevel> = { h1: 1, h2: 2, h3: 3, h4: 4 };

/**
 * As much of a VFile as this module touches.
 *
 * Structural rather than `import type { VFile } from "vfile"`, which would mean
 * adding a dependency on a package that is only in the tree transitively — and
 * pnpm's node_modules is strict, so a transitive import that type-checks on one
 * machine fails to resolve on another. Two fields is the whole contract: every
 * unified transformer is handed the file, and `process()` hands the same one
 * back.
 */
type FileData = { data: Record<string, unknown> };

/**
 * Give every heading an id, and record the list on the way past.
 *
 * ## Why this is the only place ids are decided
 *
 * There used to be two. This wrote ids onto the rendered tree; `headingsOf` in
 * lib/headings.ts read the same headings out of the Markdown *source* to build
 * the contents list, and each carried a comment asking the other to agree with
 * it. They did not — see the note at the top of lib/headings.ts for the three
 * ordinary constructs that pulled them apart — and the failure was silent: the
 * list rendered, and its links scrolled nowhere.
 *
 * Collecting here, from the tree that is actually rendered, makes disagreement
 * impossible rather than merely unlikely. The contents list is now a *result*
 * of rendering the post, not a second opinion about it.
 *
 * ## Why the list travels on the VFile
 *
 * Because the processor below is a module-level singleton — it holds Shiki's
 * grammars, and rebuilding it per call would pay that initialisation on every
 * render. A plugin cannot return a value, but every transformer is handed the
 * file being processed, and `process()` hands that same file back. So the
 * headings ride out on `file.data`, which is what it is for.
 *
 * ## Why `h1` is included
 *
 * Because posts use it. `#` for a section is ordinary Markdown, and skipping it
 * — which the old source reader did, on the grounds that `#` is "the title" —
 * meant a post written that way had no contents list and no linkable anchors.
 * The page's own `h1` is the post title and is not in the body, so nothing here
 * collides with it.
 */
export function anchorHeadings() {
  return (tree: Root, file: FileData) => {
    const seen = new Map<string, number>();
    const headings: Heading[] = [];

    visit(tree, "element", (node: Element) => {
      const level = HEADING_TAGS[node.tagName];
      if (!level) return;

      const text = textOf(node).trim();

      const base = slugifyHeading(text);
      // Two headings with the same words are ordinary in a technical post —
      // every "Why" section, for instance. Without a suffix both anchors would
      // point at the first one.
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);

      const id = count === 0 ? base : `${base}-${count + 1}`;
      node.properties = { ...node.properties, id };

      // A heading with no text has an anchor but nothing to label it with, so
      // it is addressable and not listed.
      if (text) headings.push({ id, text, level });
    });

    file.data.headings = headings;
  };
}

/** The headings a processed file collected, in document order. */
function headingsFrom(file: FileData): Heading[] {
  const collected = file.data.headings;
  return Array.isArray(collected) ? (collected as Heading[]) : [];
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
  /*
   * LaTeX, with `$$` as the only delimiter.
   *
   * `singleDollarTextMath` is off, and that is the one judgement call here.
   * With it on, `$` opens maths — and this blog writes about money, so "phí từ
   * $5 đến $10" is a paragraph containing a perfectly well-formed inline
   * formula reading "5 đến ", set in italics, with the dollar signs eaten. That
   * is a silent corruption of prose that never mentioned maths. `$$` cannot be
   * typed by accident, so it is the delimiter for both forms — inline inside a
   * sentence, display when it is the whole paragraph.
   */
  .use(remarkMath, { singleDollarTextMath: false })
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
  /*
   * The same bargain, for the same reasons. KaTeX emits spans, MathML and
   * inline styles that the schema would strip if it ran last, all of it
   * generated from text the sanitiser has already vetted — and it has to
   * precede Shiki, because a maths block reaches this point as
   * `<pre><code class="language-math">` and Shiki would highlight it as an
   * unknown language and leave a code block where the equation should be.
   *
   * `displayMathBlocks` first: it decides which formulas KaTeX renders as
   * blocks, by rewriting a class KaTeX has not looked at yet.
   */
  .use(displayMathBlocks)
  .use(rehypeKatex, katexOptions)
  .use(rehypeShiki, shikiOptions)
  .use(labelCodeBlocks)
  // After labelCodeBlocks, which reads the fence's own children to measure the
  // block: the button is not code and must not be counted in its width.
  .use(copyableCodeBlocks)
  .use(scrollableTables)
  .use(anchorHeadings)
  .use(markExternalLinks)
  .use(rehypeStringify);

/*
 * Re-exported so a caller reaching for these finds them next to the renderer.
 * The definitions live in lib/headings.ts because the table of contents is a
 * client component and this module is `server-only` — importing it there would
 * ship remark, rehype and Shiki to the browser.
 */
export { hasContents, indentOf, MINIMUM_HEADINGS, slugifyHeading } from "./headings";
export type { Heading, HeadingLevel } from "./headings";

/** A rendered post: the markup, and the headings its anchors were built from. */
export type RenderedMarkdown = { html: string; headings: Heading[] };

/**
 * The post, rendered, with its contents list.
 *
 * One pass produces both, which is the point — see `anchorHeadings`. A caller
 * that wants only the markup can use `renderMarkdown` below.
 */
export async function renderArticle(markdown: string): Promise<RenderedMarkdown> {
  const file = await processor.process(markdown);
  return { html: String(file), headings: headingsFrom(file) };
}

export async function renderMarkdown(markdown: string): Promise<string> {
  return (await renderArticle(markdown)).html;
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
 *
 * ## When to use this, and when to use the count the API sends
 *
 * This one when the whole post is in hand. `minutesForWords(post.word_count)`
 * when it may not be: a gated post arrives cut, and measuring the part that
 * arrived would advertise the reading time of its own preview — wrong on the
 * post, and actively misleading on an index, where this number is what says
 * which posts are the substantial ones.
 */
export function readingMinutes(markdown: string): number {
  const words = plainText(markdown).split(/\s+/).filter(Boolean).length;
  return minutesForWords(words);
}

/** The same estimate, from a word count somebody else did. */
export function minutesForWords(words: number): number {
  return Math.max(1, Math.ceil(words / READING_SPEED));
}
