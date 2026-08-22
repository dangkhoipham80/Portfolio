import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { restorePostRevision } from "@/app/actions/revisions";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { Notice } from "@/components/ui/notice";
import { requireAdmin } from "@/lib/admin-guard";
import { cn } from "@/lib/cn";
import { fetchContentItem, fetchRevisions, type RevisionRow } from "@/lib/console-api";
import { formatFullDate, isoDay } from "@/lib/format";

export const metadata: Metadata = { title: "History" };

/**
 * Every version a post has left behind.
 *
 * ## What a revision holds, and what it does not
 *
 * The fields a person writes: title, excerpt, body, format and the tags at the
 * time. Not `published` and not `published_at` — restoring an old body must not
 * silently unpublish a post or move a date already sitting in someone's feed
 * reader.
 *
 * ## Why revision *n* is the state the post left
 *
 * The API snapshots before it overwrites, so the newest revision is the version
 * immediately before the current one, and there is no revision for the present
 * because the post itself is it. That ordering is what makes "restore" mean
 * "put it back the way it was at this point" rather than "apply this version",
 * which are the same thing only if you already know which way the list runs.
 */

const PROBLEMS: Record<string, string> = {
  "unknown-row": "That request did not name a revision, so nothing changed.",
  "already-gone": "That revision no longer exists. The list below is current.",
  "not-restored": "Nothing was restored — the API did not answer. The post is unchanged.",
  "session-ended": "Your session ended before that went through. Sign in again to repeat it.",
};

export default async function HistoryPage({
  params,
  searchParams,
}: PageProps<"/admin/posts/[id]/history">) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) notFound();

  const { accessToken } = await requireAdmin(`/admin/posts/${postId}/history`);

  const [post, revisions] = await Promise.all([
    fetchContentItem(accessToken, "/posts/", postId),
    fetchRevisions(accessToken, postId),
  ]);

  if (!post.ok && post.reason === "missing") notFound();

  const raw = (await searchParams).problem;
  const key = Array.isArray(raw) ? raw[0] : raw;
  // Unrecognised values are dropped rather than echoed: this comes from the URL.
  const problem = key && key in PROBLEMS ? PROBLEMS[key] : null;

  const title = post.ok && typeof post.data.title === "string" ? post.data.title : `Post ${postId}`;
  const entries = revisions.ok ? revisions.data : [];

  return (
    <Container width="wide" className="py-12 sm:py-16">
      <Link
        href={`/admin/posts/${postId}`}
        className={cn(eyebrowClasses, "transition-colors hover:text-primary")}
      >
        ← Back to the post
      </Link>

      <Eyebrow className="mt-8">
        {entries.length} {entries.length === 1 ? "earlier version" : "earlier versions"}
      </Eyebrow>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        A version is kept every time the title, excerpt, body, format or tags
        change. Publishing and unpublishing are not edits and are not recorded.
      </p>

      {problem ? <Notice tone="error" className="mt-6">{problem}</Notice> : null}

      {!revisions.ok ? (
        <Notice tone="error" className="mt-6">
          The history could not be loaded — the API did not answer. The post
          itself is unaffected; reload to try again.
        </Notice>
      ) : entries.length === 0 ? (
        <Notice className="mt-6">
          {/* Not an error: a post that has never been edited has no history. */}
          Nothing yet. The first edit to this post will leave a version here.
        </Notice>
      ) : (
        <ul className="mt-8 space-y-4">
          {entries.map((revision, index) => (
            <li key={revision.id}>
              <Revision
                revision={revision}
                postId={postId}
                // The first entry is the version immediately before the one that
                // is live, which is worth saying — it is the one "undo" means.
                latest={index === 0}
              />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

function Revision({
  revision,
  postId,
  latest,
}: {
  revision: RevisionRow;
  postId: number;
  latest: boolean;
}) {
  const day = isoDay(revision.created_at);

  return (
    <article className="rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {day ? (
          <time dateTime={day} className={cn(eyebrowClasses, "tracking-normal text-foreground")}>
            {formatFullDate(revision.created_at)}
          </time>
        ) : null}
        {latest ? <Eyebrow>Most recent</Eyebrow> : null}
        <Eyebrow>{revision.format}</Eyebrow>
      </div>

      <p className="mt-2 text-sm font-medium text-foreground">{revision.title}</p>

      {revision.note ? (
        <p className="mt-1 text-sm text-muted-foreground">{revision.note}</p>
      ) : null}

      {revision.tag_slugs.length > 0 ? (
        <p className={cn(eyebrowClasses, "mt-2")}>{revision.tag_slugs.join(" · ")}</p>
      ) : null}

      {/*
        The opening of the body, not the whole thing and not a diff.

        A real diff is the obvious thing to want here and is deliberately not
        built: it needs a diffing library, a decision about word versus line
        granularity, and a way to render two thousand lines of Markdown side by
        side on a screen that also has to work at 375px. What actually answers
        "is this the one I want" is the date, the note and the first paragraph —
        and if it is not, restoring is one click and undoing it is one more.
      */}
      <p className="mt-3 line-clamp-3 whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
        {revision.body.slice(0, 400)}
      </p>

      <form action={restorePostRevision.bind(null, postId)} className="mt-4">
        <input type="hidden" name="revision_id" value={revision.id} />
        <Button type="submit" variant="quiet">
          Restore this version
        </Button>
      </form>
    </article>
  );
}
