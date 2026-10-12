import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchBundleDetailsServer } from "../helpers/fetchBundleDetailsServer";
import { isNotFoundError } from "../helpers/isNotFoundError";

export const prefetch: PagePrefetchFn = async ({ qc, url }) => {
  const bundleSlug = new URL(url).pathname.split("/").filter(Boolean).pop();
  if (!bundleSlug) return { statusCode: 404, maxAge: 300 };

  try {
    await qc.fetchQuery({
      queryKey: ["public", "bundles", "details", bundleSlug],
      queryFn: () => fetchBundleDetailsServer(bundleSlug),
    });
    return { maxAge: 300 };
  } catch (error) {
    // Missing and unpublished bundles render NotFoundState; crawlers get a real 404.
    if (isNotFoundError(error)) return { statusCode: 404, maxAge: 300 };
    console.error("Error prefetching bundle details:", error);
    // Not cached, so a transient database failure is not served to every visitor for five minutes.
    return { maxAge: 0 };
  }
};