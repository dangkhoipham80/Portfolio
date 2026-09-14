"use client";

// A client component for `useActionState` — the pending state and the
// field-level errors coming back from the action — and for `useViewer`, since
// who is signed in is a fact about a cookie and this page is prerendered. The
// form itself is a real <form> with a real action, so it still posts with
// scripting off.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState } from "react";

import { resendVerificationEmail } from "@/app/actions/auth";
import { submitPostComment } from "@/app/actions/engagement";
import { buttonClasses } from "@/components/ui/button";
import { eyebrowClasses } from "@/components/ui/eyebrow";
import { Notice } from "@/components/ui/notice";
import { TextAreaField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  type CommentState,
  type CommentValues,
  EMPTY_COMMENT,
  INITIAL_COMMENT_STATE,
} from "@/lib/comment-form";
import { type ResendState, INITIAL_RESEND_STATE } from "@/lib/verify-email";
import { useViewer } from "@/lib/viewer-store";

/**
 * Leave a comment, or reply to one.
 *
 * ## What it promises
 *
 * That the comment is queued, and nothing more. Everything submitted waits for
 * approval — there is no path in the API that produces an approved comment — so
 * the success message says "waiting to be approved" rather than "posted".
 * Telling someone their words are on the page when they are not is the one
 * thing this form must never do, and it is the mistake almost every moderated
 * comment box makes.
 *
 * ## Why there is no name and no email field
 *
 * Because there is nothing to ask. A comment is signed by the account that
 * posted it: the API reads the name and the address off the bearer token and
 * its request schema has no field for either, so a form collecting them would
 * be collecting values nothing reads.
 *
 * That is also the whole of the answer for the owner. An admin reading their
 * own site is signed in like anybody else, so their comment carries their
 * account's name without a box to type it into and without a second path that
 * would let one be typed. There is no "post as" control here, because there is
 * no choice to make.
 *
 * ## The three states before the textarea
 *
 * Signed out, unconfirmed, and ready. They are separated because the remedies
 * are different and only one of them is "sign in" — someone whose address is
 * unconfirmed can sign in all day and still not be able to post, which is
 * exactly the confusion a single "you must be logged in" produces.
 */
