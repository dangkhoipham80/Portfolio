import { describe, expect, it } from "vitest";

import { renderMarkdown } from "../markdown";
import { parseSequenceDiagram } from "./parse";
import { renderSequenceDiagram } from "./render";

/**
 * The parser's job is to be sure or to say no.
 *
 * A wrong diagram is worse than no diagram: source in a code block is obviously
 * source, whereas a drawing is believed. So most of these tests are about what
 * `parseSequenceDiagram` refuses, and the pipeline tests below check that a
 * refusal really does leave the fence alone rather than losing the content.
 */

const BASIC = `sequenceDiagram
    participant B as Browser
    participant API
    B->>API: GET /posts
    API-->>B: 200 posts[]
`;

describe("parsing", () => {
  it("reads participants, aliases and messages", () => {
    const diagram = parseSequenceDiagram(BASIC);

    expect(diagram).not.toBeNull();
    expect(diagram!.participants.map((p) => p.id)).toEqual(["B", "API"]);
    expect(diagram!.participants[0].lines).toEqual(["Browser"]);
    expect(diagram!.steps).toHaveLength(2);
  });

  it("gives a dotted arrow away as a reply", () => {
    const diagram = parseSequenceDiagram(BASIC)!;
    const [call, reply] = diagram.steps as Extract<
      (typeof diagram.steps)[number],
      { kind: "message" }
    >[];

    // The whole colour scheme hangs off this: solid is a call and goes out
    // cool, dotted is a return and comes back warm.
    expect(call.stroke).toBe("solid");
    expect(reply.stroke).toBe("dotted");
  });

  it("takes participants declared only by being messaged", () => {
    const diagram = parseSequenceDiagram("sequenceDiagram\n  A->>B: hi\n  B->>C: on\n")!;

    expect(diagram.participants.map((p) => p.id)).toEqual(["A", "B", "C"]);
  });

  it("prefers the longest arrow token", () => {
    // `-->>` also starts with `-->` and `->`. Matched short, the target would
    // be a participant called ">Bob".
    const diagram = parseSequenceDiagram("sequenceDiagram\n  Alice-->>Bob: ok\n")!;

    expect(diagram.participants.map((p) => p.id)).toEqual(["Alice", "Bob"]);
    expect(diagram.steps[0]).toMatchObject({ stroke: "dotted", head: "arrow" });
  });

  it("reads every arrow Mermaid defines", () => {
    const source = [
      "sequenceDiagram",
      "  A->B: plain",
      "  A-->B: plain dotted",
      "  A->>B: arrow",
      "  A-->>B: arrow dotted",
      "  A-)B: async",
      "  A--)B: async dotted",
      "  A-xB: lost",
      "  A--xB: lost dotted",
      "  A<<->>B: both",
    ].join("\n");

    const diagram = parseSequenceDiagram(source)!;

    expect(diagram.participants.map((p) => p.id)).toEqual(["A", "B"]);
    expect(diagram.steps.map((step) => (step.kind === "message" ? step.head : null))).toEqual([
      "none",
      "none",
      "arrow",
      "arrow",
      "open",
      "open",
      "cross",
      "cross",
      "both",
    ]);
  });

  it("reads the activation shorthands", () => {
    const diagram = parseSequenceDiagram(
      "sequenceDiagram\n  A->>+B: go\n  B-->>-A: done\n",
    )!;

    expect(diagram.steps[0]).toMatchObject({ activates: true, deactivates: false });
    expect(diagram.steps[1]).toMatchObject({ activates: false, deactivates: true });
  });

  it("reads notes, including one spanning two participants", () => {
    const diagram = parseSequenceDiagram(
      "sequenceDiagram\n  A->>B: go\n  Note over A,B: shared<br/>state\n  Note left of A: aside\n",
    )!;

    expect(diagram.steps[1]).toMatchObject({
      kind: "note",
      placement: "over",
      from: 0,
      to: 1,
      lines: ["shared", "state"],
    });
    expect(diagram.steps[2]).toMatchObject({ placement: "left", from: 0 });
  });

  it("reads blocks and their dividers", () => {
    const diagram = parseSequenceDiagram(
      "sequenceDiagram\n  alt cached\n    A->>B: hit\n  else cold\n    A->>B: miss\n  end\n",
    )!;

    expect(diagram.steps.map((step) => step.kind)).toEqual([
      "block-open",
      "message",
      "block-divider",
      "message",
      "block-close",
    ]);
  });

  it("keeps autonumber and title", () => {
    const diagram = parseSequenceDiagram(
      "sequenceDiagram\n  autonumber\n  title: A read path\n  A->>B: go\n",
    )!;

    expect(diagram.autonumber).toBe(true);
    expect(diagram.title).toBe("A read path");
  });

  it("ignores comments", () => {
    const diagram = parseSequenceDiagram("sequenceDiagram\n  %% not a step\n  A->>B: go\n")!;

    expect(diagram.steps).toHaveLength(1);
  });
});

