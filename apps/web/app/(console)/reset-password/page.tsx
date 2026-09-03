import type { Metadata } from "next";

import { DeadLink, ResetPasswordForm } from "@/components/reset-password-form";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { readResetToken } from "@/lib/password-reset";

export const metadata: Metadata = {
  title: "Choose a new password",
};

/**
 * Step two: where the link in the mail lands.
 *
 * ## Why there is no session check here
 *
 * /login and /forgot-password both bounce a live session to /admin. This one
 * must not. Resetting is the remedy for a session you no longer trust — a
 * borrowed laptop, a token you think was captured — and the API revokes every
 * token the account holds as part of the reset. Redirecting someone who still
 * holds a cookie would refuse them the one screen that fixes their problem.
 *
 * ## The token
 *
 * Read here and passed into the form as a value rather than read by the Server
 * Action, because an action does not get the page's query string. It is shape-
 * checked on the way through — see readResetToken — so a truncated paste is
 * answered by this page instead of costing a round trip and coming back as the
 * API's refusal, which reads as "your account is the problem" rather than "the
 * link is".
 *
 * Nothing here validates the token for real. It cannot: the signature is checked
 * against a key that lives only in the API, and the row it points at lives only
 * in the API's database.
 */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const token = readResetToken((await searchParams).token);

  return (
    <main id="main" className="flex flex-1 items-center py-16 sm:py-24">
      <Container width="layout">
        <div className="max-w-md">
          <Eyebrow>Account recovery</Eyebrow>

          {/*
            The heading and the prose come from the component, not from here,
            because they differ per state: "set it here, then sign in again" is
            an instruction, and leaving it standing above a changed password or
            an expired link contradicts the outcome underneath it.

            Same component for a missing token and one the API refused, so the
            two dead ends are one dead end.
          */}
          {token ? <ResetPasswordForm token={token} /> : <DeadLink />}
        </div>
      </Container>
    </main>
  );
}
