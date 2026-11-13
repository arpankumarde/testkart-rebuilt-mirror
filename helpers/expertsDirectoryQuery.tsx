import { SORT_VALUES } from "../endpoints/experts/list_GET.schema";
import type { ExpertSortValue } from "../endpoints/experts/list_GET.schema";

const ITEMS_PER_PAGE = 20;

const cleanPrice = (value: string | null) => {
  if (!value) return "";
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? String(n) : "";
};

/**
 * Reads the tutor directory's state from its URL (/expert?search=&minPrice=&maxPrice=&verified=1
 * &sort=&page=) and builds the list query from it. Shared by pages/expert.tsx and
 * pages/expert.prefetch.ts, so the server render fills exactly the query the page reads.
 * `liveSearch` is the page's debounced search box; it starts equal to the URL's search.
 */
export function expertsDirectoryQuery(searchParams: URLSearchParams, liveSearch?: string) {
  const urlSearch = searchParams.get("search") || "";
  const search = liveSearch ?? urlSearch;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const rawSort = searchParams.get("sort");
  const sortBy: ExpertSortValue = (SORT_VALUES as readonly string[]).includes(rawSort ?? "")
    ? (rawSort as ExpertSortValue)
    : "recommended";
  const minPrice = cleanPrice(searchParams.get("minPrice"));
  const maxPrice = cleanPrice(searchParams.get("maxPrice"));
  const verifiedOnly = searchParams.get("verified") === "1";
  const hasFilters = !!(minPrice || maxPrice || verifiedOnly || urlSearch);

  return {
    urlSearch,
    page,
    sortBy,
    minPrice,
    maxPrice,
    verifiedOnly,
    hasFilters,
    /** Any search, filter or non-default sort: such URLs are noindex and canonical to /expert. */
    isFiltered: hasFilters || sortBy !== "recommended",
    queryKey: ["experts", "list", search, minPrice, maxPrice, verifiedOnly, sortBy, page] as const,
    input: {
      search: search || undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      verifiedOnly: verifiedOnly || undefined,
      sortBy,
      page,
      limit: ITEMS_PER_PAGE,
    },
  };
}