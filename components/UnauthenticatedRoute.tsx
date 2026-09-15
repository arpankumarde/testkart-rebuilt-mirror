import React from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../helpers/useAuth";
import { validateRedirectPath } from "../helpers/validateRedirectPath";
import { getRoleHomePath } from "../helpers/roleHomePath";
import { AuthLoadingState } from "./AuthLoadingState";

/**
 * Guards the auth pages (/signup, /teacher/signup, /teacher/login) so a
 * signed-in visitor never sees a login or signup form.
 *
 * Where they go instead is role-aware: an explicit ?redirectTo= wins, so a
 * user who followed a gated link still lands where they were headed, and
 * otherwise they go to their own home. This used to be a fixed /mock-test,
 * which is why a logged-in teacher clicking "Join as a teacher" on any product
 * page ended up on the student mock-test listing.
 */
export const UnauthenticatedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { authState } = useAuth();
  const [searchParams] = useSearchParams();

  if (authState.type === "loading") {
    return <AuthLoadingState title="Checking session..." />;
  }

  if (authState.type === "authenticated") {
    const redirectTo = validateRedirectPath(searchParams.get("redirectTo"));
    return (
      <Navigate to={redirectTo ?? getRoleHomePath(authState.user)} replace />
    );
  }

  return <>{children}</>;
};
