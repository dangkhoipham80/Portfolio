import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { type CurrentUser, fetchCurrentUser } from "./console-api";
import {
  ACCESS_COOKIE,
  LOGIN_PATH,
  REFRESH_COOKIE,
  REFRESH_PATH,
  safeNextPath,
} from "./session";

/**
 * The gate in front of the admin area.
 *
 * ## What actually protects the data
 *
 * Not this. Every admin read carries the token to the API, and the API's
 * `require_admin` decides — so a caller who somehow rendered a page here would
 * still get a 403 in place of any content. This function exists so that an
 * expired or absent session produces a sign-in screen instead of a page full of
 * error states, and it is the layer that can be reasoned about in one place.
 *
 * ## Why there is no proxy.ts
 *
 * An earlier sketch put this in middleware. Next 16 renames that to `proxy.ts`
 * and its own documentation recommends avoiding it unless nothing else will do
 * — and something else does. A layout runs before its pages, can read cookies,
 * and can redirect, which covers the whole job. The one thing it cannot do is
 * *set* a cookie, which is why renewal is a redirect to a route handler rather
 * than something handled inline.
 */
export type AdminSession = { user: CurrentUser; accessToken: string };

/**
 * Resolve the caller, or redirect. Never returns for a signed-out visitor.
 *
 * `path` is where they were trying to go, carried through the sign-in so they
 * land there rather than on a generic dashboard.
 */
export async function requireAdmin(path: string): Promise<AdminSession> {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  const target = encodeURIComponent(safeNextPath(path));

  if (!accessToken) {
    // The access cookie's max-age matches its token's lifetime, so it is gone
    // at the moment the token stops working. A refresh cookie still present
    // means the session is renewable — go and spend it, then come back here.
    if (jar.get(REFRESH_COOKIE)) redirect(`${REFRESH_PATH}?next=${target}`);
    redirect(`${LOGIN_PATH}?next=${target}`);
  }

  const result = await fetchCurrentUser(accessToken);

  if (!result.ok) {
    // A token the API refuses: revoked by a sign-out elsewhere, or signed for a
    // key this API no longer uses. Renewal is still worth a try if there is a
    // refresh token, and that route clears both cookies when it fails.
    if (result.reason === "unauthorized" && jar.get(REFRESH_COOKIE)) {
      redirect(`${REFRESH_PATH}?next=${target}`);
    }
    redirect(`${LOGIN_PATH}?next=${target}`);
  }

  // Being signed in is not the same as being allowed. The API would refuse the
  // reads anyway, but a non-admin should meet the sign-in screen rather than an
  // admin shell wrapped around a permission error.
  if (!result.data.roles.includes("admin")) {
    redirect(`${LOGIN_PATH}?next=${target}`);
  }

  return { user: result.data, accessToken };
}
