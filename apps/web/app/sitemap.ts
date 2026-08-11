import type { MetadataRoute } from "next";

import { getPosts, getProjects } from "@/lib/api";
import { absoluteUrl } from "@/lib/site";

/**
 * The sitemap, built from the same API the pages read.
 *
 * Both readers fall back to an empty list if the API is unreachable, so an
 * outage during a build produces a sitemap of the static pages rather than a
 * failed build — the same trade the rest of the site makes.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, projects] = await Promise.all([getPosts(), getProjects()]);

  const staticPages = ["/", "/blog", "/career-journey", "/certificates"].map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: "monthly" as const,
    priority: path === "/" ? 1 : 0.8,
  }));

  return [
    ...staticPages,
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      // `updated_at` is null until a row is edited, so a post that has never
      // been touched since publication reports the date it went live.
      lastModified: post.updated_at ?? post.published_at ?? post.created_at,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
    ...projects.map((project) => ({
      url: absoluteUrl(`/projects/${project.slug}`),
      lastModified: project.updated_at ?? project.created_at,
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
