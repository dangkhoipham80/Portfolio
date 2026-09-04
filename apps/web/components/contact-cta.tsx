import Link from "next/link";

import { ChannelList } from "@/components/channel-list";
import { Section } from "@/components/section";
import { buttonClasses } from "@/components/ui/button";

/**
 * The home page's last word: the same warm room the contact form used to
 * occupy, without the form.
 *
 * The form moved to /contact so the header could name it. Keeping a second
 * copy here would mean two forms with two result states on one site, and the
 * home page is the one page whose job is to hand the reader on rather than
 * hold them. So this keeps the title, the light and the channels — the
 * things that work when the API is asleep — and one button to the page that
 * does the rest.
 */
export function ContactCta() {
  return (
    <Section
      id="contact"
      width="full"
      warm
      eyebrow="/contact"
      title="Send me a message"
      description="Open to mid-level roles and above in backend, data and AI engineering. Anything that lands here reaches my inbox."
    >
      <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-16">
        <div className="flex flex-wrap items-center gap-3 lg:order-1">
          <Link href="/contact" className={buttonClasses("primary")}>
            Write to me <span aria-hidden="true">→</span>
          </Link>
          <p className="font-mono text-xs text-muted-foreground">
            POST /contacts · usually answered within two days
          </p>
        </div>

        <div className="lg:order-2">
          <ChannelList />
        </div>
      </div>
    </Section>
  );
}
