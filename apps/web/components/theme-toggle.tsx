"use client";

/**
 * Dark/light toggle, persisted to localStorage under the same `theme` key the
 * Vite app uses — someone who has both open keeps one preference.
 *
 * Deliberately holds no React state. The source of truth is the `dark` class on
 * <html>, which the blocking script in app/layout.tsx sets before first paint.
 * Mirroring that into state would mean the server renders one icon and the
 * client corrects it on hydration, so the icon is briefly wrong on every load
 * for dark-mode users — the exact flash the blocking script exists to prevent.
 * Letting CSS pick the icon keeps the markup identical on both sides.
 */
export function ThemeToggle() {
  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // Two labels, picked by CSS for the same reason the icon is: the button
      // holds no state, so it cannot compute which one applies without
      // reintroducing the hydration flash the blocking script exists to avoid.
      // A single "Toggle dark mode" is wrong half the time — in dark mode,
      // activating it goes to light.
      aria-labelledby="theme-toggle-label"
      // Explicit box: padding alone measured 26x43, under the 44px target size.
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-accent"
    >
      <span aria-hidden="true" className="dark:hidden">
        ☾
      </span>
      <span aria-hidden="true" className="hidden dark:inline">
        ☀
      </span>
      <span id="theme-toggle-label" className="sr-only">
        <span className="dark:hidden">Switch to dark mode</span>
        <span className="hidden dark:inline">Switch to light mode</span>
      </span>
    </button>
  );
}
