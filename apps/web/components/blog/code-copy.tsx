"use client";

// A client component because the clipboard is a browser API and there is no
// CSS that can put text on it. It renders nothing — the buttons are in the
// post's own markup, written by `copyableCodeBlocks` in lib/markdown.ts.

import { useEffect } from "react";

import { useArticleState } from "@/lib/article-state";

/**
 * Makes every code block on the page copyable.
 *
 * ## One listener, not one component per block
 *
 * A post can have twenty fences. Twenty hydrated components to run one
 * `writeText` is twenty React roots' worth of bundle and boot for a control
 * that does one thing — and the body is a string of HTML by the time it reaches
 * the page, so there is nothing to mount them into anyway. Instead the markup
 * is rendered on the server with the rest of the post and a single delegated
 * listener serves all of it, however many blocks there are and whichever of the
 * two pipelines rendered them.
 *
 * ## What gets copied
 *
 * `pre > code`, and its `textContent`. Two consequences worth stating, because
 * both are requirements rather than details:
 *
 * * **The code, not the markup.** Shiki wraps every token in a `<span>` with
 *   inline colour variables; `textContent` walks past all of it and returns the
 *   characters the author typed. Reading `innerHTML` here — which is what makes
 *   a copy button look easy — would put a paragraph of `<span style=…>` on the
 *   clipboard.
 * * **Not the button.** It sits *inside* the `<pre>` (see the plugin for why),
 *   so `pre.textContent` would begin with the word "Copy". The `<code>` is the
 *   code and nothing else.
 *
 * Line breaks survive without any special handling: they are text nodes in the
 * highlighted tree, so a twenty-line block comes back as twenty lines.
 *
 * ## Why the buttons start hidden
 *
 * Because without JavaScript they cannot do anything, and a control that does
 * nothing when pressed is worse than no control. The server renders them with
 * `hidden`; this removes it on mount, which is the one moment at which the
 * promise on the button becomes true.
 */

/** How long "Copied" stays up. Long enough to read, short enough not to linger. */
const CONFIRM_MS = 2000;

export function CodeCopy() {
  /*
    Only the counter is used, and only as a dependency. Unlocking a gated post
    replaces the body, which throws away every element this effect took a handle
    on — so the listener has to be attached again to markup that exists. See
    lib/article-state.ts.
  */
  const { version } = useArticleState();

  useEffect(() => {
    const article = document.querySelector(".article-prose");
    if (!(article instanceof HTMLElement)) return;

    const buttons = article.querySelectorAll<HTMLButtonElement>("button[data-copy]");
    for (const button of buttons) button.hidden = false;

    // Per-button, so two blocks copied in quick succession do not cancel each
    // other's confirmation.
    const timers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();

    async function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLButtonElement>("button[data-copy]");
      if (!button) return;

      const code = button.closest("pre")?.querySelector("code");
      if (!code) return;

      try {
        await navigator.clipboard.writeText(code.textContent ?? "");
      } catch {
        // Denied permission, or an insecure origin — `navigator.clipboard` is
        // undefined on plain http beyond localhost. Nothing to say: the code is
        // on the page and selectable, which is where it was before there was a
        // button. Saying "copied" when nothing was would be the only real
        // failure here.
        return;
      }

      button.dataset.copied = "";
      clearTimeout(timers.get(button));
      timers.set(
        button,
        setTimeout(() => delete button.dataset.copied, CONFIRM_MS),
      );
    }

    article.addEventListener("click", onClick);
    return () => {
      article.removeEventListener("click", onClick);
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, [version]);

  return null;
}
