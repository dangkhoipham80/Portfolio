/**
 * A post's headings, derived from its source.
 *
 * ## Why this is not in lib/markdown.ts
 *
 * It was, and the `server-only` guard at the top of that file rejected it — for
 * exactly the reason the guard exists. The table of contents is a client
 * component (it observes scroll position to mark the current section) and it
 * needs the same threshold the page uses to decide whether to render a column
 * for it. Importing that from lib/markdown.ts meant importing the whole unified
 * stack — remark, rehype, the sanitiser and Shiki's grammars — into the browser
 * bundle, to read one number.
 *
 * Everything here is plain string work with no dependencies, so it is safe on
 * both sides. That is the whole reason it is a separate file.
 *
 * ## Why the source and not the rendered HTML
 *
 * Parsing the output would need a DOM on the server and a second pass over
 * every post. The source has the same headings in the same order, and reading
 * it works identically for a Markdown body and an MDX one.
 */

export type Heading = { id: string; text: string; level: 2 | 3 };

/**
 * Below this many, a contents list is furniture rather than navigation — three
 * entries beside a four-minute read.
 */
export const MINIMUM_HEADINGS = 3;

export function hasContents(headings: Heading[]): boolean {
  return headings.length >= MINIMUM_HEADINGS;
}

/**
 * The `##` and `###` headings in a post.
 *
 * `#` is skipped: that is the post title, which the page already carries as its
 * `h1`. Anything deeper than `###` is not navigation.
 *
 * Fenced code is stripped first. A shell session with a `# comment` in it is
 * not a heading, and without this the contents list fills up with them.
 */
export function headingsOf(markdown: string): Heading[] {
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, "");
  const headings: Heading[] = [];
  const seen = new Map<string, number>();

  for (const line of withoutFences.split("\n")) {
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;

    const text = match[2]
      // Inline Markdown, taken off: a heading rendered as "The `format` column"
      // must not appear in the contents with its backticks.
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
      .trim();

    if (!text) continue;

    const base = slugifyHeading(text);
    // Two headings with the same words are ordinary in a technical post — every
    // "Why" section, for instance. Without a suffix both anchors would point at
    // the first one. `anchorHeadings` in lib/markdown.ts counts the same way.
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);

    headings.push({
      id: count === 0 ? base : `${base}-${count + 1}`,
      text,
      level: match[1].length === 2 ? 2 : 3,
    });
  }

  return headings;
}

/**
 * The id a heading's anchor uses.
 *
 * Called from two places that never see each other's output — here, from the
 * Markdown source, and `anchorHeadings`, from the rendered tree — so both use
 * this and apply the duplicate-suffixing rule identically. A mismatch would not
 * fail anywhere: the contents list would simply scroll to nothing, which is why
 * it is worth stating.
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
