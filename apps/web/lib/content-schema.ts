/**
 * What each content type is made of, in one place.
 *
 * ## Why a description rather than five sets of pages
 *
 * Projects, skills, certificates, career entries and posts are the same shape
 * on the API — `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `DELETE /{id}` —
 * and differ only in their fields. Written out longhand that is five list
 * pages, five create pages and five edit forms, all near-identical, which is
 * the exact thing the repo's "if the same class string appears twice" rule
 * exists to stop. It is also how a field ends up validated on one screen and
 * not on another.
 *
 * So each type is described here and the screens are rendered from the
 * description. The cost is one indirection; the benefit is that adding a
 * column to a table is one entry in this file rather than an edit in four
 * places, and every screen gets it at once.
 *
 * ## Why this file has no imports
 *
 * Same reason as lib/contact.ts: it is used by the browser (the form) and by
 * the server (the action that receives the form), so the two cannot disagree
 * about what a valid value is. Anything the browser enforces can be skipped by
 * posting the form directly, so the server runs the identical function.
 *
 * The maximums mirror the column widths in apps/api/app/models/portfolio.py.
 * Being stricter here than the API rejects values the API would accept; being
 * looser hands the admin a 500 that could have been a sentence under the field.
 */

export type FieldKind =
  | "text"
  | "textarea"
  /** Markdown, edited as plain text. Rendered server-side; see lib/markdown.ts. */
  | "markdown"
  | "url"
  /**
   * An image URL, with a file picker that uploads to Blob and fills it in.
   * Still a URL underneath — the text input is the field, so the form keeps
   * working with scripting off. See components/console/image-field.tsx.
   */
  | "image"
  /** An API `date` column: sent as `YYYY-MM-DD`. */
  | "date"
  /** An API `datetime` column, but only the day is meaningful. See toPayload. */
  | "datetime"
  | "number"
  | "boolean"
  | "select"
  /** A JSON list of strings, edited one per line. */
  | "list"
  /**
   * An ordered list of image URLs, edited as a row of thumbnails with an
   * upload button and a picker onto the media library.
   *
   * Stored and posted as one URL per line, exactly like `list` — the control is
   * richer but the wire format is not, which is what keeps it working with
   * scripting off. See components/console/gallery-field.tsx.
   */
  | "gallery"
  /**
   * A list of `{label, url}` pairs. Posted as two parallel repeated fields and
   * zipped back together by `readForm`, so it needs no JSON in a hidden input
   * and no client component to submit.
   */
  | "links"
  /**
   * Tag slugs, chosen from the tags that exist.
   *
   * Posted as one slug per line, exactly like `list` — the control is richer
   * but the wire format is not. The API rejects a slug matching no row, which
   * is the point: a tag has to be created before it can be attached, or the
   * index grows a facet holding one post nobody meant to make. See
   * components/console/tag-picker.tsx.
   */
  | "tags"
  /**
   * A series slug, or empty for "not in a series".
   *
   * A `select` whose options come from the API rather than from this file,
   * which is the only reason it is its own kind.
   */
  | "series";

export type FieldSpec = {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** Mirrors the column width. Absent on TEXT columns, which have none. */
  maxLength?: number;
  options?: { value: string; label: string }[];
  /** Shown under the label. For saying what a field means, not what it is. */
  hint?: string;
  rows?: number;
  /**
   * Sits two-to-a-row above `sm`. Opt-in rather than derived from `kind`: a
   * date is always short but a title is always full, and both are one-line
   * inputs, so there is no rule to infer this from. Anything unmarked is full
   * width.
   */
  span?: "half";
  /**
   * Settable on create and fixed afterwards — which is the API's rule, not a
   * choice made here: the `*Update` schemas have no `slug`, because
   * regenerating one on a title edit silently breaks every link already
   * published to it.
   */
  createOnly?: boolean;
  /**
   * The mirror of `createOnly`: shown when editing and hidden when creating.
   *
   * One field so far — a post's "what changed" note, which records the reason
   * for an edit. On a create form there is no previous version for it to
   * describe, so it would be a box asking what changed about a thing that did
   * not exist.
   */
  editOnly?: boolean;
};

