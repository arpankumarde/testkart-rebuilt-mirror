import type { PagePrefetchFn } from "@floot/prefetch"

export const prefetch: PagePrefetchFn = async () => {
  // We return maxAge 0 because this is a teacher-protected route requiring session state.
  return { maxAge: 0 };
}