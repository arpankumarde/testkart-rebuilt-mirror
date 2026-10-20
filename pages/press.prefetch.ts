import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchNewsListServer } from "../helpers/fetchNewsListServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  try {
    await qc.prefetchQuery({
      queryKey: ["news", "list"],
      queryFn: () => fetchNewsListServer(),
    });
  } catch (error) {
    console.error("Error prefetching news coverage list:", error);
  }

  return { maxAge: 300 };
};