/**
 * A band of the form.
 *
 * The grouping is not arbitrary chunking to break up a long column: each band
 * is a place on the public site. "Identity" is the card, "Detail page" is the
 * body, "Visibility" is whether any of it is reachable. The field hints were
 * already saying this one at a time ("The card blurb on the home page"); the
 * bands promote it from an aside repeated per field to the shape of the screen,
 * so the question "where does this show up?" is answered once per group instead
 * of fifteen times per form.
 */
export type FieldGroup = {
  label: string;
  /** One line on what this band controls, and where it appears. */
  hint?: string;
  fields: FieldSpec[];
};

export type EntitySpec = {
  /** The URL segment under /admin, and the key everything else is looked up by. */
  key: string;
  /** Path on the API, with its trailing slash. */
  apiPath: string;
  singular: string;
  plural: string;
  /** Which field to show as a row's name in the list. */
  titleField: string;
  /** A second line under the title in the list, when there is one worth having. */
  subtitleField?: string;
  /** Whether rows have a `published` flag, and so a publish toggle. */
  publishable: boolean;
  groups: FieldGroup[];
  /**
   * Every field of every group, flattened — what validation and serialisation
   * walk, since neither cares where a field sits on screen.
   *
   * Derived, never written by hand. Groups are the source of truth precisely so
   * that a field cannot exist without being placed: a hand-maintained flat list
   * beside a hand-maintained grouping is two lists that drift, and the failure
   * is a field that validates but never renders.
   */
  fields: FieldSpec[];
  /**
   * The cache tag every public read of this type carries, so a write can
   * invalidate them all without knowing which URLs exist. Must match a value in
   * CONTENT_TAGS in lib/api.ts — that file cannot be imported here, because this
   * module is loaded by the browser and that one is `server-only`.
   */
  cacheTag: string;
};

const SLUG: FieldSpec = {
  name: "slug",
  label: "Slug",
  kind: "text",
  maxLength: 255,
  createOnly: true,
  hint: "The URL segment. Leave empty to derive it from the title — it cannot be changed later.",
};

const PUBLISHED: FieldSpec = {
  name: "published",
  label: "Published",
  kind: "boolean",
  hint: "Unpublished rows are invisible to the public site and its API.",
};

const PROJECT_STATUS: FieldSpec = {
  name: "status",
  label: "Status",
  kind: "select",
  required: true,
  options: [
    { value: "completed", label: "Completed" },
    { value: "in_progress", label: "In progress" },
    { value: "on_hold", label: "On hold" },
    { value: "dropped", label: "Dropped" },
  ],
};

