import { describe, expect, it } from "vitest";

import { plainText, readingMinutes, renderMarkdown, summarise } from "./markdown";

/**
 * The output of `renderMarkdown` goes straight into `dangerouslySetInnerHTML`.
 *
 * Everywhere else on this site, React escapes what it renders. Here it is
 * explicitly told not to, which makes this module the one place a post body can
 * reach the DOM as markup — and post bodies are the only HTML on the site the
 * app does not write itself. The sanitiser is what makes that safe, so the
 * first block below is not a nice-to-have: it is the reason the rest of the
 * feature is allowed to exist in this shape.
 */

describe("sanitisation", () => {
  it("drops a script tag", async () => {
    const html = await renderMarkdown("Hello <script>alert(1)</script> world");

    // The tag is what matters. What was between the tags survives as prose —
    // the reader sees the literal text "alert(1)", which is inert. Asserting
    // the body were gone too would be asserting the wrong thing: a post *about*
    // XSS should be able to quote one.
    expect(html).not.toContain("<script");
  });

  it("drops an inline event handler", async () => {
    const html = await renderMarkdown('<img src="x" onerror="alert(1)">');

    expect(html).not.toContain("onerror");
  });

  it("drops a javascript: URL", async () => {
    const html = await renderMarkdown("[click me](javascript:alert(1))");

    expect(html).not.toContain("javascript:");
  });

  it("drops an iframe", async () => {
    const html = await renderMarkdown('<iframe src="https://example.com"></iframe>');

    expect(html).not.toContain("<iframe");
  });

  it("escapes markup that arrives as text rather than rendering it", async () => {
    const html = await renderMarkdown("A tag looks like <b>this</b> in prose");

    // remark-rehype drops the raw HTML node entirely rather than passing it
    // through; either way the one thing that must not happen is a live <b>.
    expect(html).not.toContain("<b>");
  });
});

describe("rendering", () => {
  it("renders headings, emphasis and links", async () => {
    const html = await renderMarkdown("## Heading\n\nSome *emphasis* and [a link](/blog).");

    expect(html).toContain("<h2>Heading</h2>");
    expect(html).toContain("<em>emphasis</em>");
    expect(html).toContain('<a href="/blog">a link</a>');
  });

  it("renders GitHub tables, which plain CommonMark does not", async () => {
    const html = await renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |");

    expect(html).toContain("<table>");
  });

  it("labels a fenced block with its language", async () => {
    const html = await renderMarkdown("```css\na { color: red }\n```");

    // The stylesheet renders this as the corner label; without it every block
    // is unlabelled, which is the state this attribute exists to fix.
    expect(html).toContain('data-lang="css"');
  });

  it("leaves an unlabelled fence unlabelled rather than guessing", async () => {
    const html = await renderMarkdown("```\nplain\n```");

    expect(html).not.toContain("data-lang");
  });

  it("does not invent a language from an attacker-shaped class", async () => {
    // The attribute is written by this module, so the pattern it matches is
    // the boundary. Anything that is not a plain language name is ignored.
    const html = await renderMarkdown('```" onmouseover="alert(1)\ncode\n```');

    expect(html).not.toContain("onmouseover");
  });
});

describe("plainText", () => {
  it("takes code fences out whole", () => {
    // A description opening with three backticks and a language name
    // describes nothing.
    expect(plainText("Intro.\n\n```js\nconst x = 1\n```\n\nOutro.")).toBe("Intro. Outro.");
  });

  it("keeps a link's text and drops its target", () => {
    expect(plainText("See [the docs](https://example.com/very/long).")).toBe("See the docs.");
  });

  it("strips heading markers and emphasis", () => {
    expect(plainText("# Title\n\nSome **bold** text.")).toBe("Title Some bold text.");
  });
});

describe("summarise", () => {
  it("leaves a short body alone", () => {
    expect(summarise("Short enough.")).toBe("Short enough.");
  });

  it("cuts on a word boundary and marks the cut", () => {
    const summary = summarise("alpha bravo charlie delta echo foxtrot", 20);

    expect(summary.endsWith("…")).toBe(true);
    // Not mid-word: "charl…" reads as a truncation bug rather than a choice.
    expect(summary).toBe("alpha bravo charlie…");
  });
});

describe("readingMinutes", () => {
  it("never reports less than a minute", () => {
    expect(readingMinutes("One sentence.")).toBe(1);
  });

  it("rounds up rather than to nearest", () => {
    // 274 words is 1.37 minutes. To nearest that is "1 min", which reads as a
    // stub; and under-promising is the wrong direction for this figure.
    expect(readingMinutes("word ".repeat(274))).toBe(2);
  });

  it("counts prose rather than code", () => {
    const prose = `${"word ".repeat(400)}`;
    const withCode = `${prose}\n\n\`\`\`js\n${"token ".repeat(2000)}\n\`\`\``;

    // The code fence would triple the figure if it counted, and nobody reads a
    // code block at prose speed.
    expect(readingMinutes(withCode)).toBe(readingMinutes(prose));
  });
});
