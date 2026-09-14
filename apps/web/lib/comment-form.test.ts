import { describe, expect, it } from "vitest";

import {
  EMPTY_COMMENT,
  readCommentForm,
  validateComment,
  type CommentValues,
} from "./comment-form";

/**
 * The comment form's rules, and the one that is a security property.
 *
 * A comment used to carry a name and an address typed into the form. It now
 * carries neither: the API signs it with the account the bearer token resolves
 * to, and its request schema has no field for either. The tests below are what
 * say the *client* side of that cannot regress — a form that quietly started
 * collecting a name again would be collecting something nothing reads, and the
 * next step after that is somebody wiring it up.
 */

const values: CommentValues = { body: "This was useful, thank you." };

describe("validateComment", () => {
  it("accepts an ordinary comment", () => {
    expect(validateComment(values)).toEqual({});
  });

  it("has nothing to say about a name or an address", () => {
    // There are no such fields. Stated as a test because the absence is the
    // point: identity comes from the session, and a form that could express one
    // is a form somebody can be tempted to believe.
    expect(Object.keys(EMPTY_COMMENT)).toEqual(["body"]);
    expect(Object.keys(validateComment(EMPTY_COMMENT))).toEqual(["body"]);
  });

  it("asks for something to be written rather than reporting a length", () => {
    expect(validateComment({ body: "" }).body).toBe("Write something first.");
    expect(validateComment({ body: "x" }).body).toBe("Write something first.");
  });

  it("accepts the shortest thing that is a comment", () => {
    expect(validateComment({ body: "ok" })).toEqual({});
  });

  it("counts the characters over the limit rather than saying too long", () => {
    const error = validateComment({ body: "x".repeat(4001) }).body;

    expect(error).toContain("4001");
    expect(error).toContain("4000");
  });

  it("accepts a comment exactly at the limit, which the API also takes", () => {
    expect(validateComment({ body: "x".repeat(4000) })).toEqual({});
  });
});

describe("readCommentForm", () => {
  it("trims the body", () => {
    const form = new FormData();
    form.set("body", "  a comment  ");

    expect(readCommentForm(form)).toEqual({ body: "a comment" });
  });

  it("ignores a name or an address posted by hand", () => {
    // The action reads only what this returns, so extra fields in a
    // hand-crafted POST reach nothing. The API refuses them too — this is the
    // near end of the same guarantee.
    const form = new FormData();
    form.set("body", "signed by the account, not by this");
    form.set("author_name", "Phạm Đăng Khôi");
    form.set("author_email", "owner@example.com");

    expect(readCommentForm(form)).toEqual({
      body: "signed by the account, not by this",
    });
  });

  it("reads a missing body as empty rather than throwing", () => {
    expect(readCommentForm(new FormData())).toEqual(EMPTY_COMMENT);
  });
});
