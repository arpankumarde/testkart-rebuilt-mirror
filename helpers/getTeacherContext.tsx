import { db } from "./db";

export type TeacherRoleContext = "owner" | "manager";

export interface TeacherContext {
  effectiveTeacherId: number;
  teacherRole: TeacherRoleContext;
}

/**
 * Resolves a teacher's effective ID and role based on their team membership.
 * If the user is an active team member, their effective ID is the account owner's teacherId
 * and their role is "manager". Otherwise, they act as their own "owner".
 */
export const getTeacherContext = async (
  userId: number
): Promise<TeacherContext> => {
  const teamMember = await db
    .selectFrom("teacherTeamMembers")
    .select(["teacherId"])
    .where("memberUserId", "=", userId)
    .where("status", "=", "active")
    .executeTakeFirst();

  if (teamMember) {
    return {
      effectiveTeacherId: teamMember.teacherId,
      teacherRole: "manager" as const,
    };
  }

  return {
    effectiveTeacherId: userId,
    teacherRole: "owner" as const,
  };
};

/**
 * Validates that the provided role is 'owner'.
 * Throws an error if the role is anything else.
 */
export const requireOwnerRole = (teacherRole: TeacherRoleContext): void => {
  if (teacherRole !== "owner") {
    throw new Error("Only account owners can access this feature");
  }
};