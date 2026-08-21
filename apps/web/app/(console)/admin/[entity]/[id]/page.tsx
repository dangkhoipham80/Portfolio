import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { saveContent } from "@/app/actions/content";
import { EntityForm } from "@/components/console/entity-form";
import { Container } from "@/components/ui/container";
import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { Notice } from "@/components/ui/notice";
import { requireAdmin } from "@/lib/admin-guard";
import { cn } from "@/lib/cn";
import { fetchContentItem } from "@/lib/console-api";
import { entityFor, toValues } from "@/lib/content-schema";

export async function generateMetadata({
  params,
}: PageProps<"/admin/[entity]/[id]">): Promise<Metadata> {
  const spec = entityFor((await params).entity);
  return { title: spec ? `Edit ${spec.singular}` : "Not found" };
}

export default async function EditEntityPage({ params }: PageProps<"/admin/[entity]/[id]">) {
  const { entity, id } = await params;
  const spec = entityFor(entity);
  if (!spec) notFound();

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const { accessToken } = await requireAdmin(`/admin/${spec.key}/${id}`);
  const result = await fetchContentItem(accessToken, spec.apiPath, numericId);

  // A row that is not there is a 404, the same as a bad id. An outage is not:
  // telling the admin their post no longer exists because the backend is asleep
  // would be a lie, and one they might act on.
  if (!result.ok && result.reason === "missing") notFound();

  const title = result.ok ? String(result.data[spec.titleField] ?? "") : "";

  return (
    <Container width="wide" className="py-12 sm:py-16">
      <Link
        href={`/admin/${spec.key}`}
        className={cn(eyebrowClasses, "transition-colors hover:text-primary")}
      >
        ← {spec.plural}
      </Link>

      <Eyebrow className="mt-8">Edit {spec.singular}</Eyebrow>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">
        {title || `Edit ${spec.singular}`}
      </h1>

      {!result.ok ? (
        <Notice className="mt-8">
          This {spec.singular} could not be loaded — the API did not answer.
          Nothing has been lost; reload once it is back.
        </Notice>
      ) : (
        <>
          {typeof result.data.slug === "string" && (
            /*
              Shown, not editable. The API's update schemas carry no `slug`
              on purpose: regenerating one on a title edit silently breaks
              every link already published to it.

              The slug also rides along to the action bar, which repeats it
              beside the live/draft state. That is not a duplicate for its own
              sake: this line scrolls away, and the bar is what stays on screen
              saying which row is about to be written.
            */
            <p className={cn(eyebrowClasses, "mt-3 normal-case tracking-normal")}>
              /{result.data.slug} · fixed at creation
            </p>
          )}

          <EntityForm
            spec={spec}
            mode="edit"
            initial={toValues(spec, result.data)}
            action={saveContent.bind(null, spec.key, numericId)}
            cancelHref={`/admin/${spec.key}`}
            slug={typeof result.data.slug === "string" ? result.data.slug : undefined}
          />
        </>
      )}
    </Container>
  );
}
