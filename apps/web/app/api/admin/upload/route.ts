import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-guard";

/**
 * Where an admin's image upload gets its permission from.
 *
 * ## Why the browser uploads to Blob directly, and not through here
 *
 * This route never sees the file. It issues a short-lived token and the
 * browser sends the bytes straight to Blob storage. The obvious design —
 * POST the file to a route handler, which forwards it — dies on the first
 * real screenshot: a serverless request body is capped around 4.5MB, and the
 * failure arrives as an opaque 413 rather than anything a form can explain.
 *
 * So the token *is* the capability, and `onBeforeGenerateToken` is the
 * security boundary. Everything below runs before a token exists.
 *
 * ## Why `getAdminSession` and not `requireAdmin`
 *
 * `requireAdmin` answers a failed check with a redirect, which is correct for
 * a page and wrong here: `fetch` follows redirects, so the caller would get
 * the sign-in *page* with a 200 on it and fail while parsing HTML as JSON.
 * `getAdminSession` returns null instead, and null becomes a 401.
 *
 * Note that this is the console's own session cookie, not the API's opinion.
 * That is the one place in this app where Next decides an authorisation
 * question by itself rather than deferring to `require_admin` on the API —
 * unavoidable, because Blob is a Vercel resource the API cannot mint tokens
 * for. The blast radius is bounded by the constraints below: a stolen token
 * can write an image under a random path in a public bucket, and nothing
 * else. It cannot read, delete, or reach the API.
 */

/** Matches `allowedContentTypes`; kept as one list so the two cannot drift. */
const ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
];

/**
 * Generous for a screenshot, mean for anything else. The limit is enforced on
 * the token rather than in the browser, because a check the client performs is
 * a check an attacker skips.
 */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await getAdminSession();
        if (!session) throw new Error("Not authenticated");

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          /*
           * Two jobs. It stops a second upload of `hero.png` from silently
           * replacing the first, and it means the URLs are not guessable —
           * the bucket is public, so a predictable path is a listing.
           */
          addRandomSuffix: true,
        };
      },
      /*
       * Deliberately does nothing.
       *
       * This fires as a webhook *from* Blob back into the deployment, so it
       * never runs against localhost. Persisting `image_url` here would build
       * a feature that works in production and silently no-ops in
       * development — the worst kind. The browser already receives the URL
       * from `upload()`, so it puts it in the form field and the existing
       * save action writes it with the rest of the record.
       */
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";

    // 401 for the auth case so the client can say "sign in again" rather than
    // "something went wrong"; 400 for a rejected file.
    const status = message === "Not authenticated" ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
