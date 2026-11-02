import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSponsoredEnrollmentsList } from "../endpoints/teacher/sponsor-student/list_GET.schema";
import { getTeacherBalance } from "../endpoints/teacher/earnings/balance_GET.schema";
import { checkSponsorStudent } from "../endpoints/teacher/sponsor-student/check_POST.schema";
import { postSponsorStudentEnroll } from "../endpoints/teacher/sponsor-student/enroll_POST.schema";
import type { InputType as EnrollInputType } from "../endpoints/teacher/sponsor-student/enroll_POST.schema";

export const TEACHER_EARNINGS_BALANCE_QUERY_KEY = ["teacher", "earnings", "balance"];
export const TEACHER_SPONSOR_CHECK_QUERY_KEY = ["teacher", "sponsor", "check"];
export const TEACHER_SPONSORED_LIST_QUERY_KEY = ["teacher", "sponsor", "list"];

export const useEarningsBalance = () => {
  return useQuery({
    queryKey: TEACHER_EARNINGS_BALANCE_QUERY_KEY,
    queryFn: () => getTeacherBalance(),
    staleTime: 15 * 60 * 1000,
  });
};

/**
 * One lookup per Check press: `requestId` changes on every press and on every account pick,
 * so the dialog only ever shows the response for the request it last made.
 */
export const useSponsorCheck = (
  identifier: string,
  contentId: number | null,
  contentType: "test" | "course" | "product" | "bundle",
  enabled = true,
  requestId = 0,
  studentUserId?: number
) => {
  return useQuery({
    queryKey: [...TEACHER_SPONSOR_CHECK_QUERY_KEY, identifier, contentType, contentId, requestId, studentUserId ?? 0],
    queryFn: () => checkSponsorStudent({ identifier, contentId: contentId!, contentType, studentUserId }),
    enabled: identifier.length >= 3 && !!contentId && enabled,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
};

export const useSponsorEnroll = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EnrollInputType) => postSponsorStudentEnroll(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_EARNINGS_BALANCE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_SPONSORED_LIST_QUERY_KEY });
    },
  });
};

export const useSponsoredList = () => {
  return useQuery({
    queryKey: TEACHER_SPONSORED_LIST_QUERY_KEY,
    queryFn: () => getSponsoredEnrollmentsList(),
    staleTime: 15 * 60 * 1000,
  });
};