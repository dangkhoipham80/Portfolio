import type { Element, ElementContent } from "hast";

import type { Head, SequenceDiagram, Step, Stroke } from "./parse";

/**
 * Draws a parsed sequence diagram as SVG, on the server, in the site's tokens.
 *
 * ## The design decision
 *
 * The palette this site is built on says a request going out is cool and a
 * response coming back is warm — the hero's packets, the covers' packets and
 * the spine all obey it. A sequence diagram is a picture of exactly that, so it
 * gets the same two lights: a call is ultramarine, a reply is coral, and the
 * hue carries direction before you have read a single label. Mermaid cannot say
 * that, because it does not know what the arrows mean; this does, because the
 * parser distinguishes a solid arrow from a dotted one, which is the convention
 * every sequence diagram already uses for call versus return.
 *
 * Each wire also brightens toward its arrowhead. That is the one indulgence
 * here and it is the site's own — light travelling along a wire — and it is
 * never the sole carrier of anything: the hue says the same thing, and so does
 * the direction the head points.
 *
 * Everything else is deliberately quiet. Lifelines are hairlines, text is ink
 * and never coloured (the site's rule: hue is for fills and wires, not for
 * words), the participants sit in the same chip the rest of the site uses, and
 * a `loop`/`alt` region is tagged in its corner exactly the way a code fence is
 * tagged with its language.
 *
 * ## Why the geometry is computed rather than measured
 *
 * There is no DOM on the server, so text width is derived from the character
 * count and the mono advance. That only works because every string in the
 * diagram is set in `--font-mono` — IBM Plex Mono advances 0.6em per glyph, and
 * so does every fallback in that stack. It is also why the diagram is mono
 * throughout rather than mixing faces: a proportional face would need measuring
 * and would be wrong by a word's width on the first long label.
 */

/* Type. All of it mono, for the reason above. */
const NAME_SIZE = 12.5;
const MESSAGE_SIZE = 12;
const NOTE_SIZE = 11.5;
const TAG_SIZE = 9.5;
/** Mono advance as a fraction of the font size. */
const ADVANCE = 0.6;

/* Participant chips. */
const CHIP_PAD_X = 13;
const CHIP_PAD_Y = 9;
const CHIP_LINE = 15;
const CHIP_MIN_WIDTH = 86;
const COLUMN_CLEARANCE = 46;

/* Rows. */
const LABEL_LINE = 14;
const LABEL_LIFT = 7;
const ROW_AFTER = 20;
const SELF_REACH = 34;
const SELF_DROP = 20;
const FIRST_ROW = 30;

/* Notes and regions. */
const NOTE_PAD_X = 11;
const NOTE_PAD_Y = 8;
const NOTE_LINE = 15;
const NOTE_AFTER = 18;
const REGION_HEAD = 30;
const REGION_INSET = 12;
const REGION_AFTER = 16;
const DIVIDER_ROW = 26;

/* The activation bar sitting on a lifeline while a participant is busy. */
const BAR_WIDTH = 8;
const BAR_NEST = 4;

const MARGIN = 14;
const BOTTOM = 26;

function width(text: string, size: number): number {
  return text.length * size * ADVANCE;
}

function widest(lines: string[], size: number): number {
  return lines.reduce((most, line) => Math.max(most, width(line, size)), 0);
}

/** hast element, with the SVG namespace inferred from the `<svg>` ancestor. */
function el(
  tagName: string,
  properties: Record<string, string | number | boolean | undefined>,
  children: ElementContent[] = [],
): Element {
  const kept: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value !== undefined) kept[key] = value;
  }
  return { type: "element", tagName, properties: kept, children };
}

function textNode(value: string): ElementContent {
  return { type: "text", value };
}

/**
 * A `<text>` of one or more lines, anchored on its first baseline.
 *
 * Every string in a diagram arrives here and nowhere else, which is what makes
 * the whole renderer safe to hand to `dangerouslySetInnerHTML`: these are text
 * nodes, and the serialiser escapes them.
 */
