/* The name an admin sees for whoever cancelled a withdrawal; an admin signed in as the user is named as such. */
export function cancelledByLabel(
  userId: number | null,
  userName: string | null,
  adminId: number | null,
  adminName: string | null
): string | null {
  if (adminId !== null) return `${adminName ?? `Admin #${adminId}`} (admin, signed in as the account)`;
  if (userId !== null) return userName || `User #${userId}`;
  return null;
}