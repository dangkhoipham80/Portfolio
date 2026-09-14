import type { Metadata } from "next";
import Link from "next/link";

import { VerifyEmailForm } from "@/components/verify-email-form";
import { Container } from "@/components/ui/container";
import { eyebrowClasses } from "@/components/ui/eyebrow";
import { ScreenTitle } from "@/components/ui/screen-title";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";
import { readResetToken } from "@/lib/password-reset";

export const metadata: Metadata = {
  title: "Confirm your email",
};

/**
 * Where the link in the verification mail lands.
 *
 * ## Why this page did not exist before
 *
 * Because nothing reached it. The API has always mailed
 * `{frontend}/verify-email?token=…` — see `_send_verification_email` — and the
 * only account on the site was the owner's, created verified by the seed
 * script, so the link was never followed and its 404 was never noticed.
 *
 * Readers have accounts now and every one of them starts here. An account that
 * cannot confirm its address cannot sign in, comment, or read past the gate, so
 * this page is the difference between a sign-up flow and a dead end.
 *
 * ## Why the token is spent by a button and not by opening the page
 *
 * The token is single-use. A GET that spends it is fired by every link
 * prefetcher, mail scanner and chat-preview fetcher that meets the URL — so by
 * the time the person clicks, their link has already been used, which is true
 * and completely baffling. A form posting a Server Action means the only thing
 * that spends it is somebody pressing a button, and it works with JavaScript
 * off.
 *
 * The token is read here and passed as a hidden field rather than being read
 * from the URL in the browser: the same shape as /reset-password, which is the
 * other screen that trades a mailed token for a change to an account.
 */
export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  const params = await searchParams;
  const raw = params.token;
  // Shared with the reset screen, and doing the same job: a token arriving from
  // a mail client can be truncated or wrapped, and a mangled one should read as
  // a broken link rather than as a rejection.
  const token = readResetToken(typeof raw === "string" ? raw : undefined);

  return (
    // The console group supplies no <main>; each screen places its own, so the
    // skip link lands on content rather than on chrome.
    <main id="main" className="flex flex-1 items-center py-16 sm:py-24">
      <Container width="layout">
        <div className="max-w-md">
          <ScreenTitle>Confirm your email</ScreenTitle>

          {token ? (
            <>
              <p className="mt-4 text-muted-foreground">
                One press and the address is confirmed. After that you can sign
                in.
              </p>
              <div className="mt-10">
                <VerifyEmailForm token={token} />
              </div>
            </>
          ) : (
            <>
              <Notice tone="error" className="mt-6">
                This link is missing its token. Mail clients sometimes break a
                long link across two lines — try copying the whole thing into
                the address bar.
              </Notice>
              <p className="mt-4 text-muted-foreground">
                A fresh link can be sent from the comment box on any post, once
                you are signed in.
              </p>
            </>
          )}

          <p className={cn(eyebrowClasses, "mt-10 flex flex-wrap gap-x-5 gap-y-1")}>
            <Link href="/login" className="underline underline-offset-4 hover:text-primary">
              Sign in
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
