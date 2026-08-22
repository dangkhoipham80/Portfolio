import type { Metadata } from "next";
import Link from "next/link";

import { removeComment, setCommentStatus } from "@/app/actions/comments";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { Container } from "@/components/ui/container";
import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { Notice } from "@/components/ui/notice";
import { requireAdmin } from "@/lib/admin-guard";
import { cn } from "@/lib/cn";
import { type CommentRow, fetchComments } from "@/lib/console-api";
import { formatFullDate, isoDay } from "@/lib/format";

export const metadata: Metadata = { title: "Comments" };

/**
 * The moderation queue.
 *
 * ## Why pending is the whole page, and the rest is below it
 *
 * A queue is a worklist. Everything that needs a decision is at the top,
 * newest first, and once decided it drops out of that list — so an empty top
 * section means there is nothing to do, which is the one thing a moderation
 * screen should be able to say at a glance.
 *
 * ## Why rejected comments are kept
 *
 * Deleting is a separate, explicit action. Rejection keeps the row, so the same
 * spam arriving again is recognisable in the queue instead of looking new — and
 * so a comment rejected in haste can still be read.
 */

const PROBLEMS: Record<string, string> = {
  "unknown-row": "That request did not name a comment, so nothing changed.",
  "not-saved": "The status was not changed — the API did not answer. Try again.",
  "not-deleted": "That comment was not deleted — the API did not answer. It is still here.",
  "already-gone": "That comment had already been deleted, so nothing changed.",
  "session-ended": "Your session ended before that went through. Sign in again to repeat it.",
};

export default async function CommentsPage({ searchParams }: PageProps<"/admin/comments">) {
  const { accessToken } = await requireAdmin("/admin/comments");
  const result = await fetchComments(accessToken);

  const raw = (await searchParams).problem;
  const key = Array.isArray(raw) ? raw[0] : raw;
  // Anything unrecognised is dropped rather than echoed: the value comes from
  // the URL, and a page that prints it prints text chosen by whoever wrote the
  // link.
  const problem = key && key in PROBLEMS ? PROBLEMS[key] : null;

  const all = result.ok ? result.data : [];
  const pending = all.filter((comment) => comment.status === "pending");
  const decided = all.filter((comment) => comment.status !== "pending");

  return (
    <Container width="wide" className="py-12 sm:py-16">
      <Eyebrow>{pending.length} waiting</Eyebrow>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">
        Comments
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Nothing a reader writes appears on the site until it is approved here.
      </p>

      {problem ? <Notice tone="error" className="mt-6">{problem}</Notice> : null}

      {!result.ok ? (
        <Notice tone="error" className="mt-6">
          The queue could not be loaded — the API did not answer. Nothing has been
          approved or rejected; reload to try again.
        </Notice>
      ) : null}

      <section className="mt-10" aria-labelledby="waiting-heading">
        <div className="flex items-center gap-4">
          <Eyebrow as="h2" id="waiting-heading" className="text-foreground">
            Waiting
          </Eyebrow>
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>

        {pending.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {/* The good state, said plainly rather than as an empty box. */}
            Nothing is waiting. Approved comments are live on their posts.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {pending.map((comment) => (
              <li key={comment.id}>
                <Comment comment={comment} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 ? (
        <section className="mt-12" aria-labelledby="decided-heading">
          <div className="flex items-center gap-4">
            <Eyebrow as="h2" id="decided-heading" className="text-foreground">
              Already decided
            </Eyebrow>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>

          <ul className="mt-4 space-y-4">
            {decided.map((comment) => (
              <li key={comment.id}>
                <Comment comment={comment} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}

function Comment({ comment }: { comment: CommentRow }) {
  const day = isoDay(comment.created_at);

  return (
    <article className="rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-foreground">{comment.author_name}</span>
        {/*
          The address is here and nowhere else on the site — it is how the owner
          replies, and the public response model cannot express it.
        */}
        <span className={cn(eyebrowClasses, "normal-case tracking-normal")}>
          {comment.author_email}
        </span>
        {day ? (
          <time dateTime={day} className={cn(eyebrowClasses, "tracking-normal")}>
            {formatFullDate(comment.created_at)}
          </time>
        ) : null}
        <StatusMark status={comment.status} />
      </div>

      {comment.post_slug ? (
        <p className="mt-1">
          {/*
            Set as a link rather than in the eyebrow's uppercase mono. It sat
            under the author's name in exactly the treatment this console uses
            for field labels, so a post title read as a label — and a shouted
            one at that.
          */}
          <Link
            href={`/blog/${comment.post_slug}`}
            className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            on {comment.post_title ?? comment.post_slug}
          </Link>
        </p>
      ) : null}

      {comment.parent_id ? (
        <p className={cn(eyebrowClasses, "mt-1")}>reply</p>
      ) : null}

      {/*
        `whitespace-pre-wrap` and React's own escaping, exactly as on the public
        thread. A comment is the one text on this site written by a stranger,
        and the moderation screen must not be the place that renders it as
        markup.
      */}
      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {comment.status !== "approved" ? (
          <Decision id={comment.id} status="approved" label="Approve" />
        ) : null}
        {comment.status !== "rejected" ? (
          <Decision id={comment.id} status="rejected" label="Reject" />
        ) : null}

        {/*
          Deleting takes any replies with it, which is why it is behind the same
          two-step confirmation the rest of the console uses rather than being a
          third button in this row.
        */}
        <div className="ms-auto">
          <ConfirmDelete
            action={removeComment}
            id={comment.id}
            warning={
              comment.parent_id === null
                ? `this comment from ${comment.author_name}, and any replies to it`
                : `this reply from ${comment.author_name}`
            }
          />
        </div>
      </div>
    </article>
  );
}

function Decision({
  id,
  status,
  label,
}: {
  id: number;
  status: "approved" | "rejected";
  label: string;
}) {
  return (
    <form action={setCommentStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {label}
      </button>
    </form>
  );
}

/**
 * Where a comment stands, as a dot plus a word.
 *
 * The same encoding the rest of the console uses for publish state, and for the
 * same reasons: it survives greyscale, it survives not being able to separate
 * red from green, and the word beside it means the dot is never carrying the
 * meaning alone.
 */
function StatusMark({ status }: { status: CommentRow["status"] }) {
  if (status === "pending") return null;

  return (
    <span className={cn(eyebrowClasses, "inline-flex items-center gap-2")}>
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "approved" ? "c-dot c-dot-live" : "bg-muted-foreground/50",
        )}
      />
      {status === "approved" ? "Live" : "Rejected"}
    </span>
  );
}
