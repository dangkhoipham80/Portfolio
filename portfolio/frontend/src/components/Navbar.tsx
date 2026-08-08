import { cn } from "../lib/utils";
import { useEffect, useState, useRef } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { name: "Home", path: "/" },
  { name: "About", path: "/#about" },
  { name: "Skills", path: "/#skills" },
  { name: "Projects", path: "/#projects" },
  {
    name: "More",
    path: "#",
    items: [
      { name: "Career Journey", path: "/career-journey" },
      { name: "Certificates", path: "/certificates" },
      { name: "Contact", path: "/#contact" },
    ],
  },
];

// The mobile menu has no room for a dropdown, so the "More" group is flattened
// into the same single-level list.
const mobileNavItems = navItems.flatMap((item) =>
  item.items ? item.items : [{ name: item.name, path: item.path }]
);

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fullText = "Phạm Đăng Khôi";
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // While the mobile menu is open: trap Tab inside it, close on Escape, freeze the
  // page behind it, and hand focus over (then hand it back to the trigger on close).
  useEffect(() => {
    if (!isMenuOpen) return;

    const menu = menuRef.current;
    const trigger = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        menu?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []
      );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !menu?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    focusables()[0]?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus?.();
    };
  }, [isMenuOpen]);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (isDeleting) {
      if (displayText === "") {
        setIsDeleting(false);
      } else {
        timeout = setTimeout(() => {
          setDisplayText((prev) => prev.slice(0, -1));
        }, 50);
      }
    } else {
      if (displayText === fullText) {
        setIsDeleting(true);
      } else {
        timeout = setTimeout(() => {
          setDisplayText(fullText.slice(0, displayText.length + 1));
        }, 500);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, fullText]);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "fixed w-full z-40 transition-all duration-300",
        isScrolled
          ? "py-3 bg-background/80 backdrop-blur-lg border-b border-foreground/10 shadow-lg"
          : "py-5"
      )}
    >
      <div className="container flex items-center justify-between">
        <motion.a
          whileHover={{ scale: 1.02 }}
          className="text-base sm:text-xl font-bold flex items-center gap-2"
          href="/"
        >
          <span className="relative">
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent font-mono">
              {displayText}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="inline-block w-[2px] h-[1em] bg-primary ml-[2px]"
              />
            </span>
            {/* Dropped on phones so the brand cannot run under the floating theme toggle. */}
            <span className="hidden sm:inline text-foreground/80 ml-2">
              Portfolio
            </span>
          </span>
        </motion.a>

        {/* desktop navigation */}
        <div className="hidden md:flex items-center space-x-8">
          {navItems.map((item, key) =>
            item.items ? (
              <div key={key} className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="text-lg text-foreground hover:text-primary transition-colors duration-300 flex items-center gap-1"
                >
                  {item.name}
                  <ChevronDown
                    size={16}
                    className={cn(
                      "transition-transform duration-200",
                      isDropdownOpen ? "rotate-180" : ""
                    )}
                  />
                </button>
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 rounded-md shadow-lg bg-background/95 backdrop-blur-md border border-foreground/10 py-2">
                    {item.items.map((subItem, subKey) => {
                      if (
                        subItem.path.startsWith("http") ||
                        subItem.path.startsWith("mailto") ||
                        subItem.path.startsWith("tel")
                      ) {
                        return (
                          <a
                            key={subKey}
                            href={subItem.path}
                            className="block px-4 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors duration-200"
                            onClick={() => setIsDropdownOpen(false)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {subItem.name}
                          </a>
                        );
                      } else if (subItem.path.startsWith("/#")) {
                        return (
                          <Link
                            key={subKey}
                            to={subItem.path}
                            className="block px-4 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors duration-200"
                            onClick={(e) => {
                              setIsDropdownOpen(false);
                              if (location.pathname === "/") {
                                e.preventDefault();
                                window.location.hash = subItem.path.replace(
                                  "/#",
                                  "#"
                                );
                              }
                            }}
                          >
                            {subItem.name}
                          </Link>
                        );
                      } else {
                        return (
                          <Link
                            key={subKey}
                            to={subItem.path}
                            className="block px-4 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors duration-200"
                            onClick={() => setIsDropdownOpen(false)}
                          >
                            {subItem.name}
                          </Link>
                        );
                      }
                    })}
                  </div>
                )}
              </div>
            ) : item.path.startsWith("http") ||
              item.path.startsWith("mailto") ||
              item.path.startsWith("tel") ? (
              <a
                key={key}
                href={item.path}
                className="text-lg text-foreground hover:text-primary transition-colors duration-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.name}
              </a>
            ) : item.path.startsWith("/#") ? (
              <Link
                key={key}
                to={item.path}
                className="text-lg text-foreground hover:text-primary transition-colors duration-300"
                onClick={(e) => {
                  if (location.pathname === "/") {
                    e.preventDefault();
                    window.location.hash = item.path.replace("/#", "#");
                  }
                }}
              >
                {item.name}
              </Link>
            ) : (
              <Link
                key={key}
                to={item.path}
                className="text-lg text-foreground hover:text-primary transition-colors duration-300"
              >
                {item.name}
              </Link>
            )
          )}
        </div>

        {/* mobile menu button */}
        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="md:hidden p-2 text-foreground z-50"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* mobile menu overlay */}
        <div
          id="mobile-menu"
          ref={menuRef}
          hidden={!isMenuOpen}
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className={cn(
            "fixed inset-0 bg-background/95 backdrop-blur-md z-40 md:hidden",
            "flex flex-col items-center justify-center"
          )}
        >
          <nav className="flex flex-col items-center space-y-6 text-xl">
            {mobileNavItems.map((item) =>
              item.path.startsWith("/#") ? (
                <Link
                  key={item.path}
                  to={item.path}
                  className="text-foreground/80 hover:text-primary transition-colors duration-300"
                  onClick={(e) => {
                    setIsMenuOpen(false);
                    if (location.pathname === "/") {
                      e.preventDefault();
                      window.location.hash = item.path.replace("/#", "#");
                    }
                  }}
                >
                  {item.name}
                </Link>
              ) : (
                <Link
                  key={item.path}
                  to={item.path}
                  className="text-foreground/80 hover:text-primary transition-colors duration-300"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              )
            )}
          </nav>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
