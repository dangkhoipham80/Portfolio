import { describe, expect, it } from "vitest";

import { renderArticle, slugifyHeading } from "./markdown";
import { validateMdx } from "./mdx-guard";

/**
 * MDX bodies are compiled and run on the server, from a database column.
 *
 * In its full form MDX is JavaScript: `import` pulls in modules, `export`
 * defines values, and `{…}` evaluates an arbitrary expression. Running that
 * server-side with the database as the input is remote code execution, not
 * stored XSS — a materially worse thing than the hole lib/markdown.ts's
 * sanitiser exists to prevent.
 *
 * So the first block below is the reason the feature is allowed to exist in
 * this shape, the same way the sanitisation block in markdown.test.ts is.
 *
 * It tests `validateMdx` rather than the renderer, and that is precisely why
 * the guard is a separate module: the renderer imports `next/image` and cannot
 * be loaded into a Node test at all. Splitting them means the
 * security-critical half is not the half with no unit test.
 */

describe("rejecting executable MDX", () => {
  it("refuses an import", async () => {
    expect(await validateMdx('import fs from "node:fs"\n\nHello.')).toContain("JavaScript");
  });

  it("refuses an export", async () => {
    expect(await validateMdx("export const x = 1\n\nHello.")).toContain("JavaScript");
  });

  it("refuses a flow expression", async () => {
    expect(await validateMdx("{process.env.SECRET_KEY}")).toContain("JavaScript");
  });

  it("refuses an expression inline in a paragraph", async () => {
    expect(await validateMdx("The answer is {6 * 7} today.")).toContain("JavaScript");
  });

  it("refuses an expression hidden in an attribute", async () => {
    // The same hole as a bare `{…}`, reached through a different node type —
    // which is why the check walks attributes as well as the tree.
    expect(await validateMdx("<Callout kind={globalThis.x}>Hi</Callout>")).toContain(
      "expression",
    );
  });

  it("refuses a spread attribute", async () => {
    expect(await validateMdx("<Callout {...props}>Hi</Callout>")).toBeTruthy();
  });

  it("refuses a component the site does not define", async () => {
    expect(await validateMdx("<Script>alert(1)</Script>")).toContain(
      "not one of this site's components",
    );
  });

  it("names the components that are available when it refuses one", async () => {
    // The author is the only person who can fix this, so the message has to
    // say what they could have written instead.
    expect(await validateMdx("<Warning>Careful</Warning>")).toContain("Callout");
  });
});

/**
 * The MDX pipeline does not run `rehype-sanitize` — it deletes every component,
 * silently, because an MDX node is not an `element`. See lib/mdx.tsx.
 *
 * Almost everything that sanitiser was doing is covered by the JSX rules above:
 * MDX has no raw HTML, so `<script>` and `<img onerror>` can only arrive as JSX
 * and are refused by name. The exception is a URL in ordinary Markdown, which is
 * not JSX and which nothing else looks at — so these are the cases that would be
 * a working XSS in a body that had passed every other check.
 */
describe("rejecting dangerous URLs", () => {
  it("refuses a javascript: link", async () => {
    expect(await validateMdx("[click me](javascript:alert(1))")).toContain("scheme");
  });

  it("refuses a javascript: image", async () => {
    expect(await validateMdx("![x](javascript:alert(1))")).toContain("scheme");
  });

  it("refuses a data: URL, which can carry a scripted SVG", async () => {
    expect(await validateMdx("[x](data:text/html;base64,PHNjcmlwdD4=)")).toContain("scheme");
  });

  it("refuses it in a reference definition, not just an inline link", async () => {
    expect(await validateMdx("[x][ref]\n\n[ref]: javascript:alert(1)\n")).toContain("scheme");
  });

  it("is not fooled by case or leading space", async () => {
    expect(await validateMdx("[x](  JaVaScRiPt:alert(1))")).toContain("scheme");
  });

  it("allows http, https and mailto", async () => {
    expect(await validateMdx("[a](https://example.com)")).toBeNull();
    expect(await validateMdx("[a](http://example.com)")).toBeNull();
    expect(await validateMdx("[a](mailto:someone@example.com)")).toBeNull();
  });

  it("allows a relative link, a root-relative one and a fragment", async () => {
    // No scheme to check. `new URL` throws on all three, so they are settled
    // before any parsing is attempted.
    expect(await validateMdx("[a](/blog/x)")).toBeNull();
    expect(await validateMdx("[a](./sibling)")).toBeNull();
    expect(await validateMdx("[a](#a-section)")).toBeNull();
    expect(await validateMdx("[a](relative/path)")).toBeNull();
  });
});

