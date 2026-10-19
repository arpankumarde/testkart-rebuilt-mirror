import { useAuth } from "./useAuth";

/**
 * True when the signed-in teacher's publishes go live at once (admin, or the
 * owning teacher is verified), so publish buttons say "Publish" instead of
 * "Submit for review". The server decides per request; this only drives copy.
 */
export const usePublishesWithoutReview = (): boolean => {
  const { authState } = useAuth();
  return authState.type === "authenticated" && authState.user.publishesWithoutReview === true;
};
