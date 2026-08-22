import Image from "next/image";

import { Eyebrow } from "@/components/ui/eyebrow";
import { isOptimisableImage } from "@/lib/blob";
import type { GalleryImage } from "@/lib/types";

/**
 * The screenshots under a project's write-up.
 *
 * ## A column, not a carousel
 *
 * A carousel hides all but one image behind a control nobody presses, and it
 * needs JavaScript to show the second one. These are screenshots of software —
 * the whole argument the page is making — so they are stacked full width in the
 * reading column at the size they were captured, in the order the admin chose.
 * Scrolling is the interaction. There is nothing to learn and nothing to click.
 *
 * ## The captions
 *
 * The visible caption and the alt text are the same sentence, which is
 * deliberate and is the reason there is only one field for it. A screenshot's
 * description — "the console's edit form, grouped into bands" — is equally
 * useful read aloud and read underneath, and maintaining two strings produces
 * one good one and one stale one. Where they must not be duplicated is to a
 * screen reader, which would otherwise hear it twice: the `<img>` carries the
 * text and the `<figcaption>` is hidden from the accessibility tree.
 *
 * An image with no description gets `alt=""` and no caption. That is the
 * correct outcome rather than a gap — an undescribed screenshot in a stack of
 * described ones is decorative as far as anyone listening is concerned, and
 * inventing "Screenshot 3" from the index tells them nothing at all.
 */
export function ProjectGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  if (images.length === 0) return null;

  return (
    <section className="mt-12">
      <Eyebrow as="h2">Screens</Eyebrow>

      <ul className="mt-4 flex flex-col gap-8">
        {images.map((image) => (
          <li key={image.url}>
            <figure>
              {/*
                Three cases, and the first two are not interchangeable.

                `isOptimisableImage` is asked before next/image is handed
                anything, for the reason lib/blob.ts documents: a gallery URL is
                free text, and next/image on an unlisted host does not degrade —
                it throws at render and takes the whole project page with it.
                An image pasted from somewhere else gets a plain <img>, which is
                exactly what the console's previews use and is correct here too.

                Given an allowed host, intrinsic dimensions are used when the
                library recorded them, so the box is reserved and nothing below
                shifts as each one decodes. Without them a 3:2 `fill` box costs
                a crop and keeps the layout stable, which is the right way
                round.
              */}
              {!isOptimisableImage(image.url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.url}
                  alt={image.alt ?? ""}
                  width={image.width ?? undefined}
                  height={image.height ?? undefined}
                  loading="lazy"
                  className="w-full rounded-[var(--radius-card)] border border-border bg-muted"
                />
              ) : image.width && image.height ? (
                <Image
                  src={image.url}
                  alt={image.alt ?? ""}
                  width={image.width}
                  height={image.height}
                  sizes="(min-width: 768px) 42rem, 100vw"
                  className="w-full rounded-[var(--radius-card)] border border-border bg-muted"
                />
              ) : (
                <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted">
                  <Image
                    src={image.url}
                    alt={image.alt ?? ""}
                    fill
                    sizes="(min-width: 768px) 42rem, 100vw"
                    className="object-cover"
                  />
                </div>
              )}

              {image.alt ? (
                <figcaption
                  // Hidden from the accessibility tree because the <img> above
                  // already carries this exact sentence as its alt text.
                  aria-hidden="true"
                  className="mt-2 text-sm text-muted-foreground"
                >
                  {image.alt}
                </figcaption>
              ) : null}
            </figure>
          </li>
        ))}
      </ul>

      {/* Named for anyone arriving here from a search result mid-page. */}
      <p className="sr-only">{`Screenshots of ${title}.`}</p>
    </section>
  );
}
