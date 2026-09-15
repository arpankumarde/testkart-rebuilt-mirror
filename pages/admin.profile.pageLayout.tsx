import { AdminAuthProvider } from "../helpers/useAdminAuth";
import { AdminProtectedRouteAny } from "../components/AdminProtectedRoute";
import { AdminDashboardLayout } from "../components/AdminDashboardLayout";

export default [AdminAuthProvider, AdminProtectedRouteAny, AdminDashboardLayout];
