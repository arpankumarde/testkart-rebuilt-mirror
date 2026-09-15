import { useQuery } from "@tanstack/react-query";
import { getAdminTeachersList } from "../endpoints/admin/teachers/list_GET.schema";

export const ADMIN_TEACHERS_QUERY_KEY = "admin-teachers";

export const useAdminTeachersQuery = ({
  search = "",
  page = 1,
  sortBy,
  sortOrder,
}: {
  search?: string;
  page?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) => {
  return useQuery({
    queryKey: [ADMIN_TEACHERS_QUERY_KEY, { search, page, sortBy, sortOrder }],
    queryFn: () =>
      getAdminTeachersList({
        search,
        page,
        limit: 20,
        sortBy: sortBy as any,
        sortOrder,
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
};