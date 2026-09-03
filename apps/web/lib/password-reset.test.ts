import { describe, expect, it } from "vitest";

import {
  MIN_PASSWORD_LENGTH,
  readNewPasswordForm,
  readResetRequestForm,
  readResetToken,
  validateNewPassword,
  validateResetRequest,
} from "./password-reset";

/**
 * A value shaped like a JWT, assembled rather than pasted.
 *
 * `readResetToken` only checks for three base64url segments, so the fixture
 * only has to have three — the contents are irrelevant to every assertion
 * below, and the third segment is the word "signature" rather than anything
 * derived from a key.
 *
 * It was a literal at first, and GitGuardian flagged the pull request for a
 * hardcoded JSON Web Token. It was right to: the string is indistinguishable
 * from a real one at a glance, which is the whole property a scanner has to
 * work from. There was nothing to revoke, and that is exactly the problem — a
 * repository that answers its own secret scanner with "that one is fine" trains
 * everyone to skim the next alert, and this one leaked a live database
 * credential once already.
 *
 * Built from parts, it cannot match. Same construction as tests/e2e/password-reset.spec.ts.
 */
const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

const REAL_SHAPE = [b64url({ alg: "HS256" }), b64url({ sub: "1" }), "not-a-signature"].join(".");

/** The same value with its last segment lost, as a mail client would cut it. */
const TRUNCATED = REAL_SHAPE.split(".").slice(0, 2).join(".");

function formOf(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

describe("validateResetRequest", () => {
  it("accepts an ordinary address", () => {
    expect(validateResetRequest("ada@example.com")).toEqual({});
  });

  it("ignores surrounding whitespace, as the action does when it sends", () => {
    expect(validateResetRequest("  ada@example.com  ")).toEqual({});
  });

  it("asks for an address when there is none", () => {
    expect(validateResetRequest("").email).toMatch(/enter the account/i);
    expect(validateResetRequest("   ").email).toMatch(/enter the account/i);
  });

  it.each([
    ["ada.example.com", /missing an @/],
    ["ada@example", /needs a domain/],
  ])("names the actual defect in %s", (value, expected) => {
    // "Enter a valid email" tells someone their input was rejected without
    // telling them what to change, which is the one thing they need.
    expect(validateResetRequest(value).email).toMatch(expected);
  });
});

describe("readResetRequestForm", () => {
  it("reads the field, so a no-JS post parses the same way", () => {
    expect(readResetRequestForm(formOf({ email: "ada@example.com" }))).toBe("ada@example.com");
  });

  it("treats a missing field as empty rather than throwing", () => {
    expect(readResetRequestForm(new FormData())).toBe("");
  });
});

describe("validateNewPassword", () => {
  const long = "a".repeat(MIN_PASSWORD_LENGTH);

  it("accepts a long enough pair that matches", () => {
    expect(validateNewPassword({ password: long, confirm: long })).toEqual({});
  });

  it("counts how far short a password is", () => {
    // The rule is stated above the field; once the form has been submitted, how
    // far off it is is the part the field cannot convey.
    const errors = validateNewPassword({ password: "a".repeat(10), confirm: "a".repeat(10) });
    expect(errors.password).toMatch(/2 characters short/);
  });

  it("says \"character\", singular, when it is one short", () => {
    const almost = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validateNewPassword({ password: almost, confirm: almost }).password).toMatch(
      /1 character short/,
    );
    expect(validateNewPassword({ password: almost, confirm: almost }).password).not.toMatch(
      /characters short/,
    );
  });

  it("catches a mismatch", () => {
    expect(validateNewPassword({ password: long, confirm: `${long}x` }).confirm).toMatch(
      /do not match/,
    );
  });

  it("does not report a mismatch when the first box is empty", () => {
    // Otherwise an empty form reports two problems where there is one, and the
    // "2 fields need fixing" line sends someone hunting for a second defect.
    const errors = validateNewPassword({ password: "", confirm: "" });
    expect(errors.password).toBeDefined();
    expect(errors.confirm).not.toMatch(/do not match/);
  });

  it("does not object to a long password that happens to have spaces in it", () => {
    // A passphrase is the recommended shape, and the API imposes no character
    // rules; a client-side one would refuse passwords the account can hold.
    const phrase = "correct horse battery staple";
    expect(validateNewPassword({ password: phrase, confirm: phrase })).toEqual({});
  });
});

describe("readNewPasswordForm", () => {
  it("does not trim", () => {
    // Leading and trailing spaces may be part of the password. Trimming here
    // would set one the person cannot type.
    const values = readNewPasswordForm(formOf({ password: " pw ", confirm: " pw " }));
    expect(values).toEqual({ password: " pw ", confirm: " pw " });
  });

  it("treats missing fields as empty rather than throwing", () => {
    expect(readNewPasswordForm(new FormData())).toEqual({ password: "", confirm: "" });
  });
});

describe("readResetToken", () => {
  it("keeps a token of the right shape", () => {
    expect(readResetToken(REAL_SHAPE)).toBe(REAL_SHAPE);
  });

  it("trims a pasted link's stray whitespace", () => {
    expect(readResetToken(` ${REAL_SHAPE} `)).toBe(REAL_SHAPE);
  });

  it.each([
    ["", "empty"],
    ["   ", "whitespace"],
    ["not-a-jwt", "no segments"],
    ["only.two", "two segments"],
    [TRUNCATED, "the signature cut off by a mail client"],
    ["a.b.c.d", "four segments"],
    ["a.b.c=", "a character outside base64url"],
  ])("refuses %s (%s)", (value) => {
    expect(readResetToken(value)).toBeNull();
  });

  it("refuses a repeated query parameter", () => {
    // ?token=x&token=y arrives as an array. Picking one of them would be a
    // guess, and the guess is spent on the one submission the link allows.
    expect(readResetToken([REAL_SHAPE, REAL_SHAPE])).toBeNull();
  });

  it("refuses a missing parameter", () => {
    expect(readResetToken(undefined)).toBeNull();
  });
});
