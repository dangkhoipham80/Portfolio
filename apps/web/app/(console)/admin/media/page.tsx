import type { CSSProperties } from "react";

import type { Metadata } from "next";

import { forgetAsset, saveAltText } from "@/app/actions/media";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { Notice } from "@/components/ui/notice";
import { requireAdmin } from "@/lib/admin-guard";
import { fetchMedia } from "@/lib/console-api";

export const metadata: Metadata = { title: "Media" };

/**
 * Every image that has been uploaded.
 *
 * A grid rather than the row list the content sections use, because the
 * identifying feature of an asset is the picture. A filename in a list column
 * is not something anyone recognises — "screenshot-3-a8f2.png" tells you
 * nothing about which screenshot it is — so the thumbnail has to be the row.
 *
 * There is no upload control here on purpose. Images arrive through the field
 * that is going to use them, which is where you are when you want one; a
 * library you have to visit first, upload into, then navigate away from is two
 * extra steps in service of tidiness. This screen is for finding, describing
 * and removing what already exists.
 */
export default async function MediaPage() {
  const { accessToken } = await requireAdmin("/admin/media");
  const result = await fetchMedia(accessToken, { limit: 200 });

  const assets = result.ok ? result.data : [];
  const undescribed = assets.filter((asset) => !asset.alt).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Media
        </h1>
        {result.ok && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {assets.length} {assets.length === 1 ? "image" : "images"}
              {undescribed > 0 ? ` · ${undescribed} without a description` : ""}
            </p>
            {/*
              Said once here rather than under every card. It was per-card
              first, which put the same three lines on screen six times and
              made the grid look like a form — the explanation is about the
              field in general, and repeating it per instance is how a screen
              fills up with text nobody reads twice.
            */}
            <p className="mt-3 max-w-prose text-sm text-muted-foreground">
              A description says what an image shows, for anyone who cannot see
              it. It belongs to the image rather than to one use of it, so it is
              written once here and inherited everywhere the image appears.
            </p>
          </>
        )}
      </header>

      {!result.ok ? (
        <Notice className="mt-6">
          The library could not be loaded — the API did not answer. Nothing has
          been lost; reload once it is back.
        </Notice>
      ) : assets.length === 0 ? (
        <div className="c-panel mt-6 px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing uploaded yet. Images appear here as soon as you add one to a
            project, a post or a certificate.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset, index) => (
            <li
              key={asset.id}
              className="c-panel c-enter flex flex-col overflow-hidden"
              // Capped at eight: past that the stagger is a wait, not a flourish.
              style={{ "--i": Math.min(index, 8) } as CSSProperties}
            >
              {/*
                A plain <img>, not next/image, for the same reason the upload
                field's preview is one: these URLs are whatever is in the
                bucket, and routing them through the optimiser would mean
                whitelisting hosts. This screen is behind a login and is not
                where loading performance is decided.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.url}
                alt={asset.alt ?? ""}
                // The intrinsic size, so the browser reserves the right box and
                // the grid does not reflow as each image lands. Absent on rows
                // written before dimensions were recorded, hence the fallback
                // aspect ratio below doing the same job.
                width={asset.width ?? undefined}
                height={asset.height ?? undefined}
                loading="lazy"
                className="aspect-[3/2] w-full border-b border-border bg-muted object-cover"
              />

              <div className="flex min-w-0 flex-1 flex-col gap-3 p-3">
                <div className="min-w-0">
                  <p
                    className="truncate font-mono text-xs text-foreground"
                    title={asset.pathname ?? asset.url}
                  >
                    {asset.pathname ?? asset.url}
                  </p>
                  <p className="mt-0.5 font-mono text-[0.6875rem] text-muted-foreground">
                    {describe(asset.width, asset.height, asset.size_bytes)}
                  </p>
                </div>

                {/*
                  Alt text edited in place. It is the only field on an asset a
                  person writes, and sending someone to a detail page to change
                  one line — when the whole point is to sweep a grid describing
                  the ones that have none — would be the wrong shape.
                */}
                <form action={saveAltText.bind(null, asset.id)} className="mt-auto">
                  <label
                    htmlFor={`alt-${asset.id}`}
                    className="text-xs font-medium text-foreground"
                  >
                    Description
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id={`alt-${asset.id}`}
                      name="alt"
                      defaultValue={asset.alt ?? ""}
                      placeholder="No description"
                      className="min-h-11 w-full min-w-0 rounded-[var(--radius-control)] border border-border bg-card px-2.5 py-2 text-xs text-foreground transition-colors placeholder:text-muted-foreground/60 hover:border-primary/40"
                    />
                    <Button
                      variant="quiet"
                      type="submit"
                      className="min-h-11 shrink-0 px-3 py-2 text-xs"
                    >
                      Save
                    </Button>
                  </div>
                </form>

                <div className="flex items-start justify-between gap-2 border-t border-border pt-3">
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Open original
                  </a>

                  <ConfirmDelete
                    action={forgetAsset}
                    id={asset.id}
                    warning="Remove this from the library? The file itself stays online, and anything already using it keeps working."
                    confirmLabel="Remove from library"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "1200 × 900 · 284 KB", skipping whichever half was never recorded. */
function describe(
  width: number | null,
  height: number | null,
  bytes: number | null,
): string {
  const parts: string[] = [];
  if (width && height) parts.push(`${width} × ${height}`);
  if (bytes) parts.push(formatBytes(bytes));
  return parts.join(" · ") || "Size unknown";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
