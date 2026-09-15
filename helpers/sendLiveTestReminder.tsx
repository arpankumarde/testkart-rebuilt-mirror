import { db } from "./db";
import { sendTemplateEmail } from "./sendTemplateEmail";

export async function sendLiveTestReminder(payload: { liveTestId: number }) {
  try {
    const liveTest = await db
      .selectFrom("liveTests")
      .select(["title", "startTime"])
      .where("id", "=", payload.liveTestId)
      .executeTakeFirst();

    if (!liveTest) {
      console.log(`Live test ID: ${payload.liveTestId} not found. Skipping reminders.`);
      return;
    }

    const enrollments = await db
      .selectFrom("liveTestEnrollments")
      .innerJoin("users", "users.id", "liveTestEnrollments.studentId")
      .select(["users.email", "users.displayName"])
      .where("liveTestEnrollments.liveTestId", "=", payload.liveTestId)
      .execute();

    if (enrollments.length === 0) {
      console.log(`No enrollments found for live test ID: ${payload.liveTestId}.`);
      return;
    }

    const formattedDate = liveTest.startTime
      ? new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(liveTest.startTime))
      : "Upcoming";

    let successCount = 0;

    for (const student of enrollments) {
      if (!student.email) continue;

      const result = await sendTemplateEmail("live_test_reminder", student.email, {
        studentName: student.displayName,
        testName: liveTest.title,
        scheduledDate: formattedDate,
        liveTestId: String(payload.liveTestId),
      });

      if (result.success) {
        successCount++;
      }
    }

    console.log(`Live test reminder sent to ${successCount}/${enrollments.length} enrolled students for test ID: ${payload.liveTestId}`);
  } catch (error) {
    console.error(`Failed to execute sendLiveTestReminder for test ID: ${payload.liveTestId}:`, error);
  }
}