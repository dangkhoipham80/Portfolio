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
      aria-label="Toggle dark mode"
      className="rounded-full border border-border p-2 text-foreground transition-colors hover:bg-accent"
    >
      <span aria-hidden="true" className="dark:hidden">
        ☾
      </span>
      <span aria-hidden="true" className="hidden dark:inline">
        ☀
      </span>
    </button>
  );
}
