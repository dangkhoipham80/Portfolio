"use client";

// A client component for `useActionState` — the pending state and the verdict.
// The form is a real <form> with a real action, so the link still works with
// JavaScript off.

import Link from "next/link";
import { useActionState } from "react";

import { confirmEmail } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Wire } from "@/components/ui/wire";
import { INITIAL_VERIFY_STATE } from "@/lib/verify-email";

/**
 * Spend a verification link.
 *
 * One button and four outcomes. The interesting one is `token_rejected`, which
 * covers both "already used" and "expired" and deliberately does not try to
 * tell them apart: the API answers the same way to each, and guessing would
 * mean telling somebody their link expired when in fact they had already
 * confirmed and could simply sign in. The sentence covers both and the next
 * step is the same either way.
 */
export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmEmail, INITIAL_VERIFY_STATE);

  if (state.status === "done") {
    return (
      <div className="space-y-5">
        <Notice tone="success">
          Confirmed. You can sign in now — and comment, and read past the gate on
          a long post.
        </Notice>
        <Link href="/login" className="inline-flex">
          <Button variant="primary" type="button">
            Sign in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      {/* Read from the URL by the page, not by this component: the token is
          part of what is being submitted, and a hidden field is how a form
          without JavaScript carries it. */}
      <input type="hidden" name="token" value={token} />

      {state.status === "token_rejected" ? (
        <Notice tone="error">
          That link has already been used, or it has expired. If you have already
          confirmed the address, just sign in.
        </Notice>
      ) : null}

      {state.status === "unavailable" ? (
        <Notice tone="error">
          The API is not reachable, so nothing was confirmed. Your link is still
          good — try again shortly.
        </Notice>
      ) : null}

      <Wire active={pending} />

      <Button type="submit" disabled={pending}>
        {pending ? "Confirming…" : "Confirm email"}
      </Button>
    </form>
  );
}
