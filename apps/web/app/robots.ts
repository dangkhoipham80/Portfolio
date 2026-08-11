import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The console is behind a session guard already; this only keeps its
      // URLs out of results, where they are noise rather than a risk.
      disallow: ["/admin", "/login"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
