// Client-safe exam focus types and limits. Server reads and writes live in helpers/examFocus.

import type { User } from "./User";

export const MAX_EXAM_FOCUS = 5;

export type ExamFocusItem = {
  id: number;
  examName: string;
  examSlug: string;
};

// Students and academy owners past onboarding with no focus get the exam step in
// MissingContactInfoDialog; an admin impersonating is never asked.
export function isExamFocusPromptDue(args: {
  user: Pick<User, "role" | "teacherRole" | "onboardingCompleted">;
  focusCount: number;
  impersonated: boolean;
}): boolean {
  const { user, focusCount, impersonated } = args;
  if (impersonated || focusCount > 0) return false;
  if (user.role === "teacher") {
    return user.teacherRole !== "manager" && user.onboardingCompleted === true;
  }
  return user.role === "student";
}