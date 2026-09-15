import { AdminAuthProvider } from "../helpers/useAdminAuth";
import { AdminProtectedRouteSiteAdmin } from "../components/AdminProtectedRoute";
import { AdminDashboardLayout } from "../components/AdminDashboardLayout";

export default [AdminAuthProvider, AdminProtectedRouteSiteAdmin, AdminDashboardLayout];
