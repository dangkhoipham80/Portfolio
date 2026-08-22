"use client";

/*
 * A client component for one reason: `useActionState`.
 *
 * A create or edit form has to come back with per-field errors *and* what was
 * typed, and there is no server-only way to do that — the URL cannot carry a
 * two-thousand-word Markdown body, and re-rendering from scratch would empty
 * the form. This is the same hook, for the same reason, as the contact form.
 *
 * It still works with scripting off: `useActionState` is progressively
 * enhanced, so with no JavaScript the form does a plain POST and Next
 * re-renders the page with the returned state. That is why every control is
 * filled from `defaultValue` on the state's values rather than from the row —
 * on that path the fields would otherwise reset to their saved text and throw
 * away the edit that was just rejected.
 */

import Link from "next/link";
import { useActionState } from "react";

import { BodyEditor } from "@/components/console/body-editor";
import { GalleryField } from "@/components/console/gallery-field";
import { ImageField } from "@/components/console/image-field";
import { LinksField } from "@/components/console/links-field";
import { TagPicker } from "@/components/console/tag-picker";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";
import {
  INITIAL_CONTENT_STATE,
  type ContentState,
  type EntitySpec,
  type FieldSpec,
  type Values,
  groupsFor,
} from "@/lib/content-schema";
import type { SeriesRef, TagRef } from "@/lib/types";

