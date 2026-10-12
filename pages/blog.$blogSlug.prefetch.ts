import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchBlogPostDetailServer } from "../helpers/fetchBlogPostDetailServer";
import { isNotFoundError } from "../helpers/isNotFoundError";

export const prefetch: PagePrefetchFn = async ({ qc, url }) => {
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop();
  if (!slug) return { statusCode: 404, maxAge: 300 };

  try {
    await qc.fetchQuery({
      queryKey: ["public", "blog", "post", slug],
      queryFn: () => fetchBlogPostDetailServer(slug),
    });
    return { maxAge: 300 };
  } catch (error) {
    // Missing and unpublished posts render NotFoundState; crawlers get a real 404.
    if (isNotFoundError(error)) return { statusCode: 404, maxAge: 300 };
    console.error("Error prefetching blog post:", error);
    // Not cached, so a transient database failure is not served to every visitor for five minutes.
    return { maxAge: 0 };
  }
};