import { db } from "./db";

/**
 * Checks if a student has access to a specific test item.
 * Access is granted if either:
 * 1. The student has purchased the mock test package containing the test item, OR
 * 2. The test item is marked as free
 * 
 * @param studentId The ID of the student.
 * @param testItemId The ID of the test item.
 * @returns A boolean indicating if the student has access to the test.
 */
export async function hasStudentAccessToTestItem(
  studentId: number,
  testItemId: number
): Promise<boolean> {
  // First check if the test item is free
  const testItem = await db
    .selectFrom("mockTestItems")
    .select("isFree")
    .where("id", "=", testItemId)
    .executeTakeFirst();

  if (!testItem) {
    return false;
  }

  // If the test is free, grant access immediately
  if (testItem.isFree) {
    return true;
  }

  // Otherwise, check if the student has an enrollment for the parent mock test package
  const enrollmentRecord = await db
    .selectFrom("mockTestItems")
    .innerJoin("mockTestEnrollments", "mockTestItems.packageId", "mockTestEnrollments.mockTestId")
    .select("mockTestEnrollments.id")
    .where("mockTestItems.id", "=", testItemId)
    .where("mockTestEnrollments.studentId", "=", studentId)
    .executeTakeFirst();

  return !!enrollmentRecord;
}