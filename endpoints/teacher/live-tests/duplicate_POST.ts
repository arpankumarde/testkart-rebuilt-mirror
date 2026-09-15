import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { slugify } from "../../../helpers/slugify";
import { schema, OutputType } from "./duplicate_POST.schema";
import superjson from "superjson";
import { DB } from "../../../helpers/schema";
import { Transaction } from "kysely";
import { buildDuplicatedLiveTestValues } from "../../../helpers/liveTestDuplicate";

async function generateUniqueSlug(baseTitle: string, trx: Transaction<DB>): Promise<string> {
  const baseSlug = slugify(baseTitle);

  const existingTest = await trx
    .selectFrom("mockTests")
    .select("id")
    .where("slug", "=", baseSlug)
    .executeTakeFirst();

  if (!existingTest) {
    return baseSlug;
  }

  let counter = 1;
  while (true) {
    const candidateSlug = `${baseSlug}-${counter}`;
    const existing = await trx
      .selectFrom("mockTests")
      .select("id")
      .where("slug", "=", candidateSlug)
      .executeTakeFirst();

    if (!existing) {
      return candidateSlug;
    }
    counter++;
  }
}

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), {
        status: 403,
      });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Fetch the source live test and verify it exists and is ended
    const sourceLiveTest = await db
      .selectFrom("liveTests")
      .selectAll()
      .where("id", "=", input.liveTestId)
      .executeTakeFirst();

    if (!sourceLiveTest) {
      return new Response(superjson.stringify({ error: "Live test not found" }), {
        status: 404,
      });
    }

    if (sourceLiveTest.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized to duplicate this test" }), {
        status: 403,
      });
    }

    if (new Date(sourceLiveTest.endTime) >= new Date()) {
      return new Response(
        superjson.stringify({ error: "Only ended live tests can be duplicated" }),
        { status: 400 }
      );
    }

        // Perform full deep copy in a transaction
    const duplicatedLiveTest = await db.transaction().execute(async (trx) => {
      // 1. Copy Mock Test
      const sourceMockTest = await trx
        .selectFrom("mockTests")
        .selectAll()
        .where("id", "=", sourceLiveTest.mockTestId)
        .executeTakeFirstOrThrow();

      const newSlug = await generateUniqueSlug(sourceMockTest.title, trx);

      const newMockTest = await trx
        .insertInto("mockTests")
        .values({
          teacherId: sourceMockTest.teacherId,
          creatorName: sourceMockTest.creatorName,
          title: sourceMockTest.title,
          slug: newSlug,
          description: sourceMockTest.description,
          longDescription: sourceMockTest.longDescription,
          examId: sourceMockTest.examId,
          examName: sourceMockTest.examName,
          subject: sourceMockTest.subject,
          language: sourceMockTest.language,
          requirements: sourceMockTest.requirements,
          whatYouLearn: sourceMockTest.whatYouLearn,
          thumbnailUrl: sourceMockTest.thumbnailUrl,
          thumbnailFileId: sourceMockTest.thumbnailFileId,
          introVideoUrl: sourceMockTest.introVideoUrl,
          introVideoFileId: sourceMockTest.introVideoFileId,
          price: sourceMockTest.price,
          discountPrice: sourceMockTest.discountPrice,
          durationMinutes: sourceMockTest.durationMinutes,
          totalQuestions: sourceMockTest.totalQuestions,
          isFree: sourceMockTest.isFree,
          isPublished: false,
          totalTests: sourceMockTest.totalTests,
          freeTestsCount: sourceMockTest.freeTestsCount,
          studentsEnrolled: 0,
          rating: null,
          reviewsCount: 0,
          views: 0,
          wasEverPublished: false,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 2. Copy Mock Test Items
      const sourceTestItems = await trx
        .selectFrom("mockTestItems")
        .selectAll()
        .where("packageId", "=", sourceMockTest.id)
        .execute();

      for (const item of sourceTestItems) {
        const newItem = await trx
          .insertInto("mockTestItems")
          .values({
            packageId: newMockTest.id,
            orderIndex: item.orderIndex,
            title: item.title,
            description: item.description,
            subject: item.subject,
            durationMinutes: item.durationMinutes,
            totalQuestions: item.totalQuestions,
            isFree: false,
            scheduledDate: item.scheduledDate,
            calculatorEnabled: item.calculatorEnabled,
            subjectWiseTiming: item.subjectWiseTiming,
            questionWiseTiming: item.questionWiseTiming,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        // 3. Copy Test Item Subjects
        const subjectIdMap = new Map<number, number>();
        const sourceSubjects = await trx
          .selectFrom("testItemSubjects")
          .selectAll()
          .where("testItemId", "=", item.id)
          .execute();

        for (const sub of sourceSubjects) {
          const newSub = await trx
            .insertInto("testItemSubjects")
            .values({
              testItemId: newItem.id,
              subjectName: sub.subjectName,
              orderIndex: sub.orderIndex,
              durationMinutes: sub.durationMinutes,
              maxAttemptsAllowed: sub.maxAttemptsAllowed,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
          subjectIdMap.set(sub.id, newSub.id);

          // 4. Copy Subject Sections
          const sectionIdMap = new Map<number, number>();
          const sourceSections = await trx
            .selectFrom("subjectSections")
            .selectAll()
            .where("subjectId", "=", sub.id)
            .execute();

          for (const sec of sourceSections) {
            const newSec = await trx
              .insertInto("subjectSections")
              .values({
                subjectId: newSub.id,
                sectionName: sec.sectionName,
                orderIndex: sec.orderIndex,
                maxAttemptsAllowed: sec.maxAttemptsAllowed,
              })
              .returningAll()
              .executeTakeFirstOrThrow();
            sectionIdMap.set(sec.id, newSec.id);
          }

          // 5. Copy Test Questions
          const questionIdMap = new Map<number, number>();
          const sourceQuestions = await trx
            .selectFrom("testQuestions")
            .selectAll()
            .where("testId", "=", item.id)
            .where("subjectId", "=", sub.id)
            .execute();

          for (const q of sourceQuestions) {
            const newQ = await trx
              .insertInto("testQuestions")
              .values({
                testId: newItem.id,
                sourceBankQuestionId: q.sourceBankQuestionId,
                subjectId: newSub.id,
                sectionId: q.sectionId ? sectionIdMap.get(q.sectionId) ?? null : null,
                orderIndex: q.orderIndex,
                questionType: q.questionType,
                questionText: q.questionText,
                paragraphId: null, // We'll update this next to ensure referenced records exist
                paragraphText: q.paragraphText,
                optionA: q.optionA,
                optionB: q.optionB,
                optionC: q.optionC,
                optionD: q.optionD,
                correctOption: q.correctOption,
                correctOptions: q.correctOptions,
                numericalAnswer: q.numericalAnswer,
                numericalTolerance: q.numericalTolerance,
                matchData: q.matchData,
                explanation: q.explanation,
                positiveMarks: q.positiveMarks,
                negativeMarks: q.negativeMarks,
                partialMarking: q.partialMarking,
                durationSeconds: q.durationSeconds,
                markedForReview: q.markedForReview,
                isAiGenerated: q.isAiGenerated,
                aiGenerationMetadata: q.aiGenerationMetadata,
              })
              .returningAll()
              .executeTakeFirstOrThrow();
            questionIdMap.set(q.id, newQ.id);
          }

          // Update paragraphIds now that all questions for this subject are inserted
          const questionsWithParagraphs = sourceQuestions.filter((q) => q.paragraphId !== null);
          for (const q of questionsWithParagraphs) {
            const newQId = questionIdMap.get(q.id);
            const newParagraphId = questionIdMap.get(q.paragraphId!);
            if (newQId && newParagraphId) {
              await trx
                .updateTable("testQuestions")
                .set({ paragraphId: newParagraphId })
                .where("id", "=", newQId)
                .execute();
            }
          }
        }
      }

      // 6. Create the new Live Test
      const newLiveTest = await trx
        .insertInto("liveTests")
        .values(
          buildDuplicatedLiveTestValues(sourceLiveTest, newMockTest.id, {
            startTime: input.startTime,
            endTime: input.endTime,
            registrationDeadline: input.registrationDeadline,
          })
        )
        .returningAll()
        .executeTakeFirstOrThrow();

      return newLiveTest;
    });

    const output: OutputType = {
      ...duplicatedLiveTest,
      price: parseFloat(duplicatedLiveTest.price),
      totalPrizePool: parseFloat(duplicatedLiveTest.totalPrizePool),
      firstPrize: parseFloat(duplicatedLiveTest.firstPrize),
      secondPrize: parseFloat(duplicatedLiveTest.secondPrize),
      thirdPrize: parseFloat(duplicatedLiveTest.thirdPrize),
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error duplicating live test:", error);
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(superjson.stringify({ error: "An unknown error occurred" }), {
      status: 500,
    });
  }
}