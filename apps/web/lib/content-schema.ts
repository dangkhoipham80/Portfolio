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
  | "list";

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
   * Settable on create and fixed afterwards — which is the API's rule, not a
   * choice made here: the `*Update` schemas have no `slug`, because
   * regenerating one on a title edit silently breaks every link already
   * published to it.
   */
  createOnly?: boolean;
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

export const ENTITIES: EntitySpec[] = [
  {
    key: "projects",
    cacheTag: "projects",
    apiPath: "/projects/",
    singular: "project",
    plural: "Projects",
    titleField: "title",
    subtitleField: "description",
    publishable: true,
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
      {
        name: "long_description",
        label: "Long description",
        kind: "textarea",
        rows: 6,
        hint: "The body of the detail page.",
      },
      SLUG,
      {
        name: "image_url",
        label: "Cover image",
        kind: "image",
        maxLength: 500,
        hint: "The panel beside this project on the home page, and its detail header.",
      },
      { name: "github_url", label: "Source URL", kind: "url", maxLength: 500 },
      { name: "live_url", label: "Live URL", kind: "url", maxLength: 500 },
      { name: "technologies", label: "Technologies", kind: "list" },
      { name: "features", label: "Features", kind: "list" },
      { name: "challenges", label: "Challenges", kind: "list" },
      { name: "started_on", label: "Started on", kind: "date" },
      {
        name: "ended_on",
        label: "Ended on",
        kind: "date",
        hint: "Leave empty while the work is still running.",
      },
      PROJECT_STATUS,
      { name: "featured", label: "Featured", kind: "boolean" },
      PUBLISHED,
      {
        name: "order",
        label: "Order",
        kind: "number",
        hint: "Lowest first, within the published set.",
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
    fields: [
      { name: "title", label: "Title", kind: "text", required: true, maxLength: 255 },
      {
        name: "excerpt",
        label: "Excerpt",
        kind: "textarea",
        rows: 3,
        hint: "The blurb on the index and the meta description. Left empty, the opening of the body is used.",
      },
      {
        name: "body",
        label: "Body",
        kind: "markdown",
        required: true,
        rows: 20,
        hint: "Markdown. Rendered and sanitised on the server; raw HTML is dropped.",
      },
      SLUG,
      { name: "tags", label: "Tags", kind: "list" },
      { name: "cover_image", label: "Cover image", kind: "image", maxLength: 500 },
      PUBLISHED,
      {
        name: "published_at",
        label: "Published on",
        kind: "datetime",
        hint: "Left empty, it is stamped the first time the post is published. Set it to backdate.",
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
    fields: [
      { name: "title", label: "Title", kind: "text", required: true, maxLength: 255 },
      { name: "issuer", label: "Issuer", kind: "text", required: true, maxLength: 255 },
      { name: "issue_date", label: "Issued on", kind: "datetime", required: true },
      SLUG,
      { name: "category", label: "Category", kind: "text", maxLength: 50 },
      { name: "description", label: "Description", kind: "textarea", rows: 3 },
      { name: "skills", label: "Skills", kind: "list" },
      { name: "credential_id", label: "Credential ID", kind: "text", maxLength: 100 },
      { name: "credential_url", label: "Credential URL", kind: "url", maxLength: 500 },
      { name: "image_url", label: "Image", kind: "image", maxLength: 500 },
      PUBLISHED,
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
    fields: [
      { name: "title", label: "Role", kind: "text", required: true, maxLength: 255 },
      { name: "company", label: "Company", kind: "text", required: true, maxLength: 255 },
      { name: "location", label: "Location", kind: "text", maxLength: 255 },
      { name: "started_on", label: "Started on", kind: "date", required: true },
      {
        name: "ended_on",
        label: "Ended on",
        kind: "date",
        hint: "Leave empty for a role you are still in; the site renders that as Present.",
      },
      SLUG,
      { name: "highlights", label: "Highlights", kind: "list" },
      PUBLISHED,
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
        options: [
          { value: "beginner", label: "Beginner" },
          { value: "intermediate", label: "Intermediate" },
          { value: "advanced", label: "Advanced" },
          { value: "expert", label: "Expert" },
        ],
      },
      { name: "icon", label: "Icon", kind: "text", maxLength: 100 },
      { name: "order", label: "Order", kind: "number" },
    ],
  },
];

export function entityFor(key: string | undefined): EntitySpec | undefined {
  return ENTITIES.find((entity) => entity.key === key);
}

/** Fields the form shows: everything, minus the create-only ones when editing. */
export function fieldsFor(spec: EntitySpec, mode: "create" | "edit"): FieldSpec[] {
  return mode === "create" ? spec.fields : spec.fields.filter((field) => !field.createOnly);
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
    const raw = formData.get(field.name);
    values[field.name] = typeof raw === "string" ? raw : "";
  }

  return values;
}

/** Turn an API record into the strings the form edits. */
export function toValues(spec: EntitySpec, record: Record<string, unknown>): Values {
  const values: Values = {};

  for (const field of spec.fields) {
    const raw = record[field.name];

    if (raw === null || raw === undefined) {
      values[field.name] = "";
    } else if (field.kind === "boolean") {
      values[field.name] = raw ? "true" : "";
    } else if (field.kind === "list") {
      values[field.name] = Array.isArray(raw) ? raw.join("\n") : "";
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
        payload[field.name] = toList(values[field.name] ?? "");
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
