"use client";

// A client component for `useActionState` — the pending state and the
// field-level errors coming back from the action. The form itself is a real
// <form> with a real action, so it still posts with scripting off.

import { useActionState } from "react";

import { submitPostComment } from "@/app/actions/engagement";
import { Notice } from "@/components/ui/notice";
import { eyebrowClasses } from "@/components/ui/eyebrow";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  type CommentState,
  type CommentValues,
  EMPTY_COMMENT,
  INITIAL_COMMENT_STATE,
} from "@/lib/comment-form";

/**
 * Leave a comment, or reply to one.
 *
 * ## What it promises
 *
 * That the comment is queued, and nothing more. Everything a reader submits
 * waits for approval — there is no path in the API that produces an approved
 * comment — so the success message says "waiting to be approved" rather than
 * "posted". Telling someone their words are on the page when they are not is
 * the one thing this form must never do, and it is the mistake almost every
 * moderated comment box makes.
 *
 * ## Why the email field explains itself
 *
 * "Why do you want my email" is the reasonable first thought on a blog with no
 * account system. The hint answers it in the place the question is asked, and
 * the answer is true: it is never published, and the API's public response
 * model cannot express it.
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

  const values = valuesOf(state);
  const errors = state.status === "invalid" ? state.errors : {};

  return (
    <form action={action} className="space-y-4">
      {/*
        noValidate is deliberately absent: the browser's own required/type
        checks are a free first pass, and the server repeats every one of them.
      */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="author_name"
          label="Name"
          defaultValue={values.author_name}
          error={errors.author_name}
          maxLength={80}
          required
        />
        <Field
          name="author_email"
          label="Email"
          type="email"
          defaultValue={values.author_email}
          error={errors.author_email}
          hint="Never published. It is how you get a reply."
          maxLength={255}
          required
        />
      </div>

      <Field
        name="body"
        label={parentId === null ? "Comment" : "Reply"}
        defaultValue={values.body}
        error={errors.body}
        multiline
        maxLength={4000}
        required
      />

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

/** What was typed, kept across a rejection so nothing has to be retyped. */
function valuesOf(state: CommentState): CommentValues {
  return "values" in state ? state.values : EMPTY_COMMENT;
}

function Field({
  name,
  label,
  error,
  hint,
  multiline,
  type = "text",
  ...props
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  multiline?: boolean;
  type?: string;
  defaultValue?: string;
  maxLength?: number;
  required?: boolean;
}) {
  const describedBy = [error ? `${name}-error` : null, hint ? `${name}-hint` : null]
    .filter(Boolean)
    .join(" ");

  const shared = cn(
    "w-full min-h-11 rounded-[var(--radius-control)] border bg-card px-3 py-2.5 text-sm text-foreground",
    "placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    error ? "border-destructive" : "border-border",
  );

  return (
    <div className={multiline ? "sm:col-span-2" : undefined}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {/*
          The marker sits beside the label rather than inside it, so a screen
          reader does not read the field's name as "Name asterisk".
        */}
        {props.required ? (
          <span aria-hidden="true" className="ml-1 text-muted-foreground">
            *
          </span>
        ) : null}
      </label>

      {multiline ? (
        <textarea
          id={name}
          name={name}
          rows={5}
          className={shared}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...props}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          className={shared}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...props}
        />
      )}

      {hint ? (
        <p id={`${name}-hint`} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-destructive-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
