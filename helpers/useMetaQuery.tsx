import { useQuery } from "@tanstack/react-query";
import { getMeta } from "../endpoints/meta_GET.schema";

/**
 * A React Query hook to fetch specific meta fields from the database.
 * 
 * @param fields An array of field names to fetch (e.g., ["minversion", "version"])
 */
export function useMetaQuery(fields: string[]) {
  return useQuery({
    queryKey: ["meta", ...fields],
    queryFn: async () => {
      if (fields.length === 0) return {};
      return await getMeta({ fields: fields.join(",") });
    },
    // Only run the query if there are fields to fetch
    enabled: fields.length > 0,
    // Meta data rarely changes, so we can keep it fresh for a longer period
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}