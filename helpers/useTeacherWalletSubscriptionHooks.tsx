import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeacherSubscriptionPaymentInfo } from "../endpoints/teacher/subscription/payment-info_GET.schema";
import { postTeacherSubscriptionWalletSubscribe } from "../endpoints/teacher/subscription/wallet-subscribe_POST.schema";

export const useTeacherSubscriptionPaymentInfoQuery = () => {
  return useQuery({
    queryKey: ["teacher", "subscription", "payment-info"],
    queryFn: () => getTeacherSubscriptionPaymentInfo(),
  });
};

export const useTeacherWalletSubscribeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postTeacherSubscriptionWalletSubscribe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "subscription"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "wallet"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "earnings"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "earnings", "balance"] });
    },
  });
};