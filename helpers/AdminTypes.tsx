/**
 * This helper defines shared TypeScript types for Admin users.
 * It ensures type consistency between frontend and backend code that deals with admin profiles.
 */

export interface AdminProfile {
  id: number;
  email: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'billing_manager' | 'manager';
  avatarUrl?: string | null;
  avatarFileId?: string | null;
  bio?: string | null;
}

export type AdminRole = AdminProfile['role'];

/** Human-readable role names, shared by every admin surface that displays one. */
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  billing_manager: 'Billing Manager',
  manager: 'Manager',
};