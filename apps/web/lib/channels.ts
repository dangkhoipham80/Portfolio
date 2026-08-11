import { OWNER_EMAIL } from "./contact";

/**
 * The ways to reach the owner, in one place.
 *
 * Listed in the contact section at the bottom of the home page and in the site
 * footer, which is the point of lifting them out of the former: a recruiter
 * reading /certificates or a project page had no way to make contact without
 * first finding their way back to the home page and scrolling to the end of it.
 *
 * Order is deliberate — email is the channel that actually gets read, and it
 * works when the API is asleep, when the Server Action times out, and when
 * someone has spent their five messages for the hour.
 */
export type Channel = {
  label: string;
  /** What is shown when there is room for it: the address, the handle. */
  value: string;
  href: string;
};

export const CHANNELS: readonly Channel[] = [
  { label: "Email", value: OWNER_EMAIL, href: `mailto:${OWNER_EMAIL}` },
  { label: "GitHub", value: "dangkhoipham80", href: "https://github.com/dangkhoipham80" },
  { label: "LinkedIn", value: "khoipham4022", href: "https://www.linkedin.com/in/khoipham4022/" },
] as const;

/**
 * A mailto does not leave for another site, so it must not get the external
 * link treatment — the ↗ would be a lie about where it goes, and opening a mail
 * client in a new tab leaves an empty one behind.
 */
export function isMailto(href: string): boolean {
  return href.startsWith("mailto:");
}
