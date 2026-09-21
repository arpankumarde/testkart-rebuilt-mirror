import { AdminAuthProvider } from '../helpers/useAdminAuth';
import { AdminDashboardLayout } from '../components/AdminDashboardLayout';
import { AdminProtectedRoute } from '../components/AdminProtectedRoute';

export default [AdminAuthProvider, AdminProtectedRoute, AdminDashboardLayout];