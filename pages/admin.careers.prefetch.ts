import type { PagePrefetchFn } from "@floot/prefetch";

export const prefetch: PagePrefetchFn = async () => {
  // Admin routes require session authentication.
  // We return maxAge: 0 to ensure this page is never cached on the CDN
  // and always requests fresh data authorized by the active admin session.
  return { maxAge: 0 };
};