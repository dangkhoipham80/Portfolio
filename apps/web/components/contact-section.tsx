import { ChannelList } from "@/components/channel-list";
import { ContactForm } from "@/components/contact-form";
import { Section } from "@/components/section";

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

export function ContactSection({ level = "h2" }: { level?: "h1" | "h2" }) {
  return (
    <Section
      id="contact"
      // h2 at the foot of the home page, h1 on /contact where it is the page.
      level={level}
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

        <div className="lg:order-2">
          <ChannelList />
        </div>
      </div>
    </Section>
  );
}
