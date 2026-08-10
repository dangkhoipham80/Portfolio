import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/admin-guard";
import { fetchContacts } from "@/lib/console-api";

export const metadata: Metadata = {
  title: "Inbox",
};

/**
 * The console's first real screen: the contact inbox, read-only.
 *
 * Chosen over a dashboard of placeholder tiles because it is the one thing that
 * proves the whole chain works. `GET /api/v1/contacts/` is admin-only on the
 * API — it answers 403 to a valid non-admin token and 401 to no token at all —
 * so if these messages render, the cookie, the token and the role check are all
 * doing their jobs. A page of static tiles would look identical whether or not
 * any of it worked.
 *
 * It is also the first time these submissions are readable anywhere but the
 * notification email.
 *
 * Editing — marking read, deleting, and content CRUD — is deliberately not here
 * yet.
 */

/** "10 Aug 2026, 21:47" in the reader's locale-independent short form. */
function formatReceived(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminInboxPage() {
  // Runs in the layout too. Repeated here rather than passed down because a
  // page must not depend on a parent having done the check — and it is a cache
  // hit on the same request, not a second call to the API.
  const { accessToken } = await requireAdmin("/admin");
  const result = await fetchContacts(accessToken);

  return (
    // "wide" rather than "layout": these cards are a column of prose, and the
    // full layout width stretched a message body past 1200px on a large screen
    // — a line length nobody reads comfortably.
    <Container width="wide" className="py-12 sm:py-16">
      {/* Not as="h2" — it labels the h1 below it rather than a section. */}
      <Eyebrow>Inbox</Eyebrow>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">
        Contact messages
      </h1>

      {!result.ok ? (
        /*
          Surfaced, not swallowed. lib/api.ts hides a failed read behind an
          empty fallback so a sleeping backend cannot take the public site down;
          doing that here would draw "the API is unreachable" and "nobody has
          written to you" as the same picture, and the second one reads as
          working.
        */
        <Notice className="mt-8">
          These messages could not be loaded — the API did not answer. Nothing
          has been lost; reload once it is back.
        </Notice>
      ) : result.data.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          No messages yet. The contact form on the home page writes here.
        </p>
      ) : (
        <>
          <p className={cn(eyebrowClasses, "mt-4")}>
            {result.data.length} message{result.data.length === 1 ? "" : "s"} ·{" "}
            {result.data.filter((contact) => !contact.read).length} unread
          </p>

          <ul className="mt-8 flex flex-col gap-4">
            {result.data.map((contact) => (
              <li key={contact.id}>
                <Card>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      {contact.subject}
                    </h2>
                    {!contact.read && <Badge>Unread</Badge>}
                    <span className="ms-auto font-mono text-xs text-muted-foreground">
                      {formatReceived(contact.created_at)}
                    </span>
                  </div>

                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    {contact.name} ·{" "}
                    {/* Replying is the only action this page needs, and the mail
                        client is better at it than anything built here. */}
                    <a
                      href={`mailto:${contact.email}?subject=${encodeURIComponent(`Re: ${contact.subject}`)}`}
                      className="text-primary underline underline-offset-4"
                    >
                      {contact.email}
                    </a>
                  </p>

                  {/*
                    whitespace-pre-line so the paragraphs someone typed survive
                    — the API stores the text exactly as sent. max-w-prose caps
                    the measure independently of the card, which has a header
                    row that wants the full width.
                  */}
                  <p className="mt-4 max-w-prose whitespace-pre-line text-sm text-foreground">
                    {contact.message}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </Container>
  );
}
