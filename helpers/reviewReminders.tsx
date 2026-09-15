import { db } from "./db";
import { sendReviewReminder } from "./sendReviewReminder";

export async function reviewReminders() {
  try {
    const now = new Date();
    const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);

    const orderItems = await db
      .selectFrom("orderItems")
      .innerJoin("orders", "orders.id", "orderItems.orderId")
      .leftJoin("courses", "courses.id", "orderItems.courseId")
      .leftJoin("mockTests", "mockTests.id", "orderItems.mockTestId")
      .leftJoin("digitalProducts", "digitalProducts.id", "orderItems.digitalProductId")
      .leftJoin("users as courseTeacher", "courseTeacher.id", "courses.teacherId")
      .leftJoin("users as testTeacher", "testTeacher.id", "mockTests.teacherId")
      .leftJoin("users as productTeacher", "productTeacher.id", "digitalProducts.teacherId")
      .select([
        "orders.userId as studentId",
        "orderItems.courseId",
        "orderItems.mockTestId",
        "orderItems.digitalProductId",
        "courses.title as courseTitle",
        "courseTeacher.displayName as courseTeacherName",
        "mockTests.title as testTitle",
        "testTeacher.displayName as testTeacherName",
        "digitalProducts.title as productTitle",
        "productTeacher.displayName as productTeacherName",
      ])
      .where("orders.status", "=", "completed")
      .where("orders.updatedAt", ">=", twentyFiveHoursAgo)
      .where("orders.updatedAt", "<=", twentyThreeHoursAgo)
      .execute();

    let count = 0;

    for (const item of orderItems) {
      if (item.courseId && item.courseTitle && item.courseTeacherName) {
        await sendReviewReminder({
          studentId: item.studentId,
          itemType: "course",
          itemId: item.courseId,
          itemName: item.courseTitle,
          teacherName: item.courseTeacherName,
        });
        count++;
      } else if (item.mockTestId && item.testTitle && item.testTeacherName) {
        await sendReviewReminder({
          studentId: item.studentId,
          itemType: "test",
          itemId: item.mockTestId,
          itemName: item.testTitle,
          teacherName: item.testTeacherName,
        });
        count++;
      } else if (item.digitalProductId && item.productTitle && item.productTeacherName) {
        await sendReviewReminder({
          studentId: item.studentId,
          itemType: "digital_product",
          itemId: item.digitalProductId,
          itemName: item.productTitle,
          teacherName: item.productTeacherName,
        });
        count++;
      }
    }

    console.log(`Processed and sent ${count} review reminders.`);
  } catch (error) {
    console.error("Failed to process review reminders:", error);
  }
}