import { useAuth } from "./useAuth";
import { useBillingDetailsQuery } from "./useBillingDetails";
import { isIndianState } from "./indianLocationsData";

/**
 * True while a signed-in student or teacher has no billing state saved. The
 * web dashboards stay locked behind RequiredBillingStateDialog until one is
 * picked. Admins impersonating or editing as a user are never blocked. A
 * teacher team manager is asked for the owner's state, which is where the
 * owner's invoices read it from.
 *
 * Web only: the API does not require a state, so other clients are unaffected.
 */
export const useBillingStateRequired = (): boolean => {
  const { authState } = useAuth();
  const applies =
    authState.type === "authenticated" &&
    (authState.user.role === "student" || authState.user.role === "teacher") &&
    !authState.impersonatorAdminId;
  const { data, isSuccess } = useBillingDetailsQuery({ enabled: applies });
  if (!applies || !isSuccess) return false;
  return !isIndianState(data?.billingDetails?.state);
};