const ENTITY_DEFINITIONS: Omit<EntitySpec, "fields">[] = [
  {
    key: "projects",
    cacheTag: "projects",
    apiPath: "/projects/",
    singular: "project",
    plural: "Projects",
    titleField: "title",
    subtitleField: "description",
    publishable: true,
    groups: [
      {
        label: "Identity",
        hint: "The card for this project on the home page.",
        fields: [
          { name: "title", label: "Title", kind: "text", required: true, maxLength: 255 },
          {
            name: "description",
            label: "Description",
            kind: "textarea",
            required: true,
            rows: 3,
            hint: "The card blurb on the home page.",
          },
          SLUG,
          {
            name: "image_url",
            label: "Cover image",
            kind: "image",
            maxLength: 500,
            hint: "The panel beside this project on the home page, and its detail header.",
          },
        ],
      },
      {
        label: "Detail page",
        hint: "Everything below the header on the project's own page.",
        fields: [
          {
            name: "long_description",
            label: "Long description",
            kind: "textarea",
            rows: 8,
            hint: "The body of the detail page.",
          },
          { name: "technologies", label: "Technologies", kind: "list" },
          { name: "features", label: "Features", kind: "list" },
          { name: "challenges", label: "Challenges", kind: "list" },
        ],
      },
      {
        label: "Gallery",
        hint: "Screenshots below the write-up on the detail page, in this order. The cover above is separate.",
        fields: [
          {
            name: "gallery",
            label: "Images",
            kind: "gallery",
            hint: "Descriptions come from the media library, so each image is described once however many projects use it.",
          },
        ],
      },
      {
        label: "Links",
        hint: "Rendered as buttons on the detail page. All optional.",
        fields: [
          { name: "github_url", label: "Source URL", kind: "url", maxLength: 500 },
          { name: "live_url", label: "Live URL", kind: "url", maxLength: 500 },
          {
            name: "links",
            label: "Other links",
            kind: "links",
            hint: "A demo video, a case study, a design file — anything that is not the source or the live site.",
          },
        ],
      },
      {
        label: "Timeline",
        fields: [
          { name: "started_on", label: "Started on", kind: "date", span: "half" },
          {
            name: "ended_on",
            label: "Ended on",
            kind: "date",
            span: "half",
            hint: "Leave empty while the work is still running.",
          },
          { ...PROJECT_STATUS, span: "half" },
        ],
      },
      {
        label: "Visibility",
        hint: "Who can see this, and where it sits among the rest.",
        fields: [
          PUBLISHED,
          { name: "featured", label: "Featured", kind: "boolean" },
          {
            name: "order",
            label: "Order",
            kind: "number",
            span: "half",
            hint: "Lowest first, within the published set.",
          },
        ],
      },
    ],
  },
  {
    key: "posts",
    cacheTag: "posts",
    apiPath: "/posts/",
    singular: "post",
    plural: "Posts",
    titleField: "title",
    subtitleField: "excerpt",
    publishable: true,
    groups: [
      {
        label: "Identity",
        hint: "How the post appears on the index and in search results.",
        fields: [
          { name: "title", label: "Title", kind: "text", required: true, maxLength: 255 },
          {
            name: "excerpt",
            label: "Excerpt",
            kind: "textarea",
            rows: 3,
            hint: "The blurb on the index and the meta description. Left empty, the opening of the body is used.",
          },
          SLUG,
          { name: "cover_image", label: "Cover image", kind: "image", maxLength: 500 },
          {
            name: "tag_slugs",
            label: "Tags",
            kind: "tags",
            hint: "Pick from the tags that exist, or make one. A tag has to exist before it can be attached — that is what stops “api”, “API” and “apis” becoming three subjects on the index.",
          },
        ],
      },
      {
        label: "Body",
        fields: [
          {
            name: "format",
            label: "Format",
            kind: "select",
            required: true,
            span: "half",
            options: [
              { value: "markdown", label: "Markdown" },
              { value: "mdx", label: "MDX" },
            ],
            hint: "MDX adds the site's own blocks — Callout, Figure, Video, Aside. It cannot run JavaScript.",
          },
          {
            name: "body",
            label: "Body",
            kind: "markdown",
            required: true,
            rows: 20,
            hint: "Rendered and sanitised on the server; raw HTML is dropped. Press Preview to see exactly what the page will show.",
          },
          {
            name: "revision_note",
            label: "What changed",
            kind: "text",
            maxLength: 280,
            editOnly: true,
            hint: "Optional, and kept on the revision this save creates rather than on the post. Not shown publicly.",
          },
        ],
      },
      {
        label: "Series",
        hint: "An ordered run of posts. A post belongs to at most one — two would make “next” ambiguous.",
        fields: [
          { name: "series_slug", label: "Series", kind: "series", span: "half" },
          {
            name: "series_order",
            label: "Part number",
            kind: "number",
            span: "half",
            hint: "Lowest first. Ignored when the post is not in a series.",
          },
        ],
      },
      {
        label: "Visibility",
        fields: [
          PUBLISHED,
          {
            name: "published_at",
            label: "Published on",
            kind: "datetime",
            span: "half",
            hint: "Left empty, it is stamped the first time the post is published. Set it to backdate.",
          },
        ],
      },
    ],
  },
  {
    key: "tags",
    cacheTag: "blog-tags",
    apiPath: "/tags/",
    singular: "tag",
    plural: "Tags",
    titleField: "name",
    subtitleField: "description",
    // No draft state: a tag is either a subject or it is deleted, and a hidden
    // tag would leave the posts carrying it filed under nothing.
    publishable: false,
    groups: [
      {
        label: "Tag",
        hint: "A subject posts are filed under. The name is what readers see; the slug is its URL.",
        fields: [
          { name: "name", label: "Name", kind: "text", required: true, maxLength: 60 },
          {
            ...SLUG,
            maxLength: 120,
            hint: "The URL segment, at /blog/tag/…. Leave empty to derive it from the name — it cannot be changed later, because links already point at it.",
          },
          {
            name: "description",
            label: "Description",
            kind: "textarea",
            rows: 2,
            maxLength: 280,
            hint: "The standfirst on this tag's own page. Most tags do not need one.",
          },
        ],
      },
    ],
  },
  {
    key: "series",
    cacheTag: "series",
    apiPath: "/series/",
    singular: "series",
    plural: "Series",
    titleField: "title",
    subtitleField: "description",
    publishable: true,
    groups: [
      {
        label: "Series",
        hint: "Posts are added to a series from the post's own screen, not from here.",
        fields: [
          { name: "title", label: "Title", kind: "text", required: true, maxLength: 255 },
          {
            name: "description",
            label: "Description",
            kind: "textarea",
            rows: 3,
            hint: "The standfirst on the series page.",
          },
          SLUG,
          { name: "cover_image", label: "Cover image", kind: "image", maxLength: 500 },
        ],
      },
      {
        label: "Visibility",
        hint: "A series can stay a draft while its first parts are already published — the posts show, the navigation between them does not.",
        fields: [PUBLISHED],
      },
    ],
  },
  {
    key: "certificates",
    cacheTag: "certificates",
    apiPath: "/certificates/",
    singular: "certificate",
    plural: "Certificates",
    titleField: "title",
    subtitleField: "issuer",
    publishable: true,
    groups: [
      {
        label: "Identity",
        fields: [
          { name: "title", label: "Title", kind: "text", required: true, maxLength: 255 },
          { name: "issuer", label: "Issuer", kind: "text", required: true, maxLength: 255 },
          SLUG,
          { name: "category", label: "Category", kind: "text", maxLength: 50, span: "half" },
        ],
      },
      {
        label: "Credential",
        hint: "What proves it. The URL becomes the card's link.",
        fields: [
          {
            name: "issue_date",
            label: "Issued on",
            kind: "datetime",
            required: true,
            span: "half",
          },
          {
            name: "credential_id",
            label: "Credential ID",
            kind: "text",
            maxLength: 100,
            span: "half",
          },
          { name: "credential_url", label: "Credential URL", kind: "url", maxLength: 500 },
        ],
      },
      {
        label: "Presentation",
        fields: [
          { name: "description", label: "Description", kind: "textarea", rows: 3 },
          { name: "skills", label: "Skills", kind: "list" },
          { name: "image_url", label: "Image", kind: "image", maxLength: 500 },
        ],
      },
      { label: "Visibility", fields: [PUBLISHED] },
    ],
  },
  {
    key: "career",
    cacheTag: "career",
    apiPath: "/career/",
    singular: "career entry",
    plural: "Career",
    titleField: "title",
    subtitleField: "company",
    publishable: true,
    groups: [
      {
        label: "Role",
        fields: [
          { name: "title", label: "Role", kind: "text", required: true, maxLength: 255 },
          { name: "company", label: "Company", kind: "text", required: true, maxLength: 255 },
          { name: "location", label: "Location", kind: "text", maxLength: 255, span: "half" },
          SLUG,
        ],
      },
      {
        label: "Dates",
        fields: [
          {
            name: "started_on",
            label: "Started on",
            kind: "date",
            required: true,
            span: "half",
          },
          {
            name: "ended_on",
            label: "Ended on",
            kind: "date",
            span: "half",
            hint: "Leave empty for a role you are still in; the site renders that as Present.",
          },
        ],
      },
      {
        label: "Detail",
        hint: "The bullets under this role on the career timeline.",
        fields: [{ name: "highlights", label: "Highlights", kind: "list" }],
      },
      { label: "Visibility", fields: [PUBLISHED] },
    ],
  },
  {
    key: "skills",
    cacheTag: "skills",
    apiPath: "/skills/",
    singular: "skill",
    plural: "Skills",
    titleField: "name",
    subtitleField: "category",
    // The only content type with no `published` column: skills are a flat list
    // on the home page and have never had a draft state.
    publishable: false,
    groups: [
      {
        label: "Skill",
        fields: [
          { name: "name", label: "Name", kind: "text", required: true, maxLength: 100 },
          {
            name: "category",
            label: "Category",
            kind: "text",
            required: true,
            maxLength: 50,
            hint: "Groups the bars on the home page: Frontend, Backend, Database, Cloud, DevOps, Tools.",
          },
          {
            name: "level",
            label: "Level",
            kind: "select",
            required: true,
            span: "half",
            options: [
              { value: "beginner", label: "Beginner" },
              { value: "intermediate", label: "Intermediate" },
              { value: "advanced", label: "Advanced" },
              { value: "expert", label: "Expert" },
            ],
          },
        ],
      },
      {
        label: "Placement",
        fields: [
          { name: "icon", label: "Icon", kind: "text", maxLength: 100, span: "half" },
          { name: "order", label: "Order", kind: "number", span: "half" },
        ],
      },
    ],
  },
];

