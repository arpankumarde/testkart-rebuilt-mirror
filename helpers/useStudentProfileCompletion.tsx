import { useMemo } from "react";
import { useAuth } from "./useAuth";

/**
 * Profile completion for the student console.
 *
 * Every task is derived from the session user alone, so the meter resolves with
 * the page and never flickers a wrong percentage while a query settles. Tasks
 * are limited to things a student can actually finish from /student/profile or
 * /verify-mobile - a checklist item with no screen behind it is a dead end.
 *
 * Shared by the sidebar badge and the dashboard card so the two cannot disagree.
 */

export interface ProfileTask {
  key: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

export interface StudentProfileCompletion {
  tasks: ProfileTask[];
  remaining: ProfileTask[];
  doneCount: number;
  total: number;
  percent: number;
  isComplete: boolean;
  /** False until the session resolves, so callers render nothing rather than a wrong 0%. */
  isReady: boolean;
}

const PROFILE_HREF = "/student/profile";

export const useStudentProfileCompletion = (): StudentProfileCompletion => {
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;

  return useMemo(() => {
    const tasks: ProfileTask[] = user
      ? [
          {
            key: "photo",
            label: "Add a profile photo",
            hint: "Upload a picture for your account.",
            href: PROFILE_HREF,
            done: Boolean(user.avatarUrl),
          },
          {
            key: "email",
            label: "Connect an email address",
            hint: "Lets you sign in with email and receive account mail.",
            href: PROFILE_HREF,
            done: Boolean(user.email),
          },
          {
            key: "mobile",
            label: "Add your mobile number",
            hint: "So we can reach you about your tests.",
            href: PROFILE_HREF,
            done: Boolean(user.mobileNumber),
          },
          {
            key: "mobileVerified",
            label: "Verify your mobile number",
            hint: "Secures your account and turns on test notifications.",
            href: user.mobileNumber ? "/verify-mobile" : PROFILE_HREF,
            done: Boolean(user.mobileVerified),
          },
        ]
      : [];

    const doneCount = tasks.filter((task) => task.done).length;
    const total = tasks.length;

    return {
      tasks,
      remaining: tasks.filter((task) => !task.done),
      doneCount,
      total,
      percent: total === 0 ? 0 : Math.round((doneCount / total) * 100),
      isComplete: total > 0 && doneCount === total,
      isReady: user !== null,
    };
  }, [user]);
};
