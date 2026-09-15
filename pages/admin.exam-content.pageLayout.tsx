import { AdminDashboardLayout } from '../components/AdminDashboardLayout';
import { AdminProtectedRouteContent } from '../components/AdminProtectedRoute';
import { AdminAuthProvider } from '../helpers/useAdminAuth';

export default [AdminAuthProvider, AdminProtectedRouteContent, AdminDashboardLayout];