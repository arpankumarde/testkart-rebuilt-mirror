import type { PagePrefetchFn } from "@floot/prefetch";

export const prefetch: PagePrefetchFn = async () => {
  // Static page shell, can be cached
  return;
};