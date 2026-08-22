import Image from "next/image";
import type { ComponentType, ReactNode } from "react";

import { isOptimisableImage } from "@/lib/blob";
import { cn } from "@/lib/cn";
import type { MdxComponentName } from "@/lib/mdx-guard";

/**
 * The components a post body may name.
 *
 * The names themselves live in lib/mdx-guard.ts, which holds no React so the
 * security check can be tested without a bundler. The map below is typed
 * `Record<MdxComponentName, …>`, so the two cannot drift: a component added
 * here without being listed there is a compile error, and a name listed there
 * without a component here is the same.
 *
 * ## Why the set is this small
 *
 * Four blocks, chosen because each one is a thing the prose could not say by
 * itself: an aside that is not part of the argument, a picture with a caption,
 * a video, and a warning that has to survive being skimmed. Anything a heading
 * and a paragraph can already do is not here. A vocabulary of four is a
 * vocabulary; a vocabulary of twenty is a framework nobody remembers the
 * syntax of, and the author of these posts is one person writing Markdown.
 *
 * ## Colour
 *
 * The site's rule is that colour never touches text — hue appears only where
 * something is actually happening. `Callout` is the one place here that takes
 * any, and it takes it on a dot beside the label.
 *
 * It was a 2px rule down the left edge first, which is a named AI tell and was
 * caught by the Impeccable detector rather than by review. The dot is both
 * quieter and more consistent: it is exactly what `StatusBadge` already does,
 * and it is never the sole carrier of meaning, because the label says
 * "Warning" in words right beside it.
 */

const EYEBROW = "font-mono text-[0.625rem] uppercase tracking-[0.18em]";

/**
 * A note beside the argument rather than inside it.
 *
 * `kind` decides the rule at the left edge and the word above it. The default
 * is a plain note, which is monochrome — most asides are not warnings, and if
 * every one of them were coloured none of them would read as urgent.
 */
export function Callout({
  kind = "note",
  title,
  children,
}: {
  kind?: "note" | "warning" | "trap";
  title?: string;
  children: ReactNode;
}) {
  // "trap" is its own kind because this blog keeps writing about them — a thing
  // that type-checks, builds, passes review and is still wrong. It is not a
  // warning about what you are about to do; it is a warning about what already
  // happened, so it is marked but not alarmed.
  const dot =
    kind === "warning"
      ? "bg-destructive"
      : kind === "trap"
        ? "bg-live"
        : "border border-muted-foreground/70";

  const label = title ?? (kind === "note" ? "Note" : kind === "warning" ? "Warning" : "Trap");

  return (
    <aside className="my-8 rounded-[var(--radius-card)] border border-border bg-muted/60 px-5 py-4">
      <p className={cn(EYEBROW, "flex items-center gap-2 text-muted-foreground")}>
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
        {label}
      </p>
      {/*
        `[&>*+*]` rather than space-y: the children come from Markdown and are
        whatever the author wrote — paragraphs, a list, a fence — so the rule
        has to be "put a gap between siblings" rather than a class applied to
        each one, which there is no way to do from here.
      */}
      <div className="mt-2 text-sm [&>*+*]:mt-3">{children}</div>
    </aside>
  );
}

/**
 * A picture with something to say about itself.
 *
 * `alt` is required and the type says so: a figure is a content image by
 * definition — it is being pointed at — so there is no decorative case to
 * excuse leaving it out. The caption is separate from the alt text on purpose;
 * one describes the picture to someone who cannot see it, the other says why
 * it is here, and using either for both is how alt text ends up reading as
 * "Figure 3".
 */
