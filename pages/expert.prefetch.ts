import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchExpertsListServer } from "../helpers/fetchExpertsListServer";
import { fetchExpertSubjectsServer } from "../helpers/fetchExpertSubjectsServer";
import { expertsDirectoryQuery } from "../helpers/expertsDirectoryQuery";

/**
 * Server-renders the tutor directory with its listing and subject links, so crawlers see tutor
 * names, profile links and prices in the HTML. Query keys must match pages/expert.tsx.
 */
export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  const query = expertsDirectoryQuery(new URL(ctx.url).searchParams);

  try {
    const [list] = await Promise.all([
      qc.fetchQuery({ queryKey: query.queryKey, queryFn: () => fetchExpertsListServer(query.input) }),
      qc.fetchQuery({ queryKey: ["experts", "subjects"], queryFn: () => fetchExpertSubjectsServer() }),
    ]);
    // A page number past the last page is not a page: answer 404 instead of an empty listing.
    if (query.page > 1 && query.page > list.totalPages) return { statusCode: 404, maxAge: 300 };
    return { maxAge: 300 };
  } catch (error) {
    console.error("Error prefetching tutor directory:", error);
    // Not cached, so a transient database failure is not served to every visitor for five minutes.
    return { maxAge: 0 };
  }
};