describe("MDX that is allowed", () => {
  it("accepts a body using one of the site's components", async () => {
    const problem = await validateMdx(
      '# Title\n\n<Callout kind="warning" title="Watch out">\nBe careful.\n</Callout>\n',
    );

    expect(problem).toBeNull();
  });

  it("accepts plain Markdown", async () => {
    expect(await validateMdx("## Heading\n\nSome *emphasis*.\n")).toBeNull();
  });

  it("accepts a fragment", async () => {
    expect(await validateMdx("<>\nJust grouping.\n</>\n")).toBeNull();
  });

  it("reports a malformed body rather than throwing", async () => {
    // An unclosed tag is a compile error, and it arrives at render time on a
    // page the author is probably not looking at. The renderer turns this into
    // a fallback; taking the post down for it would be the wrong trade.
    expect(await validateMdx("<Callout>never closed")).toBeTruthy();
  });

  it("does not mistake a code fence for an expression", async () => {
    // `{` is ordinary inside a fence, and a check over the source text rather
    // than the parsed tree would trip over this.
    expect(await validateMdx('```json\n{ "a": 1 }\n```\n')).toBeNull();
  });
});

describe("heading anchors", () => {
  /*
   * These used to test `headingsOf`, which read headings out of the Markdown
   * *source* while `anchorHeadings` wrote ids onto the rendered tree — two
   * derivations of the same thing, each with a comment asking the other to
   * agree with it. They did not, and nothing failed when they diverged: the
   * contents list simply linked to anchors that were not on the page.
   *
   * There is one derivation now, and it happens during rendering, so these test
   * it where it lives. The cases below are the ones the two used to disagree
   * about.
   */

  it("collects every level a post uses, h1 included", async () => {
    // `#` is ordinary Markdown for a section. The old source reader skipped it
    // as "the post title", so a post written that way had no contents at all.
    const { headings } = await renderArticle(
      "# Introduction\n\n## Installation\n\n## Configuration\n\n### Environment Variables\n",
    );

    expect(headings.map((heading) => heading.text)).toEqual([
      "Introduction",
      "Installation",
      "Configuration",
      "Environment Variables",
    ]);
    expect(headings.map((heading) => heading.level)).toEqual([1, 2, 2, 3]);
  });

  it("gives every entry an id that is actually on the page", async () => {
    // The property the whole arrangement exists for. Nothing in a build or a
    // browser complains when this is false — the links just go nowhere.
    const source =
      "# Why\n\ntext\n\n## Cấu trúc\n\ntext\n\n> ## Quoted\n\n## Why\n\n#### Deep\n";
    const { html, headings } = await renderArticle(source);

    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) {
      expect(html).toContain(`id="${heading.id}"`);
    }
  });

  it("gives repeated headings distinct ids", async () => {
    // Every "Why" section in a technical post, otherwise both anchors point at
    // the first one.
    const { headings } = await renderArticle("## Why\n\n## Why\n\n## Why\n");

    expect(headings.map((heading) => heading.id)).toEqual(["why", "why-2", "why-3"]);
  });

  it("counts a heading inside a blockquote, like the page does", async () => {
    // The source reader's pattern was anchored to the start of a line, so it
    // missed this one — and every later duplicate then got the wrong suffix.
    const { headings } = await renderArticle("## Why\n\n> ## Why\n\n## Why\n");

    expect(headings.map((heading) => heading.id)).toEqual(["why", "why-2", "why-3"]);
  });

  it("ignores a comment inside a code fence", async () => {
    // A shell session is not a table of contents.
    const { headings } = await renderArticle(
      "```bash\n## not a heading\n```\n\n## Real One\n",
    );

    expect(headings.map((heading) => heading.text)).toEqual(["Real One"]);
  });

  it("strips inline markdown from the label", async () => {
    const { headings } = await renderArticle("## The `format` column\n");

    expect(headings[0].text).toBe("The format column");
    expect(headings[0].id).toBe("the-format-column");
  });

  it("folds accents rather than dropping the heading", async () => {
    expect(slugifyHeading("Cấu trúc")).toBe("cau-truc");
  });

  it("never produces an empty id", async () => {
    // An id of "" is an anchor that matches the document itself.
    expect(slugifyHeading("!!!")).toBe("section");
  });
});
