import type { PagePrefetchFn } from "@floot/prefetch";

export const prefetch: PagePrefetchFn = async ({ url }) => ({
  redirect: { to: `/press${new URL(url, "https://testkart.in").search}`, permanent: true },
});