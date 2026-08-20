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

import { TextField } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Status =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "failed"; message: string };

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
  const fileInput = useRef<HTMLInputElement>(null);

  async function onPick(file: File) {
    setStatus({ state: "uploading" });

    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
      });

      setUrl(blob.url);
      setStatus({ state: "idle" });
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
        meta={
          hint ? (
            <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
              {hint}
            </span>
          ) : undefined
        }
        error={error}
        value={url}
        onChange={(event) => setUrl(event.target.value)}
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
        <label
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-control)]",
            "border border-border px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-wider",
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

        {url ? (
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
            className="h-11 w-20 rounded-[var(--radius-control)] border border-border object-cover"
          />
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
