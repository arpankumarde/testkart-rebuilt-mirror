import type { PagePrefetchFn } from "@floot/prefetch";

export const prefetch: PagePrefetchFn = async (ctx) => {
  // Admin pages are session-gated and cannot be prefetched server-side
  return { maxAge: 0 };
};