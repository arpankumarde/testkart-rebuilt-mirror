import type { PagePrefetchFn } from "@floot/prefetch";

export const prefetch: PagePrefetchFn = async (_ctx) => {
  // Onboarding page requires authenticated session; not cacheable at CDN layer
  return { maxAge: 0 };
};