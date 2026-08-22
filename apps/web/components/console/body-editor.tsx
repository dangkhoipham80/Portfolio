"use client";

/*
 * A client component: it edits a selection, uploads files, and renders a
 * preview on demand. None of that has a server-only form.
 *
 * ## The textarea is still the field
 *
 * Exactly the arrangement image-field.tsx and gallery-field.tsx use. What
 * carries the value is one plain textarea with the field's `name` — that is
 * what posts, and `readForm` treats it identically to any other `markdown`
 * field. The toolbar writes into it; the preview reads from it. With scripting
 * off this degrades to the textarea it was before, which is exactly what
 * writing Markdown needs and nothing regresses.
 */

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";

import { registerUpload } from "@/app/actions/media";
import { type Preview, renderPreview } from "@/app/actions/preview";
import { LibraryPicker } from "@/components/console/library-picker";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";

/**
 * The post body editor: a toolbar, a textarea, and the real renderer beside it.
 *
 * ## Why the toolbar wraps rather than replaces
 *
 * Every button here operates on the current selection and leaves plain
 * Markdown behind. Nothing is hidden behind a widget, nothing is stored as a
 * private format, and the text after pressing Bold is the text you would have
 * typed. That is the difference between a Markdown editor and a rich-text
 * editor that happens to save Markdown — the second one loses whatever it
 * cannot represent, quietly, on the next round trip.
 *
 * ## Why the preview is on demand
 *
 * It costs a server round trip through the whole unified stack, and a live
 * preview would mean one per keystroke. Pressing Preview also marks the moment
 * the author wants to *check* something, which is when it is worth being slow
 * and correct rather than fast and approximate.
 *
 * The rendering happens in app/actions/preview.ts, which returns React rather
 * than an HTML string.
 */