export function EntityForm({
  spec,
  mode,
  initial,
  action,
  cancelHref,
  slug,
  choices,
}: {
  spec: EntitySpec;
  mode: "create" | "edit";
  /** The row as strings, or empty strings for a new one. */
  initial: Values;
  action: (previous: ContentState, formData: FormData) => Promise<ContentState>;
  cancelHref: string;
  /** The saved slug, for the action bar. Absent while creating — there is none yet. */
  slug?: string;
  /**
   * Options that come from the API rather than from lib/content-schema.ts.
   *
   * The schema describes shapes, not content, and the tags that exist change
   * every time someone makes one — so they are fetched by the page and passed
   * down rather than baked into the description. Empty for every entity that
   * has no such field, which is all of them but posts.
   */
  choices?: { tags: TagRef[]; series: SeriesRef[] };
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_CONTENT_STATE);

  const values = state.status === "idle" ? initial : state.values;
  const errors = state.status === "invalid" ? state.errors : {};

  return (
    // max-w so a text input does not stretch to a 1200px line on a big screen.
    // 3xl rather than the 2xl this was: the fields are two-to-a-row above `sm`
    // now, and at 672px a pair of halves is too narrow for a date plus its
    // label.
    <form
      action={formAction}
      // Required fields carry the attribute, so assistive technology announces
      // them — but this form renders its own per-field errors from `validate`,
      // and the browser's bubble says "Please fill out this field" in the
      // browser's voice, over the wrong element, in a style nothing else here
      // uses. Same arrangement, and the same reasoning, as the contact form.
      noValidate
      className="mt-8 max-w-3xl"
    >
      {state.status === "unavailable" && (
        <Notice className="mb-6 border-destructive/50">
          Nothing was saved — the API did not answer. Your changes are still in
          the form below; try again.
        </Notice>
      )}

      {state.status === "missing" && (
        <Notice className="mb-6 border-destructive/50">
          This {spec.singular} has been deleted, so there was nothing to save
          into. Copy anything you want to keep before leaving this page.
        </Notice>
      )}

      {state.status === "invalid" && (
        <Notice className="mb-6 border-destructive/50">
          Nothing was saved. Check the fields marked below.
        </Notice>
      )}

      <div className="flex flex-col gap-10">
        {groupsFor(spec, mode).map((group) => (
          <section key={group.label}>
            <div className="border-b border-border pb-3">
              <Eyebrow as="h2">{group.label}</Eyebrow>
              {group.hint ? (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {group.hint}
                </p>
              ) : null}
            </div>

            {/*
              Two columns above `sm`, and a field opts into a half by declaring
              it. Everything else spans both — which is why the default here is
              `sm:col-span-2` and `span: "half"` is what removes it.
            */}
            <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
              {group.fields.map((field) => (
                <div
                  key={field.name}
                  className={cn("min-w-0", field.span !== "half" && "sm:col-span-2")}
                >
                  <Control
                    field={field}
                    value={values[field.name] ?? ""}
                    error={errors[field.name]}
                    choices={choices}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/*
        The action bar, and the one place this screen spends any boldness.

        It follows you: `sticky bottom-4` means Save is one click away from
        anywhere in a form that runs well past a screen, instead of at the end
        of a scroll. And it carries the row's state on the left, so the thing
        you most often came here to change is also the thing you can always see.
      */}
      <div className="c-actionbar sticky bottom-4 z-10 mt-10 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <StatusLine spec={spec} mode={mode} slug={slug} />

        <div className="ms-auto flex items-center gap-1">
          {/* A link, not a button: cancelling is going somewhere, not submitting. */}
          <Link
            href={cancelHref}
            className="inline-flex min-h-11 items-center px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </Link>

          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : mode === "create" ? `Create ${spec.singular}` : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * What this row currently is, in the action bar.
 *
 * The live/draft half is driven by CSS, not React state. The published
 * checkbox is a real checkbox inside this form, so `form:has(#published:checked)`
 * in globals.css already knows the answer — mirroring it into `useState` would
 * add a hook, a handler and a second source of truth for something the DOM is
 * tracking anyway. Same reasoning as the theme toggle.
 *
 * Only rendered with a `published` field to read: on skills, which have no
 * draft state, `:has(#published:checked)` can never match and every skill would
 * claim to be a draft.
 */
function StatusLine({
  spec,
  mode,
  slug,
}: {
  spec: EntitySpec;
  mode: "create" | "edit";
  slug?: string;
}) {
  if (mode === "create") {
    return (
      <p className="font-mono text-xs text-muted-foreground">
        Not created yet
      </p>
    );
  }

  // Skills are both unpublishable and slugless, so there is nothing true to
  // say about one — and an empty <p> holding the bar open is not nothing, it is
  // markup that exists to describe a row and describes none.
  if (!spec.publishable && !slug) return null;

  return (
    <p className="flex min-w-0 items-center gap-2 font-mono text-xs text-muted-foreground">
      {spec.publishable ? (
        <>
          <span className="c-when-published inline-flex items-center gap-2">
            <span className="c-dot c-dot-live" />
            Live
          </span>
          <span className="c-when-draft inline-flex items-center gap-2">
            <span className="c-dot c-dot-draft" />
            Draft
          </span>
        </>
      ) : null}

      {slug ? <span className="truncate">/{slug}</span> : null}
    </p>
  );
}

function Control({
  field,
  value,
  error,
  choices,
}: {
  field: FieldSpec;
  value: string;
  error?: string;
  choices?: { tags: TagRef[]; series: SeriesRef[] };
}) {
  // Every control gets these three the same way, which is the point of pulling
  // them out: `hint` used to be handed to `meta` here and to `hint` in one
  // other branch, so the same sentence rendered in two different places
  // depending on the field's kind.
  const shared = { name: field.name, label: field.label, hint: field.hint, error };

  switch (field.kind) {
    case "boolean":
      return (
        <CheckboxField
          name={field.name}
          label={field.label}
          hint={field.hint}
          defaultChecked={value === "true"}
        />
      );

    case "select":
      return (
        <SelectField
          {...shared}
          required={field.required}
          options={field.options ?? []}
          defaultValue={value}
        />
      );

    case "list":
      return (
        <TextAreaField
          {...shared}
          required={field.required}
          // The one honest use of `meta`: a short right-aligned constraint on
          // the label row, which is what that slot was built for.
          meta={<span className="font-mono text-xs text-muted-foreground">One per line</span>}
          rows={field.rows ?? 4}
          defaultValue={value}
        />
      );

    case "image":
      return (
        <ImageField
          {...shared}
          defaultValue={value}
          maxLength={field.maxLength}
        />
      );

    case "gallery":
      return <GalleryField {...shared} defaultValue={value} />;

    case "tags":
      return <TagPicker {...shared} value={value} available={choices?.tags ?? []} />;

    case "series":
      return (
        <SelectField
          {...shared}
          options={[
            // The empty option is not a placeholder — it is a real choice, and
            // choosing it takes the post out of the series it is in.
            { value: "", label: "Not in a series" },
            ...(choices?.series ?? []).map((entry) => ({
              value: entry.slug,
              label: entry.title,
            })),
          ]}
          defaultValue={value}
        />
      );

    case "links":
      return <LinksField {...shared} value={value} />;

    case "markdown":
      // The full editor: a toolbar, image insertion from the media library, and
      // a preview rendered by the same pipeline the public page uses. Still a
      // plain textarea underneath, so it posts with scripting off.
      return <BodyEditor {...shared} defaultValue={value} />;

    case "textarea":
      return (
        <TextAreaField
          {...shared}
          required={field.required}
          rows={field.rows ?? 4}
          defaultValue={value}
        />
      );

    default:
      return (
        <TextField
          {...shared}
          required={field.required}
          defaultValue={value}
          type={inputType(field.kind)}
          maxLength={field.maxLength}
        />
      );
  }
}

function inputType(kind: FieldSpec["kind"]): string {
  if (kind === "date" || kind === "datetime") return "date";
  if (kind === "number") return "number";
  // Not type="url": the browser then refuses anything without a scheme, and
  // rejects it with a tooltip rather than the field error this form uses for
  // everything else. The API takes a string; a typo is the admin's own.
  return "text";
}
