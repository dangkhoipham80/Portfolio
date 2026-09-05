import Link from "next/link";

import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { langAttribute, languageFor } from "@/lib/languages";
import type { Post } from "@/lib/types";

/**
 * The same post, in the other languages it exists in.
 *
 * ## Why it renders nothing rather than a lone current-language chip
 *
 * A switcher offering one choice is not a switcher; it is a label, and the meta
 * rail already carries that label. Most posts have no translation, and a row of
 * one button on every one of them would be chrome that never does anything —
 * the reader learns to stop reading it, which is the state you do not want it
 * in on the post where it matters.
 *
 * ## Why the current language is still shown when there are others
 *
 * Because a switcher has to say what you are switching *from*. Two links, one
 * of which does nothing, would be a tab stop that lands on the page you are
 * already on; so the current one is a `span` with `aria-current`, and only the
 * others are links.
 */
export function TranslationSwitcher({
  post,
  className,
}: {
  post: Post;
  className?: string;
}) {
  if (post.translations.length === 0) return null;

  const current = languageFor(post.language);

  return (
    <nav aria-labelledby="translations-heading" className={className}>
      <Eyebrow id="translations-heading" className="mb-2">
        Also in
      </Eyebrow>

      <ul className="flex flex-wrap gap-2">
        <li>
          <span
            aria-current="true"
            lang={langAttribute(post.language)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-[var(--radius-pill)] border border-foreground/30 bg-muted px-4 text-sm text-foreground",
              "lg:min-h-9",
            )}
          >
            {current.label}
          </span>
        </li>

        {post.translations.map((other) => {
          const language = languageFor(other.language);

          return (
            <li key={other.slug}>
              <Link
                href={`/blog/${other.slug}`}
                lang={langAttribute(other.language)}
                /*
                  The label is the language, so the accessible name has to carry
                  what is being switched — "English" alone, out of context in a
                  list of links, does not say it leads to this post. The title
                  is the post's own, in its own language.
                */
                hrefLang={langAttribute(other.language)}
                aria-label={`${other.title} — ${language.englishName}`}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-[var(--radius-pill)] border border-border px-4 text-sm text-muted-foreground transition-colors",
                  "hover:border-foreground/30 hover:bg-muted hover:text-foreground",
                  "lg:min-h-9",
                )}
              >
                {language.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
