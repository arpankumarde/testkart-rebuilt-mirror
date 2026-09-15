import { useQuery } from "@tanstack/react-query";
import { getTeacherEarningsList } from "../endpoints/teacher/earnings/list_GET.schema";

export const TEACHER_EARNINGS_QUERY_KEY = ["teacher", "earnings"];

export const useTeacherEarningsQuery = () => {
  return useQuery({
    queryKey: TEACHER_EARNINGS_QUERY_KEY,
    queryFn: () => getTeacherEarningsList(),
    staleTime: 15 * 60 * 1000,
  });
};