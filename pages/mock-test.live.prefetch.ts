import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchLiveTestsListServer } from "../helpers/fetchLiveTestsListServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;

  try {
    // Must match the queryKey/filters used by pages/mock-test.live.tsx's
    // default (page 1, status "all" -> undefined, no search) render, so
    // the live-tests marketplace listing is server-rendered instead of
    // client-only.
    const filters = { page: 1, status: undefined, searchQuery: undefined, limit: 12 };
    await qc.prefetchQuery({
      queryKey: ["liveTests", filters],
      queryFn: () => fetchLiveTestsListServer(filters),
    });
  } catch (error) {
    console.error("Error prefetching live tests list:", error);
  }

  return { maxAge: 300 };
};
