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
