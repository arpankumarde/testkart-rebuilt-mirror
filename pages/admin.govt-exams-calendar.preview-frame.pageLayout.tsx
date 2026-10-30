import { AdminAuthProvider } from "../helpers/useAdminAuth";
import { AdminProtectedRoute } from "../components/AdminProtectedRoute";
import { SharedLayout } from "../components/SharedLayout";

export default [AdminAuthProvider, AdminProtectedRoute, SharedLayout];