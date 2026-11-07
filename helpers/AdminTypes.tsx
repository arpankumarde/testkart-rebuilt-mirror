/**
 * This helper defines shared TypeScript types for Admin users.
 * It ensures type consistency between frontend and backend code that deals with admin profiles.
 */

import type { AdminModule } from "./adminPermissions";

export interface AdminProfile {
  id: number;
  email: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'billing_manager' | 'manager';
  avatarUrl?: string | null;
  avatarFileId?: string | null;
  bio?: string | null;
  /** Modules this admin may open. Filled from the database by every session check; the JWT does not carry it. */
  permissions?: AdminModule[];
  /** Set by the session check when a super admin is signed in as this admin; never stored in the JWT's profile. */
  impersonator?: { id: number; fullName: string };
}

export type AdminRole = AdminProfile['role'];

/** Human-readable role names, shared by every admin surface that displays one. */
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  billing_manager: 'Billing Manager',
  manager: 'Manager',
};