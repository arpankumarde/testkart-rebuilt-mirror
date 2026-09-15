import { useQuery } from "@tanstack/react-query";
import { getTeacherAvatars } from "../endpoints/teachers/avatars_GET.schema";

export const useTeacherAvatarsQuery = () => {
  return useQuery({
    queryKey: ["teacherAvatars"],
    queryFn: async () => {
      return await getTeacherAvatars();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
};