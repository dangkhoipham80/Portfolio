import { ContactForm } from "@/components/contact-form";
import { Section } from "@/components/section";
import { eyebrowClasses } from "@/components/ui/eyebrow";
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
      // "layout", not "reading": the home page's spine sits on the layout
      // container's left edge, and this is the one section that broke the
      // line by centring a narrower container. The reading measure survives
      // as the max-width on the content below.
      width="full"
      warm
      // This read "Contact · POST /contacts" — the route the form submits to,
      // which is true and is the one thing that distinguishes this form from
      // the EmailJS one it replaces. It does not survive the eyebrow's
      // `uppercase`: "POST /CONTACTS" reads as shouting, not as a path. The
      // systems-voice detail moved to the status line above the submit button,
      // where the text is under this component's control.
      eyebrow="/contact"
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
      {/*
        Channels beside the form rather than stacked above it.

        Stacked, this section was 1065px tall — a screen and a bit for one form
        and three links, most of it the gap between the two. Side by side the
        form keeps its reading measure, the channels stop being a full-width
        band of mostly air, and the whole block fits in a viewport. Below `lg`
        it stacks again, which is the order it should be read in anyway: here
        is how to reach me, here is the form.
      */}
      <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-16">
        <div className="max-w-2xl lg:order-1">
          <ContactForm />
        </div>

        {/*
          A description list, because that is what this is: a stable key and its
          value. The same mono-key / value shape the meta rows elsewhere use.
        */}
        <dl className="lg:order-2">
          {CHANNELS.map((channel) => (
            <div key={channel.label} className="border-t border-border/60 py-3 first:border-t-0 first:pt-0 lg:first:border-t lg:first:pt-3">
              {/* eyebrowClasses, not a literal 11px: the footer renders these
                  same labels through it, and two sizes for one label is how a
                  scale stops being one. */}
              <dt className={eyebrowClasses}>
                {channel.label}
              </dt>
              <dd>
                {isMailto(channel.href) ? (
                  // Not an ExternalLink: a mailto does not leave for another
                  // site and the ↗ affordance would be a lie about where it
                  // goes.
                  <a
                    href={channel.href}
                    // min-h-11 states the 44px tap target rather than arriving
                    // at it by adding padding to a line-height — which is how
                    // this silently became 36px when the row gained padding of
                    // its own. ExternalLink beside it is already 44.
                    //
                    // No break-all, on purpose: in an earlier equal-column grid
                    // the address was 6px wider than its cell and broke to
                    // "dangkhoipham80@gmail.co" / "m", and an address split
                    // across two lines is not one you can read back to someone.
                    // The 20rem column is sized to hold it whole.
                    className="inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-primary"
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
      </div>
    </Section>
  );
}
