import { AdminAuthProvider } from '../helpers/useAdminAuth';
import { AdminDashboardLayout } from '../components/AdminDashboardLayout';
import { AdminProtectedRouteContent } from '../components/AdminProtectedRoute';

export default [AdminAuthProvider, AdminProtectedRouteContent, AdminDashboardLayout];