function label(
  lines: string[],
  x: number,
  y: number,
  size: number,
  anchor: "start" | "middle" | "end",
  fill: string,
  extra: Record<string, string | number> = {},
  lead: { text: string; fill: string } | undefined = undefined,
): Element {
  const spans: ElementContent[] = lines.map((line, at) =>
    el(
      "tspan",
      { x, dy: at === 0 ? 0 : size * 1.25 },
      at === 0 && lead
        ? [el("tspan", { fill: lead.fill }, [textNode(lead.text)]), textNode(line)]
        : [textNode(line)],
    ),
  );

  return el(
    "text",
    {
      x,
      y,
      fontFamily: "var(--font-mono)",
      fontSize: size,
      textAnchor: anchor,
      fill,
      ...extra,
    },
    spans,
  );
}

/*
 * Palette. Every value is a token from app/globals.css — there is not one hex
 * in this file, which is what keeps the diagram in the same system as the page
 * around it and makes dark mode free.
 */
const INK = "hsl(var(--foreground))";
const QUIET = "hsl(var(--muted-foreground))";
const LINE = "hsl(var(--border))";
const CALL = "hsl(var(--sig-cool))";
const REPLY = "hsl(var(--sig-warm))";

/** A dotted wire is a return in every sequence diagram anyone has ever drawn. */
function hueOf(stroke: Stroke): string {
  return stroke === "dotted" ? REPLY : CALL;
}

type Row =
  | { at: "message"; step: Extract<Step, { kind: "message" }>; y: number; number?: number }
  | { at: "note"; step: Extract<Step, { kind: "note" }>; y: number }
  | { at: "region"; tag: string; label: string[]; top: number; bottom: number; depth: number }
  | { at: "divider"; tag: string; label: string[]; y: number; depth: number }
  | { at: "bar"; column: number; top: number; bottom: number; nest: number };

export type RenderedDiagram = {
  svg: Element;
  /** What the drawing measured itself at, so the frame knows when it overflows. */
  width: number;
  /** The steps in words, for readers who cannot see the picture. */
  steps: string[];
};

/** Outermost region, then every region, then everything else, in row order. */
function paintOrder(row: Row): number {
  if (row.at === "region") return row.depth;
  if (row.at === "divider") return 1000;
  return 2000;
}

