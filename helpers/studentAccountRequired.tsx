/**
 * Student actions (buying, enrolling, consents) store the account in student-only columns, which reference
 * students since the users split (testkart/misc/USER-SPLIT-SPEC.md, Phase 5b). A teacher session that reaches one
 * of them gets this instead of a database error; teachers who want to buy sign in on the student side.
 */
export const STUDENT_ACCOUNT_REQUIRED =
  "This is for student accounts. Sign in with your student account to continue.";

export const isStudentAccount = (user: { role: string }): boolean => user.role === "student";
