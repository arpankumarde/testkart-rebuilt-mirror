import { db } from "./db";
import { sendTemplateEmail } from "./sendTemplateEmail";

export async function sendReviewReminder(payload: {
  studentId: number;
  itemType: "test" | "course" | "digital_product";
  itemId: number;
  itemName: string;
  teacherName: string;
}) {
  try {
    const user = await db
      .selectFrom("users")
      .select(["email", "displayName"])
      .where("id", "=", payload.studentId)
      .executeTakeFirst();

    if (!user || !user.email) {
      console.log(`No email found for student ID: ${payload.studentId}. Skipping review reminder.`);
      return;
    }

    let reviewLink = "https://testkart.in";
    if (payload.itemType === "test") {
      reviewLink += "/student/tests";
    } else if (payload.itemType === "course") {
      reviewLink += "/student/courses";
    } else if (payload.itemType === "digital_product") {
      reviewLink += "/student/shop";
    }

    await sendTemplateEmail("review_reminder", user.email, {
      studentName: user.displayName,
      itemName: payload.itemName,
      teacherName: payload.teacherName,
      reviewLink,
    });

    console.log(`Review reminder sent to student ID: ${payload.studentId} for item: ${payload.itemName}`);
  } catch (error) {
    console.error(`Failed to execute sendReviewReminder for student ID: ${payload.studentId}:`, error);
  }
}