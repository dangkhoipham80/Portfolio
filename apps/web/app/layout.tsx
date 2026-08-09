import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteNav } from "@/components/site-nav";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The script below adds `dark` before React hydrates, so the class on the
      // client never matches what the server rendered. That is the intent.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <SiteNav />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Phạm Đăng Khôi
        </footer>
      </body>
    </html>
  );
}