export function renderSequenceDiagram(
  diagram: SequenceDiagram,
  id: string,
): RenderedDiagram {
  const { participants, steps } = diagram;

  /* ---- horizontal: how wide each column is, and how far apart ---- */

  const chipWidth = participants.map((participant) =>
    Math.max(CHIP_MIN_WIDTH, widest(participant.lines, NAME_SIZE) + CHIP_PAD_X * 2),
  );
  const chipHeight =
    Math.max(...participants.map((participant) => participant.lines.length)) * CHIP_LINE +
    CHIP_PAD_Y * 2;

  const gaps: number[] = [];
  for (let column = 0; column < participants.length - 1; column += 1) {
    gaps.push((chipWidth[column] + chipWidth[column + 1]) / 2 + COLUMN_CLEARANCE);
  }

  // A span is "these two columns must end up at least this far apart", collected
  // from everything that has to fit between them. Applied shortest-span first so
  // a wide `Note over A,D` does not spend all its slack on the first gap.
  const spans: { from: number; to: number; need: number }[] = [];
  const last = participants.length - 1;
  /* How far the drawing reaches past the outermost lifeline on each side. */
  let leftReach = chipWidth[0] / 2;
  let rightReach = chipWidth[last] / 2;

  const demand = (from: number, to: number, need: number) => {
    if (from === to) return;
    spans.push({ from: Math.min(from, to), to: Math.max(from, to), need });
  };

  for (const step of steps) {
    if (step.kind === "message") {
      const text = widest(step.lines, MESSAGE_SIZE);
      if (step.from === step.to) {
        const reach = SELF_REACH + text + 18;
        if (step.from === last) rightReach = Math.max(rightReach, reach);
        else demand(step.from, step.from + 1, reach + chipWidth[step.from + 1] / 2);
      } else {
        demand(step.from, step.to, text + 26);
      }
    }

    if (step.kind === "note") {
      const text = widest(step.lines, NOTE_SIZE) + NOTE_PAD_X * 2;
      if (step.placement === "over" && step.from !== step.to) {
        demand(step.from, step.to, text - 40);
      } else if (step.placement === "over") {
        const half = text / 2 + 16;
        if (step.from > 0) demand(step.from - 1, step.from, half + chipWidth[step.from - 1] / 2);
        else leftReach = Math.max(leftReach, half);
        if (step.from < last) demand(step.from, step.from + 1, half + chipWidth[step.from + 1] / 2);
        else rightReach = Math.max(rightReach, half);
      } else if (step.placement === "left") {
        if (step.from > 0) demand(step.from - 1, step.from, text + 24 + chipWidth[step.from - 1] / 2);
        else leftReach = Math.max(leftReach, text + 14);
      } else {
        if (step.to < last) demand(step.to, step.to + 1, text + 24 + chipWidth[step.to + 1] / 2);
        else rightReach = Math.max(rightReach, text + 14);
      }
    }
  }

  for (const span of spans.sort((a, b) => a.to - a.from - (b.to - b.from))) {
    let have = 0;
    for (let gap = span.from; gap < span.to; gap += 1) have += gaps[gap];
    if (span.need <= have) continue;

    const share = (span.need - have) / (span.to - span.from);
    for (let gap = span.from; gap < span.to; gap += 1) gaps[gap] += share;
  }

  const centres: number[] = [MARGIN + leftReach];
  for (let column = 1; column < participants.length; column += 1) {
    centres.push(centres[column - 1] + gaps[column - 1]);
  }

  const svgWidth = Math.ceil(centres[last] + rightReach + MARGIN);

  /* ---- vertical: walk the steps, laying out rows and open regions ---- */

  const rows: Row[] = [];
  const spoken: string[] = [];
  const open: { tag: string; label: string[]; top: number; depth: number }[] = [];
  const active: number[][] = participants.map(() => []);
  let y = chipHeight + FIRST_ROW;
  let counter = 0;

  const name = (column: number) => participants[column].lines.join(" ");

  const openBar = (column: number) => {
    active[column].push(y);
  };
  const closeBar = (column: number) => {
    const top = active[column].pop();
    if (top === undefined) return;
    rows.push({ at: "bar", column, top, bottom: y + 6, nest: active[column].length });
  };
  for (const step of steps) {
    if (step.kind === "block-open") {
      open.push({ tag: step.tag, label: step.label, top: y - 10, depth: open.length });
      y += REGION_HEAD;
      continue;
    }

    if (step.kind === "block-divider") {
      const region = open[open.length - 1];
      rows.push({
        at: "divider",
        tag: step.tag,
        label: step.label,
        y: y + 4,
        depth: region ? region.depth : 0,
      });
      y += DIVIDER_ROW;
      continue;
    }

    if (step.kind === "block-close") {
      const region = open.pop();
      if (region) {
        rows.push({
          at: "region",
          tag: region.tag,
          label: region.label,
          top: region.top,
          bottom: y + 6,
          depth: region.depth,
        });
      }
      y += REGION_AFTER;
      continue;
    }

    if (step.kind === "activate") {
      openBar(step.at);
      continue;
    }

    if (step.kind === "deactivate") {
      closeBar(step.at);
      continue;
    }

    if (step.kind === "note") {
      const height = step.lines.length * NOTE_LINE + NOTE_PAD_Y * 2;
      rows.push({ at: "note", step, y });
      spoken.push(`Note: ${step.lines.join(" ")}`);
      y += height + NOTE_AFTER;
      continue;
    }

    counter += 1;
    const labelHeight = step.lines.length * LABEL_LINE;
    const wire = y + labelHeight + LABEL_LIFT;

    rows.push({
      at: "message",
      step,
      y: wire,
      number: diagram.autonumber ? counter : undefined,
    });

    const said = step.lines.join(" ");
    const arrow = step.stroke === "dotted" ? "replies to" : "calls";
    spoken.push(
      step.from === step.to
        ? `${name(step.from)} ${said || "acts on itself"}`
        : `${name(step.from)} ${arrow} ${name(step.to)}${said ? `: ${said}` : ""}`,
    );

    if (step.from === step.to) {
      y = wire + SELF_DROP + ROW_AFTER;
    } else {
      y = wire + ROW_AFTER;
    }

    // The `+`/`-` shorthands, applied after the wire is placed so the bar starts
    // at the message that opened it rather than a row early.
    if (step.activates) active[step.to].push(wire);
    if (step.deactivates) {
      const top = active[step.from].pop();
      if (top !== undefined) {
        rows.push({ at: "bar", column: step.from, top, bottom: wire, nest: active[step.from].length });
      }
    }
  }

  // Anything still open when the source ran out: closed at the foot rather than
  // dropped, so a diagram that forgot a `deactivate` still draws.
  for (let column = 0; column < participants.length; column += 1) {
    while (active[column].length > 0) closeBar(column);
  }
  for (let index = open.length - 1; index >= 0; index -= 1) {
    const region = open[index];
    rows.push({
      at: "region",
      tag: region.tag,
      label: region.label,
      top: region.top,
      bottom: y + 6,
      depth: region.depth,
    });
  }

  const svgHeight = Math.ceil(y + BOTTOM);
  const lifelineBottom = svgHeight - BOTTOM + 8;

  /* ---- paint, back to front ---- */

  const defs: ElementContent[] = [];
  /*
   * Regions are painted outermost first and dividers after all of them, rather
   * than in the order the rows were laid out. A region row is only made when
   * its `end` is reached, so laid-out order is *inside* out — which had a
   * nested `alt` painted over by the `loop` around it, and every `else` chip
   * tinted by the region that closed after it.
   */
  const regions: ElementContent[] = [];
  const dividers: ElementContent[] = [];
  const bars: ElementContent[] = [];
  const wires: ElementContent[] = [];
  const notes: ElementContent[] = [];

  for (const head of ["arrow", "open", "cross"] as const) {
    for (const [tone, colour] of [
      ["call", CALL],
      ["reply", REPLY],
    ] as const) {
      defs.push(marker(`${id}-${head}-${tone}`, head, colour));
    }
  }

  const lifelines: ElementContent[] = centres.map((centre) =>
    el("line", {
      x1: centre,
      y1: chipHeight,
      x2: centre,
      y2: lifelineBottom,
      stroke: LINE,
      strokeWidth: 1,
      strokeDasharray: "3 5",
    }),
  );

  const chips: ElementContent[] = participants.flatMap((participant, column) => {
    const boxWidth = chipWidth[column];
    const x = centres[column] - boxWidth / 2;
    return [
      el("rect", {
        x,
        y: 0,
        width: boxWidth,
        height: chipHeight,
        // A person is rounder than a system: `actor` gets the pill the rest of
        // the site uses for people-shaped things, `participant` the card radius.
        rx: participant.actor ? chipHeight / 2 : 10,
        fill: "hsl(var(--card))",
        stroke: LINE,
        strokeWidth: 1,
      }),
      label(
        participant.lines,
        centres[column],
        CHIP_PAD_Y + NAME_SIZE,
        NAME_SIZE,
        "middle",
        INK,
        { fontWeight: 500 },
      ),
    ];
  });

  const ordered = [...rows].sort((a, b) => paintOrder(a) - paintOrder(b));

  for (const row of ordered) {
    if (row.at === "region") {
      const inset = REGION_INSET + row.depth * 10;

      regions.push(
        el("rect", {
          x: inset,
          y: row.top,
          width: Math.max(0, svgWidth - inset * 2),
          height: Math.max(0, row.bottom - row.top),
          rx: 10,
          fill: "hsl(var(--foreground) / 0.03)",
          stroke: LINE,
          strokeWidth: 1,
        }),
        ...tag(row.tag, row.label, inset, row.top),
      );
      continue;
    }

    if (row.at === "divider") {
      const inset = REGION_INSET + row.depth * 10;
      dividers.push(
        el("line", {
          x1: inset,
          y1: row.y,
          x2: svgWidth - inset,
          y2: row.y,
          stroke: LINE,
          strokeWidth: 1,
          strokeDasharray: "4 4",
        }),
        // The same chip the region opened with, so `else` reads as a sibling of
        // `alt` rather than as a caption somebody left on a line.
        ...tag(row.tag, row.label, inset, row.y - 10),
      );
      continue;
    }

    if (row.at === "bar") {
      bars.push(
        el("rect", {
          x: centres[row.column] - BAR_WIDTH / 2 + row.nest * BAR_NEST,
          y: row.top,
          width: BAR_WIDTH,
          height: Math.max(8, row.bottom - row.top),
          rx: 3,
          // Quiet: a bar says "this one is busy", which is context rather than
          // an event, and at full strength it competed with the wires.
          fill: "hsl(var(--sig-cool) / 0.14)",
          stroke: "hsl(var(--sig-cool) / 0.38)",
          strokeWidth: 1,
        }),
      );
      continue;
    }

    if (row.at === "note") {
      const step = row.step;
      const text = widest(step.lines, NOTE_SIZE);
      const boxHeight = step.lines.length * NOTE_LINE + NOTE_PAD_Y * 2;
      let boxWidth = text + NOTE_PAD_X * 2;
      let x: number;

      if (step.placement === "left") {
        x = centres[step.from] - 12 - boxWidth;
      } else if (step.placement === "right") {
        x = centres[step.to] + 12;
      } else {
        const from = centres[step.from];
        const to = centres[step.to];
        boxWidth = Math.max(boxWidth, to - from + 44);
        x = (from + to) / 2 - boxWidth / 2;
      }

      notes.push(
        el("rect", {
          x,
          y: row.y,
          width: boxWidth,
          height: boxHeight,
          rx: 8,
          fill: "hsl(var(--muted))",
          stroke: LINE,
          strokeWidth: 1,
        }),
        label(
          step.lines,
          x + NOTE_PAD_X,
          row.y + NOTE_PAD_Y + NOTE_SIZE,
          NOTE_SIZE,
          "start",
          QUIET,
        ),
      );
      continue;
    }

    wires.push(...message(row, centres, offsetAt(rows, row), id));
  }

  const svg = el(
    "svg",
    {
      viewBox: `0 0 ${svgWidth} ${svgHeight}`,
      width: svgWidth,
      height: svgHeight,
      role: "img",
      "aria-label": diagram.description ?? diagram.title ?? "Sequence diagram",
      className: "sequence-diagram-svg",
    },
    [
      el("defs", {}, defs),
      ...regions,
      ...dividers,
      ...lifelines,
      ...bars,
      ...chips,
      ...notes,
      ...wires,
    ],
  );

  return { svg, width: svgWidth, steps: spoken };
}

