import { eyebrowClasses } from "@/components/ui/eyebrow";
import { ExternalLink } from "@/components/ui/external-link";
import { CHANNELS, isMailto } from "@/lib/channels";

/**
 * The ways to reach the owner, as a description list: a stable mono key and
 * its value, the same shape the meta rows elsewhere use.
 *
 * Shared by the contact page and the home page's closing call-to-action so
 * the two cannot drift. The footer renders the same channels in a tighter
 * two-column grid of its own; the list in lib/channels.ts is the one source.
 *
 * Flex-free on purpose. In an earlier equal-column grid the email address was
 * 6px wider than its cell and broke to "dangkhoipham80@gmail.co" / "m" — an
 * address split across two lines is not one you can read back to someone. The
 * 20rem column this sits in is sized to hold it whole.
 */
export function ChannelList() {
  return (
    <dl>
      {CHANNELS.map((channel) => (
        <div
          key={channel.label}
          className="border-t border-border/60 py-3 first:border-t-0 first:pt-0 lg:first:border-t lg:first:pt-3"
        >
          <dt className={eyebrowClasses}>{channel.label}</dt>
          <dd>
            {isMailto(channel.href) ? (
              // Not an ExternalLink: a mailto does not leave for another site
              // and the ↗ affordance would be a lie about where it goes.
              // min-h-11 states the 44px tap target outright rather than
              // arriving at it through line-height plus padding.
              <a
                href={channel.href}
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
  );
}