describe("refusing what it is not sure about", () => {
  const refused: [string, string][] = [
    ["a flowchart", "graph TD\n  A-->B\n"],
    ["an unclosed block", "sequenceDiagram\n  loop forever\n    A->>B: go\n"],
    ["a stray end", "sequenceDiagram\n  A->>B: go\n  end\n"],
    ["an else with no block", "sequenceDiagram\n  else nope\n  A->>B: go\n"],
    ["a construct outside the subset", "sequenceDiagram\n  box Grey Team\n  end\n  A->>B: go\n"],
    ["a line that is not a statement", "sequenceDiagram\n  A->>B: go\n  what is this\n"],
    ["a diagram with no messages", "sequenceDiagram\n  participant A\n"],
    ["prose that happens to be fenced", "just some text\n"],
  ];

  for (const [what, source] of refused) {
    it(`refuses ${what}`, () => {
      expect(parseSequenceDiagram(source)).toBeNull();
    });
  }
});

describe("drawing", () => {
  it("gives every column room for its widest label", () => {
    const narrow = renderSequenceDiagram(parseSequenceDiagram(BASIC)!, "t");
    const wide = renderSequenceDiagram(
      parseSequenceDiagram(BASIC.replace("GET /posts", "GET /posts?limit=50&order=published"))!,
      "t",
    );

    const box = (rendered: typeof narrow) =>
      Number(String(rendered.svg.properties?.viewBox).split(" ")[2]);

    expect(box(wide)).toBeGreaterThan(box(narrow));
  });

  it("draws a diagram with one participant and nothing to span", () => {
    // The degenerate case: no gaps array, no spans, and every width derived
    // from a single column. It is the shape most likely to produce a NaN in the
    // viewBox, which renders as nothing at all rather than as an error.
    const drawing = renderSequenceDiagram(
      parseSequenceDiagram("sequenceDiagram\n  participant W as Worker\n  W->>W: retry\n")!,
      "t",
    );

    expect(String(drawing.svg.properties?.viewBox)).toMatch(/^0 0 \d+ \d+$/);
    expect(drawing.width).toBeGreaterThan(0);
  });

  it("draws nested blocks without a NaN anywhere", () => {
    const drawing = renderSequenceDiagram(
      parseSequenceDiagram(
        [
          "sequenceDiagram",
          "  loop every tick",
          "    alt healthy",
          "      A->>B: ping",
          "    else down",
          "      A->>B: alert",
          "    end",
          "  end",
        ].join("\n"),
      )!,
      "t",
    );

    expect(JSON.stringify(drawing.svg)).not.toContain("NaN");
  });

  it("says the steps in words for a reader who cannot see them", () => {
    const { steps } = renderSequenceDiagram(parseSequenceDiagram(BASIC)!, "t");

    expect(steps).toEqual([
      "Browser calls API: GET /posts",
      "API replies to Browser: 200 posts[]",
    ]);
  });
});

