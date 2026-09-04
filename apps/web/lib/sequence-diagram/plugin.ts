import type { Element, ElementContent, Root } from "hast";
import { visit } from "unist-util-visit";

import { parseSequenceDiagram } from "./parse";
import { renderSequenceDiagram, type RenderedDiagram } from "./render";

/**
 * Turns a ```mermaid fence holding a `sequenceDiagram` into a drawn diagram.
 *
 * ## Where this runs, and why there
 *
 * After the sanitiser and before the highlighter, in both pipelines.
 *
 * *After the sanitiser*, because by then the fence's contents are a plain text
 * node that has already been vetted, and everything this emits is built from
 * parsed values rather than from the source string — so nothing a post body
 * says can reach the document as markup through here. The sanitiser would also
 * delete the `<svg>` outright if it ran later: its schema has no SVG in it.
 *
 * *Before the highlighter*, because Shiki rewrites a fence into a tree of
 * coloured `<span>`s and recovering the original text from that is guesswork.
 *
 * ## What happens to a fence this cannot draw
 *
 * Nothing. It stays a code block and Shiki labels it `MERMAID`, which is what
 * the site did before this existed. That is the deliberate answer rather than
 * an error state: the parser refuses anything outside the subset it is sure
 * about (see ./parse.ts), and a reader looking at diagram source has lost less
 * than a reader looking at a diagram drawn from a line that was guessed at.
 */

/** Fence languages that may hold a sequence diagram. */
const DIAGRAM_LANGUAGES = new Set(["mermaid", "sequence", "sequencediagram"]);

export function renderSequenceDiagrams() {
  return (tree: Root) => {
    // Ids have to be unique across the page, not just the diagram: two posts'
    // worth of markers never share a document, but two diagrams in one post do,
    // and a duplicated marker id means the second diagram's arrowheads take the
    // first one's colour.
    let seen = 0;

    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "pre" || !parent || index === undefined) return;

      const code = node.children.find(
        (child): child is Element => child.type === "element" && child.tagName === "code",
      );
      if (!code || !isDiagramFence(code)) return;

      const source = textOf(code);
      const diagram = parseSequenceDiagram(source);
      if (!diagram) return;

      seen += 1;
      const drawing = renderSequenceDiagram(diagram, `sd${seen}`);

      parent.children[index] = figure(drawing, diagram.title);
      // Nothing inside the figure needs visiting, and the `<pre>` it replaced
      // is gone — carry on from the next sibling.
      return index + 1;
    });
  };
}

function isDiagramFence(code: Element): boolean {
  const raw = code.properties?.className ?? code.properties?.["class"];
  const classes = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(" ") : [];

  return classes.some((entry) => {
    const match = /^language-(.+)$/.exec(String(entry));
    return match ? DIAGRAM_LANGUAGES.has(match[1].toLowerCase()) : false;
  });
}

function textOf(node: Element): string {
  let value = "";
  visit(node, "text", (child: { value: string }) => {
    value += child.value;
  });
  return value;
}

/**
 * The frame around the drawing.
 *
 * Four parts, and each one is load-bearing:
 *
 * * The frame, which carries the panel and — through `--diagram-width` — the
 *   one number CSS cannot work out for itself. globals.css uses it to show the
 *   right-edge fade only when the drawing is actually wider than the column,
 *   which is the whole reason the width is threaded out here rather than left
 *   inside the `<svg>`.
 * * The scroller. A diagram is drawn at the size it needs and does not shrink
 *   to fit — a five-participant diagram scaled into 375px is 6px type, which is
 *   a picture of a diagram rather than a diagram. So it scrolls sideways, with
 *   `tabindex` on it because a region that scrolls has to be reachable from the
 *   keyboard.
 * * The caption, when the source gave a `title`. Below the figure, like every
 *   other caption on this site.
 * * The steps in words, for a reader who is not going to see any of it. The
 *   `<svg>` carries `role="img"`, which hides its own text from assistive
 *   technology — an SVG read out as a bag of loose labels is worse than
 *   silence. This list is the diagram's actual content, in order.
 */
function figure(drawing: RenderedDiagram, title: string | undefined): Element {
  const children: ElementContent[] = [
    {
      type: "element",
      tagName: "div",
      properties: {
        className: ["sequence-diagram-frame"],
        style: `--diagram-width: ${drawing.width}px`,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            className: ["sequence-diagram-scroller"],
            tabIndex: 0,
            role: "group",
            "aria-label": title ?? "Sequence diagram",
          },
          children: [drawing.svg],
        },
      ],
    },
  ];

  if (title) {
    children.push({
      type: "element",
      tagName: "figcaption",
      properties: {},
      children: [{ type: "text", value: title }],
    });
  }

  children.push({
    type: "element",
    tagName: "ol",
    properties: { className: ["sequence-diagram-transcript"] },
    children: drawing.steps.map((step) => ({
      type: "element" as const,
      tagName: "li",
      properties: {},
      children: [{ type: "text" as const, value: step }],
    })),
  });

  return {
    type: "element",
    tagName: "figure",
    properties: { className: ["sequence-diagram"] },
    children,
  };
}
