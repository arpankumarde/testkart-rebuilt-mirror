import { useQuery } from "@tanstack/react-query";
import { getHomepageData } from "../endpoints/homepage/data_GET.schema";

export const HOMEPAGE_DATA_QUERY_KEY = ["homepage", "data"] as const;

// Cache for 15 minutes as homepage data doesn't change that often
const STALE_TIME = 15 * 60 * 1000; 

export const useHomepageData = () => {
  return useQuery({
    queryKey: HOMEPAGE_DATA_QUERY_KEY,
    queryFn: () => getHomepageData(),
    staleTime: STALE_TIME,
    placeholderData: (previousData) => previousData,
  });
};