import { useQuery } from "@tanstack/react-query";
import {
  getTeacherPromoCodesList,
  InputType as TeacherPromoCodesListInput,
} from "../endpoints/teacher/promo-codes/list_GET.schema";

export const TEACHER_PROMO_CODES_QUERY_KEY = ["teacher", "promo-codes"];

/**
 * A React Query hook to fetch the list of promo codes for the logged-in teacher.
 *
 * @param params - Optional parameters for pagination and filtering by status.
 *   - `page`: The page number to fetch.
 *   - `limit`: The number of items per page.
 *   - `status`: Filter by 'active', 'scheduled', or 'expired'.
 * @returns The React Query result object, with data containing `{ promoCodes, total }`.
 */
export const useTeacherPromoCodesQuery = (
  params: TeacherPromoCodesListInput
) => {
  return useQuery({
    queryKey: [...TEACHER_PROMO_CODES_QUERY_KEY, params],
    queryFn: () => getTeacherPromoCodesList(params),
    placeholderData: (previousData) => previousData,
  });
};