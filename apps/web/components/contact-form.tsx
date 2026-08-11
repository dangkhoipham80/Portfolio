"use client";

/*
 * A client component for three reasons that have no server equivalent:
 * `useActionState` to hold the result of the submission, `useState` for the
 * validation errors raised as you leave a field, and `useRef` to move focus to
 * the first field that needs fixing. None of that can be done in CSS or on the
 * server.
 *
 * The form still posts without JavaScript: `action` is the Server Action
 * itself, not a wrapper, so the browser's native form POST reaches it and the
 * page re-renders with whatever it returned.
 */

import { useActionState, useRef, useState } from "react";

import { submitContact } from "@/app/actions/contact";
import { Button } from "@/components/ui/button";
import { Wire } from "@/components/ui/wire";
import { TextAreaField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import {
  CONTACT_FIELDS,
  CONTACT_LIMITS,
  type ContactErrors,
  type ContactField,
  type ContactState,
  EMPTY_CONTACT,
  INITIAL_CONTACT_STATE,
  OWNER_EMAIL,
  readContactForm,
  validateContact,
} from "@/lib/contact";
import { formatWait } from "@/lib/retry-after";

/**
 * Everything the form has to say lands here, in one place under the fields.
 *
 * Short states get a mono line; the two that need to hand over an alternative
 * route get a bordered notice with the address in it. A toast was the other
 * option and is worse: it disappears, and the two states most worth reading are
 * the two you cannot act on immediately.
 */
function StatusLine({
  state,
  isPending,
  errorCount,
}: {
  state: ContactState;
  isPending: boolean;
  errorCount: number;
}) {
  // Not the uppercase, wide-tracked treatment the eyebrows use. This line
  // carries a route and a verb, and "POST /CONTACTS" reads as shouting rather
  // than as a path. Lower case mono is what a log line looks like, which is
  // what this is.
  const mono = "font-mono text-xs";

  if (isPending) {
    return <p className={`${mono} text-primary`}>sending…</p>;
  }

  if (state.status === "rate_limited") {
    return (
      <Notice>
        Rate limit: five messages an hour from one address. Try again{" "}
        {formatWait(state.retryAfterSeconds)}, or email{" "}
        <MailLink /> — that reaches me directly.
      </Notice>
    );
  }

  if (state.status === "unavailable") {
    return (
      <Notice>
        The server is not reachable, so this message has not been sent. Your text
        is still in the form — try again, or email <MailLink />.
      </Notice>
    );
  }

  if (errorCount > 0) {
    return (
      <p className={`${mono} text-destructive-text`}>
        {errorCount} field{errorCount === 1 ? "" : "s"} {errorCount === 1 ? "needs" : "need"} fixing
      </p>
    );
  }

  // The endpoint this posts to, and the budget, stated up front. It is the one
  // line on the page that says the owner wrote the backend as well as the form.
  return <p className={`${mono} text-muted-foreground`}>POST /contacts · 5 per hour</p>;
}

function MailLink() {
  return (
    <a href={`mailto:${OWNER_EMAIL}`} className="text-primary underline underline-offset-4">
      {OWNER_EMAIL}
    </a>
  );
}

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitContact, INITIAL_CONTACT_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  // Errors raised in the browser. The Server Action's own errors arrive in
  // `state`; both are produced by the same validateContact, so they read alike.
  const [clientErrors, setClientErrors] = useState<ContactErrors>({});

  // The only value tracked in React, because the counter has to show it. The
  // inputs stay uncontrolled so a no-JS post and a JS post behave the same.
  const [messageLength, setMessageLength] = useState(0);

  /*
   * Field errors live in exactly one map, and the Server Action's verdict is
   * folded into it when it arrives rather than being held alongside.
   *
   * Keeping the two separate and merging them at render time does not work in
   * either direction: `{...server, ...client}` means clearing a client error on
   * blur uncovers a stale server one underneath, so a corrected address keeps
   * being told it is wrong; letting the client map win outright means a server
   * error on a field the visitor already blurred — an address that passes the
   * regex here and is refused by email-validator there — is never shown at all,
   * and the submit appears to do nothing.
   */
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    // React's "adjusting state when a prop changes" pattern, done during render
    // rather than in an effect: React re-runs this component immediately and
    // before anything paints, so the errors never flash out of date. An effect
    // here would be a second render pass after paint, and eslint's
    // react-hooks/set-state-in-effect rejects it for that reason.
    setSeenState(state);
    setClientErrors(state.status === "invalid" ? state.errors : {});
  }

  const errors = clientErrors;
  const errorCount = CONTACT_FIELDS.filter((field) => errors[field]).length;

  const previousValues = "values" in state ? state.values : EMPTY_CONTACT;

  /** Re-check one field when it loses focus, but only to clear or set its own error. */
  function handleBlur(field: ContactField, value: string) {
    // Nothing is flagged until the field has been touched and left — validating
    // on every keystroke tells someone their email is invalid while they are
    // still on the first character of it.
    const fieldErrors = validateContact({ ...EMPTY_CONTACT, [field]: value });

    setClientErrors((current) => {
      const next = { ...current };
      // An empty optional-looking field that was never filled should not shout
      // on blur; only flag what was actually typed and is wrong.
      if (value.trim() && fieldErrors[field]) {
        next[field] = fieldErrors[field];
      } else {
        delete next[field];
      }
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const values = readContactForm(new FormData(event.currentTarget));
    const found = validateContact(values);

    if (Object.keys(found).length === 0) {
      setClientErrors({});
      return; // Falls through to the Server Action.
    }

    // Cancelling here stops React from running the form's action, which saves a
    // round trip to be told what the browser already knows.
    event.preventDefault();
    setClientErrors(found);

    // Focus lands on the first thing to fix. Without this the errors appear
    // above the fold for a sighted user and nowhere at all for a keyboard one,
    // whose focus is still sitting on the submit button.
    const firstBad = CONTACT_FIELDS.find((field) => found[field]);
    if (firstBad) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
    }
  }

  if (state.status === "sent") {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-card p-6">
        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
          Message sent
        </h3>
        <p className="mt-2 text-muted-foreground">
          It is in the inbox. I usually reply within a couple of days — if it is
          urgent, <MailLink /> is faster.
        </p>
        {/*
          The confirmation replaces the form rather than appearing beside it, so
          there is no ambiguity about whether the thing was sent. Getting back
          to a blank form is an explicit choice.
        */}
        <Button
          variant="quiet"
          className="mt-5"
          onClick={() => {
            formRef.current?.reset();
            setClientErrors({});
            setMessageLength(0);
            // A full reload is the honest way to clear a useActionState result;
            // there is no reset API, and faking one by remounting leaves the
            // stale state reachable on the next submit.
            window.location.hash = "contact";
            window.location.reload();
          }}
        >
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      // Our own copy names the field and the fix; the browser's bubbles say
      // "Please fill out this field" in the browser's voice, not the site's.
      // The attributes below stay on the inputs regardless — they are what
      // tells assistive tech the field is required.
      noValidate
      className="space-y-5"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="name"
          label="Name"
          required
          maxLength={CONTACT_LIMITS.name}
          autoComplete="name"
          placeholder="Your name"
          defaultValue={previousValues.name}
          error={errors.name}
          onBlur={(event) => handleBlur("name", event.target.value)}
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          required
          maxLength={CONTACT_LIMITS.email}
          autoComplete="email"
          placeholder="you@company.com"
          defaultValue={previousValues.email}
          error={errors.email}
          onBlur={(event) => handleBlur("email", event.target.value)}
        />
      </div>

      <TextField
        name="subject"
        label="Subject"
        required
        maxLength={CONTACT_LIMITS.subject}
        placeholder="What this is about"
        defaultValue={previousValues.subject}
        error={errors.subject}
        onBlur={(event) => handleBlur("subject", event.target.value)}
      />

      <TextAreaField
        name="message"
        label="Message"
        required
        rows={6}
        maxLength={CONTACT_LIMITS.message}
        placeholder="Hello — I am getting in touch about…"
        defaultValue={previousValues.message}
        error={errors.message}
        // The count is on this field alone. It is the only one where the length
        // is a decision the writer is making rather than a limit they will
        // never come close to.
        meta={
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {messageLength} / {CONTACT_LIMITS.message}
          </span>
        }
        onChange={(event) => setMessageLength(event.target.value.length)}
        onBlur={(event) => handleBlur("message", event.target.value)}
      />

      <div className="pt-3">
        <Wire active={isPending} />
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Sending…" : "Send message"}
          </Button>
          {/*
            aria-live so the outcome is announced. `polite` rather than
            `assertive`: it should be read after whatever the user is doing,
            not cut across it.
          */}
          <div aria-live="polite" className="min-w-0 flex-1">
            <StatusLine state={state} isPending={isPending} errorCount={errorCount} />
          </div>
        </div>
      </div>
    </form>
  );
}
