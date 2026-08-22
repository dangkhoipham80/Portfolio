"use client";

/*
 * The gallery editor.
 *
 * ## The textarea is the field
 *
 * Exactly the trick image-field.tsx uses for a single cover, for the same
 * reason. What carries the value is one plain textarea holding one URL per
 * line — that is what has the field's `name`, that is what posts, and
 * `readForm` treats it identically to any other `list`. Everything else on this
 * component writes into it.
 *
 * So with scripting off this degrades to what a gallery would have been
 * anyway: a textarea you paste URLs into, one per line, in display order.
 * Nothing regresses. With scripting on you get thumbnails, upload, reordering
 * and a picker onto the library, and the wire format never changes.
 *
 * ## Why the picker matters more than the upload button
 *
 * Upload is the obvious control and the less useful one. The library exists so
 * an image is uploaded and described once and then reused, and a gallery editor
 * with only an upload button quietly teaches the opposite — upload it again.
 */

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";

import { registerUpload } from "@/app/actions/media";
import { LibraryPicker } from "@/components/console/library-picker";
import { cn } from "@/lib/cn";

type Status =
  | { state: "idle" }
  | { state: "uploading"; done: number; total: number }
  | { state: "failed"; message: string };

function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function GalleryField({
  name,
  label,
  hint,
  error,
  defaultValue,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  defaultValue: string;
}) {
  const [urls, setUrls] = useState<string[]>(() => toLines(defaultValue));
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [picking, setPicking] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function move(index: number, by: number) {
    setUrls((current) => {
      const next = [...current];
      const target = index + by;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(index: number) {
    setUrls((current) => current.filter((_, i) => i !== index));
  }

  function add(url: string) {
    // Silently ignores a duplicate rather than rejecting it: the same image
    // twice in one gallery is always a misclick, and there is nothing to
    // explain to someone who just clicked the wrong thumbnail.
    setUrls((current) => (current.includes(url) ? current : [...current, url]));
  }

  async function onPick(files: FileList) {
    const chosen = Array.from(files);
    setStatus({ state: "uploading", done: 0, total: chosen.length });

    try {
      // Sequential, not Promise.all. Five 5MB screenshots at once saturates the
      // connection and the progress count becomes meaningless; one at a time
      // means the count is true and a failure names the file it happened on.
      for (const [index, file] of chosen.entries()) {
        const size = await readDimensions(file);

        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/admin/upload",
        });

        add(blob.url);
        void registerUpload({
          url: blob.url,
          pathname: blob.pathname,
          mime: file.type || undefined,
          size_bytes: file.size,
          ...(size ?? {}),
        });

        setStatus({ state: "uploading", done: index + 1, total: chosen.length });
      }

      setStatus({ state: "idle" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Upload failed";
      setStatus({
        state: "failed",
        message: message.includes("Not authenticated")
          ? "Your session expired. Open the console in a new tab to sign in, then try again."
          : message,
      });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-foreground">{label}</legend>

      {hint ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}

      {/*
        The real field. Hidden from sight once scripting is running, because the
        thumbnails above are a better view of the same data — but still in the
        form, still named, still what posts.
      */}
      <textarea
        name={name}
        value={urls.join("\n")}
        onChange={(event) => setUrls(toLines(event.target.value))}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
      />

      {urls.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {urls.map((url, index) => (
            <li
              key={url}
              className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border bg-card p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-12 w-20 shrink-0 rounded-[calc(var(--radius-control)-2px)] border border-border bg-muted object-cover"
              />

              <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                {url.split("/").pop()}
              </span>

              <div className="flex shrink-0 items-center gap-1">
                <RowButton
                  label={`Move image ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </RowButton>
                <RowButton
                  label={`Move image ${index + 1} down`}
                  disabled={index === urls.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </RowButton>
                <RowButton
                  label={`Remove image ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  ×
                </RowButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-control)]",
            "border border-border px-3.5 py-2.5 text-sm text-muted-foreground",
            "transition-colors hover:border-primary/40 hover:text-foreground",
            status.state === "uploading" && "pointer-events-none opacity-60",
          )}
        >
          {status.state === "uploading"
            ? `Uploading ${status.done + 1} of ${status.total}…`
            : "Upload images"}
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="sr-only"
            disabled={status.state === "uploading"}
            onChange={(event) => {
              if (event.target.files?.length) void onPick(event.target.files);
            }}
          />
        </label>

        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-border px-3.5 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          Choose from library
        </button>
      </div>

      <p role="status" className="sr-only">
        {status.state === "uploading" ? `Uploading image ${status.done + 1}` : ""}
      </p>

      {status.state === "failed" ? (
        <p className="mt-2 text-sm text-destructive-text">{status.message}</p>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-destructive-text">{error}</p>
      ) : null}

      {picking && (
        <LibraryPicker
          chosen={urls}
          onChoose={(asset) => add(asset.url)}
          onClose={() => setPicking(false)}
        />
      )}
    </fieldset>
  );
}

function RowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      // h-11 w-11: an arrow glyph is a few pixels of ink, and padding alone
      // leaves these well under a comfortable target.
      className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
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