/**
 * Where a wire meets a lifeline, given whatever activation bars are on it.
 *
 * Read off the laid-out bars rather than tracked during the walk, because a bar
 * is only pushed when it *closes* — at which point the messages that cross it
 * have already been placed.
 */
function offsetAt(rows: Row[], row: Extract<Row, { at: "message" }>) {
  return (column: number, direction: 1 | -1) => {
    const covering = rows.filter(
      (other) =>
        other.at === "bar" &&
        other.column === column &&
        other.top <= row.y + 0.5 &&
        other.bottom >= row.y - 0.5,
    ) as Extract<Row, { at: "bar" }>[];

    if (covering.length === 0) return 0;
    const nest = Math.max(...covering.map((bar) => bar.nest));
    return direction * (BAR_WIDTH / 2 + nest * BAR_NEST);
  };
}

function message(
  row: Extract<Row, { at: "message" }>,
  centres: number[],
  offset: (column: number, direction: 1 | -1) => number,
  id: string,
): ElementContent[] {
  const step = row.step;
  const hue = hueOf(step.stroke);
  const tone = step.stroke === "dotted" ? "reply" : "call";
  const dash = step.stroke === "dotted" ? "5 4" : undefined;
  const head = step.head === "none" ? undefined : `url(#${id}-${headKind(step.head)}-${tone})`;
  const out: ElementContent[] = [];

  const lead = row.number
    ? { text: `${row.number}  `, fill: QUIET }
    : undefined;

  if (step.from === step.to) {
    const x = centres[step.from] + offset(step.from, 1);
    const path = [
      `M ${x} ${row.y}`,
      `H ${x + SELF_REACH}`,
      `V ${row.y + SELF_DROP}`,
      `H ${x + 2}`,
    ].join(" ");

    out.push(
      el("path", {
        d: path,
        fill: "none",
        stroke: hue,
        strokeWidth: 1.5,
        strokeDasharray: dash,
        strokeLinejoin: "round",
        markerEnd: head,
        opacity: 0.9,
      }),
      label(
        step.lines,
        x + SELF_REACH + 10,
        row.y + 4,
        MESSAGE_SIZE,
        "start",
        INK,
        {},
        lead,
      ),
    );
    return out;
  }

  const rightwards = step.to > step.from;
  const x1 = centres[step.from] + offset(step.from, rightwards ? 1 : -1);
  const x2 = centres[step.to] + offset(step.to, rightwards ? -1 : 1);
  const gradient = `${id}-w${Math.round(row.y)}-${step.from}-${step.to}`;

  out.push(
    el("linearGradient", {
      id: gradient,
      gradientUnits: "userSpaceOnUse",
      x1,
      y1: row.y,
      x2,
      y2: row.y,
    }, [
      // The wire brightens toward the head it is travelling to. Redundant with
      // the hue and the arrowhead on purpose — it is a flourish, not a signal.
      el("stop", { offset: "0%", stopColor: hue, stopOpacity: 0.3 }),
      el("stop", { offset: "100%", stopColor: hue, stopOpacity: 1 }),
    ]),
    el("line", {
      x1,
      y1: row.y,
      x2,
      y2: row.y,
      stroke: `url(#${gradient})`,
      strokeWidth: 1.5,
      strokeDasharray: dash,
      markerEnd: head,
      // `orient="auto-start-reverse"` on the marker is what makes one
      // definition serve both ends; without it the start head points the way
      // the line travels, which on a `<<->>` is the wrong way.
      markerStart: step.head === "both" ? `url(#${id}-arrow-${tone})` : undefined,
    }),
    // The origin node: the same 3px mark the spine uses where a section docks.
    el("circle", { cx: x1, cy: row.y, r: 2.5, fill: hue, opacity: 0.55 }),
    label(
      step.lines,
      (x1 + x2) / 2,
      row.y - LABEL_LIFT,
      MESSAGE_SIZE,
      "middle",
      INK,
      {},
      lead,
    ),
  );

  return out;
}

