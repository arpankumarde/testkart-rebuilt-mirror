import type { PagePrefetchFn } from "@floot/prefetch";

export const prefetch: PagePrefetchFn = async () => {
  // Static content page, return void for permanent caching
  return;
};