export function BodyEditor({
  name,
  label,
  hint,
  error,
  defaultValue,
  /** Read to decide which pipeline the preview should use. */
  formatFieldName = "format",
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  defaultValue: string;
  formatFieldName?: string;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  /**
   * Replace the selection, and put the caret somewhere sensible afterwards.
   *
   * Written through the DOM rather than through React state, because the
   * textarea is uncontrolled — see the note at the top of this file. Setting
   * `.value` directly skips React's own input tracking, so `undo` in the
   * browser stops seeing the change; that is the accepted cost of keeping the
   * field a plain uncontrolled input that posts without JavaScript.
   */
  function surround(before: string, after = "", placeholder = "") {
    const field = textarea.current;
    if (!field) return;

    const { selectionStart: start, selectionEnd: end, value } = field;
    const selected = value.slice(start, end) || placeholder;
    const inserted = `${before}${selected}${after}`;

    field.setRangeText(inserted, start, end, "end");

    // With nothing selected, drop the caret between the markers so the next
    // keystroke lands inside them rather than after the closing one.
    if (start === end && !placeholder) {
      const caret = start + before.length;
      field.setSelectionRange(caret, caret);
    }

    field.focus();
  }

  /** Insert at the start of the line, for things that are line-level. */
  function prefixLine(marker: string) {
    const field = textarea.current;
    if (!field) return;

    const { selectionStart: start, value } = field;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;

    field.setRangeText(marker, lineStart, lineStart, "end");
    field.focus();
  }

  function insert(text: string) {
    const field = textarea.current;
    if (!field) return;

    field.setRangeText(text, field.selectionStart, field.selectionEnd, "end");
    field.focus();
  }

  function currentFormat(): "markdown" | "mdx" {
    // Read out of the form rather than mirrored into state: the format select
    // is a real control in the same form, so the DOM already knows, and a
    // second copy in `useState` is a second thing to keep in step.
    const form = textarea.current?.form;
    const field = form?.elements.namedItem(formatFieldName);
    const value = field instanceof HTMLSelectElement ? field.value : "markdown";

    return value === "mdx" ? "mdx" : "markdown";
  }

  async function showPreview() {
    const body = textarea.current?.value ?? "";
    setRendering(true);

    try {
      setPreview(await renderPreview(body, currentFormat()));
    } catch {
      // A failed action is a network problem or an expired session. Either way
      // the text in the textarea is untouched, which is the thing worth saying.
      setPreview({
        content: null,
        used: currentFormat(),
        problem:
          "The preview could not be rendered. Your text is untouched — if this " +
          "keeps happening, your session may have expired.",
      });
    } finally {
      setRendering(false);
    }
  }

  async function onPick(files: FileList) {
    const file = files[0];
    if (!file) return;

    setUploadError(null);

    try {
      const size = await readDimensions(file);
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
      });

      void registerUpload({
        url: blob.url,
        pathname: blob.pathname,
        mime: file.type || undefined,
        size_bytes: file.size,
        ...(size ?? {}),
      });

      insertImage(blob.url, null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Upload failed";
      setUploadError(
        message.includes("Not authenticated")
          ? "Your session expired. Open the console in a new tab to sign in, then try again."
          : message,
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  /**
   * Write the image into the body.
   *
   * MDX gets a `<Figure>`, which requires alt text and can carry a caption;
   * Markdown gets `![](url)`. The alt comes from the media library when the
   * library knows it, which is the whole reason an image is described once
   * there rather than at each use.
   */
  function insertImage(url: string, alt: string | null) {
    const description = alt ?? "";

    if (currentFormat() === "mdx") {
      insert(`\n<Figure src="${url}" alt="${escapeAttribute(description)}" />\n`);
    } else {
      insert(`\n![${description}](${url})\n`);
    }
  }

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <label htmlFor={name} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <button
          type="button"
          onClick={showPreview}
          disabled={rendering}
          className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
        >
          {rendering ? "Rendering…" : preview ? "Refresh preview" : "Preview"}
        </button>
      </div>

      {hint ? (
        <p id={`${name}-hint`} className="mb-2 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}

      <Toolbar
        onSurround={surround}
        onPrefix={prefixLine}
        onInsert={insert}
        onUpload={() => fileInput.current?.click()}
        onLibrary={() => setPicking((open) => !open)}
      />

      {/*
        Not inside the toolbar's flex row: a file input is a control the browser
        draws itself, and there is no styling that makes it match the buttons
        beside it. The visible control is the toolbar button that clicks this.
      */}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => event.target.files && onPick(event.target.files)}
      />

      <textarea
        ref={textarea}
        id={name}
        name={name}
        defaultValue={defaultValue}
        rows={20}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? `${name}-error` : null, hint ? `${name}-hint` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        // Mono, because a post body is largely code fences and indentation and
        // a proportional face makes both unreadable while editing.
        className={cn(
          "min-h-96 w-full rounded-b-[var(--radius-control)] border border-t-0 bg-card px-3 py-2.5 font-mono text-[0.8125rem] leading-relaxed text-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          error ? "border-destructive" : "border-border",
        )}
      />

      {error ? (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-destructive-text">
          {error}
        </p>
      ) : null}

      {uploadError ? (
        <Notice tone="error" className="mt-3">
          {uploadError}
        </Notice>
      ) : null}

      {picking ? (
        <LibraryPicker
          chosen={[]}
          onChoose={(asset) => {
            insertImage(asset.url, asset.alt);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}

      {preview ? (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 rounded-t-[var(--radius-control)] border border-border bg-muted px-3 py-2">
            <Eyebrow>Preview · rendered as {preview.used}</Eyebrow>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="inline-flex min-h-9 items-center px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Close
            </button>
          </div>

          {preview.problem ? (
            <Notice tone="error" className="rounded-none border-x-border border-b-0">
              {preview.problem}
            </Notice>
          ) : null}

          {/*
            Rendered as React, not as an HTML string — see app/actions/preview.ts.
            There is no `dangerouslySetInnerHTML` here and that is the point: the
            preview is not a second place where markup is trusted.
          */}
          <div className="rounded-b-[var(--radius-control)] border border-t-0 border-border bg-card p-5">
            {preview.content}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The formatting controls.
 *
 * Text labels rather than icons. A bold "B" and an italic "I" are conventional
 * enough, but "callout", "figure" and "fence" have no icon anyone would read
 * correctly, and a toolbar that is half glyphs and half words reads as neither.
 * Words also survive translation and screen readers without a title attribute
 * apiece.
 */
function Toolbar({
  onSurround,
  onPrefix,
  onInsert,
  onUpload,
  onLibrary,
}: {
  onSurround: (before: string, after?: string, placeholder?: string) => void;
  onPrefix: (marker: string) => void;
  onInsert: (text: string) => void;
  onUpload: () => void;
  onLibrary: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-1 rounded-t-[var(--radius-control)] border border-border bg-muted px-2 py-1.5"
    >
      <Tool onClick={() => onSurround("**", "**", "bold")}>Bold</Tool>
      <Tool onClick={() => onSurround("*", "*", "italic")}>Italic</Tool>
      <Tool onClick={() => onSurround("`", "`", "code")}>Code</Tool>
      <Tool onClick={() => onSurround("[", "](https://)", "link text")}>Link</Tool>

      <Divider />

      <Tool onClick={() => onPrefix("## ")}>H2</Tool>
      <Tool onClick={() => onPrefix("### ")}>H3</Tool>
      <Tool onClick={() => onPrefix("- ")}>List</Tool>
      <Tool onClick={() => onPrefix("> ")}>Quote</Tool>

      <Divider />

      <Tool onClick={() => onInsert("\n```ts\n\n```\n")}>Fence</Tool>
      <Tool onClick={() => onInsert("\n| a | b |\n| - | - |\n| 1 | 2 |\n")}>Table</Tool>

      <Divider />

      <Tool onClick={onUpload}>Upload image</Tool>
      <Tool onClick={onLibrary}>From library</Tool>

      <Divider />

      {/*
        MDX-only blocks. Offered whatever the format is set to, because the
        author may be about to switch it — and because inserting one into a
        Markdown post renders as visible text rather than breaking anything, so
        the mistake explains itself.
      */}
      <Tool onClick={() => onInsert('\n<Callout kind="warning" title="Watch out">\n\n</Callout>\n')}>
        Callout
      </Tool>
      <Tool onClick={() => onInsert('\n<Aside>\n\n</Aside>\n')}>Aside</Tool>
      <Tool onClick={() => onInsert('\n<Video provider="youtube" id="" title="" />\n')}>
        Video
      </Tool>
    </div>
  );
}

function Tool({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Not 44px: this is a dense row of same-kind controls above a keyboard
        // surface, used with a pointer on a desktop console. The console is
        // not a phone screen and never has been.
        "inline-flex min-h-8 items-center rounded-[var(--radius-control)] px-2 text-xs text-muted-foreground transition-colors",
        "hover:bg-card hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />;
}

/** Alt text goes into a double-quoted MDX attribute, so quotes have to go. */
function escapeAttribute(value: string): string {
  return value.replace(/"/g, "'");
}

/** Same as image-field.tsx: measured before upload, where the bytes already are. */
async function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}
