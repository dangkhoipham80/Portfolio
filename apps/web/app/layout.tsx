import type { Metadata } from "next";
import { Be_Vietnam_Pro, IBM_Plex_Mono } from "next/font/google";

import "./globals.css";

// One family, two voices: 800 tight-tracked for display, 400/500 for body.
// Chosen over a display/body pair because the site's identity is the owner's
// name — Be Vietnam Pro is drawn for Vietnamese first, so "Phạm Đăng Khôi"
// gets designed diacritics at every weight, including the hero's 800.
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Eyebrows, spine labels, meta rows and the topology labels.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Phạm Đăng Khôi — Software Engineer",
    template: "%s — Phạm Đăng Khôi",
  },
  description:
    "Portfolio of Phạm Đăng Khôi: backend and full-stack projects, skills, certificates and career history.",
};

/**
 * Applies the stored theme before first paint.
 *
 * This has to be a blocking inline script in <head>. Doing it in a `useEffect`
 * means the server-rendered HTML paints in light mode and then snaps to dark on
 * hydration — a visible flash on every navigation for anyone using dark mode.
 * Reads the same `theme` key as the Vite app; falls back to the OS preference.
 */
const THEME_SCRIPT = `
try {
  var stored = localStorage.getItem('theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (stored === 'dark' || (stored === null && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
`;

/**
 * Everything both route groups share, and nothing either one does not.
 *
 * The nav, `<main>` and footer used to live here. They moved down into
 * `(site)/layout.tsx` when the console arrived: `SiteNav` was rendered
 * unconditionally, and a server component cannot read the pathname to opt out,
 * so a login screen would have carried the public site's Projects/Career/
 * Certificates header. Route groups do not affect the URL, so no path changed.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${beVietnam.variable} ${plexMono.variable} h-full antialiased`}
      // The script below adds `dark` before React hydrates, so the class on the
      // client never matches what the server rendered. That is the intent.
      suppressHydrationWarning
      /*
       * `scroll-behavior: smooth` in globals.css is there for in-page anchors:
       * /#projects from the nav, and the skip link. Without this attribute Next
       * applies it to *route* transitions too, so following a project link from
       * the bottom of the home page scrolls the new page up from wherever the
       * old one was standing instead of starting at the top. Declaring it marks
       * the smoothness as deliberate, and is what the dev-server warning asks
       * for.
       */
      data-scroll-behavior="smooth"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
