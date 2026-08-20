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

import { ImageField } from "@/components/console/image-field";
import { Button } from "@/components/ui/button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import {
  INITIAL_CONTENT_STATE,
  type ContentState,
  type EntitySpec,
  type FieldSpec,
  type Values,
  fieldsFor,
} from "@/lib/content-schema";

export function EntityForm({
  spec,
  mode,
  initial,
  action,
  cancelHref,
}: {
  spec: EntitySpec;
  mode: "create" | "edit";
  /** The row as strings, or empty strings for a new one. */
  initial: Values;
  action: (previous: ContentState, formData: FormData) => Promise<ContentState>;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_CONTENT_STATE);

  const values = state.status === "idle" ? initial : state.values;
  const errors = state.status === "invalid" ? state.errors : {};

  return (
    <form action={formAction} className="mt-8">
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

      {/* max-w so a text input does not stretch to a 1200px line on a big screen. */}
      <div className="flex max-w-2xl flex-col gap-6">
        {fieldsFor(spec, mode).map((field) => (
          <Control
            key={field.name}
            field={field}
            value={values[field.name] ?? ""}
            error={errors[field.name]}
          />
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? `Create ${spec.singular}` : "Save changes"}
        </Button>

        {/* A link, not a button: cancelling is going somewhere, not submitting. */}
        <Link href={cancelHref} className="min-h-11 px-2 py-3 text-sm text-muted-foreground hover:text-primary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Control({
  field,
  value,
  error,
}: {
  field: FieldSpec;
  value: string;
  error?: string;
}) {
  const hint = field.hint ? (
    <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
      {field.hint}
    </span>
  ) : undefined;

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
          name={field.name}
          label={field.label}
          meta={hint}
          error={error}
          options={field.options ?? []}
          defaultValue={value}
        />
      );

    case "list":
      return (
        <TextAreaField
          name={field.name}
          label={field.label}
          meta={
            <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
              One per line
            </span>
          }
          error={error}
          rows={field.rows ?? 4}
          defaultValue={value}
        />
      );

    case "image":
      return (
        <ImageField
          name={field.name}
          label={field.label}
          hint={field.hint}
          error={error}
          defaultValue={value}
          maxLength={field.maxLength}
        />
      );

    case "textarea":
    case "markdown":
      return (
        <TextAreaField
          name={field.name}
          label={field.label}
          meta={hint}
          error={error}
          rows={field.rows ?? 4}
          defaultValue={value}
          // Markdown is written in the same face it is read in; the body of a
          // post is largely code fences and indentation, and a proportional
          // font makes both unreadable while editing.
          className={field.kind === "markdown" ? "font-mono text-[0.8125rem]" : undefined}
        />
      );

    default:
      return (
        <TextField
          name={field.name}
          label={field.label}
          meta={hint}
          error={error}
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
