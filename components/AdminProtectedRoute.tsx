import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { adminNavigation } from "../helpers/adminNavigation";
import { Skeleton } from "./Skeleton";
import styles from "./AdminProtectedRoute.module.css";

/**
 * Signed-in admins only, and only on pages their modules open (helpers/adminPermissions, matched
 * on the current path through helpers/adminNavigation). Anyone else goes to their first allowed page.
 */
export const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState } = useAdminAuth();
  const location = useLocation();

  if (authState.type === "loading") {
    return (
      <div className={styles.loadingContainer}>
        <Skeleton className={styles.skeleton} />
        <Skeleton className={styles.skeleton} style={{ width: "80%" }} />
        <Skeleton className={styles.skeleton} style={{ width: "60%" }} />
      </div>
    );
  }

  if (authState.type === "unauthenticated") {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  const permissions = authState.admin.permissions ?? [];
  if (!adminNavigation.canOpen(location.pathname, permissions)) {
    const home = adminNavigation.homeHref(permissions);
    if (home !== location.pathname) return <Navigate to={home} replace />;
  }

  return <>{children}</>;
};
