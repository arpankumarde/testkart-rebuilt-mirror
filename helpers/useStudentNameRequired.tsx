import { useAuth } from "./useAuth";
import { isPlaceholderDisplayName } from "./isPlaceholderDisplayName";

/**
 * True while a signed-in student still carries a generated `User_<id>` name.
 * The web student dashboard stays locked behind RequiredNameDialog until they
 * enter a real one. Admins impersonating a student are never blocked, so they
 * cannot be pushed into renaming someone else's account.
 *
 * Web only: the mobile app reads the same session but has no such gate.
 */
export const useStudentNameRequired = (): boolean => {
  const { authState } = useAuth();
  if (authState.type !== "authenticated") return false;
  if (authState.user.role !== "student") return false;
  if (authState.impersonatorAdminId) return false;
  return isPlaceholderDisplayName(authState.user.displayName);
};