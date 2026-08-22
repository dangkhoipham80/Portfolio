import type { MetadataRoute } from "next";

import { getPosts, getProjects, getSeriesList, getTags } from "@/lib/api";
import { absoluteUrl } from "@/lib/site";

/**
 * The sitemap, built from the same API the pages read.
 *
 * Both readers fall back to an empty list if the API is unreachable, so an
 * outage during a build produces a sitemap of the static pages rather than a
 * failed build — the same trade the rest of the site makes.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, projects, tags, series] = await Promise.all([
    getPosts(),
    getProjects(),
    getTags(),
    getSeriesList(),
  ]);

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
    /*
      Tag and series pages. `getTags` has already dropped the empty ones, so
      nothing here points at a page whose list is blank — which is the whole
      risk of listing generated facets in a sitemap.

      Lower priority than a post: these are ways in, not the thing itself.
    */
    ...tags.map((tag) => ({
      url: absoluteUrl(`/blog/tag/${tag.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
    ...series.map((entry) => ({
      url: absoluteUrl(`/blog/series/${entry.slug}`),
      lastModified: entry.updated_at ?? entry.created_at,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
