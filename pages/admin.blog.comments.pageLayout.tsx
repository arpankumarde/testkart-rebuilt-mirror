import { AdminAuthProvider } from '../helpers/useAdminAuth';
import { AdminDashboardLayout } from '../components/AdminDashboardLayout';
import { AdminProtectedRouteSiteAdmin } from '../components/AdminProtectedRoute';

export default [AdminAuthProvider, AdminProtectedRouteSiteAdmin, AdminDashboardLayout];