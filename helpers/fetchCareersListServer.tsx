import { db } from "./db";
import type { OutputType } from "../endpoints/careers/list_GET.schema";

/**
 * Direct-DB counterpart to endpoints/careers/list_GET.ts, for use ONLY from
 * page prefetch (pages/careers.prefetch.ts) — see
 * helpers/fetchBlogPostDetailServer.tsx for why the network endpoint can't
 * be called from within the SSR pass. Keep in sync with
 * endpoints/careers/list_GET.ts.
 */
export async function fetchCareersListServer(): Promise<OutputType> {
  const careers = await db
    .selectFrom("careerPostings")
    .selectAll()
    .where("isActive", "=", true)
    .orderBy("orderIndex", "asc")
    .orderBy("createdAt", "desc")
    .execute();

  return { careers };
}
