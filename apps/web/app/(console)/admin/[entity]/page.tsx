import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { removeContent, togglePublished } from "@/app/actions/content";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { Container } from "@/components/ui/container";
import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
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
  const drafts = spec.publishable
    ? rows.filter((row) => row.published !== true).length
    : 0;

  return (
    <Container width="wide" className="py-12 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>{spec.plural}</Eyebrow>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">
            {spec.plural}
          </h1>
          {result.ok && (
            <p className={cn(eyebrowClasses, "mt-3")}>
              {rows.length} {rows.length === 1 ? "row" : "rows"}
              {spec.publishable ? ` · ${drafts} draft${drafts === 1 ? "" : "s"}` : ""}
            </p>
          )}
        </div>

        <Link href={`/admin/${spec.key}/new`} className={buttonClasses()}>
          New {spec.singular}
        </Link>
      </div>

      {problem && <Notice className="mt-8 border-destructive/50">{problem}</Notice>}

      {!result.ok ? (
        /*
          Surfaced, not swallowed — as in the inbox. The public site hides a
          failed read behind an empty fallback so a sleeping backend cannot take
          it down; here that would draw "the API is unreachable" and "you have
          not written anything yet" as the same picture.
        */
        <Notice className="mt-8">
          These {spec.plural.toLowerCase()} could not be loaded — the API did not
          answer. Nothing has been lost; reload once it is back.
        </Notice>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          No {spec.plural.toLowerCase()} yet. Create the first one.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {rows.map((row) => {
            const id = Number(row.id);
            const title = String(row[spec.titleField] ?? "Untitled");
            const subtitle = spec.subtitleField ? row[spec.subtitleField] : null;
            const published = row.published === true;

            return (
              <li key={id}>
                <Card className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="font-display font-semibold text-foreground">
                        {title}
                      </h2>
                      {/*
                        Only drafts are badged. A "Published" badge on every row
                        is a badge that says nothing — the state worth spotting
                        at a glance is the one that is invisible to the public.
                      */}
                      {spec.publishable && !published && (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </div>

                    {typeof subtitle === "string" && subtitle && (
                      // line-clamp so a long description cannot turn one row
                      // into half a screen.
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {subtitle}
                      </p>
                    )}

                    {typeof row.slug === "string" && (
                      /*
                        normal-case, unlike every other eyebrow: this is a URL,
                        and URLs are case-significant. Rendered in the eyebrow's
                        uppercase it read as /CENEMATIC, which is not the
                        address and is not what anyone should copy.
                      */
                      <p className={cn(eyebrowClasses, "mt-2 normal-case tracking-normal")}>
                        /{row.slug}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-start gap-2">
                    <Link
                      href={`/admin/${spec.key}/${id}`}
                      className={buttonClasses("quiet", "min-h-11 px-4 py-2 text-xs")}
                    >
                      Edit
                    </Link>

                    {spec.publishable && (
                      <form action={togglePublished.bind(null, spec.key)}>
                        <input type="hidden" name="id" value={id} />
                        {/* The state being moved *to*, so the button's label and
                            what it sends cannot drift apart. */}
                        <input
                          type="hidden"
                          name="published"
                          value={published ? "false" : "true"}
                        />
                        <Button
                          variant="quiet"
                          type="submit"
                          className="min-h-11 px-4 py-2 text-xs"
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
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
