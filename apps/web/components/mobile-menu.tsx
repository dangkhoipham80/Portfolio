"use client";

/*
 * The phone-width navigation: a full-screen overlay of display-scale links.
 *
 * A client component because it is interactive by definition — open/close
 * state, Escape to dismiss, a scroll lock while open. This replaces the old
 * compromise of collapsing the nav labels to two-letter initials, which kept
 * the links reachable but read as a bug to anyone who saw it.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { isCurrent, LINKS } from "@/components/nav-links";
import { cn } from "@/lib/cn";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;

    // The page must not scroll behind a full-screen layer — on iOS it would
    // scroll *instead of* the overlay and lose the reader's place.
    document.documentElement.style.overflow = "hidden";
    closeRef.current?.focus();
    // Captured now: by cleanup time the ref may already point elsewhere.
    const trigger = triggerRef.current;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label="Open menu"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-accent"
      >
        {/* Two lines, not three: the third adds nothing at this size. */}
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
          <path d="M2 6h14M2 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/*
        Portalled to <body>: the header's backdrop-filter makes it the
        containing block for fixed descendants, so rendered in place this
        overlay would be pinned inside the 68px bar instead of the viewport.
      */}
      {open ? (
        createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md"
        >
          <div className="flex items-center justify-end px-5 py-3">
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-accent"
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <nav aria-label="Main" className="flex flex-1 flex-col justify-center gap-2 px-8 pb-16">
            {LINKS.map((link, i) => {
              const current = isCurrent(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={current ? "page" : undefined}
                  // hero-item is the site's standard entrance; the stagger walks
                  // the links in top to bottom, same as the hero boot sequence.
                  className={cn(
                    "hero-item flex min-h-12 items-center gap-4 font-display text-3xl font-bold tracking-tight transition-colors",
                    current ? "text-primary" : "text-foreground hover:text-primary",
                  )}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {current ? (
                    <span aria-hidden="true" className="spine-node shrink-0" />
                  ) : null}
                  {link.label}
                </Link>
              );
            })}

            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="hero-item mt-8 inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
              style={{ animationDelay: `${LINKS.length * 60}ms` }}
            >
              Console
            </Link>
          </nav>
        </div>,
        document.body,
        )
      ) : null}
    </div>
  );
}
