/**
 * What a post's contents list is made of.
 *
 * ## Why this is not in lib/markdown.ts
 *
 * It was, and the `server-only` guard at the top of that file rejected it — for
 * exactly the reason the guard exists. The table of contents is a client
 * component (it observes scroll position to mark the current section) and it
 * needs these types and the threshold below. Importing them from lib/markdown.ts
 * meant importing the whole unified stack — remark, rehype, the sanitiser and
 * Shiki's grammars — into the browser bundle to read one number.
 *
 * Everything here is plain string work with no dependencies, so it is safe on
 * both sides. That is the whole reason it is a separate file.
 *
 * ## Why there is no longer a parser here
 *
 * There used to be: `headingsOf`, which read `##` and `###` out of the Markdown
 * *source*, while `anchorHeadings` in lib/markdown.ts wrote ids onto the
 * *rendered tree*. Two derivations of the same ids, from two different inputs,
 * with a comment on each saying the other had to agree with it.
 *
 * They did not, and nothing failed when they diverged — the contents list
 * simply scrolled to an anchor that was not on the page. The ways they came
 * apart were all ordinary Markdown:
 *
 * * `# Introduction`. The source reader skipped `#` as "the post title", so a
 *   post written with `#` for its sections had no contents at all — and the
 *   rendered `h1`s got no ids, so linking to one was impossible.
 * * `> ## A quoted heading`. The source reader's pattern is anchored to the
 *   start of a line, so it missed this one; the renderer found it, gave it an
 *   id, and counted it — which shifted the `-2` suffix onto the wrong one of
 *   every later duplicate.
 * * A heading inside an MDX component, which is not in the source as a `##` at
 *   all.
 *
 * So the ids are now derived once, in one pass, from the tree that is actually
 * rendered — see `anchorHeadings`. This file keeps the type, the threshold and
 * the slug rule, which is the part both ends genuinely share.
 */

/** `1` is a `#` in the body, which is not the same as the page's own title. */
export type HeadingLevel = 1 | 2 | 3 | 4;

export type Heading = { id: string; text: string; level: HeadingLevel };

/**
 * Below this many, a contents list is furniture rather than navigation — three
 * entries beside a four-minute read.
 */
export const MINIMUM_HEADINGS = 3;

export function hasContents(headings: Heading[]): boolean {
  return headings.length >= MINIMUM_HEADINGS;
}

/**
 * How far a heading is indented in the contents list, relative to the shallowest
 * one in it.
 *
 * Relative rather than absolute, because both conventions are in use and both
 * are correct: a post whose sections are `##` and a post whose sections are `#`
 * should produce the same-looking list, not one of them indented a step for no
 * reason a reader can see.
 */
export function indentOf(heading: Heading, headings: Heading[]): number {
  const shallowest = Math.min(...headings.map((entry) => entry.level));
  // Capped at two steps. A fourth level at 375px has nowhere left to go, and
  // an `h4` under an `h3` under an `h2` is already past what a rail can show.
  return Math.min(heading.level - shallowest, 2);
}

/**
 * The id a heading's anchor uses.
 *
 * Called from one place now — `anchorHeadings`, over the rendered tree — which
 * is the point of the note at the top of this file. It stays here rather than
 * moving into lib/markdown.ts so the client half can be tested against the same
 * function the server half writes with.
 */
export function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      // Combining marks left behind by the decomposition above, so "Cấu" and
      // "Cau" produce the same anchor rather than one with invisible characters
      // in it.
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}
