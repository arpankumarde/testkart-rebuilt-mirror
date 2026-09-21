import { AdminDashboardLayout } from '../components/AdminDashboardLayout';
import { AdminProtectedRoute } from '../components/AdminProtectedRoute';
import { AdminAuthProvider } from '../helpers/useAdminAuth';

export default [AdminAuthProvider, AdminProtectedRoute, AdminDashboardLayout];