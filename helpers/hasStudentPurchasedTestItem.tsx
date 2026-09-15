import { db } from "./db";

/**
 * Checks if a student has access to a specific test item.
 * - A live test paper is open only to students enrolled in that live test,
 *   whatever its isFree flag says. When the paper can be used is checked
 *   separately, in helpers/liveTestAttemptWindow.
 * - Any other item is open if it is marked free or the student is enrolled in
 *   the mock test package containing it.
 *
 * @param studentId The ID of the student.
 * @param testItemId The ID of the test item.
 * @returns A boolean indicating if the student has access to the test.
 */
export async function hasStudentAccessToTestItem(
  studentId: number,
  testItemId: number
): Promise<boolean> {
  const testItem = await db
    .selectFrom("mockTestItems")
    .leftJoin("liveTests", "liveTests.mockTestId", "mockTestItems.packageId")
    .select(["mockTestItems.isFree", "liveTests.id as liveTestId"])
    .where("mockTestItems.id", "=", testItemId)
    .executeTakeFirst();

  if (!testItem) {
    return false;
  }

  if (testItem.liveTestId !== null) {
    const liveTestEnrollment = await db
      .selectFrom("liveTestEnrollments")
      .select("id")
      .where("liveTestId", "=", testItem.liveTestId)
      .where("studentId", "=", studentId)
      .executeTakeFirst();

    return !!liveTestEnrollment;
  }

  if (testItem.isFree) {
    return true;
  }

  const enrollmentRecord = await db
    .selectFrom("mockTestItems")
    .innerJoin("mockTestEnrollments", "mockTestItems.packageId", "mockTestEnrollments.mockTestId")
    .select("mockTestEnrollments.id")
    .where("mockTestItems.id", "=", testItemId)
    .where("mockTestEnrollments.studentId", "=", studentId)
    .executeTakeFirst();

  return !!enrollmentRecord;
}
