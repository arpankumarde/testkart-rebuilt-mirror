import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { AdminRole } from "../helpers/AdminTypes";
import { Skeleton } from "./Skeleton";
import styles from "./AdminProtectedRoute.module.css";

export const AdminProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: AdminRole[];
}> = ({ children, allowedRoles }) => {
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

  if (
    allowedRoles &&
    !allowedRoles.includes(authState.admin.role)
  ) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
};

// Any authenticated admin, regardless of role — used for self-service pages
// like the admin's own profile settings.
export const AdminProtectedRouteAny: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AdminProtectedRoute>
    {children}
  </AdminProtectedRoute>
);

export const AdminProtectedRouteFinance: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AdminProtectedRoute allowedRoles={['super_admin', 'admin', 'billing_manager']}>
    {children}
  </AdminProtectedRoute>
);

export const AdminProtectedRouteContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AdminProtectedRoute allowedRoles={['super_admin', 'admin', 'manager']}>
    {children}
  </AdminProtectedRoute>
);

export const AdminProtectedRouteSiteAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AdminProtectedRoute allowedRoles={['super_admin', 'admin']}>
    {children}
  </AdminProtectedRoute>
);

export const AdminProtectedRouteSuperAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AdminProtectedRoute allowedRoles={['super_admin']}>
    {children}
  </AdminProtectedRoute>
);