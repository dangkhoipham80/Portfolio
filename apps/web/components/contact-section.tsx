import { ContactForm } from "@/components/contact-form";
import { Section } from "@/components/section";
import { ExternalLink } from "@/components/ui/external-link";
import { CHANNELS, isMailto } from "@/lib/channels";

/*
 * The channels are listed above the form, not tucked into an error state.
 *
 * The form depends on the API being up. These do not — a mailto works when the
 * backend is asleep, when the Server Action times out, and when someone has
 * already spent their five messages for the hour. Showing them only after a
 * failure would mean the section's fallback is invisible until the moment it is
 * needed, which is the wrong moment to introduce it.
 *
 * The list itself lives in lib/channels.ts, because the footer shows it too and
 * two copies of someone's contact details drift.
 */

export function ContactSection() {
  return (
    <Section
      id="contact"
      width="reading"
      // This read "Contact · POST /contacts" — the route the form submits to,
      // which is true and is the one thing that distinguishes this form from
      // the EmailJS one it replaces. It does not survive the eyebrow's
      // `uppercase`: "POST /CONTACTS" reads as shouting, not as a path. The
      // systems-voice detail moved to the status line above the submit button,
      // where the text is under this component's control.
      eyebrow="Contact"
      title="Send me a message"
      description="Open to mid-level roles and above in backend, data and AI engineering. Anything that lands here reaches my inbox."
    >
      {/*
        A description list, because that is what this is: a stable key and its
        value. The same mono-key / value shape the meta rows elsewhere use.
      */}
      {/*
        Flex rather than a three-column grid. In equal columns the email address
        is 6px wider than its cell and breaks to "dangkhoipham80@gmail.co" /
        "m" — an address split across two lines is not one you can read back to
        someone. Letting each channel take its natural width fixes it and wraps
        gracefully at 375px.
      */}
      <dl className="mb-10 flex flex-wrap gap-x-10 gap-y-4">
        {CHANNELS.map((channel) => (
          <div key={channel.label}>
            <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {channel.label}
            </dt>
            <dd>
              {isMailto(channel.href) ? (
                // Not an ExternalLink: a mailto does not leave for another site
                // and the ↗ affordance would be a lie about where it goes.
                <a
                  href={channel.href}
                  // py-3 to match ExternalLink's tap target; these sit in the
                  // same row and one being shorter than its neighbours is both
                  // a miss on touch and visibly uneven.
                  className="inline-flex py-3 text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {channel.value}
                </a>
              ) : (
                <ExternalLink href={channel.href}>{channel.value}</ExternalLink>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <ContactForm />
    </Section>
  );
}
