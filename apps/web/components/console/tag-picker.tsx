"use client";

/*
 * A client component: it toggles chips and creates a tag without leaving the
 * form. The value underneath is still a plain textarea, so with scripting off
 * this is a list of slugs you type — see the note below.
 */

import { useState, useTransition } from "react";

import { createTagInline } from "@/app/actions/tags";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import type { TagRef } from "@/lib/types";

/**
 * Attach tags to a post by picking from the ones that exist.
 *
 * ## Why picking and not typing
 *
 * Free-text tagging produces "api", "API" and "apis" within a month, and the
 * reader is the one who pays: three facets on the index that should have been
 * one, holding a third of the posts each. The API enforces this — a slug that
 * matches no row is a 422 — and this control is the interface that makes the
 * rule easy to live with rather than annoying.
 *
 * ## Why a tag can still be created from here
 *
 * Because the alternative is worse. Sending someone to a different screen,
 * making a tag, and coming back to a form they had half-filled is how a rule
 * like this gets resented and worked around. The point was never that creating
 * a tag should be hard; it is that it should be *deliberate*, and pressing a
 * button labelled "Create" is deliberate in a way that typing a word into a box
 * is not.
 *
 * ## The hidden textarea is the field
 *
 * Same arrangement as image-field.tsx and gallery-field.tsx. One slug per line,
 * exactly what `readForm` reads for any `list`, so the wire format does not
 * change and the form still posts without JavaScript.
 */
export function TagPicker({
  name,
  label,
  hint,
  error,
  value,
  available,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  /** One slug per line, as the form holds it. */
  value: string;
  available: TagRef[];
}) {
  const [chosen, setChosen] = useState<string[]>(() =>
    value.split("\n").map((line) => line.trim()).filter(Boolean),
  );
  const [tags, setTags] = useState(available);
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(slug: string) {
    setChosen((current) =>
      current.includes(slug)
        ? current.filter((entry) => entry !== slug)
        : [...current, slug],
    );
  }

  function create() {
    const trimmed = draft.trim();
    if (!trimmed || pending) return;

    setFailed(null);
    startTransition(async () => {
      const result = await createTagInline(trimmed);

      if (!result.ok) {
        setFailed(result.message);
        return;
      }

      // Added to the list *and* selected: creating a tag from inside a post is
      // only ever the first half of "and put it on this post".
      setTags((current) =>
        current.some((tag) => tag.slug === result.tag.slug) ? current : [...current, result.tag],
      );
      setChosen((current) =>
        current.includes(result.tag.slug) ? current : [...current, result.tag.slug],
      );
      setDraft("");
    });
  }

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      {hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}

      {tags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const on = chosen.includes(tag.slug);

            return (
              <li key={tag.slug}>
                <button
                  type="button"
                  onClick={() => toggle(tag.slug)}
                  // aria-pressed, not colour alone: whether a tag is attached is
                  // the entire state of this control.
                  aria-pressed={on}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-[var(--radius-pill)] border px-3 text-xs transition-colors",
                    on
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  )}
                >
                  {tag.name}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No tags yet. Make the first one below.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          // Enter creates the tag rather than submitting the form. Inside a
          // form, an un-handled Enter in a text input submits it — which here
          // would save a half-written post because someone finished typing a
          // word.
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              create();
            }
          }}
          placeholder="New tag name"
          maxLength={60}
          aria-label="New tag name"
          className="min-h-9 w-48 rounded-[var(--radius-control)] border border-border bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={create}
          disabled={pending || !draft.trim()}
          className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create tag"}
        </button>
      </div>

      {failed ? <p className="mt-2 text-xs text-destructive-text">{failed}</p> : null}

      <Eyebrow className="mt-4">Posted as</Eyebrow>
      {/*
        The field itself. Visible rather than hidden, and that is deliberate:
        it is the thing that actually saves, it is editable with scripting off,
        and showing the slugs is how the author learns that a tag's URL is not
        its name. `rows` grows a little with the selection so it does not become
        a scrollbox.
      */}
      <textarea
        id={name}
        name={name}
        value={chosen.join("\n")}
        onChange={(event) =>
          setChosen(
            event.target.value.split("\n").map((line) => line.trim()).filter(Boolean),
          )
        }
        rows={Math.min(6, Math.max(2, chosen.length))}
        aria-label={`${label}, one slug per line`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cn(
          "mt-1.5 w-full rounded-[var(--radius-control)] border bg-card px-3 py-2 font-mono text-xs text-foreground",
          error ? "border-destructive" : "border-border",
        )}
      />

      {error ? (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-destructive-text">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
