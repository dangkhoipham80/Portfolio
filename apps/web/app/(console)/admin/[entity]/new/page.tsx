import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { saveContent } from "@/app/actions/content";
import { EntityForm } from "@/components/console/entity-form";
import { Container } from "@/components/ui/container";
import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { requireAdmin } from "@/lib/admin-guard";
import { cn } from "@/lib/cn";
import { entityFor, fieldsFor } from "@/lib/content-schema";

export async function generateMetadata({
  params,
}: PageProps<"/admin/[entity]/new">): Promise<Metadata> {
  const spec = entityFor((await params).entity);
  return { title: spec ? `New ${spec.singular}` : "Not found" };
}

export default async function NewEntityPage({ params }: PageProps<"/admin/[entity]/new">) {
  const { entity } = await params;
  const spec = entityFor(entity);
  if (!spec) notFound();

  await requireAdmin(`/admin/${spec.key}/new`);

  // Every field starts empty rather than at the API's defaults. A checkbox
  // pre-ticked as published would mean a slip of the mouse puts an unfinished
  // row on the public site; unpublished is the safe direction, and it is also
  // what the API's own default is.
  const initial = Object.fromEntries(
    fieldsFor(spec, "create").map((field) => [field.name, ""]),
  );

  return (
    <Container width="wide" className="py-12 sm:py-16">
      <Link
        href={`/admin/${spec.key}`}
        className={cn(eyebrowClasses, "transition-colors hover:text-primary")}
      >
        ← {spec.plural}
      </Link>

      <Eyebrow className="mt-8">New</Eyebrow>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">
        New {spec.singular}
      </h1>

      <EntityForm
        spec={spec}
        mode="create"
        initial={initial}
        // Bound here, on the server: the form posts no field that decides what
        // gets written or where.
        action={saveContent.bind(null, spec.key, null)}
        cancelHref={`/admin/${spec.key}`}
      />
    </Container>
  );
}
