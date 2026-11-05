import type { PagePrefetchFn } from "@floot/prefetch";
import { liveTestPath } from "../helpers/liveTestRoutes";

export const prefetch: PagePrefetchFn = async ({ url }) => {
  const segment = new URL(url).pathname.split("/").filter(Boolean).pop();
  const slug = segment ? decodeURIComponent(segment) : "";
  if (!slug) return { statusCode: 404, maxAge: 300 };
  return { redirect: { to: liveTestPath(slug) } };
};
