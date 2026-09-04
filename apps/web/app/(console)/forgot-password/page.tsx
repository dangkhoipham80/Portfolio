import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { Container } from "@/components/ui/container";
import { eyebrowClasses } from "@/components/ui/eyebrow";
import { hasLiveSession } from "@/lib/admin-guard";
import { cn } from "@/lib/cn";
import { ADMIN_PATH } from "@/lib/session";

export const metadata: Metadata = {
  title: "Reset console password",
};

/**
 * Step one of the way back in: ask for a link.
 *
 * Composed as the same panel on the same rail as /login, deliberately and
 * without variation. This screen is reached by someone who has just failed to
 * sign in, which is the worst possible moment to make them wonder whether they
 * are still on the same site — a second layout here would read as a redirect
 * somewhere else, which is exactly what a phishing page looks like.
 *
 * It lives in the (console) group so it inherits `console-theme` and the
 * layout's `robots: noindex`. A password-reset screen in a search result is not
 * something a portfolio wants.
 */
export default async function ForgotPasswordPage() {
  // Signed in already? Then this screen has nothing to offer — the password is
  // changed from inside the console. Same check, and the same reason, as the
  // one at the top of /login.
  if (await hasLiveSession()) redirect(ADMIN_PATH);

  return (
    // The console group supplies no <main>; each screen places its own, so the
    // skip link lands on content rather than on chrome.
    <main id="main" className="flex flex-1 items-center py-16 sm:py-24">
      <Container width="layout">
        <div className="max-w-md">
          {/* No eyebrow: "Locked out" only restated "Reset your password".
              See the note in login/page.tsx. */}

          {/*
            The heading and the prose come from the form, not from here.

            They were here first, which meant "enter the address on the account"
            stayed on screen after the link had been asked for — an instruction
            for a form that was no longer there. What is left on the page is
            what holds in every state: the label above, and the way out below.
          */}
          <ForgotPasswordForm />

          <p className={cn(eyebrowClasses, "mt-10 flex flex-wrap gap-x-5 gap-y-2")}>
            <Link href="/login" className="underline underline-offset-4 hover:text-primary">
              Back to sign in
            </Link>
            <Link href="/" className="underline underline-offset-4 hover:text-primary">
              Back to the site
            </Link>
          </p>
        </div>
      </Container>
    </main>
  );
}
