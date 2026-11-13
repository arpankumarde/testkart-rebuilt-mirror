import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postStudentWalletPurchase } from "../endpoints/student/wallet/purchase_POST.schema";
import { STUDENT_TCOINS_QUERY_KEY } from "./useTcoins";
import { gatePurchase, usePurchaseDetailsGate } from "./usePurchaseDetailsGate";

/**
 * A hook that exposes a React Query mutation to easily execute wallet-based cart purchases
 * from the frontend.
 */
export const useStudentWalletPurchase = () => {
  const queryClient = useQueryClient();
  const ensurePurchaseDetails = usePurchaseDetailsGate();
  return useMutation({
    mutationFn: gatePurchase(ensurePurchaseDetails, postStudentWalletPurchase),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", "items"] });
      queryClient.invalidateQueries({ queryKey: ["student", "wallet", "balance"] });
      queryClient.invalidateQueries({ queryKey: ["student", "wallet", "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["student", "enrolled-tests"] });
      queryClient.invalidateQueries({ queryKey: ["student", "courses"] });
      queryClient.invalidateQueries({ queryKey: ["student", "bundles"] });
      queryClient.invalidateQueries({ queryKey: STUDENT_TCOINS_QUERY_KEY });
    },
  });
};