export const ENTITIES: EntitySpec[] = ENTITY_DEFINITIONS.map((definition) => ({
  ...definition,
  fields: definition.groups.flatMap((group) => group.fields),
}));

export function entityFor(key: string | undefined): EntitySpec | undefined {
  return ENTITIES.find((entity) => entity.key === key);
}

/** Fields the form shows in this mode. See `createOnly` and `editOnly`. */
export function fieldsFor(spec: EntitySpec, mode: "create" | "edit"): FieldSpec[] {
  return spec.fields.filter((field) =>
    mode === "create" ? !field.editOnly : !field.createOnly,
  );
}

/**
 * The same filter as `fieldsFor`, but keeping the bands — and dropping any band
 * left empty by it, so an edit form never renders a heading with nothing under
 * it. That is not hypothetical: a group holding only `slug` would be exactly
 * that on every edit screen.
 */
export function groupsFor(spec: EntitySpec, mode: "create" | "edit"): FieldGroup[] {
  return spec.groups
    .map((group) => ({
      ...group,
      fields: group.fields.filter((f) => (mode === "create" ? !f.editOnly : !f.createOnly)),
    }))
    .filter((group) => group.fields.length > 0);
}

export type Values = Record<string, string>;
export type Errors = Record<string, string>;

/**
 * Every value is read as a string, including the booleans.
 *
 * FormData has no types — an unchecked checkbox is simply absent — so the
 * string form is what actually crosses the wire, and converting once at the
 * edge (`toPayload`) beats each screen guessing. It also means a rejected form
 * can be re-rendered with exactly what was typed.
 */
