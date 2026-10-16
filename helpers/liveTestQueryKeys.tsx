/* Shared by the details hooks and the page prefetch, so it imports no client libraries. */
export const LIVE_TEST_DETAILS_QUERY_KEY_PREFIX = "liveTest";

/* Invalidate with [LIVE_TEST_DETAILS_QUERY_KEY_PREFIX] alone: the public page caches by slug, the console by id. */
export const liveTestDetailsBySlugQueryKey = (slug: string | undefined, userId: number | "guest") =>
  [LIVE_TEST_DETAILS_QUERY_KEY_PREFIX, "slug", slug, userId] as const;
