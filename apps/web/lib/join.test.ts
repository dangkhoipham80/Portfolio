import { describe, expect, it } from "vitest";

import {
  EMPTY_JOIN,
  MIN_PASSWORD_LENGTH,
  readJoinForm,
  validateJoin,
  type JoinValues,
} from "./join";

/**
 * The sign-up form's rules, which both halves run.
 *
 * The browser's copy is a convenience; the Server Action runs the identical
 * function, and the API runs its own on top of that. What is worth testing here
 * is the part a person meets — that the messages land on the right field, and
 * that the two numbers this file states agree with the API's.
 */

/**
 * A password that clears the floor, built rather than written down.
 *
 * The value is irrelevant — nothing here authenticates against anything — but a
 * literal shaped like a password is what a secret scanner reports, and this
 * repo has a note about that in .github/workflows/ci.yml: it has leaked a live
 * credential once, and findings on test fixtures are the noise that trains
 * people to scroll past the real ones. Same reasoning as
 * apps/api/tests/test_login_streak.py.
 */
const LONG_ENOUGH = "x".repeat(MIN_PASSWORD_LENGTH + 4);

const good: JoinValues = {
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  password: LONG_ENOUGH,
};

describe("validateJoin", () => {
  it("accepts an ordinary sign-up", () => {
    expect(validateJoin(good)).toEqual({});
  });

  it("asks for all three when nothing is filled in", () => {
    expect(Object.keys(validateJoin(EMPTY_JOIN)).sort()).toEqual([
      "email",
      "full_name",
      "password",
    ]);
  });

  it("says what the name is for, rather than that it is required", () => {
    // "Name" on a sign-up form usually means "for our records". Here it is the
    // name that will appear on a comment, and the message says so.
    expect(validateJoin({ ...good, full_name: "" }).full_name).toMatch(/comments/i);
  });

  it("holds the name to the width of the column that stores it", () => {
    // post_comments.author_name is VARCHAR(80). Being looser here would hand
    // the reader a 422 that could have been a sentence under the field.
    const error = validateJoin({ ...good, full_name: "a".repeat(81) }).full_name;

    expect(error).toContain("81");
    expect(error).toContain("80");
  });

  it("rejects an address a person can see is wrong, and nothing cleverer", () => {
    // Deliberately loose: the API validates properly, and a second, worse email
    // regex here would only reject addresses the API would have accepted.
    expect(validateJoin({ ...good, email: "ada" }).email).toBeDefined();
    expect(validateJoin({ ...good, email: "ada@example" }).email).toBeDefined();
    expect(validateJoin({ ...good, email: "a+tag@sub.example.co.uk" }).email).toBeUndefined();
  });

  it("counts the password rather than calling it too short", () => {
    // Somebody who has typed nine characters should be able to see how many
    // more to add.
    const error = validateJoin({ ...good, password: "short" }).password;

    expect(error).toContain(String(MIN_PASSWORD_LENGTH));
    expect(error).toContain("5");
  });

  it("accepts a password exactly at the floor", () => {
    expect(
      validateJoin({ ...good, password: "x".repeat(MIN_PASSWORD_LENGTH) }).password,
    ).toBeUndefined();
  });

  it("mirrors the API's minimum, which is where the rule actually lives", () => {
    // MIN_PASSWORD_LENGTH in apps/api/app/core/constants.py. If the two drift,
    // the screen says "the API refused this password" instead of asking for a
    // longer one up front.
    expect(MIN_PASSWORD_LENGTH).toBe(12);
  });
});

describe("readJoinForm", () => {
  it("trims the name and the address but never the password", () => {
    // Spaces may be part of a password, and a value the browser did not put
    // there should not come back down the wire in a re-render.
    const form = new FormData();
    form.set("full_name", "  Ada  ");
    form.set("email", "  ada@example.com ");
    form.set("password", "  spaces matter  ");

    expect(readJoinForm(form)).toEqual({
      full_name: "Ada",
      email: "ada@example.com",
      password: "  spaces matter  ",
    });
  });

  it("reads a missing field as empty rather than throwing", () => {
    // A hand-posted form is the ordinary case this has to survive: the action
    // validates whatever comes out, and `undefined` would reach a `.length`.
    expect(readJoinForm(new FormData())).toEqual(EMPTY_JOIN);
  });
});