export function readForm(spec: EntitySpec, formData: FormData, mode: "create" | "edit"): Values {
  const values: Values = {};

  for (const field of fieldsFor(spec, mode)) {
    if (field.kind === "boolean") {
      // A checkbox posts its value only when checked; absence is false.
      values[field.name] = formData.get(field.name) === "on" ? "true" : "";
      continue;
    }

    if (field.kind === "links") {
      values[field.name] = readLinks(formData, field.name);
      continue;
    }

    const raw = formData.get(field.name);
    values[field.name] = typeof raw === "string" ? raw : "";
  }

  return values;
}

/**
 * Zip two parallel repeated fields back into one editable string.
 *
 * The links editor posts `<name>_label` and `<name>_url` once per row, in
 * document order, which is how a repeating group survives having no JavaScript:
 * plain inputs, no hidden JSON, no client component needed to submit. `getAll`
 * preserves that order, so index *i* of one list belongs with index *i* of the
 * other.
 *
 * The intermediate form is `Label\tURL` per line, one line per row, because
 * everything between `readForm` and `toPayload` is `Record<string, string>` —
 * that is what lets a rejected form re-render with exactly what was typed. Tab
 * is the separator because a label may contain anything a person types except
 * one, the field being a single-line input.
 *
 * Rows with neither half filled are dropped here: the editor always renders
 * spare blank rows, and they must not become empty links.
 */
