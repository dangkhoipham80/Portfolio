import "server-only";

import { fetchContentList } from "./console-api";
import type { Choices, EntitySpec, PostChoice } from "./content-schema";
import type { SeriesRef, TagRef } from "./types";

/**
 * The options a form needs that lib/content-schema.ts cannot know.
 *
 * That file describes shapes — what fields a post has, what each one means.
 * Which *tags* exist is content, it changes every time someone makes one, and
 * baking it into a static description would mean editing a source file to add a
 * subject. So the pages fetch it and hand it to the form.
 *
 * Read with the admin's token, so a draft series is offered here even though
 * the public site does not list it — assigning a post to a series you have not
 * announced yet is the ordinary way to write one.
 *
 * ## Why a failure is empty rather than an error
 *
 * The same reasoning as lib/api.ts, applied to the console: a tag list that
 * will not load should cost the tag picker, not the whole edit screen. An
 * author who came here to fix a typo in a paragraph can still do it, and the
 * picker says there are no tags — which is wrong but recoverable, where a 500
 * is neither.
 */

/*
 * `Choices` and `PostChoice` are declared in lib/content-schema.ts, not here.
 * This module is `server-only` and the form that consumes them runs in the
 * browser; keeping the shape beside the field descriptions means the client
 * never has to reach into a server module, even for a type.
 */
export type { Choices, PostChoice } from "./content-schema";

const NONE: Choices = { tags: [], series: [], posts: [] };

const FROM_API = new Set(["tags", "series", "translation"]);

/** Whether this entity's form has any field whose options come from the API. */
function needsChoices(spec: EntitySpec): boolean {
  return spec.fields.some((field) => FROM_API.has(field.kind));
}

export async function choicesFor(spec: EntitySpec, token: string): Promise<Choices> {
  // Only posts, today. Checked rather than assumed so adding a tag field to
  // another type does not silently get an empty picker.
  if (!needsChoices(spec)) return NONE;

  const [tags, series, posts] = await Promise.all([
    fetchContentList(token, "/tags/"),
    fetchContentList(token, "/series/"),
    // Drafts included, which is the ordinary case rather than an edge one: a
    // translation is usually written against an original that is already live,
    // but the pair can equally be drafted together.
    fetchContentList(token, "/posts/"),
  ]);

  return {
    tags: tags.ok ? tags.data.map(toTagRef).filter(isNamed) : [],
    series: series.ok ? series.data.map(toSeriesRef).filter(isTitled) : [],
    posts: posts.ok ? posts.data.map(toPostChoice).filter(isPickable) : [],
  };
}

function toTagRef(row: Record<string, unknown>): TagRef {
  return {
    id: typeof row.id === "number" ? row.id : 0,
    slug: typeof row.slug === "string" ? row.slug : "",
    name: typeof row.name === "string" ? row.name : "",
  };
}

function toSeriesRef(row: Record<string, unknown>): SeriesRef {
  return {
    id: typeof row.id === "number" ? row.id : 0,
    slug: typeof row.slug === "string" ? row.slug : "",
    title: typeof row.title === "string" ? row.title : "",
  };
}

/*
 * A row with no slug cannot be attached to anything and a row with no name has
 * nothing to render as a chip. Both are impossible from this API and both are
 * cheap to exclude — the alternative is a blank button in the picker that
 * silently posts an empty slug and 422s on save.
 */
function isNamed(tag: TagRef): boolean {
  return tag.slug !== "" && tag.name !== "";
}

function isTitled(entry: SeriesRef): boolean {
  return entry.slug !== "" && entry.title !== "";
}

function toPostChoice(row: Record<string, unknown>): PostChoice {
  return {
    slug: typeof row.slug === "string" ? row.slug : "",
    title: typeof row.title === "string" ? row.title : "",
    language: typeof row.language === "string" ? row.language : "",
  };
}

function isPickable(post: PostChoice): boolean {
  return post.slug !== "" && post.title !== "";
}
