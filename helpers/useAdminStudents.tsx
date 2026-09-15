import { useQuery } from "@tanstack/react-query";
import { getAdminStudentsList } from "../endpoints/admin/students/list_GET.schema";

export const ADMIN_STUDENTS_QUERY_KEY = "admin-students";

export const useAdminStudentsQuery = ({
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
    queryKey: [ADMIN_STUDENTS_QUERY_KEY, { search, page, sortBy, sortOrder }],
    queryFn: () =>
      getAdminStudentsList({
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