export function CommentForm({
  postId,
  parentId = null,
  onDone,
}: {
  postId: number;
  /** Set when this is a reply, which threads it under that comment. */
  parentId?: number | null;
  /** Lets a reply form close itself once the comment is away. */
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(
    submitPostComment.bind(null, postId, parentId),
    INITIAL_COMMENT_STATE,
  );
  const { status, viewer } = useViewer();
  const pathname = usePathname();

  if (state.status === "queued") {
    return (
      <div className="space-y-3">
        <Notice tone="success">
          Thanks — your comment is waiting to be approved. It will appear here once
          it has been.
        </Notice>
        {onDone ? (
          <button type="button" onClick={onDone} className={cn(eyebrowClasses, "hover:text-primary")}>
            Close
          </button>
        ) : null}
      </div>
    );
  }

  // While the session is still unknown the form renders as normal. It is the
  // less annoying way to be briefly wrong: somebody who is signed in can start
  // typing straight away, and somebody who is not meets the panel below a
  // moment later rather than a disabled box that never explains itself.
  if (status === "ready" && !viewer) {
    return <SignInFirst pathname={pathname} onDone={onDone} />;
  }

  if (status === "ready" && viewer && !viewer.isVerified) {
    return <ConfirmFirst email={viewer.email} onDone={onDone} />;
  }

  const values = valuesOf(state);
  const errors = state.status === "invalid" ? state.errors : {};

  return (
    <form action={action} className="space-y-4">
      {viewer ? (
        // Who this will be signed by, said before it is written rather than
        // discovered afterwards. A form with no name field has to say whose
        // name is going on it.
        <p className={eyebrowClasses}>Commenting as {viewer.name}</p>
      ) : null}

      {/*
        noValidate is deliberately absent: the browser's own required check is a
        free first pass, and the server repeats it.
      */}
      <TextAreaField
        name="body"
        label={parentId === null ? "Comment" : "Reply"}
        defaultValue={values.body}
        error={errors.body}
        rows={5}
        maxLength={4000}
        required
      />

      {state.status === "unauthorised" ? (
        <Notice tone="error">
          {/* The API's own sentence — it is written for a reader, and it is the
              one thing that knows which of the two refusals this is. The session
              was live when the form rendered, so this is the case where it
              stopped being live while somebody was typing. */}
          {state.message}{" "}
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="underline underline-offset-4"
          >
            Sign in again
          </Link>
        </Notice>
      ) : null}

      {state.status === "rejected" ? <Notice tone="error">{state.message}</Notice> : null}

      {state.status === "rate_limited" ? (
        <Notice tone="error">
          {/*
            Says when, not just that. The window is an hour, so "try again
            later" leaves someone refreshing to find out.
          */}
          That is enough comments for now.{" "}
          {state.retryAfter
            ? `Try again in about ${Math.ceil(state.retryAfter / 60)} minutes.`
            : "Try again a little later."}
        </Notice>
      ) : null}

      {state.status === "unavailable" ? (
        <Notice tone="error">
          Your comment was not saved — the server did not answer. Nothing was lost;
          try again in a moment.
        </Notice>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClasses("primary")}>
          {pending ? "Sending…" : parentId === null ? "Post comment" : "Post reply"}
        </button>
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className={buttonClasses("quiet")}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** Signed out: there is nothing to type into yet. */
function SignInFirst({
  pathname,
  onDone,
}: {
  pathname: string;
  onDone?: () => void;
}) {
  const next = `?next=${encodeURIComponent(pathname)}`;

  return (
    <div className="space-y-4">
      <p className="max-w-[var(--measure)] text-sm text-muted-foreground">
        {/* What it buys them, not what the system requires. A comment signed by
            a confirmed address is the reason the rule exists — anyone could
            sign one with anyone's name before. */}
        Comments are signed by the account that writes them, so a name here is a
        fact rather than a claim.
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link href={`/login${next}`} className={buttonClasses("primary")}>
          Sign in to comment
        </Link>
        {/*
          A link rather than a second button. On a gated post this panel sits a
          few hundred pixels below the gate, which already offers both as
          buttons — two identical pairs on one screen reads as the page asking
          twice. One action here, and the other way in still within reach.
        */}
        <Link
          href={`/join${next}`}
          className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
        >
          or create an account
        </Link>
        {onDone ? (
          <button type="button" onClick={onDone} className={buttonClasses("quiet")}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Signed in, address unconfirmed.
 *
 * The remedy is not "sign in" — they already have — so this offers the one
 * thing that will actually help: another link. The address is never sent from
 * here; the action reads it from the session, because a Server Action is an
 * endpoint the browser can reach directly and one that took an address would be
 * a way to mail anybody on request.
 */
function ConfirmFirst({ email, onDone }: { email: string; onDone?: () => void }) {
  const [sent, resend, pending] = useActionState<ResendState>(
    resendVerificationEmail,
    INITIAL_RESEND_STATE,
  );

  return (
    <div className="space-y-4">
      {sent.status === "sent" ? (
        <Notice tone="success">
          On its way to {email}. Open the link, then come back and post.
        </Notice>
      ) : sent.status === "rate_limited" ? (
        <Notice tone="error">
          That is several links in an hour. Check the inbox — and the spam folder
          — for one that already arrived.
        </Notice>
      ) : sent.status === "unavailable" ? (
        <Notice tone="error">
          The API is not reachable, so no link was sent. Try again shortly.
        </Notice>
      ) : (
        <Notice>
          Confirm {email} before commenting. A link was mailed when the account
          was created.
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {sent.status === "sent" ? null : (
          // A real form posting a Server Action, so it is a POST and works
          // without JavaScript — the same arrangement as signing out.
          <form action={resend}>
            <button type="submit" disabled={pending} className={buttonClasses("quiet")}>
              {pending ? "Sending…" : "Send it again"}
            </button>
          </form>
        )}
        {onDone ? (
          <button type="button" onClick={onDone} className={buttonClasses("quiet")}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** What was typed, kept across a rejection so nothing has to be retyped. */
function valuesOf(state: CommentState): CommentValues {
  return "values" in state ? state.values : EMPTY_COMMENT;
}
