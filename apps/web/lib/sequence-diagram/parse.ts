/**
 * Reads a Mermaid `sequenceDiagram` into something that can be drawn.
 *
 * ## Why this repo parses Mermaid instead of running it
 *
 * Mermaid is a browser library. It measures text with the DOM, so rendering a
 * diagram means either shipping ~500 kB of JavaScript to every reader who opens
 * a post that has one, or running a headless browser at build time. Both are a
 * lot to pay for a picture of four boxes and six arrows.
 *
 * The larger objection is that Mermaid's output would not belong here. It draws
 * in its own palette and its own typeface, and the one thing this site is
 * consistent about is that a request going out is cool and a response coming
 * back is warm — which is exactly what a sequence diagram is a picture of. A
 * stock Mermaid diagram in the middle of a post is a screenshot from another
 * website. So the source is parsed here and drawn in `./render.ts`, on the
 * server, in the site's own tokens, at the cost of zero client bytes.
 *
 * ## What that costs, and how it stays honest
 *
 * A subset. Everything below is supported; anything else — a `box`, a
 * `create`, a flowchart, a typo — makes this return `null`, and the caller
 * leaves the fence alone so the reader sees the source. That is the same rule
 * lib/mdx.tsx applies to a body that will not compile: a post is never worth
 * less than what the author wrote, and a diagram drawn from a line this parser
 * guessed at would be worse than no diagram, because it would be believed.
 *
 * Supported: `participant`/`actor` with `as` aliases, every arrow Mermaid
 * defines, `activate`/`deactivate` and the `+`/`-` shorthands, notes (`left
 * of`, `right of`, `over`, and `over A,B`), `loop`/`alt`/`else`/`opt`/`par`/
 * `and`/`critical`/`option`/`break`/`rect` blocks, `autonumber`, `title`, the
 * `acc*` accessibility fields and `%%` comments.
 */

/** A column: something messages are sent between. */
export type Participant = {
  id: string;
  /** The display name, already split on `<br/>`. */
  lines: string[];
  /** `actor` draws a person rather than a box. */
  actor: boolean;
};

/** How the wire is drawn, and what sits on the far end of it. */
export type Stroke = "solid" | "dotted";
export type Head = "arrow" | "open" | "cross" | "none" | "both";

export type Step =
  | {
      kind: "message";
      from: number;
      to: number;
      lines: string[];
      stroke: Stroke;
      head: Head;
      /** `A->>+B`: B is doing something from here on. */
      activates: boolean;
      /** `B-->>-A`: B has stopped. */
      deactivates: boolean;
    }
  | { kind: "note"; placement: "left" | "right" | "over"; from: number; to: number; lines: string[] }
  | { kind: "activate"; at: number }
  | { kind: "deactivate"; at: number }
  | { kind: "block-open"; tag: string; label: string[] }
  | { kind: "block-divider"; tag: string; label: string[] }
  | { kind: "block-close" };

export type SequenceDiagram = {
  title?: string;
  /** From `accDescr`, when the author wrote one. */
  description?: string;
  participants: Participant[];
  steps: Step[];
  autonumber: boolean;
};

/**
 * Longest first, because `-->>` also starts with `-->` and `->`.
 *
 * Ordering an alternation by length is the whole of the arrow grammar: with the
 * short forms first, `A-->>B` parses as `A` `-->` `>B`, and the message points
 * at a participant named `>B` that does not exist.
 */
const ARROWS: ReadonlyArray<[token: string, stroke: Stroke, head: Head]> = [
  ["<<-->>", "dotted", "both"],
  ["<<->>", "solid", "both"],
  ["--)", "dotted", "open"],
  ["--x", "dotted", "cross"],
  ["-->>", "dotted", "arrow"],
  ["-->", "dotted", "none"],
  ["-)", "solid", "open"],
  ["-x", "solid", "cross"],
  ["->>", "solid", "arrow"],
  ["->", "solid", "none"],
];

const ARROW_PATTERN = new RegExp(
  `^(.*?)(${ARROWS.map(([token]) => token.replace(/[-)\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})(.*)$`,
);

/** Blocks that open a region, and the word shown in its corner tag. */
const BLOCK_OPENERS = new Set(["loop", "alt", "opt", "par", "critical", "break", "rect"]);

/** Words that divide a region already open. */
const BLOCK_DIVIDERS = new Set(["else", "and", "option"]);

/** Statements that carry no drawing and are dropped rather than refused. */
const IGNORED = /^(acctitle|accdescr)\b/i;