function readLinks(formData: FormData, name: string): string {
  const labels = formData.getAll(`${name}_label`);
  const urls = formData.getAll(`${name}_url`);
  const rows: string[] = [];

  for (let i = 0; i < Math.max(labels.length, urls.length); i += 1) {
    const label = String(labels[i] ?? "").trim();
    const url = String(urls[i] ?? "").trim();
    if (!label && !url) continue;
    rows.push(`${label}\t${url}`);
  }

  return rows.join("\n");
}

/** The rows of a links field, as the editor and the payload both need them. */
export function parseLinks(value: string): { label: string; url: string }[] {
  return toList(value).map((line) => {
    const [label = "", url = ""] = line.split("\t");
    return { label: label.trim(), url: url.trim() };
  });
}

/** Turn an API record into the strings the form edits. */
export function toValues(spec: EntitySpec, record: Record<string, unknown>): Values {
  const values: Values = {};

  for (const field of spec.fields) {
    /*
      Two fields are named for what they *post*, not for what the API returns —
      the payload takes `tag_slugs` and `series_slug`, and the response carries
      `tags` and `series` as objects. So these are read before the generic
      lookup below, which would find `record.tag_slugs` undefined and leave the
      picker empty on every edit. That is not a hypothetical: it is what
      happened, and it looks exactly like "the post has no tags".
    */
    if (field.kind === "tags") {
      const tags = record.tags;
      values[field.name] = Array.isArray(tags)
        ? tags
            .map((tag) =>
              typeof tag === "string" ? tag : String((tag as { slug?: unknown })?.slug ?? ""),
            )
            .filter(Boolean)
            .join("\n")
        : "";
      continue;
    }

    if (field.kind === "series") {
      const series = record.series as { slug?: unknown } | null | undefined;
      values[field.name] = typeof series?.slug === "string" ? series.slug : "";
      continue;
    }

    const raw = record[field.name];

    if (raw === null || raw === undefined) {
      values[field.name] = "";
    } else if (field.kind === "boolean") {
      values[field.name] = raw ? "true" : "";
    } else if (field.kind === "list") {
      values[field.name] = Array.isArray(raw) ? raw.join("\n") : "";
    } else if (field.kind === "gallery") {
      // The API returns objects carrying resolved alt text; the form edits the
      // URLs, which is all the column stores. Dropping the rest here is not a
      // loss — a description is edited in the media library, and round-tripping
      // it through this form would be the second place it lived.
      values[field.name] = Array.isArray(raw)
        ? raw
            .map((item) =>
              typeof item === "string" ? item : String((item as { url?: unknown })?.url ?? ""),
            )
            .filter(Boolean)
            .join("\n")
        : "";
    } else if (field.kind === "links") {
      values[field.name] = Array.isArray(raw)
        ? raw
            .map((item) => {
              const link = item as { label?: unknown; url?: unknown };
              return `${String(link?.label ?? "")}\t${String(link?.url ?? "")}`;
            })
            .join("\n")
        : "";
    } else if (field.kind === "datetime") {
      // Sliced, not parsed: `new Date()` on an instant would shift the day for
      // anyone west of UTC, the same trap lib/format.ts documents.
      values[field.name] = String(raw).slice(0, 10);
    } else {
      values[field.name] = String(raw);
    }
  }

  return values;
}

/** One item per line, blanks dropped — so a trailing newline is not an entry. */
function toList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Errors name the field and the fix, in the house style: no "invalid input",
 * which tells someone their value was rejected without telling them what to
 * change.
 */
