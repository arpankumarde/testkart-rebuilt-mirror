import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getStudentMarketingConsent } from "../endpoints/student/marketing-consent_GET.schema";
import { postStudentMarketingConsent, type InputType } from "../endpoints/student/marketing-consent_POST.schema";

export const MARKETING_CONSENT_QUERY_KEY = ["studentMarketingConsent"] as const;

export const useMarketingConsentQuery = (enabled: boolean) =>
  useQuery({
    queryKey: MARKETING_CONSENT_QUERY_KEY,
    queryFn: () => getStudentMarketingConsent(),
    enabled,
    refetchOnMount: true,
  });

export const useSaveMarketingConsentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: InputType) => postStudentMarketingConsent(body),
    onSuccess: (data) => queryClient.setQueryData(MARKETING_CONSENT_QUERY_KEY, data),
  });
};