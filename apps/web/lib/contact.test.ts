import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  CONTACT_LIMITS,
  type ContactValues,
  EMPTY_CONTACT,
  readContactForm,
  validateContact,
} from "./contact";

/** A submission that should pass, so each test can vary one field from valid. */
function valid(overrides: Partial<ContactValues> = {}): ContactValues {
  return {
    name: "Ada Lovelace",
    email: "ada@example.com",
    subject: "About the analytical engine",
    message: "I read your notes and would like to talk.",
    ...overrides,
  };
}

describe("validateContact", () => {
  it("passes a filled-in form", () => {
    expect(validateContact(valid())).toEqual({});
  });

  it("names every empty field and what to do about it", () => {
    expect(validateContact(EMPTY_CONTACT)).toEqual({
      name: "Enter your name.",
      email: "Enter your email address.",
      subject: "Enter a subject.",
      message: "Write a message before sending.",
    });
  });

  it("treats whitespace as empty, because the API strips it before its own check", () => {
    // str_strip_whitespace on ContactCreate runs before min_length, so a field
    // of spaces is rejected there too. Accepting it here would mean posting a
    // message that the API refuses with a 422 we would have to explain.
    expect(validateContact(valid({ message: "   \n\t  " }))).toEqual({
      message: "Write a message before sending.",
    });
  });

  describe("length", () => {
    it("allows a field of exactly the limit", () => {
      expect(validateContact(valid({ name: "a".repeat(CONTACT_LIMITS.name) }))).toEqual({});
    });

    it("rejects one character over, and says how far over", () => {
      const name = "a".repeat(CONTACT_LIMITS.name + 1);

      expect(validateContact(valid({ name }))).toEqual({
        name: "Name is 101 characters. Trim it to 100.",
      });
    });

    it("measures after trimming, so padding does not push a field over", () => {
      // The API trims first and then measures. Measuring the untrimmed value
      // here would reject a message the API would have stored.
      const message = `  ${"a".repeat(CONTACT_LIMITS.message)}  `;

      expect(validateContact(valid({ message }))).toEqual({});
    });

    it("reports the trimmed length, not the raw one", () => {
      const subject = `   ${"a".repeat(CONTACT_LIMITS.subject + 2)}   `;

      expect(validateContact(valid({ subject }))).toEqual({
        subject: "Subject is 257 characters. Trim it to 255.",
      });
    });
  });

  describe("email", () => {
    it("points at the missing @ when there is no @", () => {
      expect(validateContact(valid({ email: "ada.example.com" }))).toEqual({
        email: "That email address is missing an @.",
      });
    });

    it("points at the domain when the @ is there but the domain is not", () => {
      expect(validateContact(valid({ email: "ada@example" }))).toEqual({
        email: "That email address needs a domain, like name@example.com.",
      });
    });

    it("accepts the addresses a regex has no business rejecting", () => {
      // The authoritative check is EmailStr on the API. Anything rejected here
      // never reaches it, so this regex being over-strict is the failure mode
      // that matters — the visitor cannot argue with it.
      for (const email of [
        "ada+portfolio@example.co.uk",
        "ada.lovelace@sub.domain.example.com",
        "a@b.co",
        "ADA@EXAMPLE.COM",
        "ada_lovelace-1842@example.io",
      ]) {
        expect(validateContact(valid({ email })), email).toEqual({});
      }
    });

    it("reports emptiness rather than format for a blank address", () => {
      expect(validateContact(valid({ email: "  " }))).toEqual({
        email: "Enter your email address.",
      });
    });
  });

  it("reports every bad field at once, not just the first", () => {
    // The form focuses the first field with an error and counts the rest; a
    // validator that stopped early would make that count wrong.
    const errors = validateContact({
      name: "",
      email: "nope",
      subject: "",
      message: "fine",
    });

    expect(Object.keys(errors).sort()).toEqual(["email", "name", "subject"]);
  });
});

describe("readContactForm", () => {
  it("reads the four fields", () => {
    const form = new FormData();
    form.set("name", "Ada");
    form.set("email", "ada@example.com");
    form.set("subject", "Hello");
    form.set("message", "Hi there");

    expect(readContactForm(form)).toEqual({
      name: "Ada",
      email: "ada@example.com",
      subject: "Hello",
      message: "Hi there",
    });
  });

  it("returns empty strings for fields the post left out", () => {
    // A hand-rolled POST, or a form whose markup drifted, must not produce
    // `undefined` and crash `.trim()` in the validator.
    expect(readContactForm(new FormData())).toEqual(EMPTY_CONTACT);
  });

  it("returns an empty string for a field posted as a file", () => {
    const form = new FormData();
    form.set("name", new Blob(["not a name"]), "name.txt");

    expect(readContactForm(form).name).toBe("");
  });

  it("does not trim, so the form can refill exactly what was typed", () => {
    const form = new FormData();
    form.set("subject", "  spaced  ");

    expect(readContactForm(form).subject).toBe("  spaced  ");
  });
});

/**
 * The limits in this module are a copy of the API's, and a copy drifts.
 *
 * Being stricter here rejects messages the API would have accepted; being
 * looser hands the visitor a 422 that a field error could have explained. Both
 * are silent — nothing fails until someone writes a long enough message — so
 * the two files are compared directly rather than trusted.
 */
describe("CONTACT_LIMITS mirrors ContactCreate in apps/api", () => {
  const schemaPath = fileURLToPath(new URL("../../api/app/schemas/portfolio.py", import.meta.url));

  it("still finds the schema it is mirroring", () => {
    expect(
      () => readFileSync(schemaPath, "utf8"),
      `Cannot read ${schemaPath}. If ContactCreate moved, update this test rather than deleting it.`,
    ).not.toThrow();
  });

  it("agrees with the API on every field's maximum", () => {
    const source = readFileSync(schemaPath, "utf8");

    // Only the ContactCreate block: the file holds other models with their own
    // max_length values, and matching across all of them would prove nothing.
    const block = source.split("class ContactCreate")[1]?.split("\nclass ")[0] ?? "";
    expect(block, "ContactCreate not found in the schema file").not.toBe("");

    const fromApi = Object.fromEntries(
      // Line-scoped on purpose: a pattern allowed to span lines would pair a
      // field that has no max_length with the next field's number.
      [...block.matchAll(/^ {4}(\w+):.*max_length=(\d+)/gm)].map(([, field, max]) => [
        field,
        Number(max),
      ]),
    );

    expect(fromApi).toEqual({
      name: CONTACT_LIMITS.name,
      email: CONTACT_LIMITS.email,
      subject: CONTACT_LIMITS.subject,
      message: CONTACT_LIMITS.message,
    });
  });
});