/**
 * A block's corner label: the keyword in a chip, the author's words beside it.
 *
 * The same shape as a code fence's language mark in globals.css — mono,
 * uppercase, tracked, muted — because it is doing the same job: naming what
 * kind of thing this is, in the corner, without becoming part of the content.
 */
function tag(
  keyword: string,
  words: string[],
  x: number,
  y: number,
): ElementContent[] {
  const word = keyword.toUpperCase();
  const chipWidth = width(word, TAG_SIZE) * 1.35 + 16;

  const parts: ElementContent[] = [
    el("rect", {
      x,
      y,
      width: chipWidth,
      height: 20,
      rx: 10,
      fill: "hsl(var(--muted))",
      stroke: LINE,
      strokeWidth: 1,
    }),
    label([word], x + 8, y + 14, TAG_SIZE, "start", QUIET, {
      letterSpacing: "0.14em",
    }),
  ];

  if (words.length > 0) {
    parts.push(
      label([words.join(" ")], x + chipWidth + 8, y + 14, TAG_SIZE + 1.5, "start", QUIET),
    );
  }

  return parts;
}

function headKind(head: Head): "arrow" | "open" | "cross" {
  if (head === "open") return "open";
  if (head === "cross") return "cross";
  return "arrow";
}

/**
 * The three heads Mermaid distinguishes, drawn once each per hue.
 *
 * `markerUnits="userSpaceOnUse"` so the head keeps its size whatever the wire's
 * stroke width is — with the default the head scales with the line and a 1.5px
 * stroke gives a head half the size it was drawn at.
 */
function marker(id: string, head: "arrow" | "open" | "cross", colour: string): Element {
  const shape =
    head === "arrow"
      ? el("path", { d: "M0,0 L9,3.4 L0,6.8 L1.6,3.4 Z", fill: colour })
      : head === "open"
        ? el("path", {
            d: "M0.8,0.6 L8.4,3.4 L0.8,6.2",
            fill: "none",
            stroke: colour,
            strokeWidth: 1.4,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          })
        : el("path", {
            d: "M2,0.6 L8.4,6.2 M8.4,0.6 L2,6.2",
            fill: "none",
            stroke: colour,
            strokeWidth: 1.4,
            strokeLinecap: "round",
          });

  return el(
    "marker",
    {
      id,
      markerWidth: 9,
      markerHeight: 6.8,
      refX: head === "cross" ? 5.2 : 8.6,
      refY: 3.4,
      orient: "auto-start-reverse",
      markerUnits: "userSpaceOnUse",
    },
    [shape],
  );
}
