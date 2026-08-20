import { describe, expect, it } from "vitest";

import { BLOB_HOSTNAME, isOptimisableImage } from "./blob";

/*
 * This guard decides what next/image is allowed to fetch, so the interesting
 * cases are the ones that *look* like the blob host without being it. A
 * substring check would pass most of them.
 */
describe("isOptimisableImage", () => {
  it("accepts an https URL on the project's blob host", () => {
    expect(isOptimisableImage(`https://${BLOB_HOSTNAME}/cover-abc123.png`)).toBe(true);
  });

  it("rejects another host that merely mentions the blob host", () => {
    expect(isOptimisableImage(`https://evil.example/?x=${BLOB_HOSTNAME}`)).toBe(false);
    expect(isOptimisableImage(`https://evil.example/${BLOB_HOSTNAME}/a.png`)).toBe(false);
  });

  it("rejects a subdomain prefix attack", () => {
    // `hostname` is compared whole, so this is not the configured host even
    // though it ends with a string that contains it.
    expect(isOptimisableImage(`https://${BLOB_HOSTNAME}.evil.example/a.png`)).toBe(false);
  });

  it("rejects a userinfo trick", () => {
    // The host here is evil.example; everything before the @ is credentials.
    expect(isOptimisableImage(`https://${BLOB_HOSTNAME}@evil.example/a.png`)).toBe(false);
  });

  it("rejects plain http on the right host", () => {
    expect(isOptimisableImage(`http://${BLOB_HOSTNAME}/a.png`)).toBe(false);
  });

  it("rejects the values this field actually used to hold", () => {
    // The seeded rows pointed at files that were never committed, and the
    // field is free text, so both of these are real inputs.
    expect(isOptimisableImage("/assets/images/edupath.png")).toBe(false);
    expect(isOptimisableImage("")).toBe(false);
    expect(isOptimisableImage("not a url at all")).toBe(false);
  });
});
