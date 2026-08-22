"use client";

// A client component: it fetches on open, closes on Escape, and hands a choice
// back to whatever opened it.

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import type { MediaAsset } from "@/lib/console-api";

/**
 * Pick from what has already been uploaded.
 *
 * Fetches on open rather than with the page: most edits never touch an image,
 * and the library is the one list in the console that grows without bound.
 *
 * Extracted from the gallery editor when the post body editor needed the same
 * thing. That is the point of the library existing at all — an image is
 * uploaded and described once and then reused — and a second copy of this
 * component would have been a second place for that to stop being true.
 */
export function LibraryPicker({
  chosen,
  onChoose,
  onClose,
}: {
  chosen: string[];
  /** The whole asset, not just its URL — a caller may want the alt text. */
  onChoose: (asset: MediaAsset) => void;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;

    fetch("/api/admin/media")
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: MediaAsset[]) => live && setAssets(data))
      .catch(() => live && setFailed(true));

    return () => {
      live = false;
    };
  }, []);

  // Escape closes it, which a person expects of anything that covers the page
  // and which nothing else here provides.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="mt-3 rounded-[var(--radius-card)] border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Library</p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Close
        </button>
      </div>

      {failed ? (
        <p className="mt-2 text-sm text-muted-foreground">
          The library could not be loaded. You can still upload or paste a URL.
        </p>
      ) : assets === null ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing uploaded yet. Use Upload images above.
        </p>
      ) : (
        <ul className="mt-3 grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {assets.map((asset) => {
            const already = chosen.includes(asset.url);

            return (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => onChoose(asset)}
                  disabled={already}
                  // The description is the accessible name, because that is
                  // what tells these apart — a filename here is a random suffix.
                  aria-label={
                    already
                      ? `${asset.alt ?? asset.pathname ?? "Image"} — already in this gallery`
                      : `Add ${asset.alt ?? asset.pathname ?? "image"}`
                  }
                  className={cn(
                    "group relative block w-full overflow-hidden rounded-[var(--radius-control)]",
                    "border border-border transition-colors",
                    already
                      ? "cursor-not-allowed opacity-40"
                      : "hover:border-primary/60",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt=""
                    loading="lazy"
                    className="aspect-[3/2] w-full bg-muted object-cover"
                  />
                  {already && (
                    <span className="absolute inset-x-0 bottom-0 bg-card/90 py-0.5 text-center text-[0.625rem] text-muted-foreground">
                      Added
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
