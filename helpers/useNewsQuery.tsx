import { useQuery } from "@tanstack/react-query";
import { getNewsList } from "../endpoints/news/list_GET.schema";
import { getNewsDetails } from "../endpoints/news/details_GET.schema";

export const NEWS_LIST_QUERY_KEY = ["news", "list"] as const;

export const useNewsListQuery = () => {
  return useQuery({
    queryKey: NEWS_LIST_QUERY_KEY,
    queryFn: () => getNewsList(),
  });
};

export const useNewsDetailsQuery = (slug: string) => {
  return useQuery({
    queryKey: ["news", "details", slug] as const,
    queryFn: () => getNewsDetails({ slug }),
    enabled: !!slug,
  });
};
