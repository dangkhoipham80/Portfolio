import { compile } from "@mdx-js/mdx";
import type { Node } from "unist";
import { visit } from "unist-util-visit";

/**
 * What a post body written in MDX is allowed to contain.
 *
 * ## Why this is its own module
 *
 * MDX is Markdown plus JSX, and in its full form that means executable
 * JavaScript: `import` pulls in modules, `export` defines values, and `{…}`
 * evaluates an arbitrary expression. Compiled and run on the server — which is
 * what a body living in a database column has to be — that is remote code
 * execution with the database as the input. It is a materially worse thing than
 * the stored XSS that lib/markdown.ts's sanitiser exists to prevent.
 *
 * This file is the check that stops it, and it holds no React and imports no
 * components on purpose. Two things follow, and both are the point:
 *
 * 1. It can be tested in Node, in milliseconds, without a DOM or a bundler.
 *    The rendering half cannot — it pulls in `next/image` — so keeping them
 *    together would have meant the security-critical half was the part with no
 *    unit test.
 * 2. It cannot be weakened by an edit to a component. The allow-list here is
 *    names; components/mdx-blocks.tsx is typed against it, so adding a
 *    component without listing it is a compile error rather than a component
 *    that silently cannot be used — or worse, a name that can be used without
 *    appearing here.
 */

/**
 * Every component a post body may name.
 *
 * Kept as names rather than derived from the component map, so this module
 * stays free of React — see above. Drift is prevented at the type level:
 * `MDX_COMPONENTS` is declared as `Record<MdxComponentName, …>`, which requires
 * exactly these keys and rejects any other.
 */
export const MDX_COMPONENT_NAMES = ["Callout", "Figure", "Video", "Aside"] as const;

export type MdxComponentName = (typeof MDX_COMPONENT_NAMES)[number];

const ALLOWED = new Set<string>(MDX_COMPONENT_NAMES);

/** Nodes the MDX parser produces for the syntax this pipeline will not run. */
const EXECUTABLE_NODES = new Set([
  // `import` / `export` statements.
  "mdxjsEsm",
  // `{expression}` on its own line, and inline within a paragraph.
  "mdxFlowExpression",
  "mdxTextExpression",
]);

/** Thrown by the plugin below; caught by the renderer, which falls back. */
export class MdxRejected extends Error {}

/**
 * Refuse anything executable, and any tag that is not one of ours.
 *
 * A remark plugin rather than a check on the source text, because the source
 * text cannot be checked: `{` appears in prose and in code fences, and a regex
 * that tried to tell those from an expression would be both wrong and the only
 * thing standing between a post body and `eval`. The parser has already done
 * that work, so the tree is where the question is answerable.
 */
export function rejectExecutableMdx() {
  return (tree: Node) => {
    visit(tree, (node: Node) => {
      if (EXECUTABLE_NODES.has(node.type)) {
        throw new MdxRejected(
          "This post uses JavaScript in MDX — an import, an export, or a {…} " +
            "expression. Only Markdown and the site's own components are allowed.",
        );
      }

      if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") {
        return;
      }

      const name = (node as { name?: string | null }).name;

      // A null name is a fragment (`<>…</>`), which carries nothing executable.
      if (name && !ALLOWED.has(name)) {
        throw new MdxRejected(
          `<${name}> is not one of this site's components. ` +
            `Available: ${[...MDX_COMPONENT_NAMES].sort().join(", ")}.`,
        );
      }

      // Attributes are checked by allowing one shape rather than by naming the
      // bad ones, and that is deliberate: the first version of this listed the
      // node types to reject and got the spread one's name wrong, so
      // `<Callout {...props}>` compiled and ran. Deny-listing a parser's node
      // names means a typo is a silent hole; allowing exactly "a name with a
      // plain string value" means anything unrecognised fails closed.
      for (const attribute of (node as { attributes?: unknown[] }).attributes ?? []) {
        const entry = attribute as {
          type?: string;
          name?: string;
          value?: { type?: string } | string | null;
        };

        if (entry.type !== "mdxJsxAttribute") {
          // `mdxJsxExpressionAttribute` — a spread, or any other expression in
          // attribute position.
          throw new MdxRejected(
            "Spread and expression attributes are not allowed in a post body.",
          );
        }

        // A value of null is a bare boolean attribute (`<Callout wide>`), which
        // carries nothing executable. A string is a literal. An object is an
        // `mdxJsxAttributeValueExpression` — the same hole as a bare `{…}`,
        // reached through a different node.
        if (entry.value !== null && typeof entry.value !== "string") {
          throw new MdxRejected(
            `The ${entry.name ?? "?"} attribute uses a {…} expression. ` +
              "Attributes in a post body have to be plain text.",
          );
        }
      }
    });
  };
}

/**
 * Whether a body would compile and run as MDX, without running it.
 *
 * Returns null when it is fine, or the sentence to show the author. Used by the
 * console's preview so a problem is reported while the post is being written
 * rather than discovered on the public page — and by the tests, which is why it
 * exists separately from the renderer at all.
 */
export async function validateMdx(body: string): Promise<string | null> {
  try {
    await compile(body, {
      outputFormat: "function-body",
      development: false,
      remarkPlugins: [rejectExecutableMdx],
    });
    return null;
  } catch (error) {
    return messageFor(error);
  }
}

/** The sentence an author should see for a rejection or a compile failure. */
export function messageFor(error: unknown): string {
  if (error instanceof MdxRejected) return error.message;

  // A compile error from MDX itself — an unclosed tag, usually. Its message
  // names a line and a column, so it is worth showing verbatim.
  return `This did not compile as MDX, so it is being shown as Markdown. ${
    error instanceof Error ? error.message : String(error)
  }`;
}
