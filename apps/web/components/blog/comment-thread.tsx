"use client";

// A client component only because a reply form opens and closes, which is
// state. The comments themselves are rendered from props the server fetched.

import { useState } from "react";

import { CommentForm } from "@/components/blog/comment-form";
import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { formatFullDate, isoDay } from "@/lib/format";
import type { PostComment } from "@/lib/types";

/**
 * The comments on a post, as a two-level thread.
 *
 * ## Why only two levels
 *
 * Because there is no third level of indentation available at 375px, and a
 * thread that keeps nesting either runs out of width or stops indenting and
 * stops meaning anything. The API enforces the same rule — a reply to a reply
 * is a 422 — so this is not a display convention the data can violate.
 *
 * ## Why the avatars are initials
 *
 * A comment carries a name and an email and nothing else. Gravatar would turn
 * the address into a request to a third party on every page load, which hands
 * someone else a log of who reads this blog in exchange for a picture nobody
 * asked for. Initials are derived from what is already on screen.
 */
export function CommentThread({
  postId,
  comments,
}: {
  postId: number;
  comments: PostComment[];
}) {
  const [replyingTo, setReplyingTo] = useState<number | null>(null);

  const top = comments.filter((comment) => comment.parent_id === null);
  const repliesFor = (id: number) =>
    comments.filter((comment) => comment.parent_id === id);

  return (
    // Spacing above comes from the grid row it sits in — see the post page.
    <section aria-labelledby="comments-heading">
      <div className="flex items-center gap-4">
        <Eyebrow as="h2" id="comments-heading" className="text-foreground">
          {comments.length === 0
            ? "Comments"
            : `${comments.length} ${comments.length === 1 ? "comment" : "comments"}`}
        </Eyebrow>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>

      {top.length > 0 ? (
        <ul className="mt-6 space-y-8">
          {top.map((comment) => (
            <li key={comment.id}>
              <Comment
                comment={comment}
                onReply={() => setReplyingTo(comment.id)}
                replying={replyingTo === comment.id}
              />

              {repliesFor(comment.id).length > 0 ? (
                <ul className="mt-6 space-y-6 border-l border-border pl-5 sm:pl-8">
                  {repliesFor(comment.id).map((reply) => (
                    <li key={reply.id}>
                      <Comment comment={reply} />
                    </li>
                  ))}
                </ul>
              ) : null}

              {replyingTo === comment.id ? (
                <div className="mt-6 border-l border-border pl-5 sm:pl-8">
                  <CommentForm
                    postId={postId}
                    parentId={comment.id}
                    onDone={() => setReplyingTo(null)}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 max-w-[var(--measure)] text-sm text-muted-foreground">
          {/* An empty state is an invitation, not a status report. */}
          Nothing here yet. If something in this post was wrong, or useful, say so.
        </p>
      )}

      <div className="mt-10 rounded-[var(--radius-card)] border border-border bg-card p-6">
        <Eyebrow className="mb-4">Add a comment</Eyebrow>
        <CommentForm postId={postId} />
        <p className="mt-4 max-w-[var(--measure)] text-xs text-muted-foreground">
          {/*
            Said before submitting, not after. Someone deciding whether to spend
            five minutes writing should know it will not appear immediately.
          */}
          Comments are read before they appear, so there is a wait. Markdown is not
          rendered here — it will show as you typed it.
        </p>
      </div>
    </section>
  );
}

function Comment({
  comment,
  onReply,
  replying,
}: {
  comment: PostComment;
  onReply?: () => void;
  replying?: boolean;
}) {
  const day = isoDay(comment.created_at);

  return (
    <article className="flex gap-4">
      <Monogram name={comment.author_name} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-semibold text-foreground">
            {comment.author_name}
          </span>
          {day ? (
            <time dateTime={day} className={cn(eyebrowClasses, "tracking-normal")}>
              {formatFullDate(comment.created_at)}
            </time>
          ) : null}
        </div>

        {/*
          `whitespace-pre-wrap` and nothing else. The body is plain text and is
          rendered by React, so it is escaped — this is the one place on the
          site where reader-supplied content reaches the page, and it must not
          become a second Markdown pipeline with a second sanitiser to get
          wrong. Paragraph breaks survive; markup does not.
        */}
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>

        {onReply ? (
          <button
            type="button"
            onClick={onReply}
            aria-expanded={replying}
            className={cn(
              eyebrowClasses,
              "mt-3 inline-flex min-h-11 items-center rounded-[var(--radius-control)] transition-colors hover:text-primary lg:min-h-9",
            )}
          >
            Reply
          </button>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Initials on a plain surface.
 *
 * Deliberately not a generated colour per commenter: five commenters would mean
 * five hues nobody chose, on a site whose entire palette is neutrals plus one
 * accent that means "live". Aria-hidden because the name is right beside it.
 */
function Monogram({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden="true"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-pill)] border border-border bg-muted font-mono text-xs text-muted-foreground"
    >
      {initials || "?"}
    </span>
  );
}
