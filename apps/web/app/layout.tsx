import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";

import { SiteNav } from "@/components/site-nav";
import { Container } from "@/components/ui/container";

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
      <body className="flex min-h-full flex-col font-sans">
        {/*
          First tab stop on every page. Without it a keyboard user walks all
          five nav stops before any content — on the home page the form's
          submit button was tab stop 23.
        */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[--radius-control] focus:border focus:border-border focus:bg-card focus:px-4 focus:py-3 focus:font-mono focus:text-xs focus:uppercase focus:tracking-[0.18em] focus:text-foreground"
        >
          Skip to content
        </a>
        <SiteNav />
        <main id="main" className="flex-1">{children}</main>
        <footer className="border-t border-border py-8">
          <Container
            width="layout"
            className="flex flex-col gap-1 text-center font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground sm:flex-row sm:justify-between sm:text-left"
          >
            <span>© {new Date().getFullYear()} Phạm Đăng Khôi</span>
            <span>Ho Chi Minh City, Vietnam</span>
          </Container>
        </footer>
      </body>
    </html>
  );
}
