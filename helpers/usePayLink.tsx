import { useMutation, useQuery } from "@tanstack/react-query";
import { getPayLinkInfo } from "../endpoints/pay-link/info_GET.schema";
import { postStudentPayLink } from "../endpoints/student/pay-link_POST.schema";

export const payLinkInfoKey = (token: string) => ["payLink", "info", token] as const;

export const usePayLinkInfo = (token: string | undefined) =>
  useQuery({
    queryKey: payLinkInfoKey(token ?? ""),
    queryFn: () => getPayLinkInfo({ token: token ?? "" }),
    enabled: !!token,
    refetchOnMount: true,
    staleTime: 0,
    retry: false,
  });

export const useCreatePayLink = () =>
  useMutation({
    mutationFn: () => postStudentPayLink({}),
  });
