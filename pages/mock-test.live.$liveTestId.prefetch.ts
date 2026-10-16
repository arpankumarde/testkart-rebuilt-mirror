import type { PagePrefetchFn } from "@floot/prefetch";
import { findLiveTestSlug } from "../helpers/findLiveTestSlug";
import { liveTestPath } from "../helpers/liveTestRoutes";

/* Old /mock-test/live/:id links (shares, emails, the mobile app's share text) move to /live-test/:slug. */
export const prefetch: PagePrefetchFn = async ({ url }) => {
  const segment = new URL(url).pathname.split("/").filter(Boolean).pop();
  if (!segment) return { statusCode: 404, maxAge: 300 };

  try {
    const slug = await findLiveTestSlug(decodeURIComponent(segment));
    if (!slug) return { statusCode: 404, maxAge: 300 };
    return { redirect: { to: liveTestPath(slug) } };
  } catch (error) {
    console.error("Error resolving legacy live test URL:", error);
    return { maxAge: 0 };
  }
};
