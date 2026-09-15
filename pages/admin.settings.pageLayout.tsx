import { AdminAuthProvider } from "../helpers/useAdminAuth";
import { AdminProtectedRouteSuperAdmin } from "../components/AdminProtectedRoute";
import { AdminDashboardLayout } from "../components/AdminDashboardLayout";

export default [AdminAuthProvider, AdminProtectedRouteSuperAdmin, AdminDashboardLayout];