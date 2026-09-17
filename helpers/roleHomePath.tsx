import type { User } from "./User";

/**
 * Where a signed-in user belongs when nothing more specific was requested.
 *
 * Used by UnauthenticatedRoute and the login pages, which each used to carry
 * their own hardcoded destination - UnauthenticatedRoute sent every signed-in
 * user to /mock-test, and the login pages fell back to the dashboard of the
 * role that page was written for. Both dropped users on a page their role
 * cannot use.
 *
 * A teacher who has not finished onboarding is sent to onboarding instead of
 * the dashboard, which is where TeacherRoute would bounce them anyway. Team
 * managers skip onboarding, since they work in the owner's academy.
 */
export const getRoleHomePath = (
  user: Pick<User, "role" | "onboardingCompleted" | "teacherRole">,
): string => {
  switch (user.role) {
    case "admin":
      return "/admin/dashboard";
    case "teacher":
      return user.onboardingCompleted || user.teacherRole === "manager"
        ? "/teacher/dashboard"
        : "/teacher/onboarding";
    case "student":
    default:
      return "/student/dashboard";
  }
};
