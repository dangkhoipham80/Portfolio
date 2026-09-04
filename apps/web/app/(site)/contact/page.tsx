import type { Metadata } from "next";

import { ContactSection } from "@/components/contact-section";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Send a message to Phạm Đăng Khôi — open to mid-level roles and above in backend, data and AI engineering.",
};

/**
 * The contact form, on a page of its own.
 *
 * It used to live only at the foot of the home page, which meant "get in
 * touch" was a scroll past every other section — and the header, the one
 * place a recruiter looks for a way in, had no way to say it. Now `/contact`
 * is a destination: the header links to it, the home page ends by pointing
 * at it, and the section itself is unchanged apart from being the page's h1.
 */
export default function ContactPage() {
  return <ContactSection level="h1" />;
}
