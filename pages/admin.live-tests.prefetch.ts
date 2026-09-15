import type { PagePrefetchFn } from "@floot/prefetch";

export const prefetch: PagePrefetchFn = async () => {
  // Admin pages contain sensitive data and should not be cached.
  return { maxAge: 0 };
};