export function Figure({
  src,
  alt,
  caption,
  width,
  height,
}: {
  src: string;
  alt: string;
  caption?: string;
  /** Strings, because an MDX attribute is text. Ignored unless both parse. */
  width?: string;
  height?: string;
}) {
  const w = Number(width);
  const h = Number(height);
  const sized = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;

  return (
    <figure className="my-10">
      {isOptimisableImage(src) && sized ? (
        <Image
          src={src}
          alt={alt}
          width={w}
          height={h}
          className="w-full rounded-[var(--radius-card)] border border-border"
        />
      ) : (
        /*
          A plain <img> for anything not in the Blob store, or without
          dimensions. next/image refuses an unlisted host by throwing at render,
          which would take the whole post down for one pasted URL — the same
          reasoning as components/ui/project-media.tsx, and the same rule this
          site applies to every piece of data it does not control.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full rounded-[var(--radius-card)] border border-border"
        />
      )}
      {caption ? (
        <figcaption className="mt-3 text-sm text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

/**
 * Hosts an `<iframe>` in a post body is allowed to point at.
 *
 * An allow-list rather than a scheme check, because an iframe runs whatever is
 * on the other end inside this page's origin's neighbourhood — and the whole
 * reason lib/markdown.ts drops raw HTML is that a post body is not trusted to
 * choose. These three are the ones a technical post actually embeds.
 */
const EMBED_HOSTS: Record<string, (id: string) => string> = {
  youtube: (id) => `https://www.youtube-nocookie.com/embed/${id}`,
  vimeo: (id) => `https://player.vimeo.com/video/${id}`,
  // Asciinema, for terminal recordings — which is most of what this blog would
  // want to show moving.
  asciinema: (id) => `https://asciinema.org/a/${id}/iframe`,
};

/** Ids are opaque handles; anything outside this set is not one. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * An embedded recording.
 *
 * Takes a provider and an id rather than a URL, and that is the security
 * decision rather than a convenience: a URL attribute would mean parsing
 * arbitrary text into an iframe `src`, and every version of that check has a
 * bypass. A provider key and an id matched against `SAFE_ID` cannot express a
 * host at all — this component builds the URL itself.
 */
export function Video({
  provider,
  id,
  title,
}: {
  provider?: string;
  id?: string;
  title?: string;
}) {
  const build = provider ? EMBED_HOSTS[provider] : undefined;

  if (!build || !id || !SAFE_ID.test(id)) {
    return (
      <p className="my-8 rounded-[var(--radius-card)] border border-dashed border-border px-4 py-6 text-center font-mono text-sm text-muted-foreground">
        {/* Says what to fix. An empty space where a video should be tells the
            author nothing, and they are the only person who can correct it. */}
        Video needs a provider of {Object.keys(EMBED_HOSTS).join(", ")} and an id.
      </p>
    );
  }

  return (
    <figure className="my-10">
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
        <iframe
          src={build(id)}
          title={title ?? "Embedded video"}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full"
        />
      </div>
      {title ? (
        <figcaption className="mt-3 text-sm text-muted-foreground">{title}</figcaption>
      ) : null}
    </figure>
  );
}

/**
 * A short remark that is not part of the argument.
 *
 * Distinct from `Callout`: a callout interrupts and expects to be read, an
 * aside is an accompaniment. It is set smaller and rules off rather than
 * boxing, so skimming past it is the intended behaviour.
 */
export function Aside({ children }: { children: ReactNode }) {
  return (
    <aside className="my-8 border-y border-border py-4 text-sm text-muted-foreground [&>*+*]:mt-3">
      {children}
    </aside>
  );
}

/*
 * `satisfies` rather than a type annotation, and that distinction is the whole
 * drift guard.
 *
 * The constraint requires exactly the keys in `MdxComponentName`: a component
 * added here without being listed in lib/mdx-guard.ts is an excess-property
 * error, and a name listed there without a component here is a missing-property
 * one. Annotating the type instead would satisfy the check and then widen each
 * value to the annotation, which is what MDX needs *not* to happen — it calls
 * these with the attributes the author wrote, and the real signatures are what
 * make those an error at the call site rather than at render.
 */
export const MDX_COMPONENTS = {
  Callout,
  Figure,
  Video,
  Aside,
} satisfies Record<MdxComponentName, ComponentType<never>>;
