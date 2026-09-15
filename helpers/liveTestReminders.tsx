import { db } from "./db";
import { sendLiveTestReminder } from "./sendLiveTestReminder";

export async function liveTestReminders() {
  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const liveTests = await db
      .selectFrom("liveTests")
      .select(["id"])
      .where("isActive", "=", true)
      .where("startTime", "is not", null)
      .where("startTime", ">=", now)
      .where("startTime", "<=", oneHourFromNow)
      .execute();

    let count = 0;

    for (const test of liveTests) {
      await sendLiveTestReminder({ liveTestId: test.id });
      count++;
    }

    console.log(`Processed and sent reminders for ${count} live tests.`);
  } catch (error) {
    console.error("Failed to process live test reminders:", error);
  }
}