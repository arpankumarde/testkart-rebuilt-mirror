import { db } from "./db";
import { User } from "./User";

export type LeaderboardAccessReason = "enrolled" | "attempted" | "owner" | "admin";

/**
 * Who may see a test series leaderboard. Access is checked per series, so one
 * series never opens another's rankings.
 * - "enrolled": any mock_test_enrollments row for the series, however it was
 *   created (purchase, bundle, free enrolment, sponsorship or manual grant).
 * - "attempted": at least one attempt, started or finished, on any paper of
 *   the series - including trashed papers, so earlier attempts keep access.
 * - "owner": the series' teacher or a manager on that teacher's team.
 * - "admin": admin-role accounts.
 * Returns null when none applies.
 */
export async function getTestSeriesLeaderboardAccess(
  user: Pick<User, "id" | "role" | "actingAsTeacherId">,
  mockTestId: number
): Promise<LeaderboardAccessReason | null> {
  if (user.role === "admin") return "admin";

  if (user.role === "teacher") {
    const series = await db
      .selectFrom("mockTests")
      .select("teacherId")
      .where("id", "=", mockTestId)
      .executeTakeFirst();
    if (series && series.teacherId === (user.actingAsTeacherId ?? user.id)) {
      return "owner";
    }
  }

  const enrollment = await db
    .selectFrom("mockTestEnrollments")
    .select("id")
    .where("studentId", "=", user.id)
    .where("mockTestId", "=", mockTestId)
    .executeTakeFirst();
  if (enrollment) return "enrolled";

  const attempt = await db
    .selectFrom("testAttempts")
    .innerJoin("mockTestItems", "mockTestItems.id", "testAttempts.testId")
    .select("testAttempts.id")
    .where("testAttempts.studentId", "=", user.id)
    .where("mockTestItems.packageId", "=", mockTestId)
    .executeTakeFirst();
  if (attempt) return "attempted";

  return null;
}