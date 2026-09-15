import type { PagePrefetchFn } from "@floot/prefetch";

export const prefetch: PagePrefetchFn = async () => {
  // Set the HTTP status code to 404 for SSR bots and crawlers
  return { statusCode: 404, maxAge: 3600 };
};