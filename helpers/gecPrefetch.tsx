import type { PageServerContext, PrefetchResult } from "@floot/prefetch";
import { gecServer } from "./gecServer";

const CACHE_SECONDS = 300;

/* The query key must match GEC_PUBLIC_QUERY_KEY in helpers/useGovtExamsCalendar. */
export async function prefetchGovtExamsCalendar(ctx: PageServerContext): Promise<PrefetchResult> {
  try {
    await ctx.qc.fetchQuery({ queryKey: ["govtExamsCalendar", "public"], queryFn: () => gecServer.loadPublic() });
    return { maxAge: CACHE_SECONDS };
  } catch (error) {
    console.error("Error prefetching the govt exams calendar:", error);
    return { maxAge: 0 };
  }
}