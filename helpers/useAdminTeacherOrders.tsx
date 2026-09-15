import { useQuery } from "@tanstack/react-query";
import { getAdminTeacherOrders } from "../endpoints/admin/subscriptions/teacher-orders_GET.schema";

export const useAdminTeacherOrders = (teacherId: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["admin", "teacher-orders", teacherId],
    queryFn: async () => {
      return await getAdminTeacherOrders({ teacherId });
    },
    enabled: enabled && teacherId > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};