import type { CSSProperties } from "react";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { removeContent, togglePublished } from "@/app/actions/content";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { Notice } from "@/components/ui/notice";
import { requireAdmin } from "@/lib/admin-guard";
import { cn } from "@/lib/cn";
import { fetchContentList } from "@/lib/console-api";
import { ENTITIES, entityFor, listProblem } from "@/lib/content-schema";

/**
 * One list screen for all five content types.
 *
 * The route is `[entity]` rather than five folders because the screens differ
 * only in which fields they show, and lib/content-schema.ts already holds that.
 * An unrecognised segment is a 404 — the entity is looked up in ENTITIES and
 * never taken from the URL as a path.
 */

/** Only these five segments exist; anything else 404s rather than rendering. */
export function generateStaticParams() {
  return ENTITIES.map((entity) => ({ entity: entity.key }));
}

export async function generateMetadata({
  params,
}: PageProps<"/admin/[entity]">): Promise<Metadata> {
  const spec = entityFor((await params).entity);
  return { title: spec ? spec.plural : "Not found" };
}

export default async function EntityListPage({
  params,
  searchParams,
}: PageProps<"/admin/[entity]">) {
  const { entity } = await params;
  const spec = entityFor(entity);
  if (!spec) notFound();

  const { accessToken } = await requireAdmin(`/admin/${spec.key}`);
  const result = await fetchContentList(accessToken, spec.apiPath);
  const problem = listProblem((await searchParams).problem);

  const rows = result.ok ? result.data : [];
  const drafts = spec.publishable ? rows.filter((row) => row.published !== true).length : 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {/* No eyebrow above it: the sidebar already says which section this
              is, and repeating it is the kind of chrome that made the old
              screens feel padded out. */}
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {spec.plural}
          </h1>
          {result.ok && (
            <p className="mt-1 text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "item" : "items"}
              {spec.publishable && drafts > 0 ? ` · ${drafts} draft${drafts === 1 ? "" : "s"}` : ""}
            </p>
          )}
        </div>

        <Link href={`/admin/${spec.key}/new`} className={buttonClasses("primary")}>
          New {spec.singular}
        </Link>
      </header>

      {problem && <Notice className="mt-6 border-destructive/50">{problem}</Notice>}

      {!result.ok ? (
        /*
          Surfaced, not swallowed. The public site hides a failed read behind an
          empty fallback so a sleeping backend cannot take it down; here that
          would draw "the API is unreachable" and "you have not written anything
          yet" as the same picture, and the second reads as working.
        */
        <Notice className="mt-6">
          These {spec.plural.toLowerCase()} could not be loaded — the API did not
          answer. Nothing has been lost; reload once it is back.
        </Notice>
      ) : rows.length === 0 ? (
        <div className="c-panel mt-6 px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            No {spec.plural.toLowerCase()} yet.
          </p>
          <Link
            href={`/admin/${spec.key}/new`}
            className={buttonClasses("quiet", "mt-4")}
          >
            Create the first one
          </Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {rows.map((row, index) => {
            const id = Number(row.id);
            const title = String(row[spec.titleField] ?? "Untitled");
            const subtitle = spec.subtitleField ? row[spec.subtitleField] : null;
            const published = row.published === true;

            return (
              <li
                key={id}
                className="c-panel c-row c-enter relative flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-4 py-3.5"
                // Capped at eight: past that the stagger is a wait, not a flourish.
                style={{ "--i": Math.min(index, 8) } as CSSProperties}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {spec.publishable && (
                      // Dot plus word. The dot is what you scan a column for;
                      // the word is what makes it mean anything to a screen
                      // reader, and to anyone who does not read this colour.
                      <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
                        <span
                          aria-hidden="true"
                          className={cn("c-dot", published ? "c-dot-live" : "c-dot-draft")}
                        />
                        {published ? "Live" : "Draft"}
                      </span>
                    )}

                    <h2 className="min-w-0 font-medium text-foreground">
                      {/*
                        The title is the way in to the editor, so the row needs
                        no Edit button — three equal-weight buttons per row was
                        fifteen buttons on a five-row screen. The label names
                        the action for anyone who cannot see that convention.
                      */}
                      <Link
                        href={`/admin/${spec.key}/${id}`}
                        aria-label={`Edit ${title}`}
                        // Stretched over the row, as on a project card: the
                        // title alone was a 21px-tall target, and the whole row
                        // is what looks clickable anyway.
                        className="truncate transition-colors after:absolute after:inset-0 hover:text-primary"
                      >
                        {title}
                      </Link>
                    </h2>
                  </div>

                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {typeof row.slug === "string" && (
                      // normal case, unlike the site's eyebrows: this is a URL,
                      // and URLs are case-significant.
                      <span className="font-mono text-xs text-muted-foreground/80">
                        /{row.slug}
                      </span>
                    )}
                    {typeof row.slug === "string" && typeof subtitle === "string" && subtitle
                      ? " · "
                      : ""}
                    {typeof subtitle === "string" ? subtitle : ""}
                  </p>
                </div>

                {/* items-start: the delete control grows downwards when opened. */}
                {/* Above the stretched link, so these stay independently clickable. */}
                <div className="relative z-10 flex shrink-0 items-start gap-2">
                  {spec.publishable && (
                    <form action={togglePublished.bind(null, spec.key)}>
                      <input type="hidden" name="id" value={id} />
                      {/* The state being moved *to*, so the label and what it
                          sends cannot drift apart. */}
                      <input
                        type="hidden"
                        name="published"
                        value={published ? "false" : "true"}
                      />
                      <Button
                        variant="quiet"
                        type="submit"
                        className="min-h-11 px-3 py-2 text-xs"
                      >
                        {published ? "Unpublish" : "Publish"}
                      </Button>
                    </form>
                  )}

                  <ConfirmDelete
                    action={removeContent.bind(null, spec.key)}
                    id={id}
                    warning={`Delete “${title}”? This cannot be undone.`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
