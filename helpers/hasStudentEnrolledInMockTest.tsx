import { db } from "./db";

/**
 * Checks if a student is enrolled in a specific mock test package.
 * Enrollment is a mock_test_enrollments row for the pair, however it was
 * created (purchase, free enrollment, teacher sponsorship or a manual grant).
 * @param studentId The ID of the student.
 * @param mockTestId The ID of the mock test package.
 * @returns A boolean indicating if the student is enrolled.
 */
export async function hasStudentEnrolledInMockTest(
  studentId: number,
  mockTestId: number
): Promise<boolean> {
  const enrollmentRecord = await db
    .selectFrom("mockTestEnrollments")
    .select("id")
    .where("studentId", "=", studentId)
    .where("mockTestId", "=", mockTestId)
    .executeTakeFirst();

  return !!enrollmentRecord;
}