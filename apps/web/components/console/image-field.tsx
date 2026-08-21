"use client";

/*
 * A client component because it does the two things a server component cannot:
 * read a File off an <input type="file">, and PUT its bytes at Blob storage.
 *
 * ## The URL box is the field. The picker is a convenience on top of it.
 *
 * The form this sits in works with scripting off — see the header of
 * entity-form.tsx — and a file upload cannot. So the control that actually
 * carries the value is a plain text input holding the URL, exactly as before;
 * that is what has the field's `name`, that is what posts, and that is what the
 * server reads. The picker just writes into it.
 *
 * With no JavaScript the picker is inert and the admin pastes a URL, which is
 * precisely the behaviour this field had before uploading existed. Nothing
 * regressed for that visitor.
 */

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";

import { registerUpload } from "@/app/actions/media";
import { TextField } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Status =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "failed"; message: string };

/** A cover that is 3:2 is previewed at 3:2. A 80x44 chip told you nothing. */
const PREVIEW = "h-24 w-36";

/**
 * Read an image's pixel dimensions from the file, before it is uploaded.
 *
 * Stored on the asset so a gallery can reserve the right box before the bytes
 * arrive rather than reflowing around each one. `createImageBitmap` decodes off
 * the main thread and needs no element in the document, unlike `new Image()`
 * with an onload — and it is allowed to fail: a browser that cannot decode the
 * format still uploads it fine, and a row with no dimensions is better than no
 * row.
 */
async function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    // Frees the decoded buffer now rather than at the next GC. A 5MB PNG
    // decodes to tens of megabytes.
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

export function ImageField({
  name,
  label,
  hint,
  error,
  defaultValue,
  maxLength,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  defaultValue: string;
  maxLength?: number;
}) {
  // The URL is state so the preview and the input stay in step after an
  // upload. It starts uncontrolled-in-spirit from defaultValue, which is what
  // carries a rejected edit's text back into the form.
  const [url, setUrl] = useState(defaultValue);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  // Whether the URL currently in the box actually resolves to an image. A dead
  // URL is the normal case here, not an edge one — this field holds whatever
  // was typed or pasted, and the old preview answered a 404 with the browser's
  // broken-image glyph on an `alt=""` element, which is an unlabelled broken
  // graphic that says nothing about what went wrong.
  const [broken, setBroken] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function onUrlChange(next: string) {
    setUrl(next);
    setBroken(false);
  }

  async function onPick(file: File) {
    setStatus({ state: "uploading" });

    try {
      // Measured before the upload, not after: the File is already in memory
      // here, and reading it back over the network to find out how big it is
      // would be a second download of what was just sent.
      const size = await readDimensions(file);

      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
      });

      onUrlChange(blob.url);
      setStatus({ state: "idle" });

      /*
       * Record it in the library. Not awaited before the field updates above,
       * and its result is ignored: the bytes are stored and the URL is in the
       * form, so the image will save and render whichever way this goes.
       * Making the admin wait on it — or worse, reporting a failed upload
       * because a bookkeeping call did not land — would trade the real outcome
       * for an index entry. See app/actions/media.ts.
       */
      void registerUpload({
        url: blob.url,
        pathname: blob.pathname,
        mime: file.type || undefined,
        size_bytes: file.size,
        ...(size ?? {}),
      });
    } catch (cause) {
      /*
       * The route answers 401 for a dead session and 400 for a rejected file,
       * but the SDK surfaces both as an Error whose message is the body's
       * `error`. Saying "sign in again" for the first is worth the string
       * match: it is the one failure the admin can actually act on, and
       * "upload failed" would send them hunting for a problem with the file.
       */
      const message = cause instanceof Error ? cause.message : "Upload failed";

      setStatus({
        state: "failed",
        message: message.includes("Not authenticated")
          ? "Your session expired. Open the console in a new tab to sign in, then try again."
          : message,
      });
    } finally {
      // Let the same file be picked twice — after a failure, the change event
      // would not fire again without this.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div>
      <TextField
        name={name}
        label={label}
        hint={hint}
        error={error}
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        type="text"
        maxLength={maxLength}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/*
          A real <input type="file"> with a real <label> pointing at it, rather
          than a button that calls .click(). The label is the click target and
          the keyboard target, so this is focusable and operable without a
          single extra handler.
        */}
        {/*
          Sentence case, in the body face. This was mono uppercase, which was
          the same call the field labels used to make and wrong for the same
          reason — it is a control, and every other control on the screen is a
          <Button> that says "Save changes", not "SAVE CHANGES".
        */}
        <label
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-control)]",
            "border border-border px-3.5 py-2.5 text-sm",
            "text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
            status.state === "uploading" && "pointer-events-none opacity-60",
          )}
        >
          {status.state === "uploading" ? "Uploading…" : "Upload image"}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="sr-only"
            disabled={status.state === "uploading"}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onPick(file);
            }}
          />
        </label>

        {url && !broken ? (
          /*
           * A plain <img>, not next/image: this is an admin preview of a URL
           * that may be anything the admin typed, and routing it through the
           * optimiser would mean whitelisting arbitrary hosts in
           * next.config.ts. The public site is where optimisation matters.
           */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            onError={() => setBroken(true)}
            className={cn(
              PREVIEW,
              "rounded-[var(--radius-control)] border border-border bg-muted object-cover",
            )}
          />
        ) : null}

        {url && broken ? (
          /*
           * Says what happened and what it means, rather than showing a torn
           * page. The URL is kept and will still save: it may be a host that is
           * briefly down, or one that refuses hotlinking, and silently clearing
           * someone's field on a failed GET would be worse than showing this.
           */
          <p
            className={cn(
              PREVIEW,
              "flex items-center justify-center rounded-[var(--radius-control)] border border-dashed",
              "border-border px-3 text-center text-xs leading-relaxed text-muted-foreground",
            )}
          >
            This URL did not load
          </p>
        ) : null}
      </div>

      {/* role=status so a screen reader hears the outcome without moving focus. */}
      <p role="status" className="sr-only">
        {status.state === "uploading" ? "Uploading image" : ""}
      </p>

      {status.state === "failed" ? (
        <p className="mt-2 text-sm text-destructive-text">{status.message}</p>
      ) : null}
    </div>
  );
}
