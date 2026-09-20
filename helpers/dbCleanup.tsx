import { db } from "./db";
import { sql } from "kysely";
import { syncMockTestAggregates } from "./syncMockTestAggregates";
import { deleteFromR2 } from "./r2Client";
import { releaseGumletAssets } from "./syncLessonVideoToGumlet";

export async function dbCleanup(): Promise<void> {
  console.log("Starting database cleanup job...");

  try {
    const now = new Date();

    // 1. Delete expired sessions
    const deletedSessions = await db
      .deleteFrom("sessions")
      .where("expiresAt", "<", now)
      .executeTakeFirst();

    console.log(`Deleted ${deletedSessions.numDeletedRows} expired sessions.`);

    // 2. Delete old OTPs (older than 24 hours)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const deletedOtps = await db
      .deleteFrom("mobileOtps")
      .where("expiresAt", "<", yesterday)
      .executeTakeFirst();

        console.log(`Deleted ${deletedOtps.numDeletedRows} old mobile OTPs.`);

    // 2b. Delete old email OTPs (older than 24 hours)
    const deletedEmailOtps = await db
      .deleteFrom("emailOtps")
      .where("expiresAt", "<", yesterday)
      .executeTakeFirst();

    console.log(`Deleted ${deletedEmailOtps.numDeletedRows} old email OTPs.`);

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 2c. Delete abandoned mock test drafts.
    // Matches both the legacy literal placeholder title and the newer
    // content-derived fallback ("<teacher>'s Practice Mock Test Package -
    // Draft <date>") used by create-with-items_POST.ts when a teacher never
    // set a title.
    const abandonedMockTests = await db
      .selectFrom("mockTests")
      .select(["id", "thumbnailFileId"])
      .where((eb) =>
        eb.or([
          eb("title", "=", "Untitled Test Package"),
          eb("title", "like", "%Practice Mock Test Package - Draft %"),
        ])
      )
      .where("isPublished", "=", false)
      .where("createdAt", "<", sevenDaysAgo)
      .where("deletedAt", "is", null)
      .execute();

    let deletedAbandonedMockTestsCount = 0;

    for (const mt of abandonedMockTests) {
      const hasOrders = await db
        .selectFrom("orderItems")
        .select("id")
        .where("mockTestId", "=", mt.id)
        .limit(1)
        .executeTakeFirst();

      if (hasOrders) continue;

      await db.transaction().execute(async (trx) => {
        const items = await trx
          .selectFrom("mockTestItems")
          .select(["id"])
          .where("packageId", "=", mt.id)
          .execute();

        const itemIds = items.map((i) => i.id);

        if (itemIds.length > 0) {
          const subjects = await trx
            .selectFrom("testItemSubjects")
            .select(["id"])
            .where("testItemId", "in", itemIds)
            .execute();

          const subjectIds = subjects.map((s) => s.id);

          if (subjectIds.length > 0) {
            await trx
              .deleteFrom("subjectSections")
              .where("subjectId", "in", subjectIds)
              .execute();
          }

          await trx
            .deleteFrom("testItemSubjects")
            .where("testItemId", "in", itemIds)
            .execute();

          await trx
            .deleteFrom("testQuestions")
            .where("testId", "in", itemIds)
            .execute();

          await trx
            .deleteFrom("mockTestItems")
            .where("packageId", "=", mt.id)
            .execute();
        }

        await trx
          .deleteFrom("cartItems")
          .where("mockTestId", "=", mt.id)
          .execute();

        await trx
          .deleteFrom("questionBank")
          .where("sourceMockTestId", "=", mt.id)
          .execute();

        await trx
          .deleteFrom("mockTests")
          .where("id", "=", mt.id)
          .execute();
      });

      if (mt.thumbnailFileId) {
        await deleteFromR2(mt.thumbnailFileId);
      }
      deletedAbandonedMockTestsCount++;
    }
    console.log(`[Cleanup] Permanently deleted ${deletedAbandonedMockTestsCount} abandoned mock test drafts older than 7 days.`);

    // 2d. Delete abandoned course drafts
    const abandonedCourses = await db
      .selectFrom("courses")
      .select(["id"])
      .where("title", "=", "Untitled Course")
      .where("status", "=", "draft")
      .where("createdAt", "<", sevenDaysAgo)
      .execute();

    let deletedAbandonedCoursesCount = 0;

    for (const course of abandonedCourses) {
      const hasOrders = await db
        .selectFrom("orderItems")
        .select("id")
        .where("courseId", "=", course.id)
        .limit(1)
        .executeTakeFirst();

      const hasEnrollments = await db
        .selectFrom("courseEnrollments")
        .select("id")
        .where("courseId", "=", course.id)
        .limit(1)
        .executeTakeFirst();

      if (hasOrders || hasEnrollments) continue;

      const gumletAssetIds = await db.transaction().execute(async (trx) => {
        const sections = await trx
          .selectFrom("courseSections")
          .select(["id"])
          .where("courseId", "=", course.id)
          .execute();

        const sectionIds = sections.map((s) => s.id);
        let lessonAssetIds: Array<string | null> = [];

        if (sectionIds.length > 0) {
          const lessons = await trx
            .selectFrom("courseLessons")
            .select("gumletAssetId")
            .where("sectionId", "in", sectionIds)
            .execute();
          lessonAssetIds = lessons.map((l) => l.gumletAssetId);

          await trx
            .deleteFrom("courseLessons")
            .where("sectionId", "in", sectionIds)
            .execute();

          await trx
            .deleteFrom("courseSections")
            .where("courseId", "=", course.id)
            .execute();
        }

        await trx
          .deleteFrom("courseMedia")
          .where("courseId", "=", course.id)
          .execute();

        await trx
          .deleteFrom("cartItems")
          .where("courseId", "=", course.id)
          .execute();

        await trx
          .deleteFrom("courses")
          .where("id", "=", course.id)
          .execute();

        return lessonAssetIds;
      });

      await releaseGumletAssets(gumletAssetIds);
      deletedAbandonedCoursesCount++;
    }
    console.log(`[Cleanup] Permanently deleted ${deletedAbandonedCoursesCount} abandoned course drafts older than 7 days.`);

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 2e. Delete trashed test items > 30 days
    const oldTrashedItems = await db
      .selectFrom("mockTestItems")
      .select(["id", "packageId"])
      .where("deletedAt", "is not", null)
      .where("deletedAt", "<", thirtyDaysAgo)
      .execute();

    let deletedItemsCount = 0;
    const affectedPackages = new Set<number>();

    for (const item of oldTrashedItems) {
      await db.transaction().execute(async (trx) => {
        const subjects = await trx
          .selectFrom("testItemSubjects")
          .select(["id"])
          .where("testItemId", "=", item.id)
          .execute();
        
        const subjectIds = subjects.map((s) => s.id);

        if (subjectIds.length > 0) {
          await trx
            .deleteFrom("subjectSections")
            .where("subjectId", "in", subjectIds)
            .execute();
        }

        await trx
          .deleteFrom("testItemSubjects")
          .where("testItemId", "=", item.id)
          .execute();

        await trx
          .deleteFrom("testQuestions")
          .where("testId", "=", item.id)
          .execute();

        await trx
          .deleteFrom("questionBank")
          .where("sourceTestItemId", "=", item.id)
          .execute();

        await trx
          .deleteFrom("mockTestItems")
          .where("id", "=", item.id)
          .execute();
      });
      deletedItemsCount++;
      affectedPackages.add(item.packageId);
    }

    for (const packageId of affectedPackages) {
      await syncMockTestAggregates(packageId);
    }
    console.log(`[Cleanup] Permanently deleted ${deletedItemsCount} trashed test items older than 30 days.`);

    // 2f. Delete trashed mock tests > 30 days
    const oldTrashedMockTests = await db
      .selectFrom("mockTests")
      .select(["id", "thumbnailFileId"])
      .where("deletedAt", "is not", null)
      .where("deletedAt", "<", thirtyDaysAgo)
      .execute();

    let deletedMockTestsCount = 0;

    for (const mt of oldTrashedMockTests) {
      await db.transaction().execute(async (trx) => {
        const items = await trx
          .selectFrom("mockTestItems")
          .select(["id"])
          .where("packageId", "=", mt.id)
          .execute();
        
        const itemIds = items.map((i) => i.id);

        if (itemIds.length > 0) {
          const subjects = await trx
            .selectFrom("testItemSubjects")
            .select(["id"])
            .where("testItemId", "in", itemIds)
            .execute();
          
          const subjectIds = subjects.map((s) => s.id);

          if (subjectIds.length > 0) {
            await trx
              .deleteFrom("subjectSections")
              .where("subjectId", "in", subjectIds)
              .execute();
          }

          await trx
            .deleteFrom("testItemSubjects")
            .where("testItemId", "in", itemIds)
            .execute();

          await trx
            .deleteFrom("testQuestions")
            .where("testId", "in", itemIds)
            .execute();

          await trx
            .deleteFrom("mockTestItems")
            .where("packageId", "=", mt.id)
            .execute();
        }

        await trx
          .deleteFrom("cartItems")
          .where("mockTestId", "=", mt.id)
          .execute();

        await trx
          .deleteFrom("questionBank")
          .where("sourceMockTestId", "=", mt.id)
          .execute();

        await trx
          .deleteFrom("mockTests")
          .where("id", "=", mt.id)
          .execute();
      });

      if (mt.thumbnailFileId) {
        await deleteFromR2(mt.thumbnailFileId);
      }
      deletedMockTestsCount++;
    }
    console.log(`[Cleanup] Permanently deleted ${deletedMockTestsCount} trashed mock tests older than 30 days.`);

    // 3. Run VACUUM on high-churn tables to reclaim dead tuples
    console.log("Running VACUUM on high-churn tables...");
    
    await sql`VACUUM mock_tests`.execute(db);
    await sql`VACUUM question_bank`.execute(db);
    await sql`VACUUM test_questions`.execute(db);
    await sql`VACUUM sessions`.execute(db);
        await sql`VACUUM mobile_otps`.execute(db);
    await sql`VACUUM email_otps`.execute(db);
    await sql`VACUUM orders`.execute(db);
    await sql`VACUUM users`.execute(db);
    await sql`VACUUM teacher_bank_details`.execute(db);
    await sql`VACUUM student_bank_details`.execute(db);
    await sql`VACUUM content_reviews`.execute(db);
    await sql`VACUUM pdf_recovery_jobs`.execute(db);

    console.log("Database cleanup job completed successfully.");
  } catch (error) {
    console.error("Database cleanup job failed:", error);
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
}