describe("in the Markdown pipeline", () => {
  const fence = (source: string) => "```mermaid\n" + source + "```\n";

  it("draws a sequence diagram instead of printing it", async () => {
    const html = await renderMarkdown(fence(BASIC));

    expect(html).toContain("<svg");
    expect(html).toContain("sequence-diagram");
    expect(html).not.toContain("<pre");
  });

  it("leaves a fence it cannot draw exactly as it was", async () => {
    const html = await renderMarkdown(fence("graph TD\n  A-->B\n"));

    expect(html).not.toContain("<svg");
    expect(html).toContain("<pre");
    expect(html).toContain("graph TD");
  });

  it("gives two diagrams on one page their own marker ids", async () => {
    const html = await renderMarkdown(fence(BASIC) + "\n" + fence(BASIC));

    // A shared id means the second diagram's arrowheads resolve to the first
    // one's marker, which is invisible until the two diagrams differ.
    expect(html).toContain('id="sd1-arrow-call"');
    expect(html).toContain('id="sd2-arrow-call"');
  });

  it("escapes a label that looks like markup", async () => {
    const html = await renderMarkdown(
      fence('sequenceDiagram\n  A->>B: <img src=x onerror="alert(1)">\n'),
    );

    // The angle bracket is what matters, exactly as in the sanitiser's own
    // tests: the label survives as visible text, which is inert, and there is
    // no element for the handler to be an attribute of.
    expect(html).not.toContain("<img");
    expect(html).toContain("&#x3C;img");
  });

  it("still labels an ordinary code fence", async () => {
    const html = await renderMarkdown("```python\nprint(1)\n```\n");

    expect(html).toContain('data-lang="python"');
  });
});

/**
 * The other half of the promise: the same nodes have to survive a completely
 * different back end.
 *
 * The Markdown path serialises this hast to a string; the MDX path compiles it
 * to JSX and React renders it. They disagree about almost every SVG attribute —
 * one wants `stroke-width`, the other `strokeWidth` — and the property names
 * used in ./render.ts are the ones both agree on. Nothing in a type-check says
 * so, and a mismatch does not throw: the attribute is dropped and the diagram
 * renders with no strokes, which is the same class of failure as the
 * `rounded-[--radius-x]` one this repo has already had once.
 *
 * `compile`/`run` directly rather than through lib/mdx.tsx, which imports
 * next/image and cannot be loaded in a plain Node test — the reason
 * lib/mdx-guard.ts is a separate module in the first place.
 */
describe("through the MDX compiler", () => {
  it("draws the same diagram", async () => {
    const { compile, run } = await import("@mdx-js/mdx");
    const runtime = await import("react/jsx-runtime");
    const { renderSequenceDiagrams } = await import("./plugin");

    const compiled = await compile("```mermaid\n" + BASIC + "```\n", {
      outputFormat: "function-body",
      development: false,
      rehypePlugins: [renderSequenceDiagrams],
    });

    const { default: Content } = await run(compiled, {
      ...runtime,
      baseUrl: import.meta.url,
    });

    /*
     * The element tree rather than rendered HTML: `react-dom/server` resolves
     * to its React Server Components build under this runner and refuses to
     * load. What matters here is the props the compiler produced, and those are
     * on the elements.
     */
    const tags = new Set<string>();
    const props = new Set<string>();

    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;

      const element = node as { type?: unknown; props?: Record<string, unknown> };
      if (typeof element.type === "string") tags.add(element.type);
      for (const [key, value] of Object.entries(element.props ?? {})) {
        props.add(key);
        if (key === "style" && value && typeof value === "object") {
          for (const name of Object.keys(value)) props.add(name);
        }
        if (key === "children") walk(value);
      }
    };

    walk(Content({}));

    expect(tags).toContain("svg");
    expect(tags).not.toContain("pre");
    expect(props).toContain("strokeWidth");
    expect(props).toContain("textAnchor");
    expect(props).toContain("viewBox");
    expect(props).toContain("--diagram-width");
  });
});