export function parseSequenceDiagram(source: string): SequenceDiagram | null {
  const lines = source.split("\n");

  const participants: Participant[] = [];
  const index = new Map<string, number>();
  const steps: Step[] = [];
  let autonumber = false;
  let title: string | undefined;
  let description: string | undefined;
  let depth = 0;
  let started = false;

  /**
   * A participant named on a message line rather than declared.
   *
   * Mermaid does this too, and it is how most diagrams are actually written —
   * the columns appear in the order they are first mentioned.
   */
  const columnFor = (raw: string): number | null => {
    const id = raw.trim();
    if (!id || /[\s:]/.test(id) || id.length > 60) return null;

    const existing = index.get(id);
    if (existing !== undefined) return existing;

    index.set(id, participants.length);
    participants.push({ id, lines: [id], actor: false });
    return participants.length - 1;
  };

  for (const raw of lines) {
    // Everything after `%%` is a comment, and a blank line is nothing.
    const line = raw.replace(/%%.*$/, "").trim();
    if (!line) continue;

    if (!started) {
      // The header is the one line that has to be there. Reaching a diagram of
      // some other type here means this fence is not ours to draw.
      if (!/^sequenceDiagram\b/i.test(line)) return null;
      started = true;
      continue;
    }

    if (IGNORED.test(line)) {
      const value = line.slice(line.indexOf(":") + 1).trim();
      if (/^accdescr/i.test(line) && value) description = value;
      continue;
    }

    if (/^autonumber\b/i.test(line)) {
      autonumber = !/\boff\b/i.test(line);
      continue;
    }

    if (/^title\b/i.test(line)) {
      title = line.replace(/^title\b:?/i, "").trim() || undefined;
      continue;
    }

    const declaration = /^(participant|actor)\s+(.+)$/i.exec(line);
    if (declaration) {
      const [, keyword, rest] = declaration;
      const alias = /^(.+?)\s+as\s+(.+)$/i.exec(rest);
      const id = (alias ? alias[1] : rest).trim();
      const label = (alias ? alias[2] : rest).trim();
      if (!id || /[\s:]/.test(id)) return null;

      const at = columnFor(id);
      if (at === null) return null;
      const shown = splitLabel(label);
      participants[at] = {
        id,
        lines: shown.length > 0 ? shown : [id],
        actor: keyword.toLowerCase() === "actor",
      };
      continue;
    }

    const lifecycle = /^(activate|deactivate)\s+(.+)$/i.exec(line);
    if (lifecycle) {
      const at = columnFor(lifecycle[2]);
      if (at === null) return null;
      steps.push({
        kind: lifecycle[1].toLowerCase() === "activate" ? "activate" : "deactivate",
        at,
      });
      continue;
    }

    const note = /^note\s+(left of|right of|over)\s+([^:]+):(.*)$/i.exec(line);
    if (note) {
      const placement = note[1].toLowerCase().startsWith("left")
        ? "left"
        : note[1].toLowerCase().startsWith("right")
          ? "right"
          : "over";
      const targets = note[2].split(",").map((entry) => columnFor(entry));
      if (targets.some((entry) => entry === null) || targets.length === 0) return null;

      const columns = targets as number[];
      steps.push({
        kind: "note",
        placement,
        from: Math.min(...columns),
        to: Math.max(...columns),
        lines: splitLabel(note[3].trim()),
      });
      continue;
    }

    const word = /^([a-z]+)\b(.*)$/i.exec(line);
    if (word && BLOCK_OPENERS.has(word[1].toLowerCase())) {
      const tag = word[1].toLowerCase();
      // `rect rgb(0,0,0)` colours the region in Mermaid. This site's regions
      // take their colour from the palette, so the argument is dropped rather
      // than honoured — the alternative is a post choosing a hex value.
      const label = tag === "rect" ? "" : word[2].trim();
      steps.push({ kind: "block-open", tag, label: splitLabel(label) });
      depth += 1;
      continue;
    }

    if (word && BLOCK_DIVIDERS.has(word[1].toLowerCase())) {
      if (depth === 0) return null;
      steps.push({
        kind: "block-divider",
        tag: word[1].toLowerCase(),
        label: splitLabel(word[2].trim()),
      });
      continue;
    }

    if (/^end$/i.test(line)) {
      if (depth === 0) return null;
      depth -= 1;
      steps.push({ kind: "block-close" });
      continue;
    }

    const message = parseMessage(line, columnFor);
    if (!message) return null;
    steps.push(message);
  }

  // An unclosed `loop` would draw a region with no bottom edge. Refuse, and let
  // the reader see the source that has the mistake in it.
  if (!started || depth !== 0) return null;
  if (participants.length === 0 || !steps.some((step) => step.kind === "message")) return null;

  return { title, description, participants, steps, autonumber };
}

function parseMessage(
  line: string,
  columnFor: (raw: string) => number | null,
): Extract<Step, { kind: "message" }> | null {
  const colon = line.indexOf(":");
  const head = colon === -1 ? line : line.slice(0, colon);
  const text = colon === -1 ? "" : line.slice(colon + 1).trim();

  const match = ARROW_PATTERN.exec(head);
  if (!match) return null;

  const [, left, token, right] = match;
  const arrow = ARROWS.find(([candidate]) => candidate === token);
  if (!arrow) return null;

  /*
   * `A->>+B` activates B; `B-->>-A` deactivates B, the sender. The sign sits on
   * the target's side of the arrow in both cases, which reads backwards until
   * you notice it is describing the *message*, not the participant beside it.
   */
  const sign = /^[+-]/.exec(right.trim())?.[0];
  const from = columnFor(left);
  const to = columnFor(right.trim().replace(/^[+-]/, ""));
  if (from === null || to === null) return null;

  return {
    kind: "message",
    from,
    to,
    lines: splitLabel(text),
    stroke: arrow[1],
    head: arrow[2],
    activates: sign === "+",
    deactivates: sign === "-",
  };
}

/**
 * A label, split the one way Mermaid lets an author break a line.
 *
 * `<br/>` is the only markup accepted, and it is consumed here rather than
 * passed on — the renderer emits text nodes, so nothing from a post body
 * reaches the document as markup through this path.
 */
function splitLabel(value: string): string[] {
  return value
    .replace(/^"([\s\S]*)"$/, "$1")
    .split(/<br\s*\/?>/i)
    .map((part) => part.trim())
    .filter(Boolean);
}
