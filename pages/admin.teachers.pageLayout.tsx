import { AdminAuthProvider } from "../helpers/useAdminAuth";
import { AdminProtectedRouteContent } from "../components/AdminProtectedRoute";
import { AdminDashboardLayout } from "../components/AdminDashboardLayout";

export default [AdminAuthProvider, AdminProtectedRouteContent, AdminDashboardLayout];