export function validate(spec: EntitySpec, values: Values, mode: "create" | "edit"): Errors {
  const errors: Errors = {};

  for (const field of fieldsFor(spec, mode)) {
    const value = (values[field.name] ?? "").trim();

    if (!value) {
      if (field.required) errors[field.name] = `${field.label} is required.`;
      continue;
    }

    if (field.maxLength && value.length > field.maxLength) {
      errors[field.name] =
        `${field.label} is ${value.length} characters. Trim it to ${field.maxLength}.`;
      continue;
    }

    if (field.kind === "number" && !Number.isInteger(Number(value))) {
      errors[field.name] = `${field.label} has to be a whole number.`;
      continue;
    }

    if ((field.kind === "date" || field.kind === "datetime") && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      errors[field.name] = `${field.label} has to be a date, as YYYY-MM-DD.`;
      continue;
    }

    if (field.kind === "select" && !field.options?.some((option) => option.value === value)) {
      errors[field.name] = `${field.label} is not one of the choices.`;
      continue;
    }

    if (field.kind === "links") {
      // The API rejects a link with no label — it would render as a button with
      // nothing written on it — so catch it here, where the message can name
      // the row instead of arriving as a 422 the form cannot attribute.
      const rows = parseLinks(values[field.name] ?? "");
      const incomplete = rows.findIndex((row) => !row.label || !row.url);

      if (incomplete !== -1) {
        const row = rows[incomplete];
        errors[field.name] = row.label
          ? `Link ${incomplete + 1} (“${row.label}”) has no address.`
          : `Link ${incomplete + 1} has an address but no label.`;
      }
    }
  }

  return errors;
}

/**
 * Convert the form's strings into what the API's schema expects.
 *
 * `datetime` fields are edited as a day and sent at midnight UTC. Only the day
 * is ever displayed — the certificates page and the blog both slice the first
 * ten characters — so the time carries no information, and inventing one from
 * the admin's clock would make the stored value depend on where they were
 * sitting.
 */
export function toPayload(
  spec: EntitySpec,
  values: Values,
  mode: "create" | "edit",
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of fieldsFor(spec, mode)) {
    const value = (values[field.name] ?? "").trim();

    switch (field.kind) {
      case "boolean":
        payload[field.name] = value === "true";
        break;
      case "number":
        payload[field.name] = value ? Number(value) : 0;
        break;
      case "list":
      // A gallery is a list of URLs on the wire too, and a tag picker a list of
      // slugs — the richer controls do not change the payload.
      case "gallery":
      case "tags":
        payload[field.name] = toList(values[field.name] ?? "");
        break;
      case "links":
        payload[field.name] = parseLinks(values[field.name] ?? "");
        break;
      case "datetime":
        payload[field.name] = value ? `${value}T00:00:00Z` : null;
        break;
      default:
        // Empty means null, not "". The columns are nullable and an empty
        // string would render as a blank line on the public page rather than
        // being skipped by the `? :` that guards it.
        payload[field.name] = value || null;
    }
  }

  // A slug the admin left empty must not be sent as null: the API derives it
  // from the title only when the key is absent.
  if (mode === "create" && !payload.slug) delete payload.slug;

  return payload;
}

/**
 * What a save can come back as.
 *
 * Lives here rather than beside the Server Action, for the reason lib/contact.ts
 * records: a `"use server"` module may only export async functions, and
 * `INITIAL_CONTENT_STATE` below is a real object — it would type-check, build,
 * and then throw the first time the form was submitted.
 */
export type ContentState =
  | { status: "idle" }
  /** Field-level problems, plus what was typed so nothing is lost. */
  | { status: "invalid"; errors: Errors; values: Values }
  /** The row was deleted while the form was open. */
  | { status: "missing"; values: Values }
  /** The API refused or did not answer. Nothing was saved. */
  | { status: "unavailable"; values: Values };

export const INITIAL_CONTENT_STATE: ContentState = { status: "idle" };

/** Failures the list screen reports, from its `?problem=` parameter. */
const LIST_PROBLEMS: Record<string, string> = {
  "already-gone":
    "That row had already been deleted, so nothing changed. The list below is current.",
  "not-deleted":
    "That row was not deleted — the API did not answer. It is still here; try again.",
  "not-published":
    "The publish state was not changed — the API did not answer. It is as it was; try again.",
  "unknown-row": "That request did not name a row, so nothing changed. Reload and try again.",
  "session-ended":
    "Your session ended before that went through, so nothing changed. Sign in again to repeat it.",
};

/**
 * Anything unrecognised returns null rather than being echoed. The value comes
 * from the URL, so a visitor can put whatever they like in it, and a page that
 * prints it is a page that prints text chosen by whoever wrote the link.
 */
export function listProblem(value: string | string[] | undefined): string | null {
  const key = Array.isArray(value) ? value[0] : value;
  return key && key in LIST_PROBLEMS ? LIST_PROBLEMS[key] : null;
}
