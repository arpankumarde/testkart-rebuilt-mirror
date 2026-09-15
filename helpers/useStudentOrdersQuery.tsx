import { useQuery } from "@tanstack/react-query";
import { getOrdersList } from "../endpoints/orders/list_GET.schema";

export const STUDENT_ORDERS_QUERY_KEY = ["student", "orders"] as const;

export const useStudentOrdersQuery = () => {
  return useQuery({
    queryKey: STUDENT_ORDERS_QUERY_KEY,
    queryFn: () => getOrdersList(),
    staleTime: 10 * 60 * 1000,
  });
};