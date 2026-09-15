import { AdminAuthProvider } from "../helpers/useAdminAuth";
import { AdminProtectedRouteFinance } from "../components/AdminProtectedRoute";
import { AdminDashboardLayout } from "../components/AdminDashboardLayout";

export default [AdminAuthProvider, AdminProtectedRouteFinance, AdminDashboardLayout];