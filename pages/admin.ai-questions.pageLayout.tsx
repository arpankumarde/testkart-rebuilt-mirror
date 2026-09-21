import { AdminAuthProvider } from "../helpers/useAdminAuth";
import { AdminProtectedRoute } from "../components/AdminProtectedRoute";
import { AdminDashboardLayout } from "../components/AdminDashboardLayout";

export default [AdminAuthProvider, AdminProtectedRoute, AdminDashboardLayout];