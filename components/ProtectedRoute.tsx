import React, { useEffect } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../helpers/useAuth";
import { User } from "../helpers/User";
import { AuthErrorPage } from "./AuthErrorPage";
import { Lock } from "lucide-react";
import { AuthLoadingState } from "./AuthLoadingState";
import { SharedLayout } from "./SharedLayout";
import { Button } from "./Button";
import styles from "./ProtectedRoute.module.css";

const DASHBOARD_BY_ROLE: Record<User["role"], string> = {
  student: "/student/dashboard",
  teacher: "/teacher/dashboard",
  admin: "/admin/dashboard",
};

// Protected routes are always the outermost pageLayout entry, so the page's own
// layout is never mounted here and the site header and footer appear once.
const AccessDenied: React.FC<{ message: string; role: User["role"] }> = ({ message, role }) => (
  <SharedLayout>
    <AuthErrorPage
      title="Access Denied"
      message={message}
      icon={<Lock className={styles.accessDeniedIcon} size={26} strokeWidth={2} aria-hidden="true" />}
      actions={
        <>
          <Button asChild size="lg" className={`${styles.action} ${styles.primaryAction}`}>
            <Link to={DASHBOARD_BY_ROLE[role]}>Go to my dashboard</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className={`${styles.action} ${styles.secondaryAction}`}>
            <Link to="/">Back to home</Link>
          </Button>
        </>
      }
    />
  </SharedLayout>
);

// Do not use this in pageLayout
const MakeProtectedRoute: (
  roles: User["role"][],
  customCheck?: ((user: User, pathname: string) => string | null) | null,
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
        <AccessDenied
          role={authState.user.role}
          message={`Access denied. Your role (${authState.user.role}) lacks required permissions.`}
        />
      );
    }

    if (customCheck) {
      const errorMessage = customCheck(authState.user, location.pathname);
      if (errorMessage) {
        return <AccessDenied role={authState.user.role} message={errorMessage} />;
      }
    }

    // Onboarding describes an academy of one's own; a team manager works in the owner's.
    if (
      options?.checkOnboarding &&
      authState.user.role === "teacher" &&
      authState.user.teacherRole !== "manager" &&
      !authState.user.onboardingCompleted
    ) {
      return <Navigate to="/teacher/onboarding" replace />;
    }

    // Render children if authenticated
    return <>{children}</>;
  };

// Sections a team manager may not open; they belong to the academy owner.
const TEACHER_OWNER_ONLY_PATHS = [
  "/teacher/analytics",
  "/teacher/earnings",
  "/teacher/subscription",
  "/teacher/edit-profile",
  "/teacher/settings",
  "/teacher/support",
];

const isTeacherOwnerOnlyPath = (pathname: string) =>
  TEACHER_OWNER_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

// Create protected routes here, then import them in pageLayout
export const AdminRoute = MakeProtectedRoute(["admin"]);
// Every teacher console page uses this one guard, owner-only sections included: React keeps
// the console shell (and its sidebar) mounted between pages only while each pageLayout
// starts with the same component, so a separate owner guard would rebuild it on every move.
export const TeacherRoute = MakeProtectedRoute(
  ["teacher", "admin"],
  (user, pathname) =>
    user.role === "teacher" && user.teacherRole === "manager" && isTeacherOwnerOnlyPath(pathname)
      ? "This section is only accessible by account owners."
      : null,
  { checkOnboarding: true }
);
export const TeacherRouteNoOnboardingCheck = MakeProtectedRoute(["teacher", "admin"]);
export const StudentRoute = MakeProtectedRoute(["student", "admin"]);
export const AuthenticatedRoute = MakeProtectedRoute(["teacher", "student", "admin"]);
