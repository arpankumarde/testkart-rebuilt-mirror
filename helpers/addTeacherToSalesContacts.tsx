import { db } from "./db";

/**
 * Backend-only helper function that adds a teacher to the sales_contacts table
 * if they don't already exist there.
 */
export async function addTeacherToSalesContacts(userId: number): Promise<void> {
  try {
    // Check if the user already exists in the sales pipeline
    const existing = await db
      .selectFrom("salesContacts")
      .select("id")
      .where("userId", "=", userId)
      .executeTakeFirst();
    
    if (!existing) {
      await db
        .insertInto("salesContacts")
        .values({
          userId,
          stage: "new",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .execute();
    }
  } catch (error) {
    // Silently fail - sales contact sync is non-critical to the main user flow
    console.error("Failed to add teacher to sales contacts:", error);
  }
}