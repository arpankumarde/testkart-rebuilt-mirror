import { z } from "zod";
import superjson from "superjson";

/*
 * Shared by the paged admin catalogue lists (study notes, test series, courses).
 * The browser gets one page of rows plus the status tab counts; filtering,
 * search and sorting run in SQL. The full admin/<type>/list endpoints stay for
 * the admin MCP connector.
 */
export const ADMIN_CATALOGUE_PAGE_SIZE = 50;

export const catalogueListBaseSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  /* Matches the title or the teacher's name. */
  search: z.string().trim().max(200).optional(),
  id: z.coerce.number().int().positive().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export type CatalogueListPage<T, S extends string> = {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  statusCounts: Record<S | "all", number>;
};

export const fetchCatalogueListPage = async <T,>(
  path: string,
  input: Record<string, string | number | null | undefined>,
  init?: RequestInit
): Promise<T> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  const result = await fetch(query ? `${path}?${query}` : path, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<T>(await result.text());
};