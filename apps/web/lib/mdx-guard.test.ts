import { describe, expect, it } from "vitest";

import { headingsOf, slugifyHeading } from "./markdown";
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

describe("headings", () => {
  it("collects h2 and h3 only", async () => {
    const headings = headingsOf("# Title\n\n## Two\n\n### Three\n\n#### Four\n");

    expect(headings.map((h) => h.text)).toEqual(["Two", "Three"]);
    expect(headings.map((h) => h.level)).toEqual([2, 3]);
  });

  it("ignores a comment inside a code fence", async () => {
    // A shell session is not a table of contents.
    const headings = headingsOf("```bash\n## not a heading\n```\n\n## Real One\n");

    expect(headings.map((h) => h.text)).toEqual(["Real One"]);
  });

  it("strips inline markdown from the label", async () => {
    const headings = headingsOf("## The `format` column\n");

    expect(headings[0].text).toBe("The format column");
  });

  it("gives repeated headings distinct ids", async () => {
    // Every "Why" section in a technical post, otherwise both anchors point at
    // the first one.
    const headings = headingsOf("## Why\n\n## Why\n");

    expect(headings.map((h) => h.id)).toEqual(["why", "why-2"]);
  });

  it("folds accents rather than dropping the heading", async () => {
    expect(slugifyHeading("Cấu trúc")).toBe("cau-truc");
  });

  it("never produces an empty id", async () => {
    // An id of "" is an anchor that matches the document itself.
    expect(slugifyHeading("!!!")).toBe("section");
  });
});
