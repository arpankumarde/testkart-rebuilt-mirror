import type { PagePrefetchFn } from "@floot/prefetch";
import { getAdminSupportThreads } from "../endpoints/admin/support/threads_GET.schema";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  /* Must match useAdminThreadsQuery's key for the default view: page 1, the Open tab, no search, no unread filter. */
  await qc.prefetchQuery({
    queryKey: ["admin", "support", "threads", 1, 20, "open", "", false],
    queryFn: () => getAdminSupportThreads({ page: 1, limit: 20, status: "open" }),
  });
  return { maxAge: 0 };
};
