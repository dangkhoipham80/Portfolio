import "server-only";

import { fetchContentList } from "./console-api";
import type { EntitySpec } from "./content-schema";
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

export type Choices = { tags: TagRef[]; series: SeriesRef[] };

const NONE: Choices = { tags: [], series: [] };

/** Whether this entity's form has any field whose options come from the API. */
function needsChoices(spec: EntitySpec): boolean {
  return spec.fields.some((field) => field.kind === "tags" || field.kind === "series");
}

export async function choicesFor(spec: EntitySpec, token: string): Promise<Choices> {
  // Only posts, today. Checked rather than assumed so adding a tag field to
  // another type does not silently get an empty picker.
  if (!needsChoices(spec)) return NONE;

  const [tags, series] = await Promise.all([
    fetchContentList(token, "/tags/"),
    fetchContentList(token, "/series/"),
  ]);

  return {
    tags: tags.ok ? tags.data.map(toTagRef).filter(isNamed) : [],
    series: series.ok ? series.data.map(toSeriesRef).filter(isTitled) : [],
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
