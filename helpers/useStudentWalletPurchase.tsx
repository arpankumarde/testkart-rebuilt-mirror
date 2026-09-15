import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postStudentWalletPurchase } from "../endpoints/student/wallet/purchase_POST.schema";

/**
 * A hook that exposes a React Query mutation to easily execute wallet-based cart purchases
 * from the frontend.
 */
export const useStudentWalletPurchase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postStudentWalletPurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", "items"] });
      queryClient.invalidateQueries({ queryKey: ["student", "wallet", "balance"] });
      queryClient.invalidateQueries({ queryKey: ["student", "wallet", "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["student", "enrolled-tests"] });
      queryClient.invalidateQueries({ queryKey: ["student", "courses"] });
      queryClient.invalidateQueries({ queryKey: ["student", "bundles"] });
    },
  });
};