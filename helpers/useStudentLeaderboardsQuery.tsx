import { useQuery } from "@tanstack/react-query";
import { getStudentLeaderboards } from "../endpoints/student/leaderboards_GET.schema";

export const STUDENT_LEADERBOARDS_QUERY_KEY = ["student", "leaderboards"] as const;

export const useStudentLeaderboardsQuery = () =>
  useQuery({
    queryKey: STUDENT_LEADERBOARDS_QUERY_KEY,
    queryFn: () => getStudentLeaderboards(),
  });