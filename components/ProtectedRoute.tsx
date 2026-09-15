import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../helpers/useAuth";
import { User } from "../helpers/User";
import { AuthErrorPage } from "./AuthErrorPage";
import { ShieldOff } from "lucide-react";
import { AuthLoadingState } from "./AuthLoadingState";
import styles from "./ProtectedRoute.module.css";

// Do not use this in pageLayout
const MakeProtectedRoute: (
  roles: User["role"][],
  customCheck?: ((user: User) => string | null) | null,
  options?: { checkOnboarding?: boolean }
) => React.FC<{
  children: React.ReactNode;
}> =
  (roles, customCheck, options) =>
  ({ children }) => {
    const { authState } = useAuth();
    const location = useLocation();

    // Show loading state while checking authentication
    if (authState.type === "loading") {
      return <AuthLoadingState title="Authenticating" />;
    }

    // Redirect to login if not authenticated
    if (authState.type === "unauthenticated") {
      // Construct the full path including search params
      const redirectTo = `${location.pathname}${location.search}`;
      
      // Determine if this is a teacher route based on the path
      const isTeacherRoute = location.pathname.startsWith('/teacher');
      const loginPath = isTeacherRoute ? '/teacher/login' : '/login';
      
      return <Navigate to={`${loginPath}?redirectTo=${encodeURIComponent(redirectTo)}`} replace />;
    }

    if (!roles.includes(authState.user.role)) {
      return (
        <AuthErrorPage
          title="Access Denied"
          message={`Access denied. Your role (${authState.user.role}) lacks required permissions.`}
          icon={<ShieldOff className={styles.accessDeniedIcon} size={64} />}
        />
      );
    }

    if (customCheck) {
      const errorMessage = customCheck(authState.user);
      if (errorMessage) {
        return (
          <AuthErrorPage
            title="Access Denied"
            message={errorMessage}
            icon={<ShieldOff className={styles.accessDeniedIcon} size={64} />}
          />
        );
      }
    }

    if (
      options?.checkOnboarding &&
      authState.user.role === "teacher" &&
      !authState.user.onboardingCompleted
    ) {
      return <Navigate to="/teacher/onboarding" replace />;
    }

    // Render children if authenticated
    return <>{children}</>;
  };

// Create protected routes here, then import them in pageLayout
export const AdminRoute = MakeProtectedRoute(["admin"]);
export const TeacherRoute = MakeProtectedRoute(["teacher", "admin"], null, { checkOnboarding: true });
export const TeacherRouteNoOnboardingCheck = MakeProtectedRoute(["teacher", "admin"]);
export const TeacherOwnerRoute = MakeProtectedRoute(["teacher", "admin"], (user) => {
  if (user.role === "teacher" && user.teacherRole === "manager") {
    return "This section is only accessible by account owners.";
  }
  return null;
}, { checkOnboarding: true });
export const StudentRoute = MakeProtectedRoute(["student", "admin"]);
export const AuthenticatedRoute = MakeProtectedRoute(["teacher", "student", "admin"]);
