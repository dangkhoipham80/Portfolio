/**
 * What languages a post can be written in, and what to call them.
 *
 * The codes have to match SUPPORTED_LANGUAGES in apps/api/app/core/constants.py
 * — that is the list the API validates writes against, and a code here that is
 * not there is a 422 on save with a message the admin cannot act on. Two lists,
 * because this module is loaded by the browser and cannot read Python; adding a
 * language means editing both, which is the cost of the console being a
 * separate application.
 *
 * ## Why each language is named in itself
 *
 * "Tiếng Việt", not "Vietnamese". A language switcher is read by someone who
 * wants the other language, and the label they can recognise is the one written
 * in it — labelling the Vietnamese version "Vietnamese" is only useful to
 * someone who already reads English, which is the group that does not need the
 * link. This is what `hreflang` pickers on every multilingual site do, and it is
 * the one place on this site where a label is not in English.
 */

export type LanguageCode = "vi" | "en";

export type Language = {
  code: LanguageCode;
  /** The language's name in itself, for the switcher and the meta rail. */
  label: string;
  /** For `aria-label` and `title`, where the reader may not read `label`. */
  englishName: string;
};

export const LANGUAGES: Language[] = [
  { code: "vi", label: "Tiếng Việt", englishName: "Vietnamese" },
  { code: "en", label: "English", englishName: "English" },
];

/** What a post written in no stated language is treated as. Matches the API. */
export const DEFAULT_LANGUAGE: LanguageCode = "vi";

/**
 * The language for a code, falling back rather than throwing.
 *
 * A post could carry a code this build does not know about — the API is
 * deployed separately and may be a version ahead, which is the ordinary state
 * of things for a few minutes on every deploy. A missing label must not take
 * the post page down, so an unknown code renders as itself.
 */
export function languageFor(code: string | null | undefined): Language {
  const known = LANGUAGES.find((language) => language.code === code);
  if (known) return known;

  const upper = String(code ?? DEFAULT_LANGUAGE).toUpperCase();
  return { code: DEFAULT_LANGUAGE, label: upper, englishName: upper };
}

/**
 * The `lang` attribute for a post.
 *
 * Passed through only when it is a code the site knows, because this value
 * reaches assistive technology: a made-up subtag makes a screen reader either
 * ignore it or switch to a voice for a language nobody wrote.
 */
export function langAttribute(code: string | null | undefined): LanguageCode {
  return LANGUAGES.some((language) => language.code === code)
    ? (code as LanguageCode)
    : DEFAULT_LANGUAGE;
}
