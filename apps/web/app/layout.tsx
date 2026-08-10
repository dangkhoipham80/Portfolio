import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";

import "./globals.css";

// Display. Mechanical terminals, reads as engineered rather than editorial —
// and deliberately not the Geist the Next.js starter ships with.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

// Body. Drawn for technical documentation, and its Vietnamese diacritics are
// properly designed rather than synthesised — the name in the header depends on
// that.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Eyebrows, meta rows and the topology labels.
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
      className={`${spaceGrotesk.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
      // The script below adds `dark` before React hydrates, so the class on the
      // client never matches what the server rendered